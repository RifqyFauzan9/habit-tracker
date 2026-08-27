import type { HabitDraft, RoutineBlock } from '@/lib/types';

/**
 * Placeholder for the Edge Function calls in PRD §6.4. Same response shape as
 * the future structured LLM output, so only the transport swaps later.
 */
export interface AmbiguityResult {
  clear: boolean;
  question: string | null;
  note: string;
}

const VAGUE_NAMES = ['olahraga', 'sehat', 'produktif', 'rajin', 'belajar', 'lebih baik'];

export function checkAmbiguity(draft: HabitDraft): AmbiguityResult {
  const name = draft.name.trim().toLowerCase();
  if (name.length < 3) {
    return { clear: false, question: 'Nama kebiasaannya masih kosong. Mau ditulis apa?', note: '' };
  }
  const vague = VAGUE_NAMES.some((word) => name === word);
  if (vague) {
    return {
      clear: false,
      question: `"${draft.name}" masih terlalu umum. Bentuk konkretnya seperti apa — misalnya berapa lama atau berapa banyak?`,
      note: 'Nama yang konkret bikin kamu tahu persis apa yang harus dilakukan.',
    };
  }
  if (draft.location.trim().length < 3) {
    return {
      clear: false,
      question: 'Di mana tepatnya kebiasaan ini dilakukan?',
      note: 'Lokasi yang jelas jadi petunjuk otomatis buat otakmu.',
    };
  }
  if (draft.days.length === 0) {
    return { clear: false, question: 'Hari apa saja kebiasaan ini dijalankan?', note: '' };
  }
  return {
    clear: true,
    question: null,
    note: 'Actionable, lokasinya spesifik, dan jamnya masuk akal.',
  };
}

export interface SlotSuggestion {
  time: string;
  anchor: string;
  reason: string;
}

const FALLBACK_SLOTS: SlotSuggestion[] = [
  { time: '06:45', anchor: 'Setelah kopi pagi', reason: 'Pagi biasanya punya jendela tenang yang pendek sebelum harimu ramai.' },
  { time: '13:00', anchor: 'Setelah makan siang', reason: 'Jeda siang jarang dipakai apa-apa di petamu.' },
  { time: '20:30', anchor: 'Setelah makan malam', reason: 'Menempel ke rutinitas yang sudah ada, bukan bersaing dengan blok tersibukmu.' },
];

/** PRD §4.3: never repeat a slot the user already rejected in this session. */
export function suggestSlot(
  blocks: RoutineBlock[],
  draft: HabitDraft,
  rejectedTimes: string[]
): SlotSuggestion {
  const preferred: SlotSuggestion = {
    time: draft.startTime,
    anchor: `Sekitar ${draft.startTime} di ${draft.location || 'tempat biasamu'}`,
    reason:
      blocks.length > 0
        ? `Menyambung blok "${blocks[blocks.length - 1].label}" yang sudah ada di petamu.`
        : 'Menempel ke rutinitas yang sudah kamu jalani.',
  };
  const pool = [preferred, ...FALLBACK_SLOTS];
  return pool.find((slot) => !rejectedTimes.includes(slot.time)) ?? FALLBACK_SLOTS[2];
}
