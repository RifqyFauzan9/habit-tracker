-- Gemini bills reasoning tokens that never appear in the response body. In
-- testing they were 80% of a trivial call, so §7's cost model needs them
-- counted separately rather than folded into output_tokens.
alter table public.ai_usage_events
  add column thinking_tokens integer not null default 0;
