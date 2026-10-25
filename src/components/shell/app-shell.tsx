import Image from "next/image";
import Link from "next/link";
import { AppNavigation } from "./app-navigation";
import { AmbientBackdrop } from "./ambient-backdrop";
import { EntranceSafety } from "./entrance-safety";
import { WaterReminderRunner } from "@/components/water/water-reminder";
import styles from "./app-shell.module.css";
import pages from "./workspace-pages.module.css";

export function AppShell({ children, dashboard = false }: { children: React.ReactNode; dashboard?: boolean }) {
  return (
    <div className={`${styles.workspace} ${dashboard ? "" : pages.workspace}`}>
      <a className={styles.skipLink} href="#shapeos-main">Ir para o conteúdo</a>
      <AmbientBackdrop />
      {/* The logo and the dock float; content blurs as it scrolls beneath them. */}
      <header className={`${styles.toolbar} scroll-edge`}>
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 md:px-8">
          <Link href="/dashboard" aria-label="Início do ShapeOS" className="grid size-11 shrink-0 place-items-center rounded-full">
            <Image src="/shapeos-mark.png" alt="" width={40} height={40} className={styles.brandMark} priority data-intro-target />
          </Link>
          <AppNavigation />
        </div>
      </header>
      <main id="shapeos-main" tabIndex={-1} className={styles.content}>
        <div className={styles.arrival}>{children}</div>
      </main>
      <AppNavigation mobile />
      <WaterReminderRunner />
      <EntranceSafety />
    </div>
  );
}
