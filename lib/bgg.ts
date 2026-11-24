import { XMLParser } from "fast-xml-parser";
import type { Game } from "./types";
import { firstValidImageUrl } from "./images";
import { decodeHtmlEntities } from "./text";

/**
 * Server-side access to BGG's official XML API2. Every request carries the app's
 * BGG_API_TOKEN, has a hard timeout, and /thing lookups are batched (20 ids per
 * request) and remembered in-process so repeat views never re-ask BGG.
 */

export const BGG = "https://boardgamegeek.com/xmlapi2";
const TIMEOUT_MS = 6000;
const THING_BATCH = 20; // BGG's /thing accepts at most 20 ids per request
const THING_TTL_MS = 6 * 60 * 60 * 1000;
const THING_CACHE_MAX = 4000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** GET + parse an XML API2 URL. Throws on a non-2xx response or timeout. */
export async function bggFetch(url: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/xml" };
  const token = process.env.BGG_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`BGG responded ${res.status}`);
  return parser.parse(await res.text());
}

/* --------------------------------- things --------------------------------- */

/** The metadata we use from a BGG <item>. */
export interface Thing {
  id: string;
  name: string;
  yearPublished: number | null;
  thumbnail: string | null;
  image: string | null;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  rating: number | null;
}

export function thingToGame(t: Thing): Game {
  return { ...t };
}

interface G {
  __bggThings?: Map<string, { thing: Thing; until: number }>;
  __bggActive?: number;
  __bggWaiters?: Array<() => void>;
}
const g = globalThis as unknown as G;
const cache = (g.__bggThings ??= new Map());
const waiters = (g.__bggWaiters ??= []);

/** At most 2 BGG /thing requests at once. */
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if ((g.__bggActive ?? 0) >= 2) await new Promise<void>((r) => waiters.push(r));
  g.__bggActive = (g.__bggActive ?? 0) + 1;
  try {
    return await fn();
  } finally {
    g.__bggActive = (g.__bggActive ?? 1) - 1;
    waiters.shift()?.();
  }
}

function remember(t: Thing) {
  if (cache.size >= THING_CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(t.id, { thing: t, until: Date.now() + THING_TTL_MS });
}

async function fetchBatch(ids: string[]): Promise<Thing[]> {
  const data = (await bggFetch(`${BGG}/thing?id=${ids.join(",")}&stats=1`)) as { items?: { item?: unknown } };
  return (toArray(data.items?.item) as Record<string, any>[]).map((item): Thing => {
    const names = toArray(item.name) as Record<string, any>[];
    const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
    const avg = num(item.statistics?.ratings?.average?.["@_value"], 0);
    const year = num(item.yearpublished?.["@_value"], 0);
    return {
      id: String(item["@_id"]),
      // BGG double-encodes some titles, e.g. "Andromeda&#039;s Edge"
      name: decodeHtmlEntities(String(primary?.["@_value"] ?? "Unknown")),
      yearPublished: year || null,
      // Newer games can have only one of <image> / <thumbnail>; fill in whichever is missing.
      thumbnail: firstValidImageUrl(item.thumbnail, item.image),
      image: firstValidImageUrl(item.image, item.thumbnail),
      minPlayers: num(item.minplayers?.["@_value"], 1),
      maxPlayers: num(item.maxplayers?.["@_value"], 1),
      playingTime: num(item.playingtime?.["@_value"], 0),
      rating: avg > 0 ? Math.round(avg * 10) / 10 : null,
    };
  });
}

export interface ThingsResult {
  /** Everything we have (cached or just fetched), keyed by id */
  things: Map<string, Thing>;
  /** Only the things fetched from BGG in this call (use these to fill the image cache) */
  fetched: Thing[];
  /** Ids whose batch request failed (timeout, rate limit...); unknown ids are simply absent */
  failed: string[];
}

/** Metadata for many games: cached ones instantly, the rest in batches of 20. Never throws. */
export async function getThings(ids: string[]): Promise<ThingsResult> {
  const unique = [...new Set(ids)];
  const things = new Map<string, Thing>();
  const missing: string[] = [];
  const now = Date.now();
  for (const id of unique) {
    const hit = cache.get(id);
    if (hit && hit.until > now) things.set(id, hit.thing);
    else missing.push(id);
  }

  const fetched: Thing[] = [];
  const failed: string[] = [];
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += THING_BATCH) batches.push(missing.slice(i, i + THING_BATCH));

  await Promise.all(
    batches.map((batch) =>
      limited(async () => {
        try {
          for (const t of await fetchBatch(batch)) {
            remember(t);
            things.set(t.id, t);
            fetched.push(t);
          }
        } catch (e) {
          console.error(`[bgg] /thing batch of ${batch.length} failed:`, e instanceof Error ? e.message : e);
          failed.push(...batch);
        }
      }),
    ),
  );
  return { things, fetched, failed };
}
