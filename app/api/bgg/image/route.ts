import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createAdminClient, createAnonClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { validImageUrl } from "@/lib/images";

export const dynamic = "force-dynamic";

const BGG_XML = "https://boardgamegeek.com/xmlapi2";
const BGG_PAGE = "https://boardgamegeek.com/boardgame";
const UA = "Mozilla/5.0 (compatible; Tabletopd/1.0)";
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

/** At most 3 upstream lookups at once, so a page of cards can't hammer BGG. */
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

/* --------------------------------- lookups -------------------------------- */

async function fromSupabase(id: number): Promise<string | null> {
  const sb = createAdminClient() ?? createAnonClient();
  if (!sb) return null;
  const { data } = await sb.from("game_images").select("image_url").eq("bgg_id", id).maybeSingle();
  return validImageUrl(data?.image_url);
}

async function fromBggApi(id: number): Promise<string | null> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${BGG_XML}/thing?id=${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/xml", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = parser.parse(await res.text());
  const item = Array.isArray(data?.items?.item) ? data.items.item[0] : data?.items?.item;
  return validImageUrl(item?.image ?? item?.thumbnail);
}

/** Public page fallback: read <meta property="og:image">. Backs off if BGG blocks us. */
async function fromBggPage(id: number): Promise<string | null> {
  if (Date.now() < (g.__scrapeBlockedUntil ?? 0)) return null;
  const res = await fetch(`${BGG_PAGE}/${id}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 403 || res.status === 429) {
    g.__scrapeBlockedUntil = Date.now() + BLOCK_MS; // don't keep knocking
    return null;
  }
  if (!res.ok) return null;
  const html = await res.text();
  const tag =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  return validImageUrl(tag?.[1]);
}

async function save(id: number, url: string) {
  const row = { bgg_id: id, image_url: url };
  try {
    const admin = createAdminClient();
    if (admin) {
      await admin.from("game_images").upsert(row);
      return;
    }
    // No service key: rely on the signed-in user's session + the insert-only RLS policy.
    const sb = await createServerSupabase();
    await sb?.from("game_images").upsert(row, { onConflict: "bgg_id", ignoreDuplicates: true });
  } catch {
    /* caching is best-effort */
  }
}

async function resolve(id: number): Promise<string | null> {
  const cached = await fromSupabase(id).catch(() => null);
  if (cached) return cached;

  const fresh = await limited(async () => {
    try {
      return (await fromBggApi(id)) ?? (await fromBggPage(id));
    } catch {
      return null;
    }
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

  let url: string | null;
  const hit = mem.get(id);
  if (hit && hit.until > Date.now()) {
    url = hit.url;
  } else {
    let p = inflight.get(id);
    if (!p) {
      p = resolve(id).finally(() => inflight.delete(id));
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
          : "public, max-age=300, s-maxage=600",
      },
    },
  );
}
