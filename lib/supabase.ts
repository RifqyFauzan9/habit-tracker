import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are missing — copy .env.example to .env.'
  );
}

/**
 * Expo Router pre-renders web routes in Node, where there is no `window` — and
 * AsyncStorage's web implementation reaches for `window.localStorage` the moment
 * the auth client initialises. Nothing is persisted during that pass anyway
 * (useEffect never runs), so the server render gets a throwaway store.
 */
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';

const memoryStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: isServerRender ? memoryStorage : AsyncStorage,
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    // There is no deep-link callback in this app yet; sessions come from
    // anonymous sign-in, not from a URL.
    detectSessionInUrl: false,
  },
});

/**
 * PRD §8: the app is multi-user from day one, but personal use should not open
 * with a login wall. An anonymous user is a real auth.users row — RLS applies
 * exactly the same — and can be upgraded to email later without losing data.
 */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;

  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error || !created.user) {
    throw new Error(error?.message ?? 'Gagal memulai sesi.');
  }
  return created.user.id;
}

/** Backend error envelope from the edge functions (`fail()` in _shared/http.ts). */
export function readApiError(payload: unknown, fallback: string): string {
  const message = (payload as { error?: { message?: string } } | null)?.error?.message;
  return message ?? fallback;
}
