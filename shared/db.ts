/**
 * Backend contract shared between Supabase and the Expo client (PRD §6.3).
 * Rows are snake_case exactly as Postgres returns them; the client converts to
 * camelCase at its own boundary. Nothing here is wired into the app yet.
 */

export type GroupStatus = 'building' | 'mastered';
export type LogStatus = 'done' | 'missed';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type RoutineBlockSource = 'onboarding' | 'mastered_group';
export type IdentityTagSource = 'manual' | 'routine_reflection';
export type TriggerType = 'time_based' | 'event_based';
export type LifecycleEventType = 'mastered' | 'reactivated' | 'offer_declined' | 'checked_in';
export type AiFeature = 'ambiguity_check' | 'schedule_merge' | 'identity_reflection';

interface SoftDeleteRow {
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ProfileRow extends SoftDeleteRow {
  id: string;
  display_name: string | null;
  timezone: string;
  reminder_enabled: boolean;
  onboarding_completed_at: string | null;
}

export interface RoutineBlockRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  label: string;
  start_time: string;
  end_time: string;
  source: RoutineBlockSource;
  source_group_id: string | null;
  sort_order: number;
}

export interface IdentityTagRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  label: string;
  source: IdentityTagSource;
  points: number;
}

export interface HabitGroupRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  name: string;
  days: Weekday[];
  start_time: string;
  end_time: string;
  location: string;
  identity_tag_id: string | null;
  status: GroupStatus;
  reminder_enabled: boolean;
  mastered_at: string | null;
  last_reactivated_at: string | null;
  mastery_offer_declined_at: string | null;
  last_checkin_at: string | null;
}

export interface HabitRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  group_id: string;
  name: string;
  position: number;
  trigger_type: TriggerType;
}

export interface HabitLogRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  group_id: string;
  log_date: string;
  status: LogStatus;
}

export interface HabitLifecycleEventRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  group_id: string;
  type: LifecycleEventType;
  note: string | null;
  occurred_at: string;
}

export interface NegotiationRound {
  start_time: string;
  end_time: string;
  anchor: string;
  reason: string;
  rejection_reason?: string;
}

export interface NegotiationSessionRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  group_id: string | null;
  draft: Record<string, unknown>;
  rounds: NegotiationRound[];
  round_count: number;
  final_status: 'open' | 'accepted' | 'manual' | 'abandoned';
}

export interface FinanceSettingRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  month: string;
  total_percent: number;
  increment_percent: number;
  enabled: boolean;
  education_seen_at: string | null;
}

export interface FinanceAllocationLogRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  group_id: string | null;
  log_date: string;
  percent: number;
  is_recovery_bonus: boolean;
}

/** Shape returned by public.evaluate_gates(group_id) — PRD §4.8. */
export interface GateProgressPayload {
  group_id: string;
  points: { current: number; target: number; passed: boolean };
  consistency: { current: number; target: number; passed: boolean };
  age: { current: number; target: number; passed: boolean };
  all_passed: boolean;
}

/** Row shape of public.today_groups() — PRD §4.4. */
export interface TodayGroupRow {
  group_id: string;
  name: string;
  start_time: string;
  end_time: string;
  location: string;
  identity_tag_id: string | null;
  status: GroupStatus;
  log_status: LogStatus | 'pending';
  streak: number;
  habits: Array<{ id: string; name: string; position: number }>;
}

// --- Edge function contracts (PRD §6.4) ---------------------------------

export interface AmbiguityCheckRequest {
  draft: {
    name: string;
    location: string;
    days: Weekday[];
    start_time: string;
    end_time: string;
    identity_tag_label?: string | null;
  };
}

export interface AmbiguityCheckResponse {
  clear: boolean;
  question: string | null;
  note: string;
  suggested_name: string | null;
  /** true when the AI call failed and the check was waved through. */
  degraded?: boolean;
}

export interface ScheduleMergeRequest {
  session_id?: string;
  draft?: Record<string, unknown>;
  rejection_reason?: string;
}

export interface ScheduleMergeResponse {
  session_id: string;
  round: number;
  max_rounds: number;
  /** true once three rounds are spent — the client shows a manual time picker. */
  exhausted: boolean;
  suggestion: {
    start_time: string;
    end_time: string;
    anchor: string;
    reason: string;
  } | null;
}

export interface IdentityReflectionResponse {
  observation: string | null;
  identity_label: string | null;
}

export interface AiUsageEventRow extends SoftDeleteRow {
  id: string;
  user_id: string;
  feature: AiFeature;
  model: string;
  input_tokens: number;
  output_tokens: number;
  /** Reasoning tokens — billed but absent from the response body. */
  thinking_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  latency_ms: number;
  cache_hit: boolean;
}

export interface ApiErrorResponse {
  error: { code: string; message: string; status: number };
}
