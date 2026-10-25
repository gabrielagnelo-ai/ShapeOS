import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

/**
 * A content panel. Despite the historical name, content never sits on glass: panels
 * are solid, 22px, lifted by a hairline and a soft shadow. Glass is for the floating
 * controls only (see globals.css).
 */
export function GlassCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={clsx("shapeos-panel panel relative overflow-hidden p-5 md:p-6", className)} {...props} />;
}
