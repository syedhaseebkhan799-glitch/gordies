"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useOnline } from "@/lib/online";
import Gate from "@/components/Gate";
import Logo from "@/components/Logo";
import { Button, ErrorText, Input, friendlyError } from "@/components/ui";

export default function LoginPage() {
  return (
    <Gate need="guest">
      <LoginForm />
    </Gate>
  );
}

function LoginForm() {
  const online = useOnline();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      if (password.length < 6) return setError("Password must be at least 6 characters.");
      if (password !== confirm) return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        // If email confirmation is ON in Supabase, there is no session yet.
        if (!data.session) {
          setNotice("Account created! Check your email and tap the confirm link, then sign in here.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      // On success, AuthProvider notices the new session and Gate moves us on.
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-4 text-3xl font-black tracking-tight">Gordies</h1>
          <p className="mt-1 text-muted">Chat with your Gordon College friends</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface-2 p-1">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === m ? "bg-surface text-fg shadow-sm" : "text-muted"
              }`}
            >
              {m === "signup" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          {mode === "signup" && (
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
            />
          )}

          <ErrorText>{error}</ErrorText>
          {notice && <p className="rounded-lg bg-green-600/10 px-3 py-2 text-sm text-green-600">{notice}</p>}

          <Button type="submit" loading={loading} disabled={!online}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        {mode === "signin" && (
          <Link href="/forgot/" className="mt-4 block text-center text-sm font-medium text-accent">
            Forgot password?
          </Link>
        )}
      </div>
    </div>
  );
}
