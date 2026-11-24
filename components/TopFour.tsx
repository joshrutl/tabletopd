"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import type { Game } from "@/lib/types";
import type { TopFourState } from "@/lib/useTopFour";
import { Poster } from "./GameCard";
import FavoritePickerModal from "./FavoritePickerModal";

/** Hand-picked favourites: one strict row of four, drag to reorder (arrows for touch). */
export default function TopFour({ top }: { top: TopFourState }) {
  const { slots, setSlot, swap } = top;
  const [picking, setPicking] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const taken = new Set(
    slots.flatMap((g, i) => (g && i !== picking ? [g.id] : [])),
  );

  const arrow =
    "rounded-full p-1 text-muted transition hover:bg-line hover:text-white disabled:pointer-events-none disabled:opacity-25";

  return (
    <>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {slots.map((game, i) => {
          const isTarget = dragOver === i && dragFrom !== null && dragFrom !== i;
          return (
            <div key={i} className="min-w-0">
              <div
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) swap(dragFrom, i);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`relative aspect-[3/4] overflow-hidden rounded-lg transition ${
                  isTarget ? "ring-2 ring-emerald ring-offset-2 ring-offset-bg" : ""
                } ${dragFrom === i ? "opacity-40" : ""}`}
              >
                {game ? (
                  <FilledSlot
                    game={game}
                    onSwap={() => setPicking(i)}
                    onRemove={() => setSlot(i, null)}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(i));
                      setDragFrom(i);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setPicking(i)}
                    aria-label={`Pick favorite number ${i + 1}`}
                    className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted transition hover:border-emerald hover:text-emerald ${
                      isTarget ? "border-emerald" : "border-line"
                    }`}
                  >
                    <Plus size={22} />
                    <span className="text-[10px] uppercase tracking-wider">{i + 1}</span>
                  </button>
                )}
              </div>

              {/* Touch-friendly reorder controls */}
              <div className="mt-1 flex h-6 justify-center gap-1">
                {game && (
                  <>
                    <button
                      onClick={() => swap(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Move ${game.name} left`}
                      className={arrow}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => swap(i, i + 1)}
                      disabled={i === slots.length - 1}
                      aria-label={`Move ${game.name} right`}
                      className={arrow}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {picking !== null && (
        <FavoritePickerModal
          takenIds={taken}
          onPick={(g) => {
            setSlot(picking, g);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

function FilledSlot({
  game,
  onSwap,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  game: Game;
  onSwap: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group relative h-full w-full cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={onSwap}
        aria-label={`Swap ${game.name}`}
        className="relative block h-full w-full overflow-hidden rounded-lg border border-line text-left transition hover:border-emerald/60"
      >
        <Poster game={game} className="pointer-events-none h-full w-full" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-6">
          <span className="block truncate text-[11px] font-semibold leading-tight text-white sm:text-sm">
            {game.name}
          </span>
        </span>
      </button>
      <button
        onClick={onRemove}
        aria-label={`Remove ${game.name}`}
        className="absolute right-1 top-1 rounded-full bg-black/75 p-1 text-white transition hover:bg-red-500"
      >
        <X size={12} strokeWidth={3} />
      </button>
    </div>
  );
}
