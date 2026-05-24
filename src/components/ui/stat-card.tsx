import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./glass-card";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "white";
}) {
  return (
    <GlassCard className="min-h-36">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div
          className={clsx(
            "grid size-11 place-items-center rounded-2xl",
            tone === "green" && "bg-lime-300/15 text-lime-300",
            tone === "blue" && "bg-sky-400/15 text-sky-300",
            tone === "white" && "bg-white/10 text-white",
          )}
        >
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-zinc-400">{detail}</p>
    </GlassCard>
  );
}
