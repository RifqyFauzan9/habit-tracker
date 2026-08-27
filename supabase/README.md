# Backend — Supabase

Implements PRD §5 (data model), §6.2 (Supabase-native, no custom server) and §6.4 (LLM in Edge Functions).
Not wired to the Expo app yet — `lib/store.tsx` still runs on mock data.

## Layout

```
supabase/
├── migrations/
│   ├── ...000100_init_extensions.sql   extensions, updated_at, active_date (03:00 grace)
│   ├── ...000200_core_tables.sql       all tables, indexes, profile auto-create
│   ├── ...000300_domain_logic.sql      grace enforcement, identity points, mastery gates
│   ├── ...000400_rpc_and_jobs.sql      write RPCs + nightly jobs
│   ├── ...000500_rls.sql               RLS on every table
│   ├── ...000600_read_models.sql       streaks, heatmap, today list, identity page
│   ├── ...000700_ai_thinking_tokens.sql  reasoning-token column
│   └── ...000800_fix_cache_conflict.sql  cache unique constraint (was partial, broke upsert)
├── functions/
│   ├── _shared/                        auth, HTTP envelope, Gemini client (cache + rate limit + token log)
│   ├── ambiguity-check/                §4.2.1
│   ├── schedule-merge/                 §4.3
│   └── identity-reflection/            §4.11
└── config.toml
```

## What the database enforces (so the client cannot get it wrong)

| Rule | Where | PRD |
|---|---|---|
| A day is writable until 03:00 the next morning, in the user's timezone | `enforce_log_grace_period` trigger | §4.4 |
| One log per group per day, group-scoped not habit-scoped | unique partial index on `(group_id, log_date)` | §4.2, §5 |
| Identity points: +1 per completed group per day, never below 0 | `apply_identity_points` trigger (atomic SQL) | §4.6 |
| Three mastery gates, deterministic, no LLM | `evaluate_gates()` | §4.8 |
| Reactivation restarts gate progress from the reactivation date | `group_cycle_start()` | §4.8 |
| Mastered group folds into `routine_blocks` as permanent routine | `mark_group_mastered()` | §4.8 |
| Missed days are recorded, so the consistency rate has a real denominator | `fill_missed_logs()` hourly job | §4.8 |
| Soft cap on building groups is a nudge, never a block | `building_group_count()` only reports | §4.8 |
| Every row is user-scoped and RLS is on | `...000500_rls.sql` | §8.1 |
| Finance stores percentages only — no amounts, no account data | `finance_*` tables | §4.7 |

## RPCs the client will call

| RPC | Purpose |
|---|---|
| `set_log_status(group_id, status)` | One-tap completion. Server picks the date — the client cannot write a locked day. |
| `clear_log(group_id)` | Untick today; the identity point is returned. |
| `evaluate_gates(group_id)` | Gate progress for the identity screen. |
| `mastery_offers()` | Groups that passed all three gates and are not in a declined cooldown. |
| `mark_group_mastered(group_id, force)` | `force = true` is the "manual before gates" path after the reflective friction prompt (§4.8 step 4). |
| `decline_mastery_offer(group_id)` | "Belum" — the offer goes quiet for 14 days. |
| `reactivate_group(group_id)` | Back to `building`, fresh cycle, no failure framing. |
| `checkin_group(group_id, still_running)` | 2–4 week check-in; `false` reactivates. |
| `today_groups()`, `heatmap()`, `identity_overview()`, `current_streak()`, `longest_streak()` | Read models. |

## Edge functions

All three verify the JWT, return structured JSON via Gemini's `responseSchema`, cache by request hash, rate-limit per user, and log token usage into `ai_usage_events` (§6.4, §7).

**Provider: Google Gemini free tier** (`_shared/llm.ts`), called over plain REST — no SDK, so nothing to resolve in the Deno runtime. Swapping provider means rewriting `callModel()` only; the three functions never see a provider detail.

Models follow the PRD's light/mid split, verified against a live free-tier key:

| Feature | Model | thinkingLevel |
|---|---|---|
| `ambiguity_check` | `gemini-3.5-flash-lite` | low |
| `identity_reflection` | `gemini-3.5-flash-lite` | low |
| `schedule_merge` | `gemini-3.6-flash` | low |

Gotchas found while testing, so nobody rediscovers them:
- `gemini-2.5-*` returns 404 for keys created now — use the 3.x names.
- `responseSchema` is an OpenAPI subset: no `additionalProperties`, and nullable fields are `nullable: true`, not `type: ["string","null"]`.
- Thinking is on by default and was 545 of 682 tokens on a trivial call. `thinkingLevel: "low"` cuts it ~3.6x; `thinkingBudget: 0` is rejected with 400.
- Free tier means Google may use the payload to improve models. What is sent is the user's routine map — personal data. Fine for personal use; before any public release this must move to a paid tier or a no-training provider (§8, UU PDP).

Degradation is deliberate: if the model is down or the free-tier quota is spent, the ambiguity check waves the save through (`degraded: true`) and identity reflection returns nothing. Only the merge engine returns an error, because its whole job is producing a slot — the client then falls back to the manual time picker.

## Running it

```bash
# once
brew install supabase/tap/supabase

supabase start                       # local stack (needs Docker running)
supabase db reset                    # applies every migration in order
supabase functions serve             # local edge functions

# secrets + deploy
supabase secrets set --env-file supabase/.env
supabase db push
supabase functions deploy ambiguity-check schedule-merge identity-reflection
```

## Status / known gaps

- **Verified end to end on a local stack:** all 8 migrations apply from an empty database; grace period, identity points, the three gates, mastery/reactivation, and RLS isolation between two users were each exercised directly against Postgres. All three edge functions were called over HTTP with a real JWT and a live Gemini key.
- `pg_cron` scheduling is wrapped in a guard; on hosted Supabase enable the extension, then the two jobs register on the next `db push`.
- Free-tier rate limits are not yet reflected in the per-user caps in `_shared/llm.ts` (12/min per feature, 200/day). Tune once real usage data exists (§7).
- Push notifications (§4.5) are client-side Expo Notifications and are not part of this backend; smart timing (P1) would need a scheduled function reading `habit_logs`.
- Finance tables exist and are RLS-protected, but no server logic enforces the "growth pause" rules yet (§4.7 is P1).

## One deliberate deviation from house DB rules

The house rules say no foreign keys — relationships enforced at the application layer. There is no application layer here: clients talk to Postgres directly (PRD §6.2), so anything not enforced by a constraint is not enforced at all. FKs are used, with `on delete cascade` scoped to the owning user/group. Everything else follows house rules: TEXT over VARCHAR, TIMESTAMPTZ, soft delete, `uuid_generate_v4()`, partial indexes, snake_case.
