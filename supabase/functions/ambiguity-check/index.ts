// PRD §4.2.1 — runs on submit, before the habit is saved.
// It asks one short question when something is vague; it never rejects.
import { RateLimited, type ResponseSchema, structuredCall } from '../_shared/llm.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { authenticate } from '../_shared/supabase.ts';

interface HabitDraft {
  name: string;
  location: string;
  days: number[];
  start_time: string;
  end_time: string;
  identity_tag_label?: string | null;
}

interface AmbiguityResult {
  clear: boolean;
  question: string | null;
  note: string;
  suggested_name?: string | null;
}

const SYSTEM = `Kamu penilai kejelasan kebiasaan untuk aplikasi habit tracker berbahasa Indonesia.

Cek empat hal:
1. Nama kebiasaan harus actionable dan konkret, bukan tujuan abstrak. "jadi lebih sehat" tidak lolos; "jalan kaki 20 menit" lolos.
2. Lokasi cukup spesifik. "di rumah" boleh, tapi kalau bisa dipertajam jadi "di kamar", tanyakan.
3. Rentang jam masuk akal: durasi bukan 0 menit, dan tidak melewati tengah malam tanpa alasan.
4. Hari terisi.

Aturan keras:
- Jika ada yang ambigu, ajukan TEPAT SATU pertanyaan singkat, ramah, bahasa Indonesia santai. Jangan menolak, jangan menggurui, jangan menumpuk pertanyaan.
- Kalau semua jelas, clear = true dan question = null.
- note maksimal satu kalimat pendek yang menjelaskan kenapa ini jelas atau apa yang kurang.
- Jangan pernah menyebut dirimu AI atau menjelaskan proses penilaianmu.`;

const SCHEMA: ResponseSchema = {
  type: 'object',
  required: ['clear', 'question', 'note', 'suggested_name'],
  propertyOrdering: ['clear', 'question', 'note', 'suggested_name'],
  properties: {
    clear: { type: 'boolean', description: 'true bila tidak ada yang perlu ditanyakan' },
    question: { type: 'string', nullable: true, description: 'satu pertanyaan singkat, atau null' },
    note: { type: 'string', description: 'satu kalimat pendek' },
    suggested_name: {
      type: 'string',
      nullable: true,
      description: 'usulan nama yang lebih konkret bila nama asli terlalu umum, selain itu null',
    },
  },
};

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const auth = await authenticate(req);
  if (!auth) return fail('unauthorized', 'Sesi tidak valid.', 401);

  let draft: HabitDraft;
  try {
    draft = (await req.json()).draft;
  } catch {
    return fail('invalid_body', 'Body harus JSON dengan field "draft".');
  }
  if (!draft?.name) return fail('invalid_body', 'draft.name wajib diisi.');

  try {
    const result = await structuredCall<AmbiguityResult>({
      userId: auth.userId,
      feature: 'ambiguity_check',
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 512,
      userMessage: JSON.stringify({
        nama: draft.name,
        lokasi: draft.location,
        hari: draft.days,
        jam_mulai: draft.start_time,
        jam_selesai: draft.end_time,
        identitas: draft.identity_tag_label ?? null,
      }),
    });
    return json(result);
  } catch (error) {
    if (error instanceof RateLimited) return fail('rate_limited', error.message, 429);
    console.error('[ambiguity-check]', error);
    // Never block saving on an AI outage — the check is advisory (§4.2.1).
    return json({ clear: true, question: null, note: '', suggested_name: null, degraded: true });
  }
});
