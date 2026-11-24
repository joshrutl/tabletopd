"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Game } from "@/lib/types";
import { Poster } from "./GameCard";
import StarRating from "./StarRating";

export interface ReviewItem {
  game: Game;
  rating: number;
  review: string;
  playedOn: string;
  at: number;
}

export interface PublicList {
  id: string;
  title: string;
  description: string;
  isRanked: boolean;
  items: Array<{ game: Game; note: string }>;
}

interface Props {
  owned: Game[];
  reviews: ReviewItem[];
  lists: PublicList[];
}

type Tab = "owned" | "reviews" | "lists";

const dateFmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" });

/** Read-only Owned shelf / Ratings & Reviews / Public lists for the shared profile page. */
export default function PublicProfileTabs({ owned, reviews, lists }: Props) {
  const [tab, setTab] = useState<Tab>("owned");
  const [openList, setOpenList] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "owned", label: "Owned", count: owned.length },
    { id: "reviews", label: "Ratings & Reviews", count: reviews.length },
    { id: "lists", label: "Lists", count: lists.length },
  ];

  const empty = (text: string) => (
    <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">{text}</p>
  );

  return (
    <section>
      <div role="tablist" className="mb-5 grid grid-cols-3 rounded-lg border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-1 py-2 text-[13px] font-medium leading-tight transition sm:text-sm ${
              tab === t.id ? "bg-line text-white" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
            <span className={`ml-1 text-xs ${tab === t.id ? "text-emerald" : "text-muted"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "owned" &&
        (owned.length === 0 ? (
          empty("No owned games yet.")
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {owned.map((g) => (
              <div key={g.id}>
                <Poster game={g} clearOverlay className="aspect-[3/4] w-full rounded-lg border border-line" />
                <p className="mt-1.5 truncate text-xs font-medium text-white" title={g.name}>
                  {g.name}
                </p>
              </div>
            ))}
          </div>
        ))}

      {tab === "reviews" &&
        (reviews.length === 0 ? (
          empty("No ratings or reviews yet.")
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.game.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                <Poster game={r.game} className="h-24 w-16 flex-none rounded" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{r.game.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {r.rating > 0 && <StarRating value={r.rating} size={13} />}
                    <span>{dateFmt.format(r.playedOn ? new Date(r.playedOn) : new Date(r.at))}</span>
                  </div>
                  {r.review && <p className="mt-1.5 text-sm text-white/80">{r.review}</p>}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === "lists" &&
        (lists.length === 0 ? (
          empty("No public lists yet.")
        ) : (
          <ul className="space-y-3">
            {lists.map((l) => {
              const open = openList === l.id;
              return (
                <li key={l.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                  <button
                    onClick={() => setOpenList(open ? null : l.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{l.title}</span>
                      <span className="text-xs text-muted">
                        {l.items.length} {l.items.length === 1 ? "game" : "games"}
                        {l.isRanked ? " · Ranked" : ""}
                      </span>
                    </span>
                    <ChevronDown size={18} className={`flex-none text-muted transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="border-t border-line p-3">
                      {l.description && <p className="mb-3 text-sm text-white/75">{l.description}</p>}
                      {l.items.length === 0 ? (
                        <p className="text-sm text-muted">This list has no games yet.</p>
                      ) : (
                        <ol className="space-y-2">
                          {l.items.map((it, i) => (
                            <li key={it.game.id} className="flex items-center gap-3">
                              {l.isRanked && (
                                <span className="w-8 flex-none text-center text-lg font-extrabold text-emerald">
                                  #{i + 1}
                                </span>
                              )}
                              <Poster game={it.game} className="h-16 w-12 flex-none rounded" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-white">{it.game.name}</span>
                                {it.note && <span className="block text-xs text-white/70">{it.note}</span>}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
