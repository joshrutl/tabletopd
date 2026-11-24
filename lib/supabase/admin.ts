import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * Server-only client using the service-role key (bypasses RLS), or null when
 * SUPABASE_SERVICE_ROLE_KEY isn't set. Never import this from client code.
 */
export function createAdminClient(): SupabaseClient | null {
  return url && serviceKey ? createClient(url, serviceKey, opts) : null;
}

/** Server-side anonymous client for public reads (no cookies, no session). */
export function createAnonClient(): SupabaseClient | null {
  return url && anonKey ? createClient(url, anonKey, opts) : null;
}
