type Point = {
  label: string;
  value: number;
};

export function ProgressChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <div className="grid h-64 place-items-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
        <div>
          <p className="font-medium text-zinc-200">Sem histórico suficiente</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Salve pelo menos dois check-ins semanais para visualizar sua progressão.</p>
        </div>
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (point.value - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${coords.at(-1)?.x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

  return (
    <div className="rounded-3xl bg-black/20 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible">
        <defs>
          <linearGradient id="shapeos-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b8ff00" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#b8ff00" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => {
          const y = padding + (line / 3) * (height - padding * 2);
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255,255,255,.08)" />;
        })}
        <path d={area} fill="url(#shapeos-chart-fill)" />
        <path d={path} fill="none" stroke="#b8ff00" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#0a0a0a" stroke="#b8ff00" strokeWidth="3" />
            <text x={point.x} y={height - 6} textAnchor="middle" fill="rgba(255,255,255,.45)" fontSize="12">{point.label}</text>
          </g>
        ))}
        <text x={padding} y="18" fill="rgba(255,255,255,.55)" fontSize="12">{max.toFixed(1)} kg</text>
        <text x={padding} y={height - padding - 8} fill="rgba(255,255,255,.55)" fontSize="12">{min.toFixed(1)} kg</text>
      </svg>
    </div>
  );
}
