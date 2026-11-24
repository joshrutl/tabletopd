import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createAdminClient, createAnonClient } from "@/lib/supabase/admin";
import { validImageUrl } from "@/lib/images";
import { findSummaryThumbnail, findWikipediaCover } from "@/lib/wikiImage";
import { getGameName } from "@/lib/csvIndex";

export const dynamic = "force-dynamic";

const BGG_XML = "https://boardgamegeek.com/xmlapi2";
const BGG_PAGE = "https://boardgamegeek.com/boardgame";
const UA = "Mozilla/5.0 (compatible; Tabletopd/1.0)";
/** Hard cap on every outbound request so a slow upstream can never hang a card. */
const FETCH_TIMEOUT_MS = 3000;
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/* ---- process-level state (survives across requests on a warm instance) ---- */
interface Globals {
  __imgMem?: Map<number, { url: string | null; until: number }>;
  __imgInflight?: Map<number, Promise<string | null>>;
  __scrapeBlockedUntil?: number;
}
const g = globalThis as unknown as Globals;
const mem = (g.__imgMem ??= new Map());
const inflight = (g.__imgInflight ??= new Map());

/** At most 3 upstream lookups at once, so a page of cards can't hammer BGG or Wikipedia. */
let active = 0;
const waiters: Array<() => void> = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

/* --------------------------------- sources -------------------------------- */

/** 1. Shared cache in Supabase. */
async function fromSupabase(id: number): Promise<string | null> {
  const sb = createAdminClient() ?? createAnonClient();
  if (!sb) return null;
  const { data } = await sb
    .from("game_images")
    .select("image_url")
    .eq("bgg_id", id)
    .abortSignal(AbortSignal.timeout(FETCH_TIMEOUT_MS))
    .maybeSingle();
  return validImageUrl(data?.image_url);
}

/** 2. BGG XML API (needs BGG_API_TOKEN). */
async function fromBggApi(id: number): Promise<string | null> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${BGG_XML}/thing?id=${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/xml", "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = parser.parse(await res.text());
  const item = Array.isArray(data?.items?.item) ? data.items.item[0] : data?.items?.item;
  return validImageUrl(item?.image ?? item?.thumbnail);
}

/**
 * 3. BGG's public game page (og:image). BGG sits behind bot protection and
 * usually answers 403 to servers; when it does, back off for 30 minutes
 * instead of retrying on every card.
 */
async function fromBggPage(id: number): Promise<string | null> {
  if (Date.now() < (g.__scrapeBlockedUntil ?? 0)) return null;
  const res = await fetch(`${BGG_PAGE}/${id}`, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 403 || res.status === 429) {
    g.__scrapeBlockedUntil = Date.now() + BLOCK_MS;
    return null;
  }
  if (!res.ok) return null;
  const html = await res.text();
  const tag =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  return validImageUrl(tag?.[1]);
}

/**
 * 4. The game's Wikipedia article image (works from any cloud IP): the REST summary
 * thumbnail first (one cheap call), then the fuller lookup that can also return the
 * non-free box art the summary endpoint tends to leave out.
 */
async function fromWikipedia(name: string | null): Promise<string | null> {
  if (!name) return null;
  return (await findSummaryThumbnail(name)) ?? (await findWikipediaCover(name))?.url ?? null;
}

/* --------------------------------- caching -------------------------------- */

async function save(id: number, url: string) {
  const row = { bgg_id: id, image_url: url };
  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const admin = createAdminClient();
    if (admin) {
      await admin.from("game_images").upsert(row).abortSignal(signal);
      return;
    }
    // No service key: insert-only through the anon role (see the RLS policy in schema.sql).
    // Rows that already exist are left alone, so anon visitors can never overwrite a cached cover.
    await createAnonClient()
      ?.from("game_images")
      .upsert(row, { onConflict: "bgg_id", ignoreDuplicates: true })
      .abortSignal(signal);
  } catch {
    /* caching is best-effort: errors (RLS, timeout, missing table) are ignored */
  }
}

async function resolve(id: number, nameHint: string | null): Promise<string | null> {
  const cached = await fromSupabase(id).catch(() => null);
  if (cached) return cached;

  const name = getGameName(String(id)) ?? nameHint;
  const fresh = await limited(async () => {
    for (const source of [() => fromBggApi(id), () => fromBggPage(id), () => fromWikipedia(name)]) {
      try {
        const url = await source();
        if (url) return url;
      } catch {
        /* try the next source */
      }
    }
    return null;
  });
  if (fresh) await save(id, fresh);
  return fresh;
}

/* --------------------------------- handler -------------------------------- */

export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }
  // Only used when the local index doesn't know this id (e.g. a brand-new BGG game).
  const nameHint = req.nextUrl.searchParams.get("name")?.trim().slice(0, 100) || null;

  let url: string | null;
  const hit = mem.get(id);
  if (hit && hit.until > Date.now()) {
    url = hit.url;
  } else {
    let p = inflight.get(id);
    if (!p) {
      p = resolve(id, nameHint).finally(() => inflight.delete(id));
      inflight.set(id, p);
    }
    url = await p;
    mem.set(id, { url, until: Date.now() + (url ? HIT_TTL_MS : MISS_TTL_MS) });
  }

  return NextResponse.json(
    { imageUrl: url },
    {
      headers: {
        "Cache-Control": url
          ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
          : "public, max-age=60, s-maxage=300",
      },
    },
  );
}
