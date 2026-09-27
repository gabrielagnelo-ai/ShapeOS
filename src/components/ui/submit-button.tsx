"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

export function SubmitButton({ children, pendingLabel = "Salvando…", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending} className={`${props.className ?? "rounded-full bg-lime-300 px-5 py-3 font-semibold text-black"} disabled:cursor-wait disabled:opacity-50`}>{pending ? pendingLabel : children}</button>;
}
