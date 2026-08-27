/**
 * Smart timing rules — PRD §4.5 (P1). Pure functions, no device APIs, so both
 * the scheduler and the UI copy read from the same source and cannot disagree.
 */
import { addDays, toDateKey } from '@/lib/date';
import type { HabitLog, Weekday } from '@/lib/types';

/** How far ahead of the start time a normal reminder fires. */
export const LEAD_MINUTES = 5;

/**
 * On weekdays a group is habitually missed, the nudge arrives earlier — the
 * miss usually happens because the moment was already gone by the time the
 * reminder landed.
 */
export const RISKY_LEAD_MINUTES = 30;
const RISKY_MISS_RATE = 0.4;
const RISKY_MIN_SAMPLES = 3;
const WINDOW_DAYS = 56;

/**
 * Miss rate for one group on one weekday. Only logged days count: a day with no
 * log at all is not evidence of anything.
 */
export function weekdayMissRate(
  groupId: string,
  weekday: Weekday,
  logs: HabitLog[],
  now = new Date()
): { rate: number; samples: number } {
  const since = toDateKey(addDays(now, -WINDOW_DAYS));
  const scoped = logs.filter(
    (log) => log.groupId === groupId && log.date >= since && new Date(log.date).getDay() === weekday
  );
  if (scoped.length === 0) return { rate: 0, samples: 0 };
  const missed = scoped.filter((log) => log.status === 'missed').length;
  return { rate: missed / scoped.length, samples: scoped.length };
}

export function isRiskyDay(groupId: string, weekday: Weekday, logs: HabitLog[]): boolean {
  const { rate, samples } = weekdayMissRate(groupId, weekday, logs);
  return samples >= RISKY_MIN_SAMPLES && rate >= RISKY_MISS_RATE;
}

export function leadMinutesFor(groupId: string, weekday: Weekday, logs: HabitLog[]): number {
  return isRiskyDay(groupId, weekday, logs) ? RISKY_LEAD_MINUTES : LEAD_MINUTES;
}

export function shiftBack(time: string, minutes: number): { hour: number; minute: number } {
  const [h, m] = time.split(':').map((part) => Number.parseInt(part, 10));
  let total = (h || 0) * 60 + (m || 0) - minutes;
  if (total < 0) total += 24 * 60; // A pre-midnight nudge is better than none.
  return { hour: Math.floor(total / 60), minute: total % 60 };
}
