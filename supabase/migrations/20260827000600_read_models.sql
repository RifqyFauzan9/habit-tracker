-- Read models: streaks, heatmap, today's list, identity page (PRD §4.4, §4.9, §4.10).
-- Kept in SQL so the client never has to pull the whole log table to draw a heatmap.

create or replace function public.current_streak(p_group_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  v_group public.habit_groups;
  v_cursor date;
  v_status text;
  v_streak integer := 0;
  v_i integer := 0;
begin
  select * into v_group from public.habit_groups where id = p_group_id;
  if v_group.id is null then
    return 0;
  end if;

  v_cursor := public.active_date(public.user_timezone(v_group.user_id));

  loop
    exit when v_i > 400;
    select status into v_status
    from public.habit_logs
    where group_id = p_group_id and log_date = v_cursor and deleted_at is null;

    if v_status = 'done' then
      v_streak := v_streak + 1;
    elsif v_status = 'missed' then
      exit;
    elsif v_i > 0 then
      -- Today not logged yet is not a break; any earlier gap is.
      exit;
    end if;

    v_cursor := v_cursor - 1;
    v_i := v_i + 1;
  end loop;

  return v_streak;
end;
$$;

create or replace function public.longest_streak(p_group_id uuid)
returns integer
language sql
stable
as $$
  with done as (
    select log_date,
           log_date - (row_number() over (order by log_date))::integer as bucket
    from public.habit_logs
    where group_id = p_group_id and status = 'done' and deleted_at is null
  )
  select coalesce(max(run), 0)::integer
  from (select count(*) as run from done group by bucket) s;
$$;

-- Heatmap source (§4.10). Mastered groups stay visible as read-only history.
create or replace function public.heatmap(p_group_id uuid default null, p_days integer default 365)
returns table (log_date date, done_count integer, total_count integer)
language sql
stable
as $$
  select l.log_date,
         count(*) filter (where l.status = 'done')::integer,
         count(*)::integer
  from public.habit_logs l
  where l.user_id = auth.uid()
    and l.deleted_at is null
    and (p_group_id is null or l.group_id = p_group_id)
    and l.log_date >= current_date - p_days
  group by l.log_date
  order by l.log_date;
$$;

-- Today's tracking list (§4.4): building groups scheduled for the open day only.
create or replace function public.today_groups()
returns table (
  group_id uuid,
  name text,
  start_time time,
  end_time time,
  location text,
  identity_tag_id uuid,
  status text,
  log_status text,
  streak integer,
  habits jsonb
)
language sql
stable
as $$
  with today as (
    select public.active_date(public.user_timezone(auth.uid())) as d
  )
  select g.id,
         g.name,
         g.start_time,
         g.end_time,
         g.location,
         g.identity_tag_id,
         g.status,
         coalesce(l.status, 'pending'),
         public.current_streak(g.id),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'position', h.position)
                            order by h.position)
           from public.habits h
           where h.group_id = g.id and h.deleted_at is null
         ), '[]'::jsonb)
  from public.habit_groups g
  cross join today t
  left join public.habit_logs l
    on l.group_id = g.id and l.log_date = t.d and l.deleted_at is null
  where g.user_id = auth.uid()
    and g.deleted_at is null
    and g.status = 'building'
    and extract(dow from t.d)::smallint = any(g.days)
  order by g.start_time;
$$;

-- Identity page (§4.9): permanent scheme, temporary scheme, points per tag.
create or replace function public.identity_overview()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'permanent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'group_id', g.id, 'name', g.name, 'mastered_at', g.mastered_at)
        order by g.mastered_at desc)
      from public.habit_groups g
      where g.user_id = auth.uid() and g.deleted_at is null and g.status = 'mastered'
    ), '[]'::jsonb),
    'building', coalesce((
      select jsonb_agg(jsonb_build_object(
        'group_id', g.id, 'name', g.name, 'gates', public.evaluate_gates(g.id))
        order by g.created_at)
      from public.habit_groups g
      where g.user_id = auth.uid() and g.deleted_at is null and g.status = 'building'
    ), '[]'::jsonb),
    'identity_tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'label', t.label, 'points', t.points, 'source', t.source)
        order by t.points desc)
      from public.identity_tags t
      where t.user_id = auth.uid() and t.deleted_at is null
    ), '[]'::jsonb)
  );
$$;
