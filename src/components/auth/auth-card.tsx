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
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(184,255,0,.12),transparent_30%),radial-gradient(circle_at_80%_35%,rgba(10,132,255,.10),transparent_26%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex">
            <Image src="/shapeos-logo.png" alt="ShapeOS" width={1105} height={285} className="h-auto w-[480px]" priority />
          </Link>
          <h2 className="mt-10 max-w-xl text-5xl font-semibold tracking-tight">Sua dieta e evolução em um sistema limpo.</h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
            Calcule metas, salve seu perfil e acompanhe os ajustes com o Coach IA sem perder o controle.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {["BMR", "TDEE", "Macros"].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm text-zinc-300 backdrop-blur-xl">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[#111]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-8">
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
