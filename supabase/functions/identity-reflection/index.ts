// PRD §4.11 — one tentative observation about the user's routine, offered after
// onboarding. Always a question, never a verdict, and always skippable.
import { RateLimited, type ResponseSchema, structuredCall } from '../_shared/llm.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { authenticate } from '../_shared/supabase.ts';

interface Reflection {
  observation: string | null;
  identity_label: string | null;
}

const SYSTEM = `Kamu membaca peta rutinitas harian seseorang di aplikasi habit tracker berbahasa Indonesia.

Tawarkan MAKSIMAL SATU observasi tentatif tentang apa yang tampaknya ia prioritaskan, lalu satu label identitas singkat yang mungkin cocok.

Aturan keras:
- Selalu tentatif dan berbentuk pertanyaan konfirmasi: "Sepertinya kamu ... — betul?"
- Jangan pernah memberi label kepribadian final, diagnosis, atau penilaian moral. Orang bangun jam 5 bisa karena macet, bukan karena disiplin.
- Kalau datanya terlalu tipis untuk mengatakan apa pun, kembalikan observation = null dan identity_label = null. Ini pilihan yang benar, bukan kegagalan.
- identity_label ditulis sebagai identitas positif dan singkat, misalnya "orang yang menjaga waktu paginya". Maksimal 6 kata.
- Satu kalimat saja. Jangan menyebut dirimu AI.`;

const SCHEMA: ResponseSchema = {
  type: 'object',
  required: ['observation', 'identity_label'],
  propertyOrdering: ['observation', 'identity_label'],
  properties: {
    observation: { type: 'string', nullable: true, description: 'satu kalimat konfirmasi, atau null' },
    identity_label: { type: 'string', nullable: true, description: 'label identitas positif, atau null' },
  },
};

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const auth = await authenticate(req);
  if (!auth) return fail('unauthorized', 'Sesi tidak valid.', 401);

  const { data: blocks, error } = await auth.supabase
    .from('routine_blocks')
    .select('label, start_time, end_time, source')
    .is('deleted_at', null)
    .order('start_time');

  if (error) return fail('load_failed', 'Gagal membaca rutinitas.', 500);
  if (!blocks || blocks.length < 3) {
    // Too little to say anything honest — skip rather than guess (§4.11).
    return json({ observation: null, identity_label: null });
  }

  try {
    const result = await structuredCall<Reflection>({
      userId: auth.userId,
      feature: 'identity_reflection',
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 400,
      userMessage: JSON.stringify({ rutinitas: blocks }),
    });
    return json(result);
  } catch (err) {
    if (err instanceof RateLimited) return fail('rate_limited', err.message, 429);
    console.error('[identity-reflection]', err);
    // Non-blocking by design: a failure just means no observation this time.
    return json({ observation: null, identity_label: null });
  }
});
