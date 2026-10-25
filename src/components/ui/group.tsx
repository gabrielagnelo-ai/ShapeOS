import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * Inset grouped list, after iOS: a titled group of rows on one rounded panel, with
 * separators that start after the leading media. Lists, settings and history entries.
 */
export function Group({
  title,
  description,
  action,
  footer,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx("space-y-2", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {title && <h2 className="text-title3 text-text-primary">{title}</h2>}
            {description && <p className="text-body-sm text-text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="material overflow-hidden">{children}</div>
      {footer && <p className="px-1 text-body-sm text-text-muted">{footer}</p>}
    </section>
  );
}

const tileColours = {
  brand: "bg-primary text-primary-foreground",
  orange: "bg-[#ff9500] text-white",
  blue: "bg-[#0a84ff] text-white",
  cyan: "bg-[#32ade6] text-white",
  teal: "bg-[#30b0c7] text-white",
  green: "bg-[#30b94f] text-white",
  red: "bg-[#ff453a] text-white",
  yellow: "bg-[#ffb800] text-white",
  gray: "bg-[#8e8e93] text-white",
} as const;

export type TileColour = keyof typeof tileColours;

/** The rounded-square glyph tile that leads a row or a card title (iOS Settings). */
export function IconTile({
  icon: Icon,
  colour = "gray",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  colour?: TileColour;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        // Squircle with a top specular, like the iOS 26 icons.
        "flex shrink-0 items-center justify-center bg-[image:linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0)_62%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.08)]",
        size === "lg" ? "size-11 rounded-[12px]" : size === "sm" ? "size-7 rounded-[8px]" : "size-8 rounded-[9px]",
        tileColours[colour],
        className,
      )}
    >
      <Icon size={size === "lg" ? 21 : size === "sm" ? 15 : 17} strokeWidth={2.2} />
    </span>
  );
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Shows the disclosure chevron; on by default for links. */
  chevron?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-current"?: "page";
}

/** One row of a Group. A link or button when it has href/onClick. */
export function GroupRow({ title, subtitle, leading, trailing, href, onClick, chevron, className, ...aria }: RowProps) {
  const interactive = Boolean(href || onClick);
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch border-b border-hairline py-3 pr-4 group-last/row:border-b-0">
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium text-text-primary [overflow-wrap:anywhere]">{title}</span>
          {subtitle && <span className="mt-0.5 block text-body-sm text-text-muted [overflow-wrap:anywhere]">{subtitle}</span>}
        </span>
        {trailing && <span className="flex shrink-0 items-center gap-2 text-body-sm text-text-muted">{trailing}</span>}
        {(chevron ?? Boolean(href)) && <ChevronRight aria-hidden className="size-4 shrink-0 text-text-muted/70" />}
      </span>
    </>
  );
  const rowClass = clsx(
    "group/row flex min-h-[52px] w-full items-center gap-3 pl-4 text-left",
    interactive && "transition-colors hover:bg-surface-hover/60 focus-visible:bg-surface-hover focus-visible:outline-none active:bg-surface-hover",
    className,
  );
  if (href)
    return (
      <Link href={href} className={rowClass} {...aria}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={rowClass} {...aria}>
        {body}
      </button>
    );
  return <div className={rowClass}>{body}</div>;
}
