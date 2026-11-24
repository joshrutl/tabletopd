import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createAdminClient, createAnonClient } from "@/lib/supabase/admin";
import { validImageUrl } from "@/lib/images";

export const dynamic = "force-dynamic";

/**
 * Box-art lookup. The only upstream source is BGG's official XML API2, used with
 * the app's BGG_API_TOKEN. Without a token this route makes no network requests
 * at all and cards render their styled typographic covers.
 */

const BGG_XML = "https://boardgamegeek.com/xmlapi2";
const FETCH_TIMEOUT_MS = 4000;
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/* ---- process-level state (survives across requests on a warm instance) ---- */
interface Globals {
  __imgMem?: Map<number, { url: string | null; until: number }>;
  __imgInflight?: Map<number, Promise<string | null>>;
}
const g = globalThis as unknown as Globals;
const mem = (g.__imgMem ??= new Map());
const inflight = (g.__imgInflight ??= new Map());

/** At most 3 BGG requests at once, so a page of cards can't hammer the API. */
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

/** Shared cache in Supabase. */
async function fromCache(id: number): Promise<string | null> {
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

/** Official BGG XML API2: <image> (full cover), falling back to <thumbnail>. */
async function fromBggApi(id: number, token: string): Promise<string | null> {
  const res = await fetch(`${BGG_XML}/thing?id=${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = parser.parse(await res.text());
  const item = Array.isArray(data?.items?.item) ? data.items.item[0] : data?.items?.item;
  return validImageUrl(item?.image ?? item?.thumbnail);
}

/** Best-effort write to the cache; errors (RLS, timeout, missing table) are ignored. */
async function saveToCache(id: number, url: string) {
  const row = { bgg_id: id, image_url: url };
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    const admin = createAdminClient();
    if (admin) {
      await admin.from("game_images").upsert(row).abortSignal(signal);
    } else {
      // Insert-only through the anon role; existing rows are never overwritten.
      await createAnonClient()
        ?.from("game_images")
        .upsert(row, { onConflict: "bgg_id", ignoreDuplicates: true })
        .abortSignal(signal);
    }
  } catch {
    /* caching is optional */
  }
}

async function resolve(id: number, token: string): Promise<string | null> {
  const cached = await fromCache(id).catch(() => null);
  if (cached) return cached;

  const fresh = await limited(() => fromBggApi(id, token).catch(() => null));
  if (fresh) await saveToCache(id, fresh);
  return fresh;
}

export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  // No token yet: answer instantly, touching no network (not even the cache).
  const token = process.env.BGG_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { image_url: null },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  }

  let url: string | null;
  const hit = mem.get(id);
  if (hit && hit.until > Date.now()) {
    url = hit.url;
  } else {
    let p = inflight.get(id);
    if (!p) {
      p = resolve(id, token).finally(() => inflight.delete(id));
      inflight.set(id, p);
    }
    url = await p;
    mem.set(id, { url, until: Date.now() + (url ? HIT_TTL_MS : MISS_TTL_MS) });
  }

  return NextResponse.json(
    { image_url: url },
    {
      headers: {
        "Cache-Control": url
          ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
          : "public, max-age=60, s-maxage=300",
      },
    },
  );
}
