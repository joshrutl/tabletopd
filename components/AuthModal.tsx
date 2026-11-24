"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Auth } from "@/lib/useAuth";

interface Props {
  auth: Auth;
  onClose: () => void;
}

export default function AuthModal({ auth, onClose }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === "signin") {
      const err = await auth.signIn(email.trim(), password);
      setBusy(false);
      if (err) setError(err);
      else onClose();
    } else {
      const res = await auth.signUp(username.trim(), email.trim(), password);
      setBusy(false);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setConfirmSent(true);
      else onClose();
    }
  };

  const input =
    "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-emerald focus:outline-none";
  const label = "block text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "signin" ? "Sign in" : "Create account"}
        className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-line hover:text-white"
        >
          <X size={18} />
        </button>

        {confirmSent ? (
          <div className="py-4 text-center">
            <h2 className="mb-2 text-lg font-bold text-white">Check your email</h2>
            <p className="mb-5 text-sm text-muted">
              We sent a confirmation link to <span className="text-white">{email}</span>. Open it, then come
              back and sign in.
            </p>
            <button
              onClick={() => {
                setConfirmSent(false);
                setMode("signin");
                setPassword("");
              }}
              className="rounded-md bg-emerald px-5 py-2 text-sm font-semibold text-bg hover:brightness-110"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" className="mb-5 grid grid-cols-2 rounded-lg border border-line bg-bg p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`rounded-md py-1.5 text-sm font-medium transition ${
                    mode === m ? "bg-line text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <label className={label}>
                  Username
                  <input
                    className={`${input} mt-1 normal-case`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="meeple_master"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={20}
                  />
                </label>
              )}
              <label className={label}>
                Email
                <input
                  className={`${input} mt-1 normal-case`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className={label}>
                Password
                <input
                  className={`${input} mt-1 normal-case`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                />
              </label>

              {error && (
                <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald py-2.5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
