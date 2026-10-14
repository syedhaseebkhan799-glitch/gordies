"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useOnline } from "@/lib/online";
import { BackIcon } from "@/components/Icons";
import { Button, ErrorText, Input, friendlyError } from "@/components/ui";

// Reset by email link: Supabase's default "Reset Password" email has a link that
// comes back here as /forgot/?reset=1 and logs the user in for a password change.
// Inside the Android app (https://localhost) or Windows app (app://gordies) an email link
// can't open the page, so the link goes to the website instead.
function siteOrigin() {
  const { hostname, port, origin, protocol } = window.location;
  const inApp = protocol === "app:" || (hostname === "localhost" && !port);
  return inApp ? "https://gordies.vercel.app" : origin;
}

export default function ForgotPage() {
  const router = useRouter();
  const online = useOnline();
  const [step, setStep] = useState<"email" | "sent" | "checking" | "new" | "expired">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Came back from the email link?
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep("checking");
    const linkError = url.hash.includes("error=") || url.searchParams.has("error");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setStep("new");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStep("new");
      else if (linkError) setStep("expired");
      else setTimeout(() => setStep((s) => (s === "checking" ? "expired" : s)), 4000);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteOrigin()}/forgot/?reset=1`,
    });
    setLoading(false);
    if (error) return setError(friendlyError(error.message));
    setStep("sent");
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(friendlyError(error.message));
    router.replace("/");
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
      <Link href="/login/" className="mb-6 -ml-2 flex w-fit items-center gap-1 rounded-lg p-2 text-muted">
        <BackIcon className="h-5 w-5" /> Back
      </Link>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">Reset password</h1>

        {step === "email" && (
          <form onSubmit={sendLink} className="mt-6 space-y-4">
            <p className="text-muted">Enter your email. We will send you a reset link.</p>
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={loading} disabled={!online}>
              Send reset link
            </Button>
          </form>
        )}

        {step === "sent" && (
          <div className="mt-6 space-y-4">
            <p className="text-4xl">📧</p>
            <p className="text-muted">
              We sent a link to <b className="text-fg">{email}</b>. Open the email and tap <b className="text-fg">Reset password</b>.
              Check spam too.
            </p>
            <button type="button" onClick={() => setStep("email")} className="w-full text-sm text-muted">
              Use a different email
            </button>
          </div>
        )}

        {step === "checking" && <p className="mt-6 text-muted">Checking your reset link…</p>}

        {step === "expired" && (
          <div className="mt-6 space-y-4">
            <p className="text-muted">This reset link is invalid or has expired. Ask for a new one.</p>
            <Button type="button" onClick={() => setStep("email")}>
              Send a new link
            </Button>
          </div>
        )}

        {step === "new" && (
          <form onSubmit={saveNewPassword} className="mt-6 space-y-4">
            <p className="text-muted">Choose a new password.</p>
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
          </form>
        )}
      </div>
    </div>
  );
}
