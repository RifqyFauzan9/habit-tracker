import { activeDateKey, addDays, daysBetween, toDateKey } from '@/lib/date';
import type { GateProgress, HabitGroup, HabitLog, IdentityTag } from '@/lib/types';

export const GATE_POINTS = 40;
export const GATE_CONSISTENCY = 0.8;
export const GATE_MIN_DAYS = 21;
export const CONSISTENCY_WINDOW_DAYS = 30;
export const SOFT_CAP_BUILDING_GROUPS = 3;

function cycleStart(group: HabitGroup): string {
  return group.lastReactivatedAt ?? group.createdAt;
}

export function completionRate(
  group: HabitGroup,
  logs: HabitLog[],
  windowDays = CONSISTENCY_WINDOW_DAYS,
  now = new Date()
): number {
  const start = toDateKey(addDays(now, -windowDays));
  const scoped = logs.filter(
    (log) => log.groupId === group.id && log.date >= start && log.date >= cycleStart(group)
  );
  if (scoped.length === 0) return 0;
  const done = scoped.filter((log) => log.status === 'done').length;
  return done / scoped.length;
}

/** PRD §4.8: deterministic, no LLM — three gates, all must pass. */
export function evaluateGates(
  group: HabitGroup,
  logs: HabitLog[],
  tags: IdentityTag[],
  now = new Date()
): GateProgress {
  const tag = tags.find((t) => t.id === group.identityTagId);
  const points = tag?.points ?? 0;
  const rate = completionRate(group, logs, CONSISTENCY_WINDOW_DAYS, now);
  const age = daysBetween(cycleStart(group), activeDateKey(now));

  const pointsGate = { current: points, target: GATE_POINTS, passed: points >= GATE_POINTS };
  const consistencyGate = {
    current: Math.round(rate * 100),
    target: Math.round(GATE_CONSISTENCY * 100),
    passed: rate >= GATE_CONSISTENCY,
  };
  const ageGate = { current: age, target: GATE_MIN_DAYS, passed: age >= GATE_MIN_DAYS };

  return {
    points: pointsGate,
    consistency: consistencyGate,
    age: ageGate,
    allPassed: pointsGate.passed && consistencyGate.passed && ageGate.passed,
  };
}

export function currentStreak(groupId: string, logs: HabitLog[], now = new Date()): number {
  const byDate = new Map(logs.filter((l) => l.groupId === groupId).map((l) => [l.date, l.status]));
  let streak = 0;
  for (let i = 0; i < 400; i += 1) {
    const key = toDateKey(addDays(now, -i));
    const status = byDate.get(key);
    if (status === 'done') {
      streak += 1;
      continue;
    }
    if (status === 'missed') break;
    if (i === 0) continue;
    break;
  }
  return streak;
}

export function longestStreak(groupId: string, logs: HabitLog[]): number {
  const done = logs
    .filter((l) => l.groupId === groupId && l.status === 'done')
    .map((l) => l.date)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of done) {
    run = previous && daysBetween(previous, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}
