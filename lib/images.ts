/** Box art is only trusted from BGG's image CDN (URLs come from the official API). */
const TRUSTED_HOST = /(^|\.)geekdo-images\.com$/;

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
