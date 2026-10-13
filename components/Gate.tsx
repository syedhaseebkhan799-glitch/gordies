"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Spinner from "./Spinner";

const HOME = { guest: "/login/", "needs-setup": "/setup/", ready: "/chats/" } as const;

/** Only shows the page when the user is in the right state; otherwise sends them to the right screen. */
export default function Gate({
  need,
  children,
}: {
  need: "guest" | "needs-setup" | "ready";
  children: React.ReactNode;
}) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "loading" && status !== need) router.replace(HOME[status]);
  }, [status, need, router]);

  if (status !== need) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <>{children}</>;
}
