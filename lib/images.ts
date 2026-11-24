/** Box art is only trusted from BGG's image CDN (URLs come from the official API). */
const TRUSTED_HOST = /(^|\.)geekdo-images\.com$/;

/**
 * Normalises a URL from BGG: trims it, upgrades http:// and protocol-relative
 * (//host/...) URLs to https, and keeps it only if it is on BGG's image CDN.
 */
export function validImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.startsWith("//")) s = `https:${s}`;
  else if (s.startsWith("http://")) s = `https://${s.slice("http://".length)}`;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && TRUSTED_HOST.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** First usable URL among several candidates (e.g. BGG's <image> then <thumbnail>). */
export function firstValidImageUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const url = validImageUrl(c);
    if (url) return url;
  }
  return null;
}
