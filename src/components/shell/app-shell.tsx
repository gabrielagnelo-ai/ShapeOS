import Image from "next/image";
import Link from "next/link";
import { AppNavigation } from "./app-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh text-zinc-100">
      <div className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/50 shadow-[0_18px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-[1840px] items-center justify-between gap-3 px-3 sm:h-20 sm:px-4 md:px-6 2xl:px-8">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[18px] border border-lime-300/20 bg-lime-300/10 shadow-[0_0_30px_rgba(184,255,0,.12)] transition group-hover:border-lime-300/45 group-hover:bg-lime-300/15 sm:size-11">
              <Image src="/shapeos-icon.png" alt="ShapeOS" width={30} height={30} className="rounded-xl" />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">ShapeOS</span>
          </Link>
          <AppNavigation />
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1840px] px-3 pb-28 pt-24 sm:px-4 sm:pt-28 md:px-6 xl:pb-16 2xl:px-8">
        <div className="animate-fade-scale">{children}</div>
      </main>
      <AppNavigation mobile />
    </div>
  );
}
