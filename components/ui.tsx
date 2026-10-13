"use client";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import Spinner from "./Spinner";

export function Input({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-fg outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
      {hint && <span className="mt-1.5 block text-xs">{hint}</span>}
    </label>
  );
}

export function Button({
  loading,
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-white hover:brightness-110",
    ghost: "bg-surface-2 text-fg hover:brightness-95",
    danger: "bg-red-600/10 text-red-600 hover:bg-red-600/15",
  }[variant];
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {loading ? <Spinner size={20} /> : children}
    </button>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="rounded-lg bg-red-600/10 px-3 py-2 text-sm text-red-600">{children}</p>;
}

/** Turns Supabase errors into simple English. */
export function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "This email already has an account. Try signing in.";
  if (m.includes("password should be at least")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a few minutes and try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email first (check your inbox).";
  if (m.includes("token") && (m.includes("expired") || m.includes("invalid"))) return "That code is wrong or expired.";
  if (m.includes("failed to fetch") || m.includes("network")) return navigator.onLine ? "Can't reach the Gordies server. Try again in a moment." : "No internet connection.";
  if (m.includes("duplicate key") && m.includes("username")) return "This username is already taken.";
  return msg;
}
