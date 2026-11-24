"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase/client";

export interface Profile {
  username: string | null;
  bio: string;
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** Escape LIKE wildcards so "a_b" doesn't match "axb" in the availability check. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Supabase Auth session + the signed-in user's profile row. Inert when Supabase isn't configured. */
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const sb = createClient();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load (or create, for accounts that predate the trigger) the profile row.
  useEffect(() => {
    const sb = createClient();
    if (!sb || !userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await sb.from("profiles").select("username, bio").eq("id", userId).maybeSingle();
      if (cancelled) return;
      if (data) {
        setProfile({ username: data.username, bio: data.bio ?? "" });
      } else {
        await sb.from("profiles").upsert({ id: userId });
        if (!cancelled) setProfile({ username: null, bio: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Returns an error message, or null on success. */
  const signIn = useCallback(async (emailAddr: string, password: string): Promise<string | null> => {
    const sb = createClient();
    if (!sb) return "Accounts aren't set up.";
    const { error } = await sb.auth.signInWithPassword({ email: emailAddr, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(
    async (
      username: string,
      emailAddr: string,
      password: string,
    ): Promise<{ error: string | null; needsConfirmation: boolean }> => {
      const sb = createClient();
      if (!sb) return { error: "Accounts aren't set up.", needsConfirmation: false };
      if (!USERNAME_RE.test(username)) {
        return {
          error: "Username must be 3–20 characters: letters, numbers or underscores.",
          needsConfirmation: false,
        };
      }
      const { data: taken } = await sb
        .from("profiles")
        .select("id")
        .ilike("username", escapeLike(username))
        .maybeSingle();
      if (taken) return { error: "That username is taken.", needsConfirmation: false };

      const { data, error } = await sb.auth.signUp({
        email: emailAddr,
        password,
        options: { data: { username } },
      });
      if (error) return { error: error.message, needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await createClient()?.auth.signOut();
  }, []);

  const updateBio = useCallback(
    async (bio: string): Promise<string | null> => {
      const sb = createClient();
      if (!sb || !userId) return "Not signed in.";
      const { error } = await sb.from("profiles").upsert({ id: userId, bio });
      if (error) return error.message;
      setProfile((p) => ({ username: p?.username ?? null, bio }));
      return null;
    },
    [userId],
  );

  return {
    configured: isSupabaseConfigured,
    loading,
    userId,
    email,
    profile,
    signIn,
    signUp,
    signOut,
    updateBio,
  };
}

export type Auth = ReturnType<typeof useAuth>;
