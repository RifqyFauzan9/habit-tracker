// PRD §4.3 — habit stacking with a negotiation loop.
// One slot for the whole group, max three rounds, and every rejection from the
// session is sent back to the model so it never repeats a rejected shape.
import { RateLimited, type ResponseSchema, structuredCall } from '../_shared/llm.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { authenticate } from '../_shared/supabase.ts';

const MAX_ROUNDS = 3;

interface Round {
  start_time: string;
  end_time: string;
  anchor: string;
  reason: string;
  rejection_reason?: string;
}

interface Suggestion {
  start_time: string;
  end_time: string;
  anchor: string;
  reason: string;
}

const SYSTEM = `Kamu penata jadwal untuk aplikasi habit tracker berbahasa Indonesia, memakai prinsip habit stacking dari Atomic Habits.

Tugasmu: cari SATU celah waktu realistis untuk seluruh grup kebiasaan baru, menempel pada rutinitas yang sudah ada.

Aturan keras:
- Satu usulan saja, untuk seluruh grup — bukan satu slot per langkah.
- Tempelkan ke rutinitas existing ("setelah X"), jangan menaruh di jam yang bentrok dengan blok rutinitas yang sudah padat.
- alasan maksimal dua kalimat, bahasa Indonesia santai, menyebut rutinitas yang jadi jangkarnya.
- Kamu akan diberi seluruh riwayat penolakan sesi ini. Usulan barumu TIDAK BOLEH mirip dengan yang sudah ditolak — beda jam, beda jangkar, dan hormati alasan penolakannya.
- Durasi usulan mengikuti durasi yang diminta pengguna.
- Jangan menyebut dirimu AI, jangan menjelaskan prosesmu, jangan menawarkan lebih dari satu opsi.`;

const SCHEMA: ResponseSchema = {
  type: 'object',
  required: ['start_time', 'end_time', 'anchor', 'reason'],
  propertyOrdering: ['start_time', 'end_time', 'anchor', 'reason'],
  properties: {
    start_time: { type: 'string', description: 'format HH:MM 24 jam' },
    end_time: { type: 'string', description: 'format HH:MM 24 jam' },
    anchor: { type: 'string', description: 'rutinitas existing yang jadi jangkar, satu frasa pendek' },
    reason: { type: 'string', description: 'alasan 1-2 kalimat' },
  },
};

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const auth = await authenticate(req);
  if (!auth) return fail('unauthorized', 'Sesi tidak valid.', 401);

  let body: { session_id?: string; draft?: Record<string, unknown>; rejection_reason?: string };
  try {
    body = await req.json();
  } catch {
    return fail('invalid_body', 'Body harus JSON.');
  }

  const { supabase, userId } = auth;

  // Load or open the session. Rejection history lives in the DB, not in client
  // memory, so a reload mid-negotiation does not reset the loop.
  let sessionId = body.session_id ?? null;
  let rounds: Round[] = [];
  let draft = body.draft ?? {};

  if (sessionId) {
    const { data, error } = await supabase
      .from('negotiation_sessions')
      .select('id, draft, rounds')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) return fail('session_not_found', 'Sesi negosiasi tidak ditemukan.', 404);
    rounds = (data.rounds as Round[]) ?? [];
    draft = (data.draft as Record<string, unknown>) ?? draft;
  } else {
    const { data, error } = await supabase
      .from('negotiation_sessions')
      .insert({ user_id: userId, draft })
      .select('id')
      .single();
    if (error || !data) return fail('session_create_failed', 'Gagal membuka sesi negosiasi.', 500);
    sessionId = data.id;
  }

  // Attach the rejection to the round it belongs to before asking again.
  if (body.rejection_reason && rounds.length > 0) {
    rounds[rounds.length - 1].rejection_reason = body.rejection_reason;
  }

  if (rounds.length >= MAX_ROUNDS) {
    await supabase
      .from('negotiation_sessions')
      .update({ rounds, round_count: rounds.length, final_status: 'manual' })
      .eq('id', sessionId);
    // §4.3: stop arguing — hand the time picker back to the user.
    return json({ session_id: sessionId, round: rounds.length, max_rounds: MAX_ROUNDS, exhausted: true, suggestion: null });
  }

  const [{ data: blocks }, { data: groups }] = await Promise.all([
    supabase.from('routine_blocks')
      .select('label, start_time, end_time, source')
      .is('deleted_at', null)
      .order('start_time'),
    supabase.from('habit_groups')
      .select('name, days, start_time, end_time')
      .is('deleted_at', null)
      .eq('status', 'building'),
  ]);

  try {
    const suggestion = await structuredCall<Suggestion>({
      userId,
      feature: 'schedule_merge',
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 700,
      userMessage: JSON.stringify({
        rutinitas_existing: blocks ?? [],
        grup_yang_sedang_dibangun: groups ?? [],
        grup_baru: draft,
        riwayat_usulan_ditolak: rounds.map((r) => ({
          jam: `${r.start_time}-${r.end_time}`,
          jangkar: r.anchor,
          alasan_ditolak: r.rejection_reason ?? null,
        })),
      }),
    });

    rounds.push({ ...suggestion });
    await supabase
      .from('negotiation_sessions')
      .update({ rounds, round_count: rounds.length, draft })
      .eq('id', sessionId);

    return json({
      session_id: sessionId,
      round: rounds.length,
      max_rounds: MAX_ROUNDS,
      exhausted: false,
      suggestion,
    });
  } catch (error) {
    if (error instanceof RateLimited) return fail('rate_limited', error.message, 429);
    console.error('[schedule-merge]', error);
    return fail('merge_failed', 'Belum bisa mengusulkan jadwal. Pilih jam sendiri dulu.', 502);
  }
});
