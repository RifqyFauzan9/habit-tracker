import { describe, expect, it } from '@jest/globals';
import {
  isRiskyDay,
  leadMinutesFor,
  LEAD_MINUTES,
  RISKY_LEAD_MINUTES,
  shiftBack,
  weekdayMissRate,
} from '@/lib/reminder-timing';
import type { HabitLog, Weekday } from '@/lib/types';

const NOW = new Date('2026-08-27T10:00:00');

/** Builds logs on a given weekday, walking backwards week by week. */
function logsOn(weekday: Weekday, statuses: ('done' | 'missed')[]): HabitLog[] {
  const logs: HabitLog[] = [];
  const cursor = new Date(NOW);
  // Rewind to the most recent occurrence of that weekday.
  while (cursor.getDay() !== weekday) cursor.setDate(cursor.getDate() - 1);

  for (const status of statuses) {
    const y = cursor.getFullYear();
    const m = `${cursor.getMonth() + 1}`.padStart(2, '0');
    const d = `${cursor.getDate()}`.padStart(2, '0');
    logs.push({ groupId: 'g1', date: `${y}-${m}-${d}`, status });
    cursor.setDate(cursor.getDate() - 7);
  }
  return logs;
}

describe('shiftBack', () => {
  it('moves the reminder earlier', () => {
    expect(shiftBack('21:00', 5)).toEqual({ hour: 20, minute: 55 });
    expect(shiftBack('21:00', 30)).toEqual({ hour: 20, minute: 30 });
  });

  it('wraps to the previous day instead of producing a negative time', () => {
    expect(shiftBack('00:10', 30)).toEqual({ hour: 23, minute: 40 });
  });
});

describe('weekdayMissRate', () => {
  it('is zero when nothing was ever logged — silence is not evidence', () => {
    expect(weekdayMissRate('g1', 1, [], NOW)).toEqual({ rate: 0, samples: 0 });
  });

  it('counts only the weekday asked about', () => {
    const logs = [...logsOn(1, ['missed', 'missed']), ...logsOn(3, ['done', 'done'])];
    expect(weekdayMissRate('g1', 1, logs, NOW).rate).toBe(1);
    expect(weekdayMissRate('g1', 3, logs, NOW).rate).toBe(0);
  });

  it('ignores other groups', () => {
    const logs = logsOn(1, ['missed', 'missed']).map((log) => ({ ...log, groupId: 'other' }));
    expect(weekdayMissRate('g1', 1, logs, NOW).samples).toBe(0);
  });
});

describe('smart timing (PRD §4.5)', () => {
  it('needs enough history before it moves anything', () => {
    // Two misses is a bad week, not a pattern.
    const logs = logsOn(1, ['missed', 'missed']);
    expect(isRiskyDay('g1', 1, logs)).toBe(false);
    expect(leadMinutesFor('g1', 1, logs)).toBe(LEAD_MINUTES);
  });

  it('sends the nudge earlier on a habitually missed weekday', () => {
    const logs = logsOn(1, ['missed', 'missed', 'done', 'missed']);
    expect(isRiskyDay('g1', 1, logs)).toBe(true);
    expect(leadMinutesFor('g1', 1, logs)).toBe(RISKY_LEAD_MINUTES);
  });

  it('leaves reliable weekdays alone', () => {
    const logs = logsOn(5, ['done', 'done', 'done', 'missed']);
    expect(isRiskyDay('g1', 5, logs)).toBe(false);
    expect(leadMinutesFor('g1', 5, logs)).toBe(LEAD_MINUTES);
  });
});
