-- Write-side RPCs. Everything multi-table runs inside one function so it is one
-- transaction; all of them are SECURITY INVOKER so RLS still applies.

-- PRD §4.4: one tap marks the currently open day. The server picks the date so
-- the client cannot write to a locked day by sending its own.
create or replace function public.set_log_status(p_group_id uuid, p_status text default 'done')
returns public.habit_logs
language plpgsql
as $$
declare
  v_group public.habit_groups;
  v_date date;
  v_row public.habit_logs;
begin
  select * into v_group
  from public.habit_groups
  where id = p_group_id and user_id = auth.uid() and deleted_at is null;

  if v_group.id is null then
    raise exception 'group not found' using errcode = 'no_data_found';
  end if;
  if p_status not in ('done', 'missed') then
    raise exception 'invalid status %', p_status using errcode = 'check_violation';
  end if;

  v_date := public.active_date(public.user_timezone(v_group.user_id));

  insert into public.habit_logs (user_id, group_id, log_date, status)
  values (v_group.user_id, p_group_id, v_date, p_status)
  on conflict (group_id, log_date) where deleted_at is null
  do update set status = excluded.status, deleted_at = null
  returning * into v_row;

  return v_row;
end;
$$;

-- Untick: soft delete today's log so the identity point is given back.
create or replace function public.clear_log(p_group_id uuid)
returns void
language plpgsql
as $$
declare
  v_date date;
begin
  select public.active_date(public.user_timezone(auth.uid())) into v_date;

  update public.habit_logs
  set deleted_at = now()
  where group_id = p_group_id
    and user_id = auth.uid()
    and log_date = v_date
    and deleted_at is null;
end;
$$;

-- PRD §4.8: mastered folds the group into the permanent routine schema, which
-- then becomes context for placing the next habit.
create or replace function public.mark_group_mastered(p_group_id uuid, p_force boolean default false)
returns public.habit_groups
language plpgsql
as $$
declare
  v_group public.habit_groups;
  v_gates jsonb;
begin
  select * into v_group
  from public.habit_groups
  where id = p_group_id and user_id = auth.uid() and deleted_at is null
  for update;

  if v_group.id is null then
    raise exception 'group not found' using errcode = 'no_data_found';
  end if;
  if v_group.status = 'mastered' then
    return v_group;
  end if;

  v_gates := public.evaluate_gates(p_group_id);
  if not p_force and not (v_gates ->> 'all_passed')::boolean then
    raise exception 'gates not met: %', v_gates using errcode = 'check_violation';
  end if;

  update public.habit_groups
  set status = 'mastered',
      mastered_at = now(),
      mastery_offer_declined_at = null,
      last_checkin_at = now()
  where id = p_group_id
  returning * into v_group;

  insert into public.routine_blocks (user_id, label, start_time, end_time, source, source_group_id)
  values (v_group.user_id, v_group.name, v_group.start_time, v_group.end_time, 'mastered_group', v_group.id);

  insert into public.habit_lifecycle_events (user_id, group_id, type, note)
  values (v_group.user_id, v_group.id, 'mastered',
          case when p_force then 'manual before gates' else null end);

  return v_group;
end;
$$;

create or replace function public.decline_mastery_offer(p_group_id uuid)
returns void
language plpgsql
as $$
begin
  update public.habit_groups
  set mastery_offer_declined_at = now()
  where id = p_group_id and user_id = auth.uid() and deleted_at is null;

  if not found then
    raise exception 'group not found' using errcode = 'no_data_found';
  end if;

  insert into public.habit_lifecycle_events (user_id, group_id, type)
  values (auth.uid(), p_group_id, 'offer_declined');
end;
$$;

-- Reactivation starts a fresh cycle: gate progress is measured from now, and the
-- routine block written at mastery is retired. No failure framing anywhere.
create or replace function public.reactivate_group(p_group_id uuid)
returns public.habit_groups
language plpgsql
as $$
declare
  v_group public.habit_groups;
begin
  update public.habit_groups
  set status = 'building',
      mastered_at = null,
      last_reactivated_at = now(),
      mastery_offer_declined_at = null,
      last_checkin_at = null
  where id = p_group_id and user_id = auth.uid() and deleted_at is null
  returning * into v_group;

  if v_group.id is null then
    raise exception 'group not found' using errcode = 'no_data_found';
  end if;

  update public.routine_blocks
  set deleted_at = now()
  where source_group_id = p_group_id and user_id = auth.uid() and deleted_at is null;

  insert into public.habit_lifecycle_events (user_id, group_id, type)
  values (v_group.user_id, v_group.id, 'reactivated');

  return v_group;
end;
$$;

create or replace function public.checkin_group(p_group_id uuid, p_still_running boolean)
returns public.habit_groups
language plpgsql
as $$
declare
  v_group public.habit_groups;
begin
  if not p_still_running then
    return public.reactivate_group(p_group_id);
  end if;

  update public.habit_groups
  set last_checkin_at = now()
  where id = p_group_id and user_id = auth.uid() and deleted_at is null
  returning * into v_group;

  if v_group.id is null then
    raise exception 'group not found' using errcode = 'no_data_found';
  end if;

  insert into public.habit_lifecycle_events (user_id, group_id, type)
  values (v_group.user_id, v_group.id, 'checked_in');

  return v_group;
end;
$$;

-- PRD §4.8: soft cap is a nudge, so this only reports the count. No block.
create or replace function public.building_group_count()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.habit_groups
  where user_id = auth.uid() and deleted_at is null and status = 'building';
$$;

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------

-- Without this, the consistency gate would only ever see completed days and the
-- rate would be a meaningless 100%. Runs after every user's grace window closes.
create or replace function public.fill_missed_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_rows integer;
  r record;
begin
  perform set_config('app.bypass_grace', 'on', true);

  for r in
    select g.id as group_id,
           g.user_id,
           g.days,
           public.group_cycle_start(g) as cycle_start,
           (public.active_date(public.user_timezone(g.user_id)) - 1) as target_date
    from public.habit_groups g
    where g.deleted_at is null and g.status = 'building'
  loop
    -- Only days the group was actually scheduled for count against it.
    continue when not (extract(dow from r.target_date)::smallint = any(r.days));
    continue when r.target_date < r.cycle_start;

    insert into public.habit_logs (user_id, group_id, log_date, status)
    select r.user_id, r.group_id, r.target_date, 'missed'
    where not exists (
      select 1 from public.habit_logs
      where group_id = r.group_id and log_date = r.target_date and deleted_at is null
    );

    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.expire_ai_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.ai_response_cache where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- pg_cron is optional locally; skip silently when the extension is unavailable.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('fill-missed-logs', '30 * * * *', 'select public.fill_missed_logs()');
    perform cron.schedule('expire-ai-cache', '0 * * * *', 'select public.expire_ai_cache()');
  end if;
exception
  when others then
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
