"use client";

import { Compass, Library, User, Users } from "lucide-react";

export type Tab = "discover" | "shelf" | "night" | "profile";

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "shelf", label: "My Shelf", icon: Library },
  { id: "night", label: "Game Night", icon: Users },
  { id: "profile", label: "Profile", icon: User },
];

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  shelfCount: number;
}

export default function BottomNav({ tab, onTab, shelfCount }: Props) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === tab;
          return (
            <li key={id}>
              <button
                onClick={() => onTab(id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-emerald" : "text-muted hover:text-white"
                }`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  {id === "shelf" && shelfCount > 0 && (
                    <span className="absolute -right-3 -top-1.5 min-w-[18px] rounded-full bg-emerald px-1 text-center text-[10px] font-bold leading-[18px] text-bg">
                      {shelfCount}
                    </span>
                  )}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
