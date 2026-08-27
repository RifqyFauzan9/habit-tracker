import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Service role — used only for AI bookkeeping tables the user must not write. */
export function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Caller-scoped client: RLS still applies to everything it touches. */
export function userClient(authHeader: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

export interface AuthedRequest {
  userId: string;
  supabase: SupabaseClient;
}

export async function authenticate(req: Request): Promise<AuthedRequest | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabase = userClient(authHeader);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { userId: data.user.id, supabase };
}
