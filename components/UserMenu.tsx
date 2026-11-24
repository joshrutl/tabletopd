"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

interface Props {
  username: string | null;
  email: string | null;
  onSignOut: () => void;
}

export default function UserMenu({ username, email, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = username ?? email?.split("@")[0] ?? "me";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1 text-sm font-medium text-white transition hover:border-emerald sm:pr-3"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald text-sm font-bold uppercase text-bg">
          {name[0]}
        </span>
        <span className="hidden max-w-[110px] truncate sm:inline">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white">@{name}</p>
            {email && <p className="truncate text-xs text-muted">{email}</p>}
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/90 hover:bg-line"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
