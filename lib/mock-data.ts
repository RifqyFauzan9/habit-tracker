import { addDays, toDateKey } from '@/lib/date';
import type {
  FinanceSetting,
  HabitGroup,
  HabitLog,
  IdentityTag,
  RoutineBlock,
} from '@/lib/types';

const now = new Date();

export const MOCK_IDENTITY_TAGS: IdentityTag[] = [
  { id: 'tag-disciplined', label: 'Disiplin', source: 'manual', points: 38 },
  { id: 'tag-healthy', label: 'Sehat', source: 'manual', points: 18 },
  { id: 'tag-learner', label: 'Pembelajar', source: 'manual', points: 12 },
  { id: 'tag-calm', label: 'Tenang', source: 'routine_reflection', points: 0 },
];

export const MOCK_ROUTINE_BLOCKS: RoutineBlock[] = [
  { id: 'rb-morning', label: 'Bangun & siap-siap', startTime: '06:00', endTime: '09:00', source: 'onboarding' },
  { id: 'rb-work', label: 'Kerja / belajar', startTime: '09:00', endTime: '12:00', source: 'onboarding' },
  { id: 'rb-afternoon', label: 'Siang–sore', startTime: '12:00', endTime: '18:00', source: 'onboarding' },
  { id: 'rb-evening', label: 'Malam di rumah', startTime: '18:00', endTime: '22:30', source: 'onboarding' },
];

export const MOCK_GROUPS: HabitGroup[] = [
  {
    id: 'grp-morning',
    name: 'Morning Routine',
    days: [1, 2, 3, 4, 5],
    startTime: '07:30',
    endTime: '08:00',
    location: 'Kamar → Dapur',
    identityTagId: 'tag-disciplined',
    status: 'mastered',
    createdAt: toDateKey(addDays(now, -96)),
    masteredAt: toDateKey(addDays(now, -22)),
    lastReactivatedAt: null,
    reminderEnabled: false,
    masteryOfferDeclinedAt: null,
    habits: [
      { id: 'hb-1', groupId: 'grp-morning', name: 'Rapikan tempat tidur', order: 0, triggerType: 'time_based' },
      { id: 'hb-2', groupId: 'grp-morning', name: 'Minum air putih', order: 1, triggerType: 'time_based' },
      { id: 'hb-3', groupId: 'grp-morning', name: 'Stretching 5 menit', order: 2, triggerType: 'time_based' },
    ],
  },
  {
    id: 'grp-walk',
    name: 'Jalan 10 menit',
    days: [1, 2, 3, 4, 5, 6, 0],
    startTime: '16:30',
    endTime: '17:00',
    location: 'Sekitar komplek',
    identityTagId: 'tag-healthy',
    status: 'building',
    createdAt: toDateKey(addDays(now, -26)),
    masteredAt: null,
    lastReactivatedAt: null,
    reminderEnabled: true,
    masteryOfferDeclinedAt: null,
    habits: [
      { id: 'hb-4', groupId: 'grp-walk', name: 'Jalan 10 menit', order: 0, triggerType: 'time_based' },
    ],
  },
  {
    id: 'grp-read',
    name: 'Baca 10 halaman',
    days: [1, 3, 5],
    startTime: '21:00',
    endTime: '21:30',
    location: 'Meja kerja',
    identityTagId: 'tag-learner',
    status: 'building',
    createdAt: toDateKey(addDays(now, -12)),
    masteredAt: null,
    lastReactivatedAt: null,
    reminderEnabled: true,
    masteryOfferDeclinedAt: null,
    habits: [
      { id: 'hb-5', groupId: 'grp-read', name: 'Baca 10 halaman', order: 0, triggerType: 'time_based' },
    ],
  },
];

function seedLogs(): HabitLog[] {
  const logs: HabitLog[] = [];
  const seeds: Record<string, { span: number; rate: number }> = {
    'grp-morning': { span: 96, rate: 0.94 },
    'grp-walk': { span: 26, rate: 0.78 },
    'grp-read': { span: 12, rate: 0.82 },
  };
  Object.entries(seeds).forEach(([groupId, { span, rate }]) => {
    for (let i = 1; i <= span; i += 1) {
      const date = toDateKey(addDays(now, -i));
      // Deterministic pseudo-random so the heatmap is stable across reloads.
      const hash = (groupId.length * 31 + i * 17) % 100;
      logs.push({ groupId, date, status: hash < rate * 100 ? 'done' : 'missed' });
    }
  });
  return logs;
}

export const MOCK_LOGS: HabitLog[] = seedLogs();

export const MOCK_FINANCE: FinanceSetting = {
  month: toDateKey(now).slice(0, 7),
  totalPercent: 30,
  incrementPercent: 1,
  enabled: false,
  educationSeen: false,
};

export const ONBOARDING_BLOCKS = [
  {
    id: 'wake',
    eyebrow: 'Bangun — 09:00',
    title: 'Apa yang biasanya\nkamu lakukan setelah bangun?',
    options: ['☕ Sarapan / kopi', '🚿 Siap-siap', '🧘 Olahraga', '🙏 Ibadah', '🧹 Beres-beres rumah'],
  },
  {
    id: 'morning',
    eyebrow: '09:00 — 12:00',
    title: 'Blok ini biasanya\ndiisi apa?',
    options: ['💻 Kerja', '📚 Belajar', '🚗 Perjalanan', '🙏 Ibadah', '👨‍👩‍👧 Keluarga', '🍳 Masak'],
  },
  {
    id: 'afternoon',
    eyebrow: '12:00 — 18:00',
    title: 'Siang sampai sore\nkamu ke mana?',
    options: ['💻 Kerja', '🏃 Olahraga', '🙏 Ibadah', '🏠 Di rumah', '😌 Waktu luang'],
  },
  {
    id: 'evening',
    eyebrow: '18:00 — malam',
    title: 'Apa penanda\nmalammu?',
    options: ['🍽 Makan malam', '👨‍👩‍👧 Waktu keluarga', '📱 Santai', '📖 Baca', '🙏 Ibadah'],
  },
  {
    id: 'bedtime',
    eyebrow: 'Sebelum tidur',
    title: 'Menjelang tidur,\nbiasanya apa?',
    options: ['📖 Baca', '📱 Scroll HP', '🧘 Refleksi', '🙏 Ibadah', '😴 Langsung tidur'],
  },
];
