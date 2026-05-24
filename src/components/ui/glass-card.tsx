import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

export function GlassCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={clsx(
        "rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl transition duration-300 hover:border-lime-300/30 hover:bg-white/[0.08]",
        className,
      )}
      {...props}
    />
  );
}
