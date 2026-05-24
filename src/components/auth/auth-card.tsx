import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function AuthCard({
  title,
  subtitle,
  error,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  error?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-hidden px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(184,255,0,.16),transparent_30%),radial-gradient(circle_at_80%_35%,rgba(10,132,255,.10),transparent_28%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex">
            <Image src="/shapeos-logo.png" alt="ShapeOS" width={1105} height={285} className="h-auto w-[480px]" priority />
          </Link>
          <h2 className="mt-10 max-w-xl text-5xl font-semibold tracking-tight">Sua dieta e evolução em um sistema inteligente.</h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
            Metas claras, dieta editável, evolução semanal e um Coach IA que sugere ajustes sem virar um chatbot invasivo.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["BMR", "gasto basal"],
              ["Macros", "meta diária"],
              ["Coach", "alertas úteis"],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
                <p className="font-semibold text-zinc-100">{title}</p>
                <p className="mt-1 text-xs text-zinc-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[34px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035))] p-6 shadow-[0_28px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-lime-300/50 before:to-transparent sm:p-8">
          <Link href="/" className="mb-8 flex justify-center lg:hidden">
            <Image src="/shapeos-logo.png" alt="ShapeOS" width={480} height={124} className="h-auto w-72" priority />
          </Link>
          <div className="mb-7">
            <p className="text-sm font-medium text-lime-300">ShapeOS</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{subtitle}</p>
          </div>
          {error ? <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          {children}
          <div className="mt-7 text-center text-sm text-zinc-500">{footer}</div>
        </section>
      </div>
    </main>
  );
}

export function AuthField({
  icon: Icon,
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="mt-2 flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 transition focus-within:border-lime-300/60 focus-within:bg-black/50">
        <Icon size={18} className="shrink-0 text-zinc-500" />
        <input {...props} className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-600" />
      </div>
    </label>
  );
}
