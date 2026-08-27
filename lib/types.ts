export type GroupStatus = 'building' | 'mastered';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RoutineBlockSource = 'onboarding' | 'mastered_group';

export interface RoutineBlock {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  source: RoutineBlockSource;
}

export interface IdentityTag {
  id: string;
  label: string;
  source: 'manual' | 'routine_reflection';
  points: number;
}

export interface Habit {
  id: string;
  groupId: string;
  name: string;
  order: number;
  triggerType: 'time_based';
}

export interface HabitGroup {
  id: string;
  name: string;
  days: Weekday[];
  startTime: string;
  endTime: string;
  location: string;
  identityTagId: string | null;
  status: GroupStatus;
  createdAt: string;
  masteredAt: string | null;
  lastReactivatedAt: string | null;
  reminderEnabled: boolean;
  habits: Habit[];
  masteryOfferDeclinedAt: string | null;
}

export type LogStatus = 'done' | 'missed';

export interface HabitLog {
  groupId: string;
  date: string;
  status: LogStatus;
}

export interface FinanceSetting {
  month: string;
  totalPercent: number;
  incrementPercent: number;
  enabled: boolean;
  educationSeen: boolean;
}

export interface FinanceLog {
  id: string;
  date: string;
  percent: number;
}

export interface NegotiationRound {
  suggestion: string;
  reason: string;
  rejectionReason?: string;
}

export interface HabitDraft {
  name: string;
  location: string;
  days: Weekday[];
  startTime: string;
  endTime: string;
  identityTagId: string | null;
}

export interface GateProgress {
  points: { current: number; target: number; passed: boolean };
  consistency: { current: number; target: number; passed: boolean };
  age: { current: number; target: number; passed: boolean };
  allPassed: boolean;
}
