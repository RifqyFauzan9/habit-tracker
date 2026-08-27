// LLM layer — Google Gemini via REST (PRD §6.4).
//
// Plain fetch instead of an SDK on purpose: one endpoint, one response shape,
// and no npm resolution to break inside the Deno edge runtime.
//
// Swapping provider later means rewriting only callModel() below; the three
// edge functions call structuredCall() and never see a provider detail.
import { adminClient } from './supabase.ts';
import { sha256 } from './http.ts';

export type Feature = 'ambiguity_check' | 'schedule_merge' | 'identity_reflection';

/**
 * PRD §6.4: light model for the two short calls, mid model for the merge engine
 * which reasons over the whole routine map. Verified against the live free-tier
 * key — gemini-2.5-* is closed to new keys, so these are the 3.x equivalents.
 */
export const MODELS: Record<Feature, string> = {
  ambiguity_check: 'gemini-3.5-flash-lite',
  schedule_merge: 'gemini-3.6-flash',
  identity_reflection: 'gemini-3.5-flash-lite',
};

/**
 * Thinking is on by default and dominated token spend in testing (545 of 682
 * tokens for a trivial clarity check). "low" cut that ~3.6x with no quality
 * loss on these tasks. Note thinkingBudget:0 is rejected by 3.x — the level
 * enum is the only lever.
 */
const THINKING_LEVEL: Record<Feature, 'low' | 'medium' | 'high'> = {
  ambiguity_check: 'low',
  schedule_merge: 'low',
  identity_reflection: 'low',
};

/** Per-user guards (§6.4). The negotiation loop can fire repeatedly in one session. */
const RATE_LIMIT_PER_MINUTE: Record<Feature, number> = {
  ambiguity_check: 12,
  schedule_merge: 12,
  identity_reflection: 4,
};
const RATE_LIMIT_PER_DAY = 200;

const CACHE_TTL_SECONDS: Record<Feature, number> = {
  ambiguity_check: 60 * 60,
  schedule_merge: 10 * 60,
  identity_reflection: 24 * 60 * 60,
};

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class RateLimited extends Error {}

/**
 * Gemini accepts an OpenAPI subset: type, description, nullable, enum, items,
 * properties, required, propertyOrdering. It does NOT accept JSON Schema's
 * `additionalProperties` or union types like `["string", "null"]` — use
 * `nullable: true` instead, or the request fails with 400.
 */
export interface ResponseSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  propertyOrdering?: string[];
}

export async function assertWithinRateLimit(userId: string, feature: Feature): Promise<void> {
  const admin = adminClient();
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [{ count: perMinute }, { count: perDay }] = await Promise.all([
    admin.from('ai_usage_events').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('feature', feature).gte('created_at', minuteAgo),
    admin.from('ai_usage_events').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', dayAgo),
  ]);

  if ((perMinute ?? 0) >= RATE_LIMIT_PER_MINUTE[feature]) {
    throw new RateLimited('Terlalu banyak permintaan. Coba lagi sebentar lagi.');
  }
  if ((perDay ?? 0) >= RATE_LIMIT_PER_DAY) {
    throw new RateLimited('Batas harian AI tercapai. Coba lagi besok.');
  }
}

async function readCache<T>(userId: string, feature: Feature, key: string): Promise<T | null> {
  const { data } = await adminClient()
    .from('ai_response_cache')
    .select('response')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('cache_key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return (data?.response as T) ?? null;
}

async function writeCache(userId: string, feature: Feature, key: string, response: unknown) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS[feature] * 1000).toISOString();
  const { error } = await adminClient().from('ai_response_cache').upsert(
    { user_id: userId, feature, cache_key: key, response, expires_at: expiresAt },
    { onConflict: 'user_id,feature,cache_key' },
  );
  // A cache miss is survivable; a silent one is not — it looked like the cache
  // worked while every request was still paying for a model call.
  if (error) console.error('[llm] cache write failed', error.message);
}

interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

async function recordUsage(
  userId: string,
  feature: Feature,
  model: string,
  usage: GeminiUsage | undefined,
  latencyMs: number,
  cacheHit: boolean,
) {
  await adminClient().from('ai_usage_events').insert({
    user_id: userId,
    feature,
    model,
    input_tokens: usage?.promptTokenCount ?? 0,
    output_tokens: usage?.candidatesTokenCount ?? 0,
    // Billed but invisible in the response — tracked separately so §7's cost
    // model is not silently wrong by a factor of three.
    thinking_tokens: usage?.thoughtsTokenCount ?? 0,
    cache_read_input_tokens: usage?.cachedContentTokenCount ?? 0,
    cache_creation_input_tokens: 0,
    latency_ms: latencyMs,
    cache_hit: cacheHit,
  });
}

export interface StructuredCallOptions {
  userId: string;
  feature: Feature;
  system: string;
  userMessage: string;
  schema: ResponseSchema;
  maxTokens?: number;
}

async function callModel(
  model: string,
  feature: Feature,
  options: StructuredCallOptions,
): Promise<{ text: string; usage: GeminiUsage | undefined }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const response = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: [{ text: options.userMessage }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: options.schema,
        thinkingConfig: { thinkingLevel: THINKING_LEVEL[feature] },
        maxOutputTokens: options.maxTokens ?? 1024,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`gemini ${response.status}: ${payload?.error?.message ?? 'unknown error'}`);
  }

  const candidate = payload?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    // A safety block or a token cutoff lands here rather than silently
    // returning an empty object to the UI.
    throw new Error(`gemini returned no text (finishReason: ${candidate?.finishReason ?? 'none'})`);
  }

  return { text, usage: payload?.usageMetadata as GeminiUsage | undefined };
}

/**
 * PRD §6.4: structured JSON only — the result maps straight onto UI, never
 * parsed out of prose.
 */
export async function structuredCall<T>(options: StructuredCallOptions): Promise<T> {
  const feature = options.feature;
  const model = MODELS[feature];
  const cacheKey = await sha256(
    JSON.stringify([model, feature, options.system, options.userMessage]),
  );

  const cached = await readCache<T>(options.userId, feature, cacheKey);
  if (cached) {
    await recordUsage(options.userId, feature, model, undefined, 0, true);
    return cached;
  }

  await assertWithinRateLimit(options.userId, feature);

  const startedAt = Date.now();
  const { text, usage } = await callModel(model, feature, options);
  await recordUsage(options.userId, feature, model, usage, Date.now() - startedAt, false);

  let result: T;
  try {
    result = JSON.parse(text) as T;
  } catch {
    throw new Error('gemini returned malformed JSON');
  }

  await writeCache(options.userId, feature, cacheKey, result);
  return result;
}
