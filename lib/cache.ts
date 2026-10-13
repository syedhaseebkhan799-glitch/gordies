// Small offline cache on the device, so chats can be read without internet.
import type { ChatRow, GroupMessage, Message, Profile } from "./types";

const MAX_MESSAGES_PER_CHAT = 300;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works, just without offline copy.
  }
}

export const cache = {
  getProfile: (uid: string) => read<Profile | null>(`g:profile:${uid}`, null),
  setProfile: (p: Profile) => write(`g:profile:${p.id}`, p),

  getChats: (uid: string) => read<ChatRow[]>(`g:chats:${uid}`, []),
  setChats: (uid: string, rows: ChatRow[]) => write(`g:chats:${uid}`, rows),

  getMembers: () => read<Profile[]>("g:members", []),
  setMembers: (rows: Profile[]) => write("g:members", rows),

  getGroup: () => read<GroupMessage[]>("g:group", []),
  setGroup: (msgs: GroupMessage[]) => write("g:group", msgs.slice(-MAX_MESSAGES_PER_CHAT)),
  // When I last opened # General (for the unread count).
  getGroupRead: (uid: string) => read<string>(`g:groupread:${uid}`, ""),
  setGroupRead: (uid: string, iso: string) => write(`g:groupread:${uid}`, iso),

  getMessages: (chatId: string) => read<Message[]>(`g:msgs:${chatId}`, []),
  setMessages: (chatId: string, msgs: Message[]) =>
    write(`g:msgs:${chatId}`, msgs.slice(-MAX_MESSAGES_PER_CHAT)),

  getOtherProfile: (chatId: string) => read<Profile | null>(`g:other:${chatId}`, null),
  setOtherProfile: (chatId: string, p: Profile) => write(`g:other:${chatId}`, p),

  clearAll() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("g:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};
