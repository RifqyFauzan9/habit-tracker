/**
 * Web stub — PRD §4.5 is a device feature.
 *
 * Importing expo-notifications reads browser storage at module load, which
 * kills Expo Router's server-render pass. Metro picks this file for web, so the
 * shared code can import '@/lib/notifications' unconditionally.
 */
import type { HabitGroup, HabitLog } from '@/lib/types';

export const GROUP_CATEGORY = 'habit-group';
export const DONE_ACTION = 'MARK_DONE';

export interface ReminderTap {
  groupId: string;
  markDone: boolean;
}

export async function configureNotifications(): Promise<void> {}

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function syncReminders(_groups: HabitGroup[], _logs: HabitLog[]): Promise<void> {}

export async function scheduledCount(): Promise<number> {
  return 0;
}

export function onReminderTap(_handler: (tap: ReminderTap) => void): () => void {
  return () => {};
}

export function useLastReminderTap(): ReminderTap | null {
  return null;
}
