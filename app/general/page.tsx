"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/online";
import { useOnlineUsers } from "@/lib/presence";
import { cache } from "@/lib/cache";
import { dayLabel, newId, timeLabel } from "@/lib/format";
import type { GroupMessage, Profile } from "@/lib/types";
import Gate from "@/components/Gate";
import Avatar from "@/components/Avatar";
import Spinner from "@/components/Spinner";
import { BackIcon, SendIcon } from "@/components/Icons";

// "# General": the one group chat every member is in.
export default function GeneralPage() {
  return (
    <Gate need="ready">
      <GeneralRoom />
    </Gate>
  );
}

const TYPING_SEND_EVERY = 2000;
const TYPING_SHOW_FOR = 3500;

function GeneralRoom() {
  const { user } = useAuth();
  const me = user!.id;
  const online = useOnline();
  const onlineUsers = useOnlineUsers();

  const [members, setMembers] = useState<Record<string, Profile>>(() =>
    Object.fromEntries(cache.getMembers().map((p) => [p.id, p])),
  );
  const [messages, setMessages] = useState<GroupMessage[]>(() => cache.getGroup());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState(false);
  const loaded = fetched || !online;
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [typers, setTypers] = useState<Record<string, string>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const stickToBottom = useRef(true);

  const upsert = useCallback((m: GroupMessage) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = prev.slice();
      next[i] = m;
      return next;
    });
  }, []);

  const stopTyping = useCallback((id: string) => {
    clearTimeout(typingTimers.current[id]);
    setTypers((t) => {
      if (!(id in t)) return t;
      const n = { ...t };
      delete n[id];
      return n;
    });
  }, []);

  // Load members (for names/photos) + latest messages.
  useEffect(() => {
    if (!online) return;
    let active = true;
    (async () => {
      const [{ data: profs }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").limit(1000),
        supabase
          .from("group_messages")
          .select("id, sender_id, body, created_at")
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
      if (!active) return;
      if (profs) {
        setMembers(Object.fromEntries(profs.map((p) => [p.id, p])));
        cache.setMembers(profs);
      }
      if (msgs) setMessages(msgs.reverse());
      setFetched(true);
    })();
    return () => {
      active = false;
    };
  }, [online]);

  // Save for offline reading, and remember that I have read up to here.
  useEffect(() => {
    if (!fetched) return;
    const saved = messages.filter((m) => !pending.has(m.id));
    cache.setGroup(saved);
    const last = saved[saved.length - 1];
    if (last) cache.setGroupRead(me, last.created_at);
  }, [messages, pending, fetched, me]);

  // Live: new messages + "typing…".
  useEffect(() => {
    if (!online) return;
    const channel = supabase
      .channel("group:general")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, (payload) => {
        const m = payload.new as GroupMessage;
        upsert(m);
        stopTyping(m.sender_id);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const id = payload?.user_id as string | undefined;
        if (!id || id === me) return;
        setTypers((t) => (t[id] ? t : { ...t, [id]: String(payload.name ?? "Someone") }));
        clearTimeout(typingTimers.current[id]);
        typingTimers.current[id] = setTimeout(() => stopTyping(id), TYPING_SHOW_FOR);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [me, online, upsert, stopTyping]);

  const typingNames = Object.values(typers);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typingNames.length]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function onType(value: string) {
    setText(value);
    const now = Date.now();
    if (value && channelRef.current && now - lastTypingSent.current > TYPING_SEND_EVERY) {
      lastTypingSent.current = now;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: me, name: members[me]?.display_name ?? cache.getProfile(me)?.display_name },
      });
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !online) return;
    setSendError(null);
    const msg: GroupMessage = { id: newId(), sender_id: me, body, created_at: new Date().toISOString() };
    stickToBottom.current = true;
    setText("");
    setPending((p) => new Set(p).add(msg.id));
    upsert(msg);
    inputRef.current?.focus();

    const { data, error } = await supabase
      .from("group_messages")
      .insert({ id: msg.id, sender_id: me, body })
      .select("id, sender_id, body, created_at")
      .single();

    setPending((p) => {
      const n = new Set(p);
      n.delete(msg.id);
      return n;
    });
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setText((t) => t || body);
      setSendError("Message not sent. Check your internet and try again.");
      return;
    }
    upsert(data);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const memberCount = Object.keys(members).length;
  const status =
    typingNames.length === 1
      ? `${typingNames[0]} is typing…`
      : typingNames.length > 1
        ? `${typingNames.length} people are typing…`
        : `${memberCount} members · ${onlineUsers.size} online`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2">
        <Link href="/chats/" className="rounded-full p-2 text-fg hover:bg-surface-2" aria-label="Back">
          <BackIcon />
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-black text-white">
          #
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate leading-tight font-semibold">General</p>
          <p className={`truncate text-xs ${typingNames.length ? "text-accent" : "text-muted"}`}>{status}</p>
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="chat-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!loaded && messages.length === 0 && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-2xl bg-surface/80 p-5 text-center backdrop-blur">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 text-sm text-muted">Welcome to # General — everyone in Gordies sees this chat. Say hi!</p>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === me;
          const prev = messages[i - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          const grouped = prev && !newDay && prev.sender_id === m.sender_id;
          const sender = members[m.sender_id];
          const name = sender?.display_name ?? "Member";
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-muted shadow-sm">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                {!mine &&
                  (grouped ? (
                    <div className="w-8 shrink-0" />
                  ) : (
                    <Avatar name={name} url={sender?.avatar_url ?? null} size={32} online={onlineUsers.has(m.sender_id)} />
                  ))}
                <div
                  className={`bubble max-w-[78%] px-3 pt-1.5 pb-1 shadow-sm ${
                    mine ? "bg-accent text-white" : "border border-line bg-bubble-in text-fg"
                  }`}
                >
                  {!mine && !grouped && <p className="text-xs font-bold text-accent">{name}</p>}
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${mine ? "text-white/75" : "text-muted"}`}>
                    {timeLabel(m.created_at)}
                    {mine && (pending.has(m.id) ? <span aria-label="sending">🕓</span> : <span aria-label="sent">✓</span>)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sendError && <p className="bg-red-600/10 px-4 py-2 text-sm text-red-600">{sendError}</p>}

      <div
        className="flex items-end gap-2 border-t border-line bg-surface px-3 py-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!online}
          maxLength={2000}
          placeholder={online ? "Message # General" : "No internet — you can read, not send"}
          className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-3xl bg-surface-2 px-4 py-2.5 leading-6 outline-none placeholder:text-muted disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={!online || !text.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition active:scale-90 disabled:opacity-40"
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
