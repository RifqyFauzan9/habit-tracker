/**
 * The only place that talks to Supabase. Screens and the store use app types
 * (camelCase, lib/types.ts); Postgres speaks snake_case. That conversion lives
 * here and nowhere else, so a schema change has exactly one blast radius.
 */
import { toDateKey } from '@/lib/date';
import { readApiError, supabase } from '@/lib/supabase';
import type {
  FinanceLog,
  FinanceSetting,
  Habit,
  HabitGroup,
  HabitLog,
  IdentityTag,
  RoutineBlock,
  Weekday,
} from '@/lib/types';

// --- row shapes as Postgres returns them ---------------------------------

interface RoutineBlockRow {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  source: 'onboarding' | 'mastered_group';
}

interface IdentityTagRow {
  id: string;
  label: string;
  source: 'manual' | 'routine_reflection';
  points: number;
}

interface HabitRow {
  id: string;
  group_id: string;
  name: string;
  position: number;
  trigger_type: 'time_based' | 'event_based';
}

interface HabitGroupRow {
  id: string;
  name: string;
  days: number[];
  start_time: string;
  end_time: string;
  location: string;
  identity_tag_id: string | null;
  status: 'building' | 'mastered';
  reminder_enabled: boolean;
  created_at: string;
  mastered_at: string | null;
  last_reactivated_at: string | null;
  mastery_offer_declined_at: string | null;
  habits: HabitRow[] | null;
}

interface HabitLogRow {
  group_id: string;
  log_date: string;
  status: 'done' | 'missed';
}

interface FinanceSettingRow {
  month: string;
  total_percent: number | string;
  increment_percent: number | string;
  enabled: boolean;
  education_seen_at: string | null;
}

interface FinanceLogRow {
  id: string;
  log_date: string;
  percent: number | string;
}

// --- mappers --------------------------------------------------------------

/** Postgres numerics arrive as strings over the wire; the UI does arithmetic on them. */
function num(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

/** Times come back as HH:MM:SS; every screen renders HH:MM. */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

function toRoutineBlock(row: RoutineBlockRow): RoutineBlock {
  return {
    id: row.id,
    label: row.label,
    startTime: hhmm(row.start_time),
    endTime: hhmm(row.end_time),
    source: row.source,
  };
}

function toIdentityTag(row: IdentityTagRow): IdentityTag {
  return { id: row.id, label: row.label, source: row.source, points: row.points };
}

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    order: row.position,
    triggerType: 'time_based',
  };
}

function toGroup(row: HabitGroupRow): HabitGroup {
  return {
    id: row.id,
    name: row.name,
    days: [...row.days].sort((a, b) => a - b) as Weekday[],
    startTime: hhmm(row.start_time),
    endTime: hhmm(row.end_time),
    location: row.location,
    identityTagId: row.identity_tag_id,
    status: row.status,
    // App types carry date keys, not timestamps — gates.ts does date maths on them.
    createdAt: toDateKey(new Date(row.created_at)),
    masteredAt: row.mastered_at ? toDateKey(new Date(row.mastered_at)) : null,
    lastReactivatedAt: row.last_reactivated_at
      ? toDateKey(new Date(row.last_reactivated_at))
      : null,
    masteryOfferDeclinedAt: row.mastery_offer_declined_at
      ? toDateKey(new Date(row.mastery_offer_declined_at))
      : null,
    reminderEnabled: row.reminder_enabled,
    habits: (row.habits ?? []).slice().sort((a, b) => a.position - b.position).map(toHabit),
  };
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown error'}`);
}

// --- reads ----------------------------------------------------------------

export interface Snapshot {
  routineBlocks: RoutineBlock[];
  groups: HabitGroup[];
  logs: HabitLog[];
  identityTags: IdentityTag[];
  finance: FinanceSetting;
  financeLogs: FinanceLog[];
  onboardingDone: boolean;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-01`;
}

const DEFAULT_FINANCE: FinanceSetting = {
  month: currentMonth(),
  totalPercent: 30,
  incrementPercent: 1,
  enabled: false,
  educationSeen: false,
};

/** One round trip per table, in parallel — the whole dataset is small. */
export async function loadSnapshot(): Promise<Snapshot> {
  const [blocks, tags, groups, logs, finance, financeLogs, profile] = await Promise.all([
    supabase.from('routine_blocks').select('id,label,start_time,end_time,source')
      .is('deleted_at', null).order('sort_order'),
    supabase.from('identity_tags').select('id,label,source,points')
      .is('deleted_at', null).order('created_at'),
    supabase.from('habit_groups')
      .select(
        'id,name,days,start_time,end_time,location,identity_tag_id,status,reminder_enabled,' +
          'created_at,mastered_at,last_reactivated_at,mastery_offer_declined_at,' +
          'habits(id,group_id,name,position,trigger_type)'
      )
      .is('deleted_at', null).order('created_at'),
    supabase.from('habit_logs').select('group_id,log_date,status').is('deleted_at', null),
    supabase.from('finance_settings').select('month,total_percent,increment_percent,enabled,education_seen_at')
      .is('deleted_at', null).eq('month', currentMonth()).maybeSingle(),
    supabase.from('finance_allocation_logs').select('id,log_date,percent')
      .is('deleted_at', null).order('log_date'),
    supabase.from('profiles').select('onboarding_completed_at').maybeSingle(),
  ]);

  if (blocks.error) fail('load routine blocks', blocks.error);
  if (tags.error) fail('load identity tags', tags.error);
  if (groups.error) fail('load groups', groups.error);
  if (logs.error) fail('load logs', logs.error);
  if (financeLogs.error) fail('load finance logs', financeLogs.error);

  return {
    routineBlocks: (blocks.data ?? []).map(toRoutineBlock),
    identityTags: (tags.data ?? []).map(toIdentityTag),
    groups: (groups.data ?? []).map((row) => toGroup(row as unknown as HabitGroupRow)),
    logs: (logs.data ?? []).map((row: HabitLogRow) => ({
      groupId: row.group_id,
      date: row.log_date,
      status: row.status,
    })),
    finance: finance.data
      ? {
          month: (finance.data as FinanceSettingRow).month,
          totalPercent: num((finance.data as FinanceSettingRow).total_percent),
          incrementPercent: num((finance.data as FinanceSettingRow).increment_percent),
          enabled: (finance.data as FinanceSettingRow).enabled,
          educationSeen: (finance.data as FinanceSettingRow).education_seen_at !== null,
        }
      : DEFAULT_FINANCE,
    financeLogs: (financeLogs.data ?? []).map((row: FinanceLogRow) => ({
      id: row.id,
      date: row.log_date,
      percent: num(row.percent),
    })),
    onboardingDone: Boolean(
      (profile.data as { onboarding_completed_at: string | null } | null)?.onboarding_completed_at
    ),
  };
}

// --- writes ---------------------------------------------------------------

/**
 * The server picks the date, not the client — that is what keeps the 03:00
 * grace window (§4.4) unforgeable.
 */
export async function setLogStatus(groupId: string, status: 'done' | 'missed'): Promise<void> {
  const { error } = await supabase.rpc('set_log_status', {
    p_group_id: groupId,
    p_status: status,
  });
  if (error) fail('set log status', error);
}

export async function clearLog(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_log', { p_group_id: groupId });
  if (error) fail('clear log', error);
}

export interface NewGroupInput {
  name: string;
  days: Weekday[];
  startTime: string;
  endTime: string;
  location: string;
  identityTagId: string | null;
  steps: string[];
}

export async function createGroup(userId: string, input: NewGroupInput): Promise<string> {
  const { data, error } = await supabase
    .from('habit_groups')
    .insert({
      user_id: userId,
      name: input.name,
      days: input.days,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      identity_tag_id: input.identityTagId,
    })
    .select('id')
    .single();
  if (error || !data) fail('create group', error);

  const steps = input.steps.length > 0 ? input.steps : [input.name];
  const { error: habitsError } = await supabase.from('habits').insert(
    steps.map((name, index) => ({
      user_id: userId,
      group_id: data.id,
      name,
      position: index,
    }))
  );
  if (habitsError) fail('create habits', habitsError);

  return data.id;
}

export async function markMastered(groupId: string, force: boolean): Promise<void> {
  const { error } = await supabase.rpc('mark_group_mastered', {
    p_group_id: groupId,
    p_force: force,
  });
  if (error) fail('mark mastered', error);
}

export async function declineMasteryOffer(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_mastery_offer', { p_group_id: groupId });
  if (error) fail('decline mastery offer', error);
}

export async function reactivateGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('reactivate_group', { p_group_id: groupId });
  if (error) fail('reactivate group', error);
}

export async function setReminder(groupId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('habit_groups')
    .update({ reminder_enabled: enabled })
    .eq('id', groupId);
  if (error) fail('toggle reminder', error);
}

export async function createIdentityTag(userId: string, label: string): Promise<IdentityTag> {
  const { data, error } = await supabase
    .from('identity_tags')
    .insert({ user_id: userId, label, source: 'manual' })
    .select('id,label,source,points')
    .single();
  if (error || !data) fail('create identity tag', error);
  return toIdentityTag(data as IdentityTagRow);
}

/** Onboarding rewrites the whole map, so the old blocks are retired first (§4.1). */
export async function replaceRoutineBlocks(
  userId: string,
  blocks: RoutineBlock[]
): Promise<RoutineBlock[]> {
  const { error: clearError } = await supabase
    .from('routine_blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('source', 'onboarding')
    .is('deleted_at', null);
  if (clearError) fail('clear routine blocks', clearError);

  if (blocks.length === 0) return [];

  const { data, error } = await supabase
    .from('routine_blocks')
    .insert(
      blocks.map((block, index) => ({
        user_id: userId,
        label: block.label,
        start_time: block.startTime,
        end_time: block.endTime,
        source: 'onboarding',
        sort_order: index,
      }))
    )
    .select('id,label,start_time,end_time,source');
  if (error || !data) fail('insert routine blocks', error);
  return data.map((row) => toRoutineBlock(row as RoutineBlockRow));
}

export async function completeOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) fail('complete onboarding', error);
}

export async function saveFinanceSetting(
  userId: string,
  setting: FinanceSetting
): Promise<void> {
  const { error } = await supabase.from('finance_settings').upsert(
    {
      user_id: userId,
      month: currentMonth(),
      total_percent: setting.totalPercent,
      increment_percent: setting.incrementPercent,
      enabled: setting.enabled,
      education_seen_at: setting.educationSeen ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,month' }
  );
  if (error) fail('save finance setting', error);
}

export async function logAllocation(
  userId: string,
  percent: number
): Promise<FinanceLog> {
  const { data, error } = await supabase
    .from('finance_allocation_logs')
    .insert({ user_id: userId, log_date: toDateKey(new Date()), percent })
    .select('id,log_date,percent')
    .single();
  if (error || !data) fail('log allocation', error);
  const row = data as FinanceLogRow;
  return { id: row.id, date: row.log_date, percent: num(row.percent) };
}

// --- edge functions (§6.4) -----------------------------------------------

export interface AmbiguityResult {
  clear: boolean;
  question: string | null;
  note: string;
  suggestedName: string | null;
}

export async function checkAmbiguity(draft: {
  name: string;
  location: string;
  days: Weekday[];
  startTime: string;
  endTime: string;
}): Promise<AmbiguityResult> {
  const { data, error } = await supabase.functions.invoke('ambiguity-check', {
    body: {
      draft: {
        name: draft.name,
        location: draft.location,
        days: draft.days,
        start_time: draft.startTime,
        end_time: draft.endTime,
      },
    },
  });
  if (error) throw new Error(readApiError(data, 'Gagal mengecek kejelasan.'));
  return {
    clear: Boolean(data.clear),
    question: data.question ?? null,
    note: data.note ?? '',
    suggestedName: data.suggested_name ?? null,
  };
}

export interface SlotSuggestion {
  startTime: string;
  endTime: string;
  anchor: string;
  reason: string;
}

export interface MergeResult {
  sessionId: string;
  round: number;
  maxRounds: number;
  exhausted: boolean;
  suggestion: SlotSuggestion | null;
}

export async function requestSlot(input: {
  sessionId?: string;
  draft?: Record<string, unknown>;
  rejectionReason?: string;
}): Promise<MergeResult> {
  const { data, error } = await supabase.functions.invoke('schedule-merge', {
    body: {
      session_id: input.sessionId,
      draft: input.draft,
      rejection_reason: input.rejectionReason,
    },
  });
  if (error) throw new Error(readApiError(data, 'Gagal mencari slot.'));
  return {
    sessionId: data.session_id,
    round: data.round,
    maxRounds: data.max_rounds,
    exhausted: Boolean(data.exhausted),
    suggestion: data.suggestion
      ? {
          startTime: data.suggestion.start_time,
          endTime: data.suggestion.end_time,
          anchor: data.suggestion.anchor,
          reason: data.suggestion.reason,
        }
      : null,
  };
}
