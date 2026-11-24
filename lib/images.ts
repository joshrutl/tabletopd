/** Only BGG's image CDN is trusted for box art (matches next.config images.remotePatterns). */
const GEEKDO = /(^|\.)geekdo-images\.com$/;

/** Returns a normalised https URL if it's on BGG's image CDN, otherwise null. */
export function validImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && GEEKDO.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
