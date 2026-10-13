"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/online";
import { uploadAvatar } from "@/lib/avatar";
import Gate from "@/components/Gate";
import Avatar from "@/components/Avatar";
import { CameraIcon } from "@/components/Icons";
import { Button, ErrorText, Input, friendlyError } from "@/components/ui";

export default function SetupPage() {
  return (
    <Gate need="needs-setup">
      <SetupForm />
    </Gate>
  );
}

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;
type Availability = "idle" | "checking" | "free" | "taken" | "invalid";

function SetupForm() {
  const { user, refreshProfile, signOut } = useAuth();
  const online = useOnline();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ name: string; taken: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const availability: Availability = !username
    ? "idle"
    : !USERNAME_RULE.test(username)
      ? "invalid"
      : checked?.name !== username
        ? "checking"
        : checked.taken
          ? "taken"
          : "free";

  // Check if the username is free, 400ms after the user stops typing.
  useEffect(() => {
    if (!USERNAME_RULE.test(username)) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setChecked({ name: username, taken: Boolean(data) });
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  function pickPhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (!USERNAME_RULE.test(username)) return setError("Username: 3-20 characters, only a-z, 0-9 and _");
    if (!displayName.trim()) return setError("Please enter a display name.");

    setLoading(true);
    try {
      let avatar_url: string | null = null;
      if (photo) avatar_url = await uploadAvatar(user.id, photo);
      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        username,
        display_name: displayName.trim(),
        avatar_url,
      });
      if (error) throw error;
      await refreshProfile(); // Gate then moves to the chats screen
    } catch (err) {
      setError(friendlyError((err as Error).message));
      setLoading(false);
    }
  }

  const hint = {
    idle: <span className="text-muted">3-20 characters: a-z, 0-9 and _</span>,
    checking: <span className="text-muted">Checking…</span>,
    free: <span className="text-green-600">✓ @{username} is available</span>,
    taken: <span className="text-red-600">✗ @{username} is already taken</span>,
    invalid: <span className="text-red-600">Only a-z, 0-9 and _ (3-20 characters)</span>,
  }[availability];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="mt-1 text-muted">Friends will find you by your username.</p>

        <form onSubmit={save} className="mt-8 space-y-5">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-full"
              aria-label="Choose profile photo"
            >
              <Avatar name={displayName || username || "?"} url={preview} size={96} />
              <span className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-accent text-white">
                <CameraIcon />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="-mt-2 text-center text-xs text-muted">Profile photo (optional)</p>

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="haseeb_07"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={20}
            hint={hint}
          />
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Haseeb"
            maxLength={40}
          />

          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} disabled={!online || availability === "taken" || availability === "invalid"}>
            Continue
          </Button>
          <button type="button" onClick={signOut} className="w-full text-sm text-muted">
            Use a different account
          </button>
        </form>
      </div>
    </div>
  );
}
