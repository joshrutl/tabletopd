import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when the env vars are missing; the app then runs on localStorage only. */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Browser Supabase client (a singleton), or null when Supabase isn't configured. */
export function createClient(): SupabaseClient | null {
  if (!url || !key) return null;
  client ??= createBrowserClient(url, key);
  return client;
}
