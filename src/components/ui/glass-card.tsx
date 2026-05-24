import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

export function GlassCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[30px] border border-white/[0.11] bg-[linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.035))] p-5 shadow-[0_24px_90px_rgba(0,0,0,.38)] backdrop-blur-2xl transition duration-300 before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent hover:border-lime-300/25 hover:bg-white/[0.075]",
        className,
      )}
      {...props}
    />
  );
}
