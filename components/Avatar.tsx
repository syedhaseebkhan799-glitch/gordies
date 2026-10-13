"use client";

const COLORS = ["#2563eb", "#16a34a", "#7c3aed", "#dc2626", "#ea580c", "#db2777", "#0891b2", "#ca8a04"];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function Avatar({
  name,
  url,
  size = 44,
  online = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  online?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: colorFor(name), fontSize: size * 0.38 }}
        >
          {initials || "?"}
        </div>
      )}
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-surface bg-green-500"
          style={{ width: size * 0.28, height: size * 0.28 }}
          aria-label="online"
        />
      )}
    </div>
  );
}
