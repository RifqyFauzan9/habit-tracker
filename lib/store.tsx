import { activeDateKey, toDateKey } from '@/lib/date';
import { evaluateGates, SOFT_CAP_BUILDING_GROUPS } from '@/lib/gates';
import {
  MOCK_FINANCE,
  MOCK_GROUPS,
  MOCK_IDENTITY_TAGS,
  MOCK_LOGS,
  MOCK_ROUTINE_BLOCKS,
} from '@/lib/mock-data';
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
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

  todayGroups: HabitGroup[];
  buildingCount: number;
  atSoftCap: boolean;

  statusFor: (groupId: string) => 'done' | 'missed' | 'pending';
  gatesFor: (groupId: string) => GateProgress;
  tagFor: (groupId: string) => IdentityTag | undefined;

  toggleToday: (groupId: string) => void;
  setDraft: (draft: PendingGroupDraft | null) => void;
  updateDraft: (patch: Partial<PendingGroupDraft>) => void;
  commitDraft: () => string;
  markMastered: (groupId: string) => void;
  declineMastery: (groupId: string) => void;
  reactivate: (groupId: string) => void;
  toggleReminder: (groupId: string) => void;
  setRoutineBlocks: (blocks: RoutineBlock[]) => void;
  finishOnboarding: (blocks: RoutineBlock[]) => void;
  addIdentityTag: (label: string) => IdentityTag;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [routineBlocks, setRoutineBlocksState] = useState<RoutineBlock[]>(MOCK_ROUTINE_BLOCKS);
  const [groups, setGroups] = useState<HabitGroup[]>(MOCK_GROUPS);
  const [logs, setLogs] = useState<HabitLog[]>(MOCK_LOGS);
  const [identityTags, setIdentityTags] = useState<IdentityTag[]>(MOCK_IDENTITY_TAGS);
  const [finance, setFinance] = useState<FinanceSetting>(MOCK_FINANCE);
  const [financeLogs, setFinanceLogs] = useState<FinanceLog[]>([]);
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [draft, setDraft] = useState<PendingGroupDraft | null>(null);

  const todayKey = activeDateKey();

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

  const toggleToday = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const wasDone = statusFor(groupId) === 'done';

      setLogs((prev) => {
        const rest = prev.filter((l) => !(l.groupId === groupId && l.date === todayKey));
        return wasDone ? rest : [...rest, { groupId, date: todayKey, status: 'done' as const }];
      });

      // PRD §4.6: one vote per group per day, and only when a tag is attached.
      if (!group.identityTagId) return;
      setIdentityTags((prev) =>
        prev.map((tag) =>
          tag.id === group.identityTagId
            ? { ...tag, points: Math.max(0, tag.points + (wasDone ? -1 : 1)) }
            : tag
        )
      );
    },
    [groups, statusFor, todayKey]
  );

  const updateDraft = useCallback((patch: Partial<PendingGroupDraft>) => {
    setDraft((prev) => ({ ...(prev ?? EMPTY_DRAFT), ...patch }));
  }, []);

  const commitDraft = useCallback(() => {
    const current = draft ?? EMPTY_DRAFT;
    const groupId = `grp-${Date.now()}`;
    const steps = current.steps.length > 0 ? current.steps : [current.name];
    const group: HabitGroup = {
      id: groupId,
      name: current.groupName || current.name,
      days: current.days,
      startTime: current.startTime,
      endTime: current.endTime,
      location: current.location,
      identityTagId: current.identityTagId,
      status: 'building',
      createdAt: toDateKey(new Date()),
      masteredAt: null,
      lastReactivatedAt: null,
      reminderEnabled: true,
      masteryOfferDeclinedAt: null,
      habits: steps.map((name, index) => ({
        id: `hb-${groupId}-${index}`,
        groupId,
        name,
        order: index,
        triggerType: 'time_based' as const,
      })),
    };
    setGroups((prev) => [...prev, group]);
    setDraft(null);
    return groupId;
  }, [draft]);

  /** PRD §4.8: a mastered group folds into the permanent routine map. */
  const markMastered = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const today = toDateKey(new Date());
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, status: 'mastered', masteredAt: today, reminderEnabled: false }
            : g
        )
      );
      setRoutineBlocksState((prev) => [
        ...prev,
        {
          id: `rb-${groupId}`,
          label: group.name,
          startTime: group.startTime,
          endTime: group.endTime,
          source: 'mastered_group',
        },
      ]);
    },
    [groups]
  );

  const declineMastery = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, masteryOfferDeclinedAt: toDateKey(new Date()) } : g
      )
    );
  }, []);

  /** PRD §4.8 safety net: gate progress restarts from the reactivation point. */
  const reactivate = useCallback((groupId: string) => {
    const today = toDateKey(new Date());
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              status: 'building',
              masteredAt: null,
              lastReactivatedAt: today,
              reminderEnabled: true,
              masteryOfferDeclinedAt: null,
            }
          : g
      )
    );
    setRoutineBlocksState((prev) => prev.filter((b) => b.id !== `rb-${groupId}`));
  }, []);

  const toggleReminder = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, reminderEnabled: !g.reminderEnabled } : g))
    );
  }, []);

  const finishOnboarding = useCallback((blocks: RoutineBlock[]) => {
    setRoutineBlocksState(blocks);
    setOnboardingDone(true);
  }, []);

  const addIdentityTag = useCallback((label: string) => {
    const tag: IdentityTag = {
      id: `tag-${Date.now()}`,
      label,
      source: 'manual',
      points: 0,
    };
    setIdentityTags((prev) => [...prev, tag]);
    return tag;
  }, []);

  const enableFinance = useCallback(() => {
    setFinance((prev) => ({ ...prev, enabled: true, educationSeen: true }));
  }, []);

  const updateFinance = useCallback((patch: Partial<FinanceSetting>) => {
    setFinance((prev) => ({ ...prev, ...patch }));
  }, []);

  /** PRD §4.7: the prompt never pushes past the allowance the user set. */
  const allocate = useCallback(() => {
    setFinanceLogs((prev) => {
      const used = prev.reduce((sum, log) => sum + log.percent, 0);
      if (used + finance.incrementPercent > finance.totalPercent) return prev;
      return [
        ...prev,
        {
          id: `fin-${Date.now()}`,
          date: toDateKey(new Date()),
          percent: finance.incrementPercent,
        },
      ];
    });
  }, [finance.incrementPercent, finance.totalPercent]);

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
      setRoutineBlocks: setRoutineBlocksState,
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
