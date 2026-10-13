"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import Spinner from "@/components/Spinner";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!supabaseConfigured) return;
    if (status === "guest") router.replace("/login/");
    if (status === "needs-setup") router.replace("/setup/");
    if (status === "ready") router.replace("/chats/");
  }, [status, router]);

  if (!supabaseConfigured) {
    return (
      <div className="m-auto max-w-sm p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">Setup needed</h1>
        <p className="text-muted">
          Create a <code>.env.local</code> file with your Supabase URL and key (see <code>.env.local.example</code>),
          then restart <code>npm run dev</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}
