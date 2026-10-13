"use client";
import { useOnline } from "@/lib/online";

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <span aria-hidden>📶</span>
      net on kar gandu
    </div>
  );
}
