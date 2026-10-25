"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

/** A form's submit. Filled by default (the main action); pass a class for gray or tinted ones. */
export function SubmitButton({ children, pendingLabel = "Salvando…", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending} className={`${props.className ?? "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:bg-primary-light"} disabled:cursor-wait disabled:opacity-50`}>{pending ? pendingLabel : children}</button>;
}
