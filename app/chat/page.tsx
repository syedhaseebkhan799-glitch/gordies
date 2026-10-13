"use client";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/online";
import { useOnlineUsers } from "@/lib/presence";
import { cache } from "@/lib/cache";
import { dayLabel, newId, timeLabel } from "@/lib/format";
import type { Message, Profile } from "@/lib/types";
import Gate from "@/components/Gate";
import Avatar from "@/components/Avatar";
import Spinner from "@/components/Spinner";
import { BackIcon, SendIcon, Ticks } from "@/components/Icons";

// Chat id comes from the link: /chat/?id=...  (a query string works in the APK and .exe builds)
export default function ChatPage() {
  return (
    <Gate need="ready">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <ChatFromUrl />
      </Suspense>
    </Gate>
  );
}

function ChatFromUrl() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <div className="m-auto text-center">
        <p className="text-muted">Chat not found.</p>
        <Link href="/chats/" className="mt-2 inline-block font-semibold text-accent">
          Back to chats
        </Link>
      </div>
    );
  }
  return <ChatRoom key={id} chatId={id} />;
}

const TYPING_SEND_EVERY = 2000;
const TYPING_SHOW_FOR = 3500;

function ChatRoom({ chatId }: { chatId: string }) {
  const { user } = useAuth();
  const me = user!.id;
  const online = useOnline();
  const onlineUsers = useOnlineUsers();

  const [other, setOther] = useState<Profile | null>(() => cache.getOtherProfile(chatId));
  const [messages, setMessages] = useState<Message[]>(() => cache.getMessages(chatId));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState(false);
  const loaded = fetched || !online; // offline: show whatever is saved on the device
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickToBottom = useRef(true);

  const markSeen = useCallback(() => {
    if (!navigator.onLine || document.visibilityState !== "visible") return;
    if (seenTimer.current) clearTimeout(seenTimer.current);
    seenTimer.current = setTimeout(() => {
      supabase.rpc("mark_chat_seen", { p_chat: chatId });
    }, 300);
  }, [chatId]);

  const upsert = useCallback((m: Message) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = prev.slice();
      next[i] = m;
      return next;
    });
  }, []);

  // Load the other person + latest messages (whenever we are online).
  useEffect(() => {
    if (!online) return;
    let active = true;
    (async () => {
      const { data: chat } = await supabase.from("chats").select("user_a, user_b").eq("id", chatId).maybeSingle();
      if (!active) return;
      if (!chat) {
        setNotFound(true);
        setFetched(true);
        return;
      }
      const otherId = chat.user_a === me ? chat.user_b : chat.user_a;
      const [{ data: prof }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", otherId).maybeSingle(),
        supabase
          .from("messages")
          .select("id, chat_id, sender_id, body, created_at, seen_at")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
      if (!active) return;
      if (prof) {
        setOther(prof);
        cache.setOtherProfile(chatId, prof);
      }
      if (msgs) setMessages(msgs.reverse());
      setFetched(true);
      markSeen();
    })();
    return () => {
      active = false;
    };
  }, [chatId, me, online, markSeen]);

  // Save a copy on the device for offline reading (confirmed messages only).
  useEffect(() => {
    if (!fetched) return;
    cache.setMessages(
      chatId,
      messages.filter((m) => !pending.has(m.id)),
    );
  }, [messages, pending, chatId, fetched]);

  // Live updates: new messages, seen ticks, and "typing…".
  useEffect(() => {
    if (!online) return;
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Message;
          upsert(m);
          if (m.sender_id !== me) {
            setOtherTyping(false);
            markSeen();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => upsert(payload.new as Message),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.user_id === me) return;
        setOtherTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_SHOW_FOR);
      })
      .subscribe();
    channelRef.current = channel;

    const onVisible = () => document.visibilityState === "visible" && markSeen();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [chatId, me, online, upsert, markSeen]);

  // Keep the view at the newest message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, otherTyping]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function onType(value: string) {
    setText(value);
    const now = Date.now();
    if (value && channelRef.current && now - lastTypingSent.current > TYPING_SEND_EVERY) {
      lastTypingSent.current = now;
      channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: me } });
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !online) return;
    setSendError(null);
    const msg: Message = {
      id: newId(),
      chat_id: chatId,
      sender_id: me,
      body,
      created_at: new Date().toISOString(),
      seen_at: null,
    };
    // Show it straight away (with a clock), then confirm when the server saves it.
    stickToBottom.current = true;
    setText("");
    setPending((p) => new Set(p).add(msg.id));
    upsert(msg);
    inputRef.current?.focus();

    const { data, error } = await supabase
      .from("messages")
      .insert({ id: msg.id, chat_id: chatId, sender_id: me, body })
      .select("id, chat_id, sender_id, body, created_at, seen_at")
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

  // Grow the text box up to 5 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const isOnline = other ? onlineUsers.has(other.id) : false;
  const status = otherTyping ? "typing…" : isOnline ? "online" : other ? `@${other.username}` : "";

  if (notFound) {
    return (
      <div className="m-auto text-center">
        <p className="text-muted">This chat does not exist.</p>
        <Link href="/chats/" className="mt-2 inline-block font-semibold text-accent">
          Back to chats
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2">
        <Link href="/chats/" className="rounded-full p-2 text-fg hover:bg-surface-2" aria-label="Back">
          <BackIcon />
        </Link>
        {other ? (
          <>
            <Avatar name={other.display_name} url={other.avatar_url} size={40} online={isOnline} />
            <div className="min-w-0 flex-1">
              <p className="truncate leading-tight font-semibold">{other.display_name}</p>
              <p className={`truncate text-xs ${otherTyping || isOnline ? "text-accent" : "text-muted"}`}>{status}</p>
            </div>
          </>
        ) : (
          <div className="flex-1" />
        )}
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="chat-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!loaded && messages.length === 0 && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-2xl bg-surface/80 p-5 text-center backdrop-blur">
            <p className="text-3xl">👋</p>
            <p className="mt-2 text-sm text-muted">Say hi to {other?.display_name ?? "your friend"}!</p>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === me;
          const prev = messages[i - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          const grouped = prev && !newDay && prev.sender_id === m.sender_id;
          const isPending = pending.has(m.id);
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-muted shadow-sm">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                <div
                  className={`bubble max-w-[80%] px-3 pt-1.5 pb-1 shadow-sm ${
                    mine ? "bg-accent text-white" : "border border-line bg-bubble-in text-fg"
                  }`}
                >
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${mine ? "text-white/75" : "text-muted"}`}>
                    {timeLabel(m.created_at)}
                    {mine && (isPending ? <span aria-label="sending">🕓</span> : <Ticks seen={!!m.seen_at} />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {otherTyping && (
          <div className="mt-2 flex justify-start">
            <div className="bubble flex gap-1 border border-line bg-bubble-in px-4 py-3">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
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
          placeholder={online ? "Message" : "No internet — you can read, not send"}
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
