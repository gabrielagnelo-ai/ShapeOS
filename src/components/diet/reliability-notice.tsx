import Link from "next/link";
import { foodReliabilityMessages } from "@/lib/food-reliability";

export function ReliabilityNotice({ status }: { status?: string | null }) {
  if (!status || !foodReliabilityMessages[status]) return null;
  const success = ["plan-created", "recipe-created", "recipe-updated", "recipe-estimated", "recipe-logged", "recipe-planned"].includes(status);
  return <div role={success ? "status" : "alert"} className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${success ? "border-lime-300/20 bg-lime-300/5 text-lime-100" : "border-amber-200/20 bg-amber-200/5 text-amber-100"}`}>
    <p>{foodReliabilityMessages[status]}</p>
    {status.endsWith("review") ? <Link href="/configuracoes" className="mt-2 inline-block underline underline-offset-4">Conferir meu perfil</Link> : null}
  </div>;
}

export function SafetyReview({ required }: { required: boolean }) {
  if (!required) return null;
  return <label className="my-3 flex w-full min-w-0 items-start gap-2 text-xs leading-5 text-amber-100 md:col-span-full">
    <input type="checkbox" name="confirmSafetyReview" required className="mt-1 size-4 shrink-0 accent-lime-300" />
    <span>Conferi a composição, os alérgenos e a compatibilidade destes alimentos com meu perfil e o plano revisado com meu profissional.</span>
  </label>;
}
