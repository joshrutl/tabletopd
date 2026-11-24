"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import { generateStoryCard, type StoryCardOptions, type StoryGame } from "@/lib/generateStoryCard";
import type { ShelfStats } from "@/lib/stats";

/** What to draw. Stats are passed separately so the modal can toggle them. */
export interface StoryCardSpec {
  title: string;
  subtitle?: string;
  games: (StoryGame | null)[];
  ranked: boolean;
  footerUrl: string;
  moreCount?: number;
  /** Download file name, e.g. tabletopd-josh-top4.png */
  filename: string;
}

interface Props {
  spec: StoryCardSpec;
  /** Omit (null) when there are no stats to offer */
  stats: ShelfStats | null;
  onClose: () => void;
}

export default function ShareStoryModal({ spec, stats, onClose }: Props) {
  const [showStats, setShowStats] = useState(true);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canShareFile, setCanShareFile] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const specRef = useRef(spec);
  specRef.current = spec;

  // Re-render the card only when what it shows actually changes (not on every parent render).
  const key = useMemo(
    () =>
      JSON.stringify([
        spec.title,
        spec.subtitle,
        spec.ranked,
        spec.footerUrl,
        spec.moreCount,
        spec.games.map((g) => (g ? [g.game.id, g.rating] : null)),
        showStats && stats ? [stats.owned, stats.played, stats.avg] : null,
      ]),
    [spec, stats, showStats],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setBusy(true);
    setError(null);

    const s = specRef.current;
    const options: StoryCardOptions = {
      title: s.title,
      subtitle: s.subtitle,
      games: s.games,
      ranked: s.ranked,
      footerUrl: s.footerUrl,
      moreCount: s.moreCount,
      stats: showStats ? stats : null,
    };

    generateStoryCard(options)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setPreviewUrl(objectUrl);
        setBusy(false);
        try {
          const probe = new File([b], s.filename, { type: "image/png" });
          setCanShareFile(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
        } catch {
          setCanShareFile(false);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't generate the image.");
        setBusy(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const download = () => {
    if (!blob || !previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = spec.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const shareToApps = async () => {
    if (!blob) return;
    setShareMsg(null);
    try {
      const file = new File([blob], spec.filename, { type: "image/png" });
      await navigator.share({ files: [file], title: spec.title });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShareMsg("Couldn't open the share sheet. Use Download instead.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share graphic"
        className="sheet-enter flex max-h-[96vh] w-full max-w-md flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-lg font-bold text-white">Share graphic</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-line hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {/* 9:16 preview */}
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl border border-line bg-bg">
            {busy && (
              <div className="shimmer absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin text-emerald" />
              </div>
            )}
            {previewUrl && !error && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview of your story card"
                className={`h-full w-full transition-opacity duration-300 ${busy ? "opacity-40" : "opacity-100"}`}
              />
            )}
            {error && <p className="absolute inset-0 flex items-center p-4 text-center text-sm text-red-300">{error}</p>}
          </div>

          {stats && (
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={showStats}
                onChange={(e) => setShowStats(e.target.checked)}
                className="accent-emerald"
              />
              Include my stats (owned, played, average rating)
            </label>
          )}
        </div>

        <footer className="space-y-2 border-t border-line p-4">
          <div className="flex gap-2">
            <button
              onClick={download}
              disabled={!blob || busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald py-2.5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-50"
            >
              <Download size={16} /> Download PNG
            </button>
            {canShareFile && (
              <button
                onClick={shareToApps}
                disabled={!blob || busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-emerald py-2.5 text-sm font-bold text-emerald transition hover:bg-emerald hover:text-bg disabled:opacity-50"
              >
                <Share2 size={16} /> Share to Apps
              </button>
            )}
          </div>
          {!canShareFile && !busy && (
            <p className="text-center text-xs text-muted">
              Your browser can&apos;t share images directly. Download the PNG, then post it from your gallery.
            </p>
          )}
          {shareMsg && <p className="text-center text-xs text-red-300">{shareMsg}</p>}
        </footer>
      </div>
    </div>
  );
}
