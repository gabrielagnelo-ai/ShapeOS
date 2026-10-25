"use client";

import { useEffect, useRef } from "react";
import styles from "./water-vessel.module.css";

export function WaterVessel({ percent, label }: { percent: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const level = Math.min(100, Math.max(0, percent));
  useEffect(() => {
    const vessel = ref.current;
    if (!vessel) return;
    let visible = false;
    const update = () => { vessel.dataset.active = String(visible && !document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(vessel);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  return (
    <div ref={ref} className={styles.vessel} data-active="false" data-empty={level === 0} role="img" aria-label={label}>
      <span className={styles.level} style={{ transform: `translateY(${100 - level}%)` }}>
        <span className={styles.surface} aria-hidden="true" />
      </span>
      <span className={styles.reflection} aria-hidden="true" />
    </div>
  );
}
