"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { cache } from "./cache";
import type { Profile } from "./types";

type Status = "loading" | "guest" | "needs-setup" | "ready";

type AuthValue = {
  status: Status;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthValue>({
  status: "loading",
  user: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>(supabaseConfigured ? "loading" : "guest");

  const loadProfile = useCallback(async (u: User) => {
    // Show the saved copy first, so the app opens instantly (and works offline).
    const cached = cache.getProfile(u.id);
    if (cached) {
      setProfile(cached);
      setStatus("ready");
    }
    if (!navigator.onLine) {
      if (!cached) setStatus("needs-setup");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", u.id)
      .maybeSingle();
    if (error) {
      if (!cached) setStatus("needs-setup");
      return;
    }
    if (data) {
      cache.setProfile(data);
      setProfile(data);
      setStatus("ready");
    } else {
      setProfile(null);
      setStatus("needs-setup");
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u);
      else setStatus("guest");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (event === "SIGNED_OUT" || !u) {
        setProfile(null);
        setStatus("guest");
      } else if (event === "SIGNED_IN") {
        loadProfile(u);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    cache.clearAll();
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthCtx.Provider value={{ status, user, profile, refreshProfile, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
