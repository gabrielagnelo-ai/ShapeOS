"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import styles from "./app-navigation.module.css";
import { IconTile, type TileColour } from "@/components/ui/group";
import { Activity, Apple, BarChart3, Calculator, ChefHat, Dumbbell, FileText, FlaskConical, Home, LogOut, MoreHorizontal, Settings, Sparkles, Utensils, X, type LucideIcon } from "lucide-react";

const primary = [
  { href: "/dashboard", label: "Hoje", icon: Home },
  { href: "/diario", label: "Diário", icon: Apple },
  { href: "/dieta", label: "Dieta", icon: Utensils },
  { href: "/acompanhamento", label: "Progresso", icon: BarChart3 },
];
const sections: { title: string; items: { href: string; label: string; icon: LucideIcon; tile: TileColour }[] }[] = [
  { title: "Alimentação", items: [
    { href: "/receitas", label: "Receitas", icon: ChefHat, tile: "orange" },
    { href: "/alimentos", label: "Alimentos", icon: Apple, tile: "green" },
    { href: "/suplementos", label: "Suplementos", icon: FlaskConical, tile: "cyan" },
  ] },
  { title: "Treino", items: [
    { href: "/treinos", label: "Treinos", icon: Dumbbell, tile: "red" },
    { href: "/atividades", label: "Atividades", icon: Activity, tile: "yellow" },
  ] },
  { title: "Análises", items: [
    { href: "/coach", label: "Coach", icon: Sparkles, tile: "brand" },
    { href: "/calculadoras", label: "Calculadoras", icon: Calculator, tile: "gray" },
    { href: "/relatorio-nutricionista", label: "Relatório", icon: FileText, tile: "blue" },
  ] },
  { title: "Conta", items: [
    { href: "/configuracoes", label: "Metas e perfil", icon: Settings, tile: "gray" },
  ] },
];
const secondary = sections.flatMap((section) => section.items);

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const [minimized, setMinimized] = useMinimizeOnScroll(mobile, pathname);
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  const selectedIndex = primary.findIndex(({ href }) => active(href));
  const secondaryActive = secondary.some(({ href }) => active(href));
  const index = selectedIndex >= 0 ? selectedIndex : secondaryActive ? 4 : -1;
  // A tap (or Enter) on the minimized bar brings the tabs back instead of following the link.
  function expandOnTap(event: MouseEvent) {
    if (!minimized) return;
    event.preventDefault();
    event.stopPropagation();
    setMinimized(false);
  }
  return (
    <>
      <nav aria-label={mobile ? "Navegação mobile" : "Navegação principal"} className={`glass ${styles.dock} ${mobile ? styles.mobile : styles.desktop}`} data-selected={index >= 0} data-minimized={minimized} onClickCapture={expandOnTap} style={{ "--nav-index": Math.max(0, index) } as CSSProperties}>
        <span className={styles.lens} aria-hidden="true" />
        {primary.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={styles.item}>
            <Icon size={mobile ? 21 : 17} strokeWidth={active(href) ? 2.3 : 1.9} aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
        <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()} data-active={secondaryActive} className={styles.item}>
          <MoreHorizontal size={mobile ? 21 : 17} aria-hidden="true" /><span>Mais</span>
        </button>
      </nav>
      <dialog ref={dialog} aria-labelledby={titleId} className={`glass-menu ${styles.sheet}`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="mb-4 flex items-center justify-between gap-4 pl-2">
          <h2 id={titleId} className="text-h3">Mais no ShapeOS</h2>
          <button autoFocus type="button" aria-label="Fechar menu" onClick={() => dialog.current?.close()} className="grid size-10 place-items-center rounded-full bg-fill text-text-secondary hover:bg-fill-strong"><X size={20} /></button>
        </div>
        <nav aria-label="Todas as ferramentas" className={styles.sections}>
          {sections.map((section) => (
            <div key={section.title} className={styles.section}>
              <p className={styles.sectionTitle}>{section.title}</p>
              {section.items.map(({ href, label, icon, tile }) => (
                <Link key={href} href={href} onClick={() => dialog.current?.close()} aria-current={active(href) ? "page" : undefined} className={styles.tool}>
                  <IconTile icon={icon} colour={tile} /><span>{label}</span>
                </Link>
              ))}
              {section.title === "Conta" ? (
                <a href="/logout" className={`${styles.tool} ${styles.signOut}`}>
                  <span className={styles.signOutIcon}><LogOut size={17} aria-hidden="true" /></span><span>Sair da conta</span>
                </a>
              ) : null}
            </div>
          ))}
        </nav>
      </dialog>
    </>
  );
}

/**
 * iOS 26 tab bar: on a phone it shrinks to the current tab while the page scrolls down,
 * and comes back on scrolling up or near the top (a new page starts at the top).
 */
function useMinimizeOnScroll(enabled: boolean, pathname: string) {
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      if (y < 80) setMinimized(false);
      else if (delta > 8) setMinimized(true);
      else if (delta < -8) setMinimized(false);
      if (Math.abs(delta) > 8 || y < 80) last = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [enabled, pathname]);
  return [minimized, setMinimized] as const;
}
