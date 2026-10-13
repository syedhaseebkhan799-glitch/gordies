"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { useOnline } from "./online";

// Who is online right now (green dot). Uses Supabase Realtime Presence.
const EMPTY = new Set<string>();
const PresenceCtx = createContext<Set<string>>(EMPTY);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const online = useOnline();
  const [ids, setIds] = useState<Set<string>>(EMPTY);
  const active = Boolean(user && status === "ready" && online);

  useEffect(() => {
    if (!user || !active) return;
    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") channel.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, active]);

  return <PresenceCtx.Provider value={active ? ids : EMPTY}>{children}</PresenceCtx.Provider>;
}

export const useOnlineUsers = () => useContext(PresenceCtx);
