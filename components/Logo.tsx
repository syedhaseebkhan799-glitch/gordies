export default function Logo({ size = 64 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[28%] bg-accent font-black text-white shadow-lg shadow-accent/30"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      G
    </div>
  );
}
