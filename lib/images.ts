/**
 * Only these image hosts are trusted for box art: BGG's CDN (from the official
 * API) and Wikimedia (the hand-picked covers in lib/mockGames.ts).
 */
const TRUSTED_HOST = /(^|\.)geekdo-images\.com$|^(upload|thumb)\.wikimedia\.org$/;

/** Returns a normalised https URL if it's on a trusted image host, otherwise null. */
export function validImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && TRUSTED_HOST.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
