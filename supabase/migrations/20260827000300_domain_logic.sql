-- Domain logic that must not live in the client: grace period, identity points,
-- and the deterministic mastery gates (PRD §4.4, §4.6, §4.8 — no LLM here).

-- ---------------------------------------------------------------------------
-- Grace period (PRD §4.4)
-- ---------------------------------------------------------------------------

-- A log may only be written for the currently open day. Past days are locked so
-- streaks cannot be edited retroactively. The nightly filler job bypasses this
-- with a transaction-local flag.
create or replace function public.enforce_log_grace_period()
returns trigger
language plpgsql
as $$
declare
  v_row public.habit_logs;
  v_today date;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if coalesce(current_setting('app.bypass_grace', true), 'off') = 'on' then
    return v_row;
  end if;

  v_today := public.active_date(public.user_timezone(v_row.user_id));

  if v_row.log_date > v_today then
    raise exception 'cannot log a future day (% > %)', v_row.log_date, v_today
      using errcode = 'check_violation';
  end if;

  if v_row.log_date < v_today then
    raise exception 'day % is locked; edits close at 03:00 the next morning', v_row.log_date
      using errcode = 'check_violation';
  end if;

  return v_row;
end;
$$;

create trigger trg_habit_logs_grace
  before insert or update or delete on public.habit_logs
  for each row execute function public.enforce_log_grace_period();

-- ---------------------------------------------------------------------------
-- Identity points (PRD §4.6) — one vote per group per day, never below zero.
-- ---------------------------------------------------------------------------

create or replace function public.log_points_contribution(p_log public.habit_logs)
returns integer
language sql
stable
as $$
  select case
    when p_log.id is null then 0
    when p_log.deleted_at is not null then 0
    when p_log.status <> 'done' then 0
    when (select identity_tag_id from public.habit_groups where id = p_log.group_id) is null then 0
    else 1
  end;
$$;

create or replace function public.apply_identity_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer := 0;
  v_new integer := 0;
  v_group_id uuid;
  v_tag uuid;
begin
  if tg_op = 'DELETE' then
    v_old := public.log_points_contribution(old);
    v_group_id := old.group_id;
  elsif tg_op = 'INSERT' then
    v_new := public.log_points_contribution(new);
    v_group_id := new.group_id;
  else
    v_old := public.log_points_contribution(old);
    v_new := public.log_points_contribution(new);
    v_group_id := new.group_id;
  end if;

  if v_new = v_old then
    return coalesce(new, old);
  end if;

  select identity_tag_id into v_tag
  from public.habit_groups
  where id = v_group_id;

  if v_tag is null then
    return coalesce(new, old);
  end if;

  -- Atomic SQL arithmetic, not read-modify-write.
  update public.identity_tags
  set points = greatest(0, points + (v_new - v_old))
  where id = v_tag;

  return coalesce(new, old);
end;
$$;

create trigger trg_habit_logs_points
  after insert or update or delete on public.habit_logs
  for each row execute function public.apply_identity_points();

-- Repair / re-point after a group's identity tag changes.
create or replace function public.recalculate_identity_points(p_user_id uuid default auth.uid())
returns void
language sql
security definer
set search_path = public
as $$
  update public.identity_tags t
  set points = coalesce((
    select count(*)
    from public.habit_logs l
    join public.habit_groups g on g.id = l.group_id
    where g.identity_tag_id = t.id
      and l.status = 'done'
      and l.deleted_at is null
      and g.deleted_at is null
  ), 0)
  where t.user_id = p_user_id
    and t.deleted_at is null;
$$;

create or replace function public.retag_group_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.identity_tag_id is distinct from old.identity_tag_id then
    perform public.recalculate_identity_points(new.user_id);
  end if;
  return new;
end;
$$;

create trigger trg_habit_groups_retag
  after update of identity_tag_id on public.habit_groups
  for each row execute function public.retag_group_points();

-- ---------------------------------------------------------------------------
-- Mastery gates (PRD §4.8) — deterministic, three gates, all must pass.
-- ---------------------------------------------------------------------------

create or replace function public.gate_points_target() returns integer language sql immutable as $$ select 40 $$;
create or replace function public.gate_consistency_target() returns numeric language sql immutable as $$ select 0.80 $$;
create or replace function public.gate_min_days_target() returns integer language sql immutable as $$ select 21 $$;
create or replace function public.consistency_window_days() returns integer language sql immutable as $$ select 30 $$;
create or replace function public.soft_cap_building_groups() returns integer language sql immutable as $$ select 3 $$;

-- Progress is measured from the reactivation point, not from group creation, so
-- a restarted cycle is evaluated on its own evidence.
create or replace function public.group_cycle_start(p_group public.habit_groups)
returns date
language sql
stable
as $$
  select (coalesce(p_group.last_reactivated_at, p_group.created_at)
          at time zone public.user_timezone(p_group.user_id))::date;
$$;

create or replace function public.group_completion_rate(p_group_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_group public.habit_groups;
  v_start date;
  v_total integer;
  v_done integer;
begin
  select * into v_group from public.habit_groups where id = p_group_id;
  if v_group.id is null then
    return 0;
  end if;

  v_start := greatest(
    public.group_cycle_start(v_group),
    public.active_date(public.user_timezone(v_group.user_id)) - public.consistency_window_days()
  );

  select count(*), count(*) filter (where status = 'done')
  into v_total, v_done
  from public.habit_logs
  where group_id = p_group_id
    and deleted_at is null
    and log_date >= v_start;

  if coalesce(v_total, 0) = 0 then
    return 0;
  end if;
  return v_done::numeric / v_total::numeric;
end;
$$;

create or replace function public.evaluate_gates(p_group_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_group public.habit_groups;
  v_points integer := 0;
  v_rate numeric := 0;
  v_age integer := 0;
  v_points_ok boolean;
  v_rate_ok boolean;
  v_age_ok boolean;
begin
  select * into v_group from public.habit_groups where id = p_group_id and deleted_at is null;
  if v_group.id is null then
    return null;
  end if;

  select coalesce(points, 0) into v_points
  from public.identity_tags where id = v_group.identity_tag_id;

  v_rate := public.group_completion_rate(p_group_id);
  v_age := public.active_date(public.user_timezone(v_group.user_id)) - public.group_cycle_start(v_group);

  v_points_ok := coalesce(v_points, 0) >= public.gate_points_target();
  v_rate_ok := v_rate >= public.gate_consistency_target();
  v_age_ok := v_age >= public.gate_min_days_target();

  return jsonb_build_object(
    'group_id', p_group_id,
    'points', jsonb_build_object(
      'current', coalesce(v_points, 0),
      'target', public.gate_points_target(),
      'passed', v_points_ok),
    'consistency', jsonb_build_object(
      'current', round(v_rate * 100),
      'target', round(public.gate_consistency_target() * 100),
      'passed', v_rate_ok),
    'age', jsonb_build_object(
      'current', v_age,
      'target', public.gate_min_days_target(),
      'passed', v_age_ok),
    'all_passed', v_points_ok and v_rate_ok and v_age_ok
  );
end;
$$;

-- Groups ready to be offered mastery. A declined offer goes quiet for 14 days
-- rather than re-asking daily (§4.8 step 3).
create or replace function public.mastery_offers()
returns table (group_id uuid, gates jsonb)
language sql
stable
as $$
  select g.id, public.evaluate_gates(g.id)
  from public.habit_groups g
  where g.user_id = auth.uid()
    and g.deleted_at is null
    and g.status = 'building'
    and (g.mastery_offer_declined_at is null or g.mastery_offer_declined_at < now() - interval '14 days')
    and (public.evaluate_gates(g.id) ->> 'all_passed')::boolean;
$$;

-- Groups due for the post-mastery check-in (§4.8 safety net, 2-4 weeks).
create or replace function public.due_checkins()
returns table (group_id uuid, mastered_at timestamptz, last_checkin_at timestamptz)
language sql
stable
as $$
  select g.id, g.mastered_at, g.last_checkin_at
  from public.habit_groups g
  where g.user_id = auth.uid()
    and g.deleted_at is null
    and g.status = 'mastered'
    and coalesce(g.last_checkin_at, g.mastered_at) < now() - interval '21 days';
$$;
