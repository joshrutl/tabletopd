"use client";

import Link from "next/link";
import { Dices, Search, X } from "lucide-react";
import type { Auth } from "@/lib/useAuth";
import UserMenu from "./UserMenu";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  /** The search bar only applies to the Discover feed. */
  showSearch: boolean;
  auth: Auth;
  onSignIn: () => void;
}

export default function NavBar({ query, onQuery, showSearch, auth, onSignIn }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex flex-none items-center gap-2 text-xl font-extrabold tracking-tight text-white"
        >
          <span className="rounded-md bg-emerald p-1 text-bg">
            <Dices size={20} strokeWidth={2.5} />
          </span>
          <span className="hidden sm:inline">Tabletopd</span>
        </Link>

        {showSearch && (
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search board games…"
              aria-label="Search board games"
              className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-emerald focus:outline-none"
            />
            {query && (
              <button
                onClick={() => onQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Account control; hidden entirely when Supabase isn't configured */}
        {auth.configured && (
          <div className="ml-auto flex-none">
            {auth.loading ? (
              <div className="h-9 w-20 animate-pulse rounded-full bg-surface" />
            ) : auth.userId ? (
              <UserMenu
                username={auth.profile?.username ?? null}
                email={auth.email}
                onSignOut={auth.signOut}
              />
            ) : (
              <button
                onClick={onSignIn}
                className="rounded-full border border-emerald px-4 py-1.5 text-sm font-semibold text-emerald transition hover:bg-emerald hover:text-bg"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
