-- Row-Level Security — PRD §8.1. On from day one, single user or not.
-- Every table carries user_id (profiles carries id), so no policy needs a join.
-- Deletes are not granted anywhere: removal is a soft delete via UPDATE.

alter table public.profiles enable row level security;
alter table public.routine_blocks enable row level security;
alter table public.identity_tags enable row level security;
alter table public.habit_groups enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habit_lifecycle_events enable row level security;
alter table public.negotiation_sessions enable row level security;
alter table public.finance_settings enable row level security;
alter table public.finance_allocation_logs enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.ai_response_cache enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'routine_blocks', 'identity_tags', 'habit_groups', 'habits', 'habit_logs',
    'habit_lifecycle_events', 'negotiation_sessions', 'finance_settings',
    'finance_allocation_logs'
  ]
  loop
    execute format($f$
      create policy %1$s_select on public.%1$s
        for select to authenticated using (user_id = (select auth.uid()));
      create policy %1$s_insert on public.%1$s
        for insert to authenticated with check (user_id = (select auth.uid()));
      create policy %1$s_update on public.%1$s
        for update to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end;
$$;

-- AI tables are written by edge functions (service role bypasses RLS); the user
-- may read their own usage but never write it.
create policy ai_usage_select on public.ai_usage_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_cache_select on public.ai_response_cache
  for select to authenticated using (user_id = (select auth.uid()));

-- The anon role gets nothing: no policies, no grants beyond the schema default.
revoke all on all tables in schema public from anon;

-- Hosted Supabase grants these through default privileges, but relying on that
-- is fragile — an environment without it would leave every policy unreachable.
-- RLS still decides which rows; these only decide which tables are visible.
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- AI bookkeeping is written by edge functions under the service role only.
revoke insert, update on public.ai_usage_events, public.ai_response_cache from authenticated;
