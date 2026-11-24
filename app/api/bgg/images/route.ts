import { NextRequest, NextResponse, after } from "next/server";
import { resolveImageIds, saveImages } from "@/lib/bggImages";

export const dynamic = "force-dynamic";

const MAX_IDS = 40;

/**
 * Batch cover lookup: GET /api/bgg/images?ids=266192,13,9209
 * -> { images: { "266192": "https://...", "13": null }, transient: ["9209"] }
 * `transient` ids couldn't be checked (BGG timeout / rate limit) and should be retried soon,
 * unlike a plain null, which means BGG has no image for that game.
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{1,9}$/.test(s))
    .slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids must be a comma-separated list of BGG ids" }, { status: 400 });
  }

  const { images, transient, fresh } = await resolveImageIds(ids);
  if (Object.keys(fresh).length > 0) after(() => saveImages(fresh));

  const complete = transient.length === 0 && ids.every((id) => images[id]);
  return NextResponse.json(
    { images, transient },
    {
      headers: {
        "Cache-Control": complete
          ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
          : "public, max-age=30, s-maxage=60",
      },
    },
  );
}
