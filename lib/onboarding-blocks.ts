/**
 * Onboarding question set — PRD §4.1. Big time blocks with quick-pick chips,
 * never free text and never hour-by-hour, so the whole map takes under 5 minutes.
 * This is app content, not sample data: it survived the mock layer's removal.
 */
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
