"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/online";
import { ACCENTS, useTheme, type Accent, type Bubble, type Mode, type Wallpaper } from "@/lib/theme";
import { uploadAvatar } from "@/lib/avatar";
import Gate from "@/components/Gate";
import Avatar from "@/components/Avatar";
import Spinner from "@/components/Spinner";
import { BackIcon, CameraIcon } from "@/components/Icons";
import { Button, ErrorText, Input, friendlyError } from "@/components/ui";

export default function SettingsPage() {
  return (
    <Gate need="ready">
      <Settings />
    </Gate>
  );
}

function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const online = useOnline();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user || !profile) return null;
  const uid = user.id;

  async function saveName() {
    setError(null);
    setSaved(false);
    if (!displayName.trim()) return setError("Display name cannot be empty.");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", uid);
    setSaving(false);
    if (error) return setError(friendlyError(error.message));
    await refreshProfile();
    setSaved(true);
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const avatar_url = await uploadAvatar(uid, file);
      const { error } = await supabase.from("profiles").update({ avatar_url }).eq("id", uid);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setError(null);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);
    if (error) return setError(friendlyError(error.message));
    await refreshProfile();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-2 py-3">
        <Link href="/chats/" className="rounded-full p-2 hover:bg-surface-2" aria-label="Back">
          <BackIcon />
        </Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-10">
        {/* ---------- Profile ---------- */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!online || uploading}
              className="relative rounded-full disabled:opacity-60"
              aria-label="Change profile photo"
            >
              <Avatar name={profile.display_name} url={profile.avatar_url} size={72} />
              <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-accent text-white">
                {uploading ? <Spinner size={14} /> : <CameraIcon className="h-3.5 w-3.5" />}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changePhoto(e.target.files?.[0])} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{profile.display_name}</p>
              <p className="truncate text-muted">@{profile.username}</p>
              {profile.avatar_url && (
                <button onClick={removePhoto} disabled={!online} className="mt-1 text-xs font-medium text-red-600">
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Input
              label="Display name"
              value={displayName}
              maxLength={40}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSaved(false);
              }}
            />
            <ErrorText>{error}</ErrorText>
            <Button
              variant="ghost"
              onClick={saveName}
              loading={saving}
              disabled={!online || displayName.trim() === profile.display_name}
            >
              {saved ? "Saved ✓" : "Save name"}
            </Button>
            <p className="text-xs text-muted">Your username can&apos;t be changed.</p>
          </div>
        </section>

        {/* ---------- Theme ---------- */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-bold">Theme</h2>

          <Label>Mode</Label>
          <Segmented<Mode>
            value={theme.mode}
            onChange={(mode) => setTheme({ mode })}
            options={[
              ["system", "Auto"],
              ["light", "Light"],
              ["dark", "Dark"],
              ["amoled", "Black"],
            ]}
          />

          <Label>Color</Label>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(ACCENTS) as Accent[]).map((a) => (
              <button
                key={a}
                onClick={() => setTheme({ accent: a })}
                aria-label={a}
                className={`h-10 w-10 rounded-full transition ${
                  theme.accent === a ? "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ background: ACCENTS[a] }}
              />
            ))}
          </div>

          <Label>Chat wallpaper</Label>
          <Segmented<Wallpaper>
            value={theme.wallpaper}
            onChange={(wallpaper) => setTheme({ wallpaper })}
            options={[
              ["plain", "Plain"],
              ["dots", "Dots"],
              ["gradient", "Gradient"],
            ]}
          />

          <Label>Bubble style</Label>
          <Segmented<Bubble>
            value={theme.bubble}
            onChange={(bubble) => setTheme({ bubble })}
            options={[
              ["round", "Round"],
              ["sharp", "Sharp"],
            ]}
          />

          {/* Live preview */}
          <div className="chat-wallpaper mt-5 space-y-2 rounded-xl border border-line p-4">
            <div className="flex">
              <div className="bubble border border-line bg-bubble-in px-3 py-2 text-sm">Class kab hai? 📚</div>
            </div>
            <div className="flex justify-end">
              <div className="bubble bg-accent px-3 py-2 text-sm text-white">10 baje, room 12 👍</div>
            </div>
          </div>
        </section>

        {/* ---------- Account ---------- */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-bold">Account</h2>
          <p className="mb-4 truncate text-sm text-muted">{user.email}</p>
          <Button variant="danger" onClick={signOut}>
            Log out
          </Button>
        </section>

        <p className="text-center text-xs text-muted">Gordies v1.0 · made for Gordon College</p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 mb-2 text-sm font-medium text-muted first:mt-0">{children}</p>;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="grid rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-lg py-2 text-sm font-semibold transition ${value === v ? "bg-surface text-fg shadow-sm" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
