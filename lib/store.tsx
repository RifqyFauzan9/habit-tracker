import * as api from '@/lib/api';
import { activeDateKey } from '@/lib/date';
import { evaluateGates, SOFT_CAP_BUILDING_GROUPS } from '@/lib/gates';
import { ensureSession } from '@/lib/supabase';
import type {
  FinanceLog,
  FinanceSetting,
  GateProgress,
  HabitDraft,
  HabitGroup,
  HabitLog,
  IdentityTag,
  RoutineBlock,
  Weekday,
} from '@/lib/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface PendingGroupDraft extends HabitDraft {
  groupName: string;
  steps: string[];
}

interface StoreValue {
  routineBlocks: RoutineBlock[];
  groups: HabitGroup[];
  logs: HabitLog[];
  identityTags: IdentityTag[];
  finance: FinanceSetting;
  financeLogs: FinanceLog[];
  onboardingDone: boolean;
  draft: PendingGroupDraft | null;
  todayKey: string;

  /** False until the session and the first snapshot have loaded. */
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  todayGroups: HabitGroup[];
  buildingCount: number;
  atSoftCap: boolean;

  statusFor: (groupId: string) => 'done' | 'missed' | 'pending';
  gatesFor: (groupId: string) => GateProgress;
  tagFor: (groupId: string) => IdentityTag | undefined;

  toggleToday: (groupId: string) => void;
  setDraft: (draft: PendingGroupDraft | null) => void;
  updateDraft: (patch: Partial<PendingGroupDraft>) => void;
  commitDraft: () => Promise<string>;
  markMastered: (groupId: string) => void;
  declineMastery: (groupId: string) => void;
  reactivate: (groupId: string) => void;
  toggleReminder: (groupId: string) => void;
  setRoutineBlocks: (blocks: RoutineBlock[]) => void;
  finishOnboarding: (blocks: RoutineBlock[]) => Promise<void>;
  addIdentityTag: (label: string) => Promise<IdentityTag>;
  enableFinance: () => void;
  updateFinance: (patch: Partial<FinanceSetting>) => void;
  allocate: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const EMPTY_DRAFT: PendingGroupDraft = {
  name: '',
  location: '',
  days: [1, 3, 5] as Weekday[],
  startTime: '21:00',
  endTime: '21:30',
  identityTagId: null,
  groupName: '',
  steps: [],
};

const EMPTY_FINANCE: FinanceSetting = {
  month: '',
  totalPercent: 30,
  incrementPercent: 1,
  enabled: false,
  educationSeen: false,
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [routineBlocks, setRoutineBlocksState] = useState<RoutineBlock[]>([]);
  const [groups, setGroups] = useState<HabitGroup[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [identityTags, setIdentityTags] = useState<IdentityTag[]>([]);
  const [finance, setFinance] = useState<FinanceSetting>(EMPTY_FINANCE);
  const [financeLogs, setFinanceLogs] = useState<FinanceLog[]>([]);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [draft, setDraft] = useState<PendingGroupDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayKey = activeDateKey();

  const applySnapshot = useCallback((snapshot: api.Snapshot) => {
    setRoutineBlocksState(snapshot.routineBlocks);
    setGroups(snapshot.groups);
    setLogs(snapshot.logs);
    setIdentityTags(snapshot.identityTags);
    setFinance(snapshot.finance);
    setFinanceLogs(snapshot.financeLogs);
    setOnboardingDone(snapshot.onboardingDone);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySnapshot(await api.loadSnapshot());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data.');
    }
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await ensureSession();
        if (cancelled) return;
        setUserId(id);
        applySnapshot(await api.loadSnapshot());
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memulai sesi.');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySnapshot]);

  const statusFor = useCallback(
    (groupId: string): 'done' | 'missed' | 'pending' => {
      const log = logs.find((l) => l.groupId === groupId && l.date === todayKey);
      return log?.status ?? 'pending';
    },
    [logs, todayKey]
  );

  const tagFor = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      return identityTags.find((t) => t.id === group?.identityTagId);
    },
    [groups, identityTags]
  );

  // Gates are evaluated client-side from data already loaded, mirroring
  // public.evaluate_gates(). The server stays the authority for actually
  // granting `mastered` — this is only what the progress bars read.
  const gatesFor = useCallback(
    (groupId: string): GateProgress => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        return {
          points: { current: 0, target: 40, passed: false },
          consistency: { current: 0, target: 80, passed: false },
          age: { current: 0, target: 21, passed: false },
          allPassed: false,
        };
      }
      return evaluateGates(group, logs, identityTags);
    },
    [groups, logs, identityTags]
  );

  const todayGroups = useMemo(() => {
    const weekday = new Date().getDay() as Weekday;
    return groups.filter((g) => g.status === 'building' && g.days.includes(weekday));
  }, [groups]);

  const buildingCount = useMemo(
    () => groups.filter((g) => g.status === 'building').length,
    [groups]
  );

  /**
   * Optimistic by design (frontend rules): the tap flips instantly, the write
   * follows, and a failure re-reads the server rather than leaving a lie on
   * screen. The identity point is mirrored locally because the real +1 comes
   * from a database trigger we would otherwise have to wait for.
   */
  const toggleToday = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const wasDone = statusFor(groupId) === 'done';

      setLogs((prev) => {
        const rest = prev.filter((l) => !(l.groupId === groupId && l.date === todayKey));
        return wasDone ? rest : [...rest, { groupId, date: todayKey, status: 'done' as const }];
      });
      if (group.identityTagId) {
        setIdentityTags((prev) =>
          prev.map((tag) =>
            tag.id === group.identityTagId
              ? { ...tag, points: Math.max(0, tag.points + (wasDone ? -1 : 1)) }
              : tag
          )
        );
      }

      (wasDone ? api.clearLog(groupId) : api.setLogStatus(groupId, 'done')).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
        void refresh();
      });
    },
    [groups, statusFor, todayKey, refresh]
  );

  const updateDraft = useCallback((patch: Partial<PendingGroupDraft>) => {
    setDraft((prev) => ({ ...(prev ?? EMPTY_DRAFT), ...patch }));
  }, []);

  const commitDraft = useCallback(async (): Promise<string> => {
    if (!userId) throw new Error('Sesi belum siap.');
    const current = draft ?? EMPTY_DRAFT;
    const groupId = await api.createGroup(userId, {
      name: current.groupName || current.name,
      days: current.days,
      startTime: current.startTime,
      endTime: current.endTime,
      location: current.location,
      identityTagId: current.identityTagId,
      steps: current.steps.filter((step) => step.trim().length > 0),
    });
    setDraft(null);
    await refresh();
    return groupId;
  }, [draft, userId, refresh]);

  /** PRD §4.8: force=true — the reflective friction already happened in the UI. */
  const markMastered = useCallback(
    (groupId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, status: 'mastered', reminderEnabled: false } : g
        )
      );
      api.markMastered(groupId, true).then(refresh).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
        void refresh();
      });
    },
    [refresh]
  );

  const declineMastery = useCallback(
    (groupId: string) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, masteryOfferDeclinedAt: todayKey } : g))
      );
      api.declineMasteryOffer(groupId).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
        void refresh();
      });
    },
    [todayKey, refresh]
  );

  const reactivate = useCallback(
    (groupId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                status: 'building',
                masteredAt: null,
                lastReactivatedAt: todayKey,
                reminderEnabled: true,
                masteryOfferDeclinedAt: null,
              }
            : g
        )
      );
      api.reactivateGroup(groupId).then(refresh).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
        void refresh();
      });
    },
    [todayKey, refresh]
  );

  const toggleReminder = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const next = !group.reminderEnabled;
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, reminderEnabled: next } : g))
      );
      api.setReminder(groupId, next).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
        void refresh();
      });
    },
    [groups, refresh]
  );

  const setRoutineBlocks = useCallback(
    (blocks: RoutineBlock[]) => {
      setRoutineBlocksState(blocks);
      if (!userId) return;
      api.replaceRoutineBlocks(userId, blocks).then(setRoutineBlocksState).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan rutinitas.');
        void refresh();
      });
    },
    [userId, refresh]
  );

  const finishOnboarding = useCallback(
    async (blocks: RoutineBlock[]) => {
      if (!userId) throw new Error('Sesi belum siap.');
      setRoutineBlocksState(await api.replaceRoutineBlocks(userId, blocks));
      await api.completeOnboarding(userId);
      setOnboardingDone(true);
    },
    [userId]
  );

  const addIdentityTag = useCallback(
    async (label: string): Promise<IdentityTag> => {
      if (!userId) throw new Error('Sesi belum siap.');
      const tag = await api.createIdentityTag(userId, label);
      setIdentityTags((prev) => [...prev, tag]);
      return tag;
    },
    [userId]
  );

  const persistFinance = useCallback(
    (next: FinanceSetting) => {
      setFinance(next);
      if (!userId) return;
      api.saveFinanceSetting(userId, next).catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
        void refresh();
      });
    },
    [userId, refresh]
  );

  const enableFinance = useCallback(() => {
    persistFinance({ ...finance, enabled: true, educationSeen: true });
  }, [finance, persistFinance]);

  const updateFinance = useCallback(
    (patch: Partial<FinanceSetting>) => {
      persistFinance({ ...finance, ...patch });
    },
    [finance, persistFinance]
  );

  /** PRD §4.7: the prompt never pushes past the allowance the user set. */
  const allocate = useCallback(() => {
    if (!userId) return;
    const used = financeLogs.reduce((sum, log) => sum + log.percent, 0);
    if (used + finance.incrementPercent > finance.totalPercent) return;

    api.logAllocation(userId, finance.incrementPercent)
      .then((log) => setFinanceLogs((prev) => [...prev, log]))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal mencatat alokasi.');
        void refresh();
      });
  }, [userId, financeLogs, finance.incrementPercent, finance.totalPercent, refresh]);

  const value = useMemo<StoreValue>(
    () => ({
      routineBlocks,
      groups,
      logs,
      identityTags,
      finance,
      financeLogs,
      onboardingDone,
      draft,
      todayKey,
      ready,
      error,
      refresh,
      todayGroups,
      buildingCount,
      atSoftCap: buildingCount >= SOFT_CAP_BUILDING_GROUPS,
      statusFor,
      gatesFor,
      tagFor,
      toggleToday,
      setDraft,
      updateDraft,
      commitDraft,
      markMastered,
      declineMastery,
      reactivate,
      toggleReminder,
      setRoutineBlocks,
      finishOnboarding,
      addIdentityTag,
      enableFinance,
      updateFinance,
      allocate,
    }),
    [
      routineBlocks,
      groups,
      logs,
      identityTags,
      finance,
      financeLogs,
      onboardingDone,
      draft,
      todayKey,
      ready,
      error,
      refresh,
      todayGroups,
      buildingCount,
      statusFor,
      gatesFor,
      tagFor,
      toggleToday,
      updateDraft,
      commitDraft,
      markMastered,
      declineMastery,
      reactivate,
      toggleReminder,
      setRoutineBlocks,
      finishOnboarding,
      addIdentityTag,
      enableFinance,
      updateFinance,
      allocate,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return value;
}
