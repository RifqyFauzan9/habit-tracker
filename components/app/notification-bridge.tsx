import * as api from '@/lib/api';
import {
  configureNotifications,
  ensurePermission,
  onReminderTap,
  syncReminders,
  useLastReminderTap,
  type ReminderTap,
} from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Keeps the device's scheduled reminders in step with the groups (PRD §4.5) and
 * handles "Selesai" pressed straight from the notification.
 *
 * Renders nothing — this is wiring, not UI. On web every call below resolves to
 * the no-op stub in notifications.web.ts.
 */
export function NotificationBridge() {
  const { ready, groups, logs, refresh } = useStore();
  const permissionAsked = useRef(false);
  const handledTap = useRef<string | null>(null);

  useEffect(() => {
    void configureNotifications();
  }, []);

  const markDone = useCallback(
    async (tap: ReminderTap) => {
      if (!tap.markDone) return;
      try {
        // The server picks the date, so a stale notification from yesterday
        // cannot write to a locked day (§4.4).
        await api.setLogStatus(tap.groupId, 'done');
        await refresh();
      } catch {
        // A failed write leaves the group untouched; the next open shows the
        // real state rather than a phantom tick.
      }
    },
    [refresh]
  );

  // Cold start: the app was launched by pressing the notification.
  const lastTap = useLastReminderTap();
  useEffect(() => {
    if (!ready || !lastTap) return;
    const key = `${lastTap.groupId}:${lastTap.markDone}`;
    if (handledTap.current === key) return;
    handledTap.current = key;
    void markDone(lastTap);
  }, [ready, lastTap, markDone]);

  // While running or backgrounded.
  useEffect(() => onReminderTap((tap) => void markDone(tap)), [markDone]);

  // Reschedule whenever groups or the miss history change. The schedule is
  // rebuilt wholesale, so there is no partial state to reconcile.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      const wantsReminders = groups.some((g) => g.status === 'building' && g.reminderEnabled);
      if (!wantsReminders) {
        await syncReminders([], []);
        return;
      }

      // Ask once per session, and only when a reminder is actually wanted — a
      // permission prompt before the user has any habit is noise.
      if (!permissionAsked.current) {
        permissionAsked.current = true;
        const granted = await ensurePermission();
        if (!granted || cancelled) return;
      }

      if (!cancelled) await syncReminders(groups, logs);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, groups, logs]);

  return null;
}
