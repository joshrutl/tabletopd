import { createAdminClient, createAnonClient } from "./supabase/admin";
import { validImageUrl } from "./images";
import { getThings, type Thing } from "./bgg";

const CACHE_TIMEOUT_MS = 4000;

export interface ResolvedImages {
  /** id -> cover URL, or null when BGG has no image for that game */
  images: Record<string, string | null>;
  /** Ids we couldn't check this time (BGG timeout / rate limit); callers should retry soon */
  transient: string[];
  /** Covers found at BGG just now; write these to the shared cache */
  fresh: Record<string, string>;
}

/**
 * Cover URLs for many games in one go: Supabase `game_images` cache first, then BGG's
 * /thing endpoint (batched, with an in-process cache). Needs BGG_API_TOKEN; without it
 * nothing is requested and every id is a plain null.
 */
export async function resolveImageIds(ids: string[]): Promise<ResolvedImages> {
  const unique = [...new Set(ids)].filter((id) => /^\d+$/.test(id));
  const images: Record<string, string | null> = {};
  const fresh: Record<string, string> = {};

  if (!process.env.BGG_API_TOKEN) {
    for (const id of unique) images[id] = null;
    return { images, transient: [], fresh };
  }

  // 1. Shared cache
  let remaining = unique;
  const sb = createAdminClient() ?? createAnonClient();
  if (sb && unique.length > 0) {
    try {
      const { data } = await sb
        .from("game_images")
        .select("bgg_id, image_url")
        .in("bgg_id", unique.map(Number))
        .abortSignal(AbortSignal.timeout(CACHE_TIMEOUT_MS));
      for (const row of data ?? []) {
        const url = validImageUrl(row.image_url);
        if (url) images[String(row.bgg_id)] = url;
      }
      remaining = unique.filter((id) => !images[id]);
    } catch {
      /* cache unavailable: fall through to BGG */
    }
  }

  // 2. BGG, batched
  const { things, failed } = remaining.length > 0 ? await getThings(remaining) : { things: new Map<string, Thing>(), failed: [] };
  const failedSet = new Set(failed);
  const transient: string[] = [];
  for (const id of remaining) {
    const t = things.get(id);
    const url = t ? validImageUrl(t.image) ?? validImageUrl(t.thumbnail) : null;
    if (url) {
      images[id] = url;
      fresh[id] = url;
    } else if (failedSet.has(id)) {
      transient.push(id);
      images[id] = null;
    } else {
      images[id] = null; // BGG answered but has no image for it
    }
  }
  return { images, transient, fresh };
}

/**
 * Writes covers to the shared cache. Best effort: failures are logged (RLS rejections come
 * back as `error` values, not exceptions) but never break a response. With the service key
 * this is a full upsert; with the anon key it is insert-only, so visitors can add a missing
 * cover but never overwrite one.
 */
export async function saveImages(rows: Record<string, string>): Promise<void> {
  const now = new Date().toISOString();
  const payload = Object.entries(rows).map(([id, url]) => ({ bgg_id: Number(id), image_url: url, updated_at: now }));
  if (payload.length === 0) return;
  const signal = AbortSignal.timeout(CACHE_TIMEOUT_MS);
  try {
    const admin = createAdminClient();
    const result = admin
      ? await admin.from("game_images").upsert(payload, { onConflict: "bgg_id" }).abortSignal(signal)
      : await createAnonClient()
          ?.from("game_images")
          .upsert(payload, { onConflict: "bgg_id", ignoreDuplicates: true })
          .abortSignal(signal);
    if (result?.error) console.error(`[game_images] couldn't cache ${payload.length} covers: ${result.error.message}`);
  } catch (e) {
    console.error("[game_images] cache write failed:", e instanceof Error ? e.message : e);
  }
}

/** Covers from freshly fetched BGG things, ready for saveImages(). */
export function imagesFromThings(things: Thing[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of things) {
    const url = validImageUrl(t.image) ?? validImageUrl(t.thumbnail);
    if (url) out[t.id] = url;
  }
  return out;
}
