"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./workspace-tabs.module.css";

export function WorkspaceTabs({ label, items, initial = 0 }: { label: string; items: { id: string; label: string; content: ReactNode }[]; initial?: number }) {
  const uid = useId();
  const [active, setActive] = useState(initial);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const sync = () => {
      const index = items.findIndex((item) => `#${item.id}` === window.location.hash);
      if (index >= 0) setActive(index);
    };
    const frame = requestAnimationFrame(sync);
    window.addEventListener("hashchange", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", sync); };
  }, [items]);
  function select(index: number) {
    setActive(index);
    window.history.replaceState(null, "", `#${items[index].id}`);
  }
  return <div className={styles.root}>
    <div className={styles.bar} role="tablist" aria-label={label} style={{ "--count": items.length, "--index": active } as CSSProperties}>
      <span className={styles.selection} aria-hidden="true" />
      {items.map((item, index) => <button key={item.id} ref={(element) => { buttons.current[index] = element; }} type="button" role="tab" id={`${uid}-${item.id}-tab`} aria-controls={`${uid}-${item.id}-panel`} aria-selected={index === active} tabIndex={index === active ? 0 : -1} onClick={() => select(index)} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
        select(next); buttons.current[next]?.focus();
      }}>{item.label}</button>)}
    </div>
    {items.map((item, index) => <div key={item.id} role="tabpanel" id={`${uid}-${item.id}-panel`} aria-labelledby={`${uid}-${item.id}-tab`} hidden={active !== index} className={styles.panel} tabIndex={0}>{item.content}</div>)}
  </div>;
}
