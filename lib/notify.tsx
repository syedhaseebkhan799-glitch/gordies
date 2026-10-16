"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import type { GroupMessage, Message } from "./types";

// Pops a system notification for new DMs and #General messages while the app is running
// (browser tab, Windows app, or Android app). Skips your own messages and the chat you're looking at.
const native = Capacitor.isNativePlatform();

async function askPermission() {
  if (native) {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") await LocalNotifications.requestPermissions();
  } else if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

let nextId = 1;

// Which chat is on screen right now ("chat:<id>", "general" or "").
function openChat() {
  const { pathname, search } = window.location;
  const id = new URLSearchParams(search).get("id");
  if (pathname.startsWith("/chat/") && id) return `chat:${id}`;
  return pathname.startsWith("/general") ? "general" : "";
}

export function NotificationsProvider() {
  const { user, status } = useAuth();
  const router = useRouter();
  const names = useRef(new Map<string, string>());

  // Ask for permission. Browsers want a tap first, so web asks on the first tap/click.
  useEffect(() => {
    if (status !== "ready") return;
    if (native) {
      askPermission();
      const sub = LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
        const url = e.notification.extra?.url;
        if (url) router.push(url);
      });
      return () => {
        sub.then((s) => s.remove());
      };
    }
    const onTap = () => askPermission();
    window.addEventListener("pointerdown", onTap, { once: true });
    return () => window.removeEventListener("pointerdown", onTap);
  }, [status, router]);

  useEffect(() => {
    if (!user || status !== "ready") return;
    const me = user.id;

    const nameOf = async (id: string) => {
      const known = names.current.get(id);
      if (known) return known;
      const { data } = await supabase.from("profiles").select("display_name").eq("id", id).maybeSingle();
      const name = data?.display_name ?? "Someone";
      names.current.set(id, name);
      return name;
    };

    const show = async (key: string, senderId: string, body: string, url: string, group: boolean) => {
      if (senderId === me) return;
      if (document.visibilityState === "visible" && document.hasFocus() && openChat() === key) return;
      const name = await nameOf(senderId);
      const title = group ? `# General` : name;
      const text = group ? `${name}: ${body}` : body;
      if (native) {
        const { display } = await LocalNotifications.checkPermissions();
        if (display !== "granted") return;
        await LocalNotifications.schedule({
          notifications: [{ id: nextId++, title, body: text, group: key, extra: { url } }],
        });
      } else if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification(title, { body: text, tag: key, icon: "/favicon.ico" });
        n.onclick = () => {
          window.focus();
          router.push(url);
          n.close();
        };
      }
    };

    const channel = supabase
      .channel("notify")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: m }) => {
        const msg = m as Message;
        show(`chat:${msg.chat_id}`, msg.sender_id, msg.body, `/chat/?id=${msg.chat_id}`, false);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, ({ new: m }) => {
        const msg = m as GroupMessage;
        show("general", msg.sender_id, msg.body, "/general/", true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, status, router]);

  return null;
}
