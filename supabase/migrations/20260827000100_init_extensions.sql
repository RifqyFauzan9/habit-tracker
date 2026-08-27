-- Extensions and shared helpers.
-- PRD §5, §8: every table is user-scoped and RLS is on from day one.

-- Hosted Supabase keeps extensions in their own schema and runs migrations
-- without it on the search_path, so both the install and every call below are
-- schema-qualified. Local and cloud then behave identically.
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- Reused by every table; never redefine per migration.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- PRD §4.4: a calendar day stays writable until 03:00 the next morning, in the
-- user's own timezone. Server-side so the client cannot widen the window.
create or replace function public.active_date(p_timezone text default 'UTC', p_now timestamptz default now())
returns date
language sql
stable
as $$
  select (((p_now at time zone coalesce(p_timezone, 'UTC')) - interval '3 hours'))::date;
$$;
