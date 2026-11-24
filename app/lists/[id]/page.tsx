import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Dices } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/admin";
import type { Game } from "@/lib/types";
import { Poster } from "@/components/GameCard";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads a public list. Row Level Security guarantees private lists come back empty. */
async function loadList(id: string) {
  if (!UUID.test(id)) return null;
  const sb = createAnonClient();
  if (!sb) return null;

  const { data: list } = await sb.from("lists").select("*").eq("id", id).eq("is_public", true).maybeSingle();
  if (!list) return null;

  const [{ data: items }, { data: owner }] = await Promise.all([
    sb.from("list_items").select("*").eq("list_id", id).order("position", { ascending: true }),
    sb.from("profiles").select("username").eq("id", list.user_id).maybeSingle(),
  ]);
  return {
    list,
    owner: owner?.username as string | null | undefined,
    items: (items ?? []) as Array<{ bgg_id: number; game_data: Game; note: string | null }>,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const found = await loadList((await params).id);
  return { title: found ? `${found.list.title} — Tabletopd` : "List not found — Tabletopd" };
}

export default async function SharedListPage({ params }: { params: Promise<{ id: string }> }) {
  const found = await loadList((await params).id);
  if (!found) notFound();
  const { list, owner, items } = found;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
        <span className="rounded-md bg-emerald p-1 text-bg">
          <Dices size={18} strokeWidth={2.5} />
        </span>
        Tabletopd
      </Link>

      <h1 className="text-2xl font-bold text-white">{list.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {owner ? `A list by @${owner}` : "A list"} · {items.length} {items.length === 1 ? "game" : "games"}
        {list.is_ranked ? " · Ranked" : ""}
      </p>
      {list.description && <p className="mt-3 text-sm text-white/75">{list.description}</p>}

      {items.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
          This list has no games yet.
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {items.map((it, i) => (
            <li key={it.bgg_id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
              {list.is_ranked && (
                <span className="w-9 flex-none text-center text-xl font-extrabold text-emerald">#{i + 1}</span>
              )}
              <Poster game={it.game_data} className="h-20 w-14 flex-none rounded" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{it.game_data.name}</p>
                <p className="text-xs text-muted">{it.game_data.yearPublished ?? "—"}</p>
                {it.note && <p className="mt-1 text-sm text-white/75">{it.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <footer className="mt-12 border-t border-line pt-4 text-center text-xs text-muted">
        Game data powered by{" "}
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-line underline-offset-2 hover:text-emerald"
        >
          BoardGameGeek
        </a>
      </footer>
    </main>
  );
}
