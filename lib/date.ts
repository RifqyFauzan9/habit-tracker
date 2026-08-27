const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);
}

/**
 * PRD §4.4: a day stays editable until 03:00 the next morning, so a user who
 * forgot to log before sleeping is not punished by the calendar rollover.
 */
export function activeDateKey(now = new Date()): string {
  const shifted = now.getHours() < 3 ? addDays(now, -1) : now;
  return toDateKey(shifted);
}

export function formatDayHeader(now = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(now);
}

export function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateKey));
}

export function describeDays(days: number[]): string {
  if (days.length === 7) return 'Setiap hari';
  if (days.length === 0) return 'Belum dijadwalkan';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(' · ');
}
