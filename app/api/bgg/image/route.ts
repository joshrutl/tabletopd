import { NextRequest, NextResponse, after } from "next/server";
import { resolveImageIds, saveImages } from "@/lib/bggImages";

export const dynamic = "force-dynamic";

/**
 * Single-game cover lookup (used by the story-card generator). The app's cards use the
 * batch endpoint, /api/bgg/images. With no BGG_API_TOKEN this returns { image_url: null }
 * instantly without any network request.
 */
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  const { images, transient, fresh } = await resolveImageIds([String(id)]);
  if (Object.keys(fresh).length > 0) after(() => saveImages(fresh));
  const url = images[String(id)] ?? null;

  return NextResponse.json(
    { image_url: url },
    {
      headers: {
        "Cache-Control": url
          ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
          : transient.length > 0
            ? "no-store"
            : "public, max-age=60, s-maxage=300",
      },
    },
  );
}
