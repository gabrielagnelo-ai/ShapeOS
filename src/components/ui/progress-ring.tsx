export function ProgressRing({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid size-32 place-items-center rounded-full bg-white/[0.04]">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#b8ff00 ${pct * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}
      />
      <div className="relative grid size-24 place-items-center rounded-full bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-2xl font-semibold text-white">{pct}%</div>
          <div className="text-xs text-zinc-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
