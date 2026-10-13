export default function Spinner({ size = 28 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-[3px] border-line border-t-accent"
      style={{ width: size, height: size }}
      aria-label="loading"
    />
  );
}
