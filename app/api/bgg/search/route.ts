import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import type { Game, SearchResponse, SortId } from "@/lib/types";
import { searchMockGames } from "@/lib/mockGames";
import { getCsvIndex, searchCsv } from "@/lib/csvIndex";
import { matchesFilter, type GameFilter } from "@/lib/filters";
import { firstValidImageUrl } from "@/lib/images";
import { decodeHtmlEntities } from "@/lib/text";

export const dynamic = "force-dynamic";

const BGG = "https://boardgamegeek.com/xmlapi2";
const MAX_RESULTS = 12; // live BGG results (each needs a /thing lookup)
const LOCAL_RESULTS = 24; // local CSV results, and the cap for filtered live results
const LIVE_FILTER_POOL = 50; // live BGG candidates to resolve when a filter is active
const SORTS: SortId[] = ["popular", "rated", "highest", "newest"];

function intParam(req: NextRequest, key: string, min: number, max: number): number | null {
  const n = Number(req.nextUrl.searchParams.get(key));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/xml" };
  const token = process.env.BGG_API_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function bggFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: headers(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`BGG responded ${res.status}`);
  return parser.parse(await res.text());
}

const THING_BATCH = 20; // BGG's /thing accepts at most 20 ids per request

/** Resolve one batch of BGG ids (<= 20) into clean Game objects. */
async function fetchThingBatch(ids: string[]): Promise<Game[]> {
  const data = (await bggFetch(
    `${BGG}/thing?id=${ids.join(",")}&stats=1`,
  )) as { items?: { item?: unknown } };

  return (toArray(data.items?.item) as Record<string, any>[]).map((item): Game => {
    const names = toArray(item.name) as Record<string, any>[];
    const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
    const avg = num(item.statistics?.ratings?.average?.["@_value"], 0);
    const year = num(item.yearpublished?.["@_value"], 0);
    // Newer games can have only one of <image> / <thumbnail>; fill in whichever is missing.
    const image = firstValidImageUrl(item.image, item.thumbnail);
    const thumbnail = firstValidImageUrl(item.thumbnail, item.image);
    return {
      id: String(item["@_id"]),
      name: decodeHtmlEntities(String(primary?.["@_value"] ?? "Unknown")), // BGG sends e.g. "Andromeda&#039;s Edge"
      yearPublished: year || null,
      thumbnail,
      image,
      minPlayers: num(item.minplayers?.["@_value"], 1),
      maxPlayers: num(item.maxplayers?.["@_value"], 1),
      playingTime: num(item.playingtime?.["@_value"], 0),
      rating: avg > 0 ? Math.round(avg * 10) / 10 : null,
    };
  });
}

/** Resolve a list of BGG ids into Game objects, keeping the order of `ids`. */
async function fetchThings(ids: string[]): Promise<Game[]> {
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += THING_BATCH) batches.push(ids.slice(i, i + THING_BATCH));
  const games = (await Promise.all(batches.map(fetchThingBatch))).flat();
  return ids.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => Boolean(g));
}

/** `limit` is how many BGG hits to resolve into full games (more when filters will thin them out). */
async function liveSearch(q: string, limit: number): Promise<Game[]> {
  let ids: string[];
  if (q) {
    const data = (await bggFetch(
      `${BGG}/search?query=${encodeURIComponent(q)}&type=boardgame`,
    )) as { items?: { item?: unknown } };
    ids = (toArray(data.items?.item) as Record<string, any>[])
      .map((i) => String(i["@_id"]))
      .slice(0, limit);
  } else {
    // No query: show BGG's "hot" list as the Trending view.
    const data = (await bggFetch(`${BGG}/hot?type=boardgame`)) as {
      items?: { item?: unknown };
    };
    ids = (toArray(data.items?.item) as Record<string, any>[])
      .map((i) => String(i["@_id"]))
      .slice(0, limit);
  }
  return fetchThings(ids);
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sortParam = req.nextUrl.searchParams.get("sort");
  const sort: SortId = SORTS.includes(sortParam as SortId) ? (sortParam as SortId) : "popular";
  const filter: GameFilter = {
    players: intParam(req, "players", 1, 20),
    maxTime: intParam(req, "maxTime", 1, 1000),
  };
  const hasToken = Boolean(process.env.BGG_API_TOKEN);

  // No token: serve from the local CSV index (falls through to mock if the CSV is absent).
  if (!hasToken && getCsvIndex()) {
    const body: SearchResponse = {
      games: searchCsv(q, sort, LOCAL_RESULTS, filter),
      source: "local",
      note: "Searching the local BGG rankings dataset.",
    };
    return NextResponse.json(body);
  }

  try {
    // Live path: BGG can't filter server-side, so when a filter is active we resolve a deeper
    // pool of candidates (up to 50 hits, in /thing batches of 20) and filter that, instead of
    // trimming the 12 results a plain search returns.
    const filtering = filter.players !== null || filter.maxTime !== null;
    const pool = await liveSearch(q, filtering ? LIVE_FILTER_POOL : MAX_RESULTS);
    const games = pool.filter((g) => matchesFilter(g, filter)).slice(0, filtering ? LOCAL_RESULTS : MAX_RESULTS);
    const body: SearchResponse = { games, source: "bgg" };
    return NextResponse.json(body);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    const body: SearchResponse = {
      games: searchMockGames(q)
        .filter((g) => matchesFilter(g, filter))
        .slice(0, MAX_RESULTS),
      source: "mock",
      note: process.env.BGG_API_TOKEN
        ? `BGG request failed (${reason}); showing sample games.`
        : "No BGG_API_TOKEN configured; showing sample games.",
    };
    return NextResponse.json(body);
  }
}
