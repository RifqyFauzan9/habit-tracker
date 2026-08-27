-- Core data model — PRD §5.
-- Conventions: snake_case, TEXT over VARCHAR, TIMESTAMPTZ (UTC), soft delete,
-- uuid primary keys, partial indexes for the active-row queries.
--
-- Deviation from the house "no foreign keys" rule, on purpose: there is no
-- application server here (PRD §6.2 — clients talk to Postgres directly), so
-- referential integrity has no other layer to live in. FKs are the enforcement.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Jakarta',
  reminder_enabled boolean not null default true,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create or replace function public.user_timezone(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(timezone, 'UTC') from public.profiles where id = p_user_id;
$$;

-- PRD §4.1 / §4.8: onboarding output, plus mastered groups folded back in as
-- permanent routine. Both feed the schedule merge engine as context.
create table public.routine_blocks (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  start_time time not null,
  end_time time not null,
  source text not null default 'onboarding'
    check (source in ('onboarding', 'mastered_group')),
  source_group_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- PRD §4.6: points start at 0 and are a psychological counter only — never a
-- currency, never redeemable.
create table public.identity_tags (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  source text not null default 'manual'
    check (source in ('manual', 'routine_reflection')),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- PRD §4.2: the group is the only tracked unit — one schedule, one reminder,
-- one log, one identity vote per day.
create table public.habit_groups (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  days smallint[] not null default '{}',
  start_time time not null,
  end_time time not null,
  location text not null default '',
  identity_tag_id uuid references public.identity_tags (id) on delete set null,
  status text not null default 'building' check (status in ('building', 'mastered')),
  reminder_enabled boolean not null default true,
  mastered_at timestamptz,
  last_reactivated_at timestamptz,
  mastery_offer_declined_at timestamptz,
  last_checkin_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint habit_groups_days_valid
    check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

-- trigger_type exists in v1 with a single value so event-based habits (§10.1)
-- can land without a schema migration.
create table public.habits (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.habit_groups (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  trigger_type text not null default 'time_based'
    check (trigger_type in ('time_based', 'event_based')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- PRD §5: logs hang off group_id, never habit_id.
create table public.habit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.habit_groups (id) on delete cascade,
  log_date date not null,
  status text not null check (status in ('done', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table public.habit_lifecycle_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.habit_groups (id) on delete cascade,
  type text not null
    check (type in ('mastered', 'reactivated', 'offer_declined', 'checked_in')),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- PRD §4.3: the whole rejection history of a session is the merge engine input,
-- so it is stored rather than kept in client memory.
create table public.negotiation_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.habit_groups (id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  rounds jsonb not null default '[]'::jsonb,
  round_count integer not null default 0,
  final_status text not null default 'open'
    check (final_status in ('open', 'accepted', 'manual', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- PRD §4.7: percentages only. No nominal amounts, no account data, ever.
create table public.finance_settings (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month date not null,
  total_percent numeric(5, 2) not null default 0 check (total_percent between 0 and 100),
  increment_percent numeric(5, 2) not null default 0 check (increment_percent between 0 and 100),
  enabled boolean not null default false,
  education_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table public.finance_allocation_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.habit_groups (id) on delete set null,
  log_date date not null,
  percent numeric(5, 2) not null check (percent > 0),
  is_recovery_bonus boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- PRD §6.4 / §7: token instrumentation from day one so cost per user comes from
-- real data, and doubles as the rate-limit window source.
create table public.ai_usage_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null
    check (feature in ('ambiguity_check', 'schedule_merge', 'identity_reflection')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  latency_ms integer not null default 0,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table public.ai_response_cache (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  cache_key text not null,
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- Indexes: active-row partial indexes for reads, a deleted_at index for cleanup.
create index idx_routine_blocks_user_active on public.routine_blocks (user_id, sort_order) where deleted_at is null;
create index idx_identity_tags_user_active on public.identity_tags (user_id) where deleted_at is null;
create unique index idx_identity_tags_label_unique on public.identity_tags (user_id, lower(label)) where deleted_at is null;
create index idx_habit_groups_user_status on public.habit_groups (user_id, status) where deleted_at is null;
create index idx_habits_group_active on public.habits (group_id, position) where deleted_at is null;
create index idx_habit_logs_group_date on public.habit_logs (group_id, log_date desc) where deleted_at is null;
create unique index idx_habit_logs_group_date_unique on public.habit_logs (group_id, log_date) where deleted_at is null;
create index idx_habit_logs_user_date on public.habit_logs (user_id, log_date desc) where deleted_at is null;
create index idx_lifecycle_group on public.habit_lifecycle_events (group_id, occurred_at desc) where deleted_at is null;
create index idx_negotiation_user on public.negotiation_sessions (user_id, created_at desc) where deleted_at is null;
create unique index idx_finance_settings_month_unique on public.finance_settings (user_id, month) where deleted_at is null;
create index idx_finance_logs_user_date on public.finance_allocation_logs (user_id, log_date desc) where deleted_at is null;
create index idx_ai_usage_user_feature on public.ai_usage_events (user_id, feature, created_at desc);
create unique index idx_ai_cache_key_unique on public.ai_response_cache (user_id, feature, cache_key) where deleted_at is null;
create index idx_ai_cache_expiry on public.ai_response_cache (expires_at);

create index idx_habit_groups_deleted on public.habit_groups (deleted_at) where deleted_at is not null;
create index idx_habit_logs_deleted on public.habit_logs (deleted_at) where deleted_at is not null;

-- updated_at automation
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'routine_blocks', 'identity_tags', 'habit_groups', 'habits',
    'habit_logs', 'habit_lifecycle_events', 'negotiation_sessions',
    'finance_settings', 'finance_allocation_logs', 'ai_usage_events',
    'ai_response_cache'
  ]
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- New auth user gets a profile row automatically; no seeded personal data (§8.2).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
