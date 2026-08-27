/**
 * Reminders on device — PRD §4.5.
 *
 * One notification per group, never per step, sent near the group's start time.
 * Scheduled locally: no push server, no token registry, and reminders keep
 * firing with the laptop off and the phone offline. The database only records
 * whether a group wants reminders at all.
 *
 * Web has its own stub (notifications.web.ts) because importing
 * expo-notifications at all touches browser storage, which breaks the
 * server-render pass.
 */
import { leadMinutesFor, shiftBack } from '@/lib/reminder-timing';
import type { HabitGroup, HabitLog } from '@/lib/types';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Lets the user tick the group off from the notification itself (§4.5). */
export const GROUP_CATEGORY = 'habit-group';
export const DONE_ACTION = 'MARK_DONE';

const ANDROID_CHANNEL = 'reminders';

export interface ReminderTap {
  groupId: string;
  markDone: boolean;
}

export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  await Notifications.setNotificationCategoryAsync(GROUP_CATEGORY, [
    {
      identifier: DONE_ACTION,
      buttonTitle: 'Selesai',
      // Ticking it off should not drag the user into the app (§4.5).
      options: { opensAppToForeground: false },
    },
  ]);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Pengingat kebiasaan',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 200],
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function bodyFor(group: HabitGroup): string {
  const steps = group.habits.length;
  if (steps > 1) return `${steps} langkah · ${group.location || 'seperti biasa'}`;
  return group.location ? `Di ${group.location}` : 'Satu tap saja.';
}

/**
 * Rebuilds the whole schedule. Cheaper and far less error-prone than tracking
 * which individual reminders changed, and it only runs when groups change.
 */
export async function syncReminders(groups: HabitGroup[], logs: HabitLog[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Mastered groups stop nudging daily — that is the whole point of graduating
  // them (§4.8). Only `building` groups with reminders on are scheduled.
  const active = groups.filter((group) => group.status === 'building' && group.reminderEnabled);
  if (active.length === 0) return;

  for (const group of active) {
    for (const weekday of group.days) {
      const { hour, minute } = shiftBack(group.startTime, leadMinutesFor(group.id, weekday, logs));

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${group.name}?`,
          body: bodyFor(group),
          categoryIdentifier: GROUP_CATEGORY,
          data: { groupId: group.id, weekday },
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          // Expo counts weekdays from 1 = Sunday; the app uses 0 = Sunday.
          weekday: weekday + 1,
          hour,
          minute,
        },
      });
    }
  }
}

export async function scheduledCount(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

function toTap(response: Notifications.NotificationResponse | null | undefined): ReminderTap | null {
  const groupId = response?.notification.request.content.data?.groupId;
  if (typeof groupId !== 'string') return null;
  return { groupId, markDone: response?.actionIdentifier === DONE_ACTION };
}

/** Fires while the app is running, including when it is in the background. */
export function onReminderTap(handler: (tap: ReminderTap) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const tap = toTap(response);
    if (tap) handler(tap);
  });
  return () => subscription.remove();
}

/** Covers the app being launched by the notification itself (cold start). */
export function useLastReminderTap(): ReminderTap | null {
  return toTap(Notifications.useLastNotificationResponse());
}
