"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/online";
import { useOnlineUsers } from "@/lib/presence";
import { cache } from "@/lib/cache";
import { listTime } from "@/lib/format";
import type { ChatRow, GroupMessage, Profile } from "@/lib/types";
import Gate from "@/components/Gate";
import Avatar from "@/components/Avatar";
import Spinner from "@/components/Spinner";
import { CloseIcon, SearchIcon, SettingsIcon, Ticks } from "@/components/Icons";

export default function ChatsPage() {
  return (
    <Gate need="ready">
      <ChatList />
    </Gate>
  );
}

function ChatList() {
  const { user } = useAuth();
  const me = user!.id;
  const online = useOnline();
  const onlineUsers = useOnlineUsers();
  const router = useRouter();

  const [chats, setChats] = useState<ChatRow[]>(() => cache.getChats(me));
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; results: Profile[] }>({ q: "", results: [] });
  const [opening, setOpening] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [tab, setTab] = useState<"chats" | "members">("chats");
  const [members, setMembers] = useState<Profile[]>(() => cache.getMembers());
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [groupLast, setGroupLast] = useState<GroupMessage | null>(() => cache.getGroup().at(-1) ?? null);
  const [groupUnread, setGroupUnread] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadChats = useCallback(async () => {
    if (!navigator.onLine) return;
    const { data, error } = await supabase.rpc("my_chats");
    if (!error && data) {
      const rows = (data as ChatRow[]).map((r) => ({ ...r, unread: Number(r.unread) }));
      setChats(rows);
      cache.setChats(me, rows);
    }
    setLoaded(true);
  }, [me]);

  // Everyone who has joined Gordies, like a server member list.
  const loadMembers = useCallback(async () => {
    if (!navigator.onLine) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .order("display_name")
      .limit(1000);
    if (!error && data) {
      setMembers(data);
      cache.setMembers(data);
    }
    setMembersLoaded(true);
  }, []);

  // # General: last message + how many new since I last opened it.
  const loadGroup = useCallback(async () => {
    if (!navigator.onLine) return;
    const lastRead = cache.getGroupRead(me);
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("group_messages")
        .select("id, sender_id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("group_messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", me)
        .gt("created_at", lastRead || "1970-01-01"),
    ]);
    setGroupLast(data ?? null);
    setGroupUnread(count ?? 0);
  }, [me]);

  // Load now, when internet comes back, and when the app comes back to the front.
  useEffect(() => {
    // loadChats/loadMembers only set state after the network reply, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChats();
    loadMembers();
    loadGroup();
    const onFocus = () => {
      loadChats();
      loadMembers();
      loadGroup();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadChats, loadMembers, loadGroup, online]);

  // Live: any new message or seen-tick in my chats refreshes the list.
  useEffect(() => {
    if (!online) return;
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(loadChats, 250);
    };
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadMembers())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, () => loadGroup())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [online, loadChats, loadMembers, loadGroup]);

  // Username search (starts-with), 300ms after typing stops.
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const searching = q !== "" && found.q !== q;
  const results = found.q === q ? found.results : [];

  useEffect(() => {
    if (!q || !online) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `${q.replace(/[%_\\]/g, "\\$&")}%`)
        .neq("id", me)
        .limit(15);
      setFound({ q, results: data ?? [] });
    }, 300);
    return () => clearTimeout(t);
  }, [q, online, me]);

  async function openChatWith(p: Profile) {
    setSearchError(null);
    setOpening(p.id);
    const { data, error } = await supabase.rpc("get_or_create_chat", { other_user: p.id });
    setOpening(null);
    if (error || !data) return setSearchError("Could not open chat. Try again.");
    cache.setOtherProfile(data as string, p);
    router.push(`/chat/?id=${data}`);
  }

  const searchMode = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h1 className="text-2xl font-black tracking-tight">Gordies</h1>
        <Link href="/settings/" className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Settings">
          <SettingsIcon />
        </Link>
      </header>

      <div className="px-5 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3">
          <SearchIcon className="h-5 w-5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={online ? "Find people by username" : "Search needs internet"}
            disabled={!online}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full bg-transparent py-3 outline-none placeholder:text-muted disabled:opacity-60"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted" aria-label="Clear search">
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {!searchMode && (
        <div className="flex gap-1 px-5 pb-2" role="tablist">
          {(["chats", "members"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                tab === t ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {t === "chats"
                ? `Chats${groupUnread > 0 || chats.some((c) => c.unread > 0) ? " •" : ""}`
                : `Members${members.length ? ` (${members.length})` : ""}`}
            </button>
          ))}
        </div>
      )}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
        {searchMode ? (
          <>
            {searchError && <p className="px-5 py-2 text-sm text-red-600">{searchError}</p>}
            {searching && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}
            {!searching && results.length === 0 && (
              <p className="px-5 py-8 text-center text-muted">No one found with that username.</p>
            )}
            {!searching &&
              results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openChatWith(p)}
                  disabled={opening !== null}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2"
                >
                  <Avatar name={p.display_name} url={p.avatar_url} online={onlineUsers.has(p.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.display_name}</p>
                    <p className="truncate text-sm text-muted">@{p.username}</p>
                  </div>
                  {opening === p.id ? <Spinner size={20} /> : <span className="text-sm font-semibold text-accent">Chat</span>}
                </button>
              ))}
          </>
        ) : tab === "members" ? (
          <MemberList
            members={members}
            loading={!membersLoaded && online && members.length === 0}
            me={me}
            onlineUsers={onlineUsers}
            opening={opening}
            error={searchError}
            onOpen={openChatWith}
          />
        ) : (
          <>
            <Link href="/general/" className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-black text-white">
                #
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">General</p>
                  {groupLast && (
                    <span className={`shrink-0 text-xs ${groupUnread > 0 ? "font-semibold text-accent" : "text-muted"}`}>
                      {listTime(groupLast.created_at)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${groupUnread > 0 ? "font-medium text-fg" : "text-muted"}`}>
                    {groupLast ? (
                      <>
                        {groupLast.sender_id === me
                          ? "You: "
                          : `${members.find((p) => p.id === groupLast.sender_id)?.display_name ?? "Member"}: `}
                        {groupLast.body}
                      </>
                    ) : (
                      <span className="italic">Group chat with everyone</span>
                    )}
                  </p>
                  {groupUnread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                      {groupUnread > 99 ? "99+" : groupUnread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            {chats.length === 0 ? (
          loaded || !online ? (
            <div className="px-8 py-16 text-center">
              <p className="text-4xl">👋</p>
              <p className="mt-3 font-semibold">No chats yet</p>
              <p className="mt-1 text-sm text-muted">
                Open <button onClick={() => setTab("members")} className="font-semibold text-accent">Members</button> or
                search a username to start chatting.
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )
        ) : (
          chats.map((c) => {
            const mine = c.last_sender === me;
            return (
              <Link
                key={c.chat_id}
                href={`/chat/?id=${c.chat_id}`}
                onClick={() =>
                  cache.setOtherProfile(c.chat_id, {
                    id: c.other_id,
                    username: c.other_username,
                    display_name: c.other_display,
                    avatar_url: c.other_avatar,
                  })
                }
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
              >
                <Avatar name={c.other_display} url={c.other_avatar} size={52} online={onlineUsers.has(c.other_id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold">{c.other_display}</p>
                    <span className={`shrink-0 text-xs ${c.unread > 0 ? "font-semibold text-accent" : "text-muted"}`}>
                      {listTime(c.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${c.unread > 0 ? "font-medium text-fg" : "text-muted"}`}>
                      {mine && <span className="mr-1"><Ticks seen={!!c.last_seen_at} seenColor="text-sky-500" /></span>}
                      {c.last_body ?? <span className="italic">Say hi 👋</span>}
                    </p>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
          </>
        )}
      </div>
    </div>
  );
}

function MemberList({
  members,
  loading,
  me,
  onlineUsers,
  opening,
  error,
  onOpen,
}: {
  members: Profile[];
  loading: boolean;
  me: string;
  onlineUsers: Set<string>;
  opening: string | null;
  error: string | null;
  onOpen: (p: Profile) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  const isOn = (p: Profile) => p.id === me || onlineUsers.has(p.id);
  const groups = [
    { title: "Online", list: members.filter(isOn) },
    { title: "Offline", list: members.filter((p) => !isOn(p)) },
  ];
  return (
    <>
      {error && <p className="px-5 py-2 text-sm text-red-600">{error}</p>}
      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <section key={g.title}>
              <h2 className="px-5 pt-4 pb-1 text-xs font-bold tracking-wider text-muted uppercase">
                {g.title} — {g.list.length}
              </h2>
              {g.list.map((p) => {
                const self = p.id === me;
                return (
                  <button
                    key={p.id}
                    onClick={() => !self && onOpen(p)}
                    disabled={self || opening !== null}
                    className={`flex w-full items-center gap-3 px-5 py-2.5 text-left ${
                      self ? "cursor-default" : "hover:bg-surface-2"
                    } ${g.title === "Offline" ? "opacity-60" : ""}`}
                  >
                    <Avatar name={p.display_name} url={p.avatar_url} online={isOn(p)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {p.display_name}
                        {self && <span className="ml-1 text-sm font-normal text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-sm text-muted">@{p.username}</p>
                    </div>
                    {opening === p.id ? (
                      <Spinner size={20} />
                    ) : (
                      !self && <span className="text-sm font-semibold text-accent">Chat</span>
                    )}
                  </button>
                );
              })}
            </section>
          ),
      )}
    </>
  );
}
