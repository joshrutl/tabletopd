"use client";

import { useCallback, useState } from "react";
import { X } from "lucide-react";
import type { Game } from "@/lib/types";
import { useShelf } from "@/lib/useShelf";
import { useTopFour } from "@/lib/useTopFour";
import { useDiscover } from "@/lib/useDiscover";
import { useAuth } from "@/lib/useAuth";
import { useLists } from "@/lib/useLists";
import { useMigration } from "@/lib/useMigration";
import NavBar from "@/components/NavBar";
import BottomNav, { type Tab } from "@/components/BottomNav";
import DiscoverView from "@/components/DiscoverView";
import ShelfView, { type ShelfSeg } from "@/components/ShelfView";
import GameNightView from "@/components/GameNightView";
import ProfileView from "@/components/ProfileView";
import LogModal from "@/components/LogModal";
import AuthModal from "@/components/AuthModal";
import MigrationModal from "@/components/MigrationModal";

export default function Home() {
  const [syncError, setSyncError] = useState<string | null>(null);
  const onError = useCallback((m: string) => setSyncError(m), []);

  const auth = useAuth();
  const { shelf, save, toggle, importEntries, ready: shelfReady } = useShelf(auth.userId, onError);
  const top = useTopFour(auth.userId, onError);
  const listsState = useLists(auth.userId, onError);
  const discover = useDiscover();
  const migration = useMigration({
    userId: auth.userId,
    shelf,
    shelfReady,
    importEntries,
    topSlots: top.slots,
    topReady: top.ready,
    replaceTopFour: top.replaceAll,
    lists: listsState.lists,
    listsReady: listsState.ready,
    importLists: listsState.importLists,
    onError,
  });

  const [tab, setTab] = useState<Tab>("discover");
  const [shelfSeg, setShelfSeg] = useState<ShelfSeg>("owned");
  const [openListId, setOpenListId] = useState<string | null>(null);

  /** Jump to My Shelf → Lists (optionally straight into one list), e.g. from the Profile tab. */
  const openList = (id: string | null) => {
    setShelfSeg("lists");
    setOpenListId(id);
    setTab("shelf");
  };
  const [logging, setLogging] = useState<Game | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const handlers = {
    onToggleOwned: (g: Game) => toggle(g, "owned"),
    onToggleWishlist: (g: Game) => toggle(g, "wishlist"),
    onLog: setLogging,
  };

  return (
    <>
      <NavBar
        query={discover.query}
        onQuery={discover.setQuery}
        showSearch={tab === "discover"}
        auth={auth}
        onSignIn={() => setAuthOpen(true)}
      />

      {syncError && (
        <div
          role="alert"
          className="mx-auto mt-3 flex max-w-7xl items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 sm:mx-4 lg:mx-auto"
        >
          <span className="flex-1">{syncError}</span>
          <button onClick={() => setSyncError(null)} aria-label="Dismiss" className="flex-none hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* pb-24 keeps the last row of cards clear of the fixed bottom bar */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-5">
        {/* Kept mounted (just hidden) so search results and filters survive tab switches */}
        <div hidden={tab !== "discover"}>
          <DiscoverView d={discover} shelf={shelf} {...handlers} />
        </div>
        {tab === "shelf" && (
          <ShelfView
            shelf={shelf}
            seg={shelfSeg}
            onSeg={setShelfSeg}
            listsState={listsState}
            signedIn={Boolean(auth.userId)}
            openListId={openListId}
            onOpenList={setOpenListId}
            {...handlers}
          />
        )}
        {tab === "night" && <GameNightView shelf={shelf} {...handlers} />}
        {tab === "profile" && (
          <ProfileView
            shelf={shelf}
            onOpen={setLogging}
            auth={auth}
            top={top}
            onSignIn={() => setAuthOpen(true)}
            lists={listsState.lists}
            onOpenList={openList}
          />
        )}

        <footer className="mt-12 border-t border-line pt-4 text-center text-xs text-muted">
          Game data powered by{" "}
          <a
            href="https://boardgamegeek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-2 transition hover:text-emerald hover:decoration-emerald"
          >
            BoardGameGeek
          </a>
        </footer>
      </main>

      <BottomNav tab={tab} onTab={setTab} shelfCount={Object.keys(shelf).length} />

      {logging && (
        <LogModal
          game={logging}
          entry={shelf[logging.id]}
          onSave={save}
          onClose={() => setLogging(null)}
          lists={listsState.lists}
          onAddToList={listsState.addToList}
        />
      )}

      {authOpen && !auth.userId && <AuthModal auth={auth} onClose={() => setAuthOpen(false)} />}

      {migration.offer && (
        <MigrationModal
          offer={migration.offer}
          busy={migration.busy}
          onAccept={migration.accept}
          onDismiss={migration.dismiss}
        />
      )}
    </>
  );
}
