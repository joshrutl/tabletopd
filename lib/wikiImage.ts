/**
 * Box-art lookup via Wikipedia's public API. Used as a fallback when BGG
 * blocks server-side requests. A game article's infobox image is almost
 * always the box cover.
 *
 * Self-contained (no path aliases) so it can also run from a plain node script.
 */

const API = "https://en.wikipedia.org/w/api.php";
const UA = "Tabletopd/1.0 (board game tracker)";
const WIKIMEDIA_HOST = /^(upload|thumb)\.wikimedia\.org$/;

export interface WikiCover {
  /** Wikipedia article the image came from, e.g. "Wingspan (board game)" */
  title: string;
  /** HTTPS thumbnail URL on upload.wikimedia.org (~400px wide) */
  url: string;
}

interface Page {
  title: string;
  missing?: boolean;
  extract?: string;
  pageprops?: { page_image?: string; page_image_free?: string };
  imageinfo?: Array<{ thumburl?: string; url?: string }>;
}

interface Result {
  pages: Page[];
  redirects: Array<{ from: string; to: string }>;
  normalized: Array<{ from: string; to: string }>;
}

/** Titles like "Azul (board game)", "Jaipur (card game)", "Hive (game)". */
const GAME_TITLE = /\((board|card|tabletop)? ?game\)$/i;

/** For bare titles: does the intro read like a tabletop game rather than something else? */
const IS_TABLETOP =
  /board game|card game|tabletop|dice game|strategy game|eurogame|tile-placement|abstract game|party game|game designed/i;

async function query(params: Record<string, string>): Promise<Result | null> {
  const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params });
  try {
    // Single attempt with a hard 3s cap: a slow or rate-limited Wikipedia must never stall a card.
    const res = await fetch(`${API}?${qs}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const q = ((await res.json()) as { query?: Partial<Result> }).query ?? {};
    return { pages: q.pages ?? [], redirects: q.redirects ?? [], normalized: q.normalized ?? [] };
  } catch {
    return null;
  }
}

/** Keeps only https URLs on Wikimedia's image hosts and drops tracking params. */
function cleanWikimediaUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !WIKIMEDIA_HOST.test(u.hostname)) return null;
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Quick lookup via Wikipedia's REST summary API for "{name} (board game)".
 * One cheap request; returns the article thumbnail if it has one. Note that
 * this endpoint usually omits non-free box art, so findWikipediaCover() below
 * is the fuller fallback.
 */
export async function findSummaryThumbnail(name: string): Promise<string | null> {
  const clean = name.trim().slice(0, 100);
  if (!clean) return null;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`${clean} (board game)`)}`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { type?: string; thumbnail?: { source?: string } };
    if (data.type === "disambiguation") return null;
    return cleanWikimediaUrl(data.thumbnail?.source);
  } catch {
    return null;
  }
}

/** Article titles Wikipedia is likely to use for a game, most specific first. */
function candidateTitles(name: string): string[] {
  // Exact name only. Stripping a subtitle ("Brass: Birmingham" -> "Brass") would pick the
  // wrong game's cover for sequels and spin-offs, and a missing cover beats a wrong one.
  return [" (board game)", " (card game)", " (game)", " (tabletop game)", ""].map((suffix) => name + suffix);
}

/**
 * Finds the cover image for a game by looking up its likely article titles in
 * one request. Returns null rather than guessing: a missing cover is better
 * than the wrong one.
 */
export async function findWikipediaCover(name: string): Promise<WikiCover | null> {
  const clean = name.trim().slice(0, 100);
  if (!clean) return null;

  const titles = candidateTitles(clean);
  const res = await query({
    titles: titles.join("|"),
    redirects: "1",
    prop: "pageprops|extracts",
    ppprop: "page_image|page_image_free",
    exintro: "1",
    explaintext: "1",
    exchars: "300",
  });
  if (!res) return null;

  // Rank each returned page by the earliest candidate title that resolves to it.
  const resolve = (t: string) =>
    res.redirects.find((r) => r.from === (res.normalized.find((n) => n.from === t)?.to ?? t))?.to ??
    res.normalized.find((n) => n.from === t)?.to ??
    t;
  const rank = (p: Page) => titles.findIndex((t) => resolve(t) === p.title);

  const match = res.pages
    .filter((p) => !p.missing && rank(p) >= 0)
    .sort((a, b) => rank(a) - rank(b))
    .find((p) => {
      if (!(p.pageprops?.page_image_free ?? p.pageprops?.page_image)) return false;
      const extract = p.extract ?? "";
      if (/may refer to/i.test(extract) || /\bis an? [^.]{0,60}video game/i.test(extract)) return false;
      // "(board game)" etc. in the title is proof enough; a bare title must read like a tabletop game.
      return GAME_TITLE.test(p.title) || IS_TABLETOP.test(extract);
    });
  if (!match) return null;

  const file = (match.pageprops!.page_image_free ?? match.pageprops!.page_image)!;
  const info = await query({
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "400",
  });
  const ii = info?.pages[0]?.imageinfo?.[0];
  const url = cleanWikimediaUrl(ii?.thumburl ?? ii?.url);
  return url ? { title: match.title, url } : null;
}
