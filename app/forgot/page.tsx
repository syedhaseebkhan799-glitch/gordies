"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useOnline } from "@/lib/online";
import { BackIcon } from "@/components/Icons";
import { Button, ErrorText, Input, friendlyError } from "@/components/ui";

// Reset with a 6-digit code from email (works the same on Android, Windows and localhost).
export default function ForgotPage() {
  const router = useRouter();
  const online = useOnline();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) return setError(friendlyError(error.message));
    setStep("code");
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "recovery",
      });
      if (otpErr) throw otpErr;
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      router.replace("/");
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
      <Link href="/login/" className="mb-6 -ml-2 flex w-fit items-center gap-1 rounded-lg p-2 text-muted">
        <BackIcon className="h-5 w-5" /> Back
      </Link>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">Reset password</h1>

        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <p className="text-muted">Enter your email. We will send you a 6-digit code.</p>
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={loading} disabled={!online}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="mt-6 space-y-4">
            <p className="text-muted">
              We sent a code to <b className="text-fg">{email}</b>. Check spam too.
            </p>
            <Input
              label="Code from email"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="123456"
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={loading} disabled={!online}>
              Save new password
            </Button>
            <button type="button" onClick={() => setStep("email")} className="w-full text-sm text-muted">
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
