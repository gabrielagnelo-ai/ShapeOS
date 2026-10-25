import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./screen.module.css";

/** The content of a screen under its large title, in reading order; each block enters a beat after the previous one. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(styles.stack, className)}>{children}</div>;
}

/** The screen's one answer (iOS hero card): the largest card, with the main figure and the one filled action. */
export function Hero({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={clsx("panel", styles.hero, className)} {...props} />;
}

/** A titled section of cards, after the iOS Fitness and Health summaries. */
export function Section({
  title,
  link,
  columns = 1,
  id,
  className,
  children,
}: {
  title: string;
  /** The section's "show more": a plain link in the tint. */
  link?: { href: string; label: string };
  columns?: 1 | 2 | 3 | "wide";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className={clsx(styles.section, className)}>
      <header className={styles.header}>
        <h2>{title}</h2>
        {link ? <Link href={link.href} className={styles.action}>{link.label}</Link> : null}
      </header>
      <div className={styles.grid} data-columns={columns}>{children}</div>
    </section>
  );
}

/** Several cards stacked in one cell of a section's grid. */
export function Column({ children }: { children: ReactNode }) {
  return <div className={styles.column}>{children}</div>;
}
