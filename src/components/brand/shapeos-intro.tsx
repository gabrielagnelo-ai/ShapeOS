"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SHAPEOS_INTRO } from "./shapeos-intro.config";
import styles from "./shapeos-intro.module.css";

// ease-in-out: the mark is already on screen when it flies to the toolbar.
const FLIGHT_EASING = "cubic-bezier(0.645, 0.045, 0.355, 1)";

// The four rings of Hoje, outside in: energy, protein, carbohydrate, fat. Each arrives tilted on
// its own axes (degrees) and spins into place.
const RINGS = [
  { r: 98, w: 14, color: "var(--kcal)", tilt: [72, 0, -180] },
  { r: 79, w: 12, color: "var(--protein)", tilt: [0, 72, 160] },
  { r: 62, w: 12, color: "var(--carbs)", tilt: [-58, 38, -140] },
  { r: 45, w: 12, color: "var(--fat)", tilt: [38, -58, 120] },
];

/**
 * Launch, on the first visit of a session: Hoje's rings arrive spinning in depth and close around
 * the mark, then the mark flies to its place in the toolbar ([data-intro-target]) while the page
 * opens behind it. A tap skips to the flight; Escape and Tab end it at once; reduced motion never
 * shows it.
 */
export function ShapeOSIntro({ children }: { children: ReactNode }) {
  const markRef = useRef<HTMLImageElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldPlayRef = useRef<boolean | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    // Keep the first decision during React Strict Mode's setup/cleanup/setup cycle.
    shouldPlayRef.current ??= root.dataset.shapeosIntro === "pending";
    if (!shouldPlayRef.current) return;

    const content = contentRef.current;
    const mark = markRef.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timers: number[] = [];
    let disposed = false;
    let ending = false;
    let started = false;
    const previousInert = content?.inert ?? false;
    const deadline = Number(root.dataset.shapeosIntroDeadline) || Date.now();

    const schedule = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      timers.push(id);
      return id;
    };

    const release = () => {
      delete root.dataset.shapeosIntro;
      if (content) content.inert = previousInert;
    };

    // The mark travels to the toolbar mark and lands on it; without a target it fades out.
    const fly = () => {
      if (!mark) return;
      const from = mark.getBoundingClientRect();
      const to = document.querySelector("[data-intro-target]")?.getBoundingClientRect();
      const keyframes = to && to.width > 0 && from.width > 0
        ? [
            { transform: "none" },
            { transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})` },
          ]
        : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.8)" }];
      mark.animate(keyframes, { duration: SHAPEOS_INTRO.flyMs, easing: FLIGHT_EASING, fill: "forwards" });
    };

    const finish = (animate = true) => {
      if (disposed || ending) return;
      ending = true;
      timers.forEach(window.clearTimeout);
      if (content) content.inert = previousInert;
      if (!animate || motion.matches) {
        release();
        setFinished(true);
        return;
      }
      root.dataset.shapeosIntro = "leaving";
      fly();
      schedule(() => {
        release();
        setFinished(true);
      }, SHAPEOS_INTRO.flyMs);
    };

    const start = () => {
      if (disposed || ending || started) return;
      started = true;
      window.clearTimeout(imageTimeout);
      if (motion.matches || Date.now() >= deadline) {
        finish(false);
        return;
      }
      root.dataset.shapeosIntro = "playing";
      // The opening began at first paint; take off once it has run for holdMs.
      const paintedAt = performance.getEntriesByType("paint").find((entry) => entry.name === "first-paint")?.startTime ?? performance.now();
      schedule(() => finish(), Math.max(240, SHAPEOS_INTRO.holdMs - (performance.now() - paintedAt)));
    };

    const imageReady = () => {
      if (!mark || mark.naturalWidth === 0) {
        finish(false);
        return;
      }
      // decode() also handles a cached image whose load event preceded hydration.
      mark.decode().then(start, () => finish(false));
    };
    const imageError = () => finish(false);
    const motionChanged = () => { if (motion.matches) finish(false); };
    const keyDown = (event: KeyboardEvent) => {
      // Tab releases the page before the browser moves focus to its first link.
      if (event.key === "Escape" || event.key === "Tab") finish(false);
    };
    const skip = () => finish();
    const visibilityChanged = () => {
      if (document.hidden) finish(false);
    };

    root.dataset.shapeosIntro = "pending";
    if (content) content.inert = true;
    const imageTimeout = schedule(() => finish(false), SHAPEOS_INTRO.imageWaitMs);
    schedule(() => finish(false), Math.max(0, deadline - Date.now()));
    mark?.addEventListener("load", imageReady);
    mark?.addEventListener("error", imageError);
    motion.addEventListener("change", motionChanged);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("visibilitychange", visibilityChanged);
    const overlay = document.getElementById("shapeos-intro");
    overlay?.addEventListener("pointerdown", skip);
    // The preloaded mark may already be decoded by the time React hydrates.
    if (mark?.complete && mark.naturalWidth > 0) imageReady();
    if (motion.matches || document.hidden) schedule(() => finish(false), 0);

    return () => {
      disposed = true;
      timers.forEach(window.clearTimeout);
      mark?.removeEventListener("load", imageReady);
      mark?.removeEventListener("error", imageError);
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("visibilitychange", visibilityChanged);
      overlay?.removeEventListener("pointerdown", skip);
      release();
    };
  }, []);

  return (
    <>
      {!finished && (
        <div id="shapeos-intro" className={styles.overlay} aria-hidden="true">
          <div className={styles.stage}>
            <div className={styles.orbit}>
              {RINGS.map((ring, index) => (
                <svg key={ring.r} className={styles.ring} viewBox="0 0 220 220"
                  style={{ "--i": index, "--x": `${ring.tilt[0]}deg`, "--y": `${ring.tilt[1]}deg`, "--z": `${ring.tilt[2]}deg` } as CSSProperties}>
                  {/* The stroke starts at twelve o'clock, as on Hoje. */}
                  <g transform="rotate(-90 110 110)">
                    <circle className={styles.track} cx="110" cy="110" r={ring.r} strokeWidth={ring.w} />
                    <circle className={styles.arc} cx="110" cy="110" r={ring.r} strokeWidth={ring.w} pathLength={100}
                      style={{ "--ring": ring.color } as CSSProperties} />
                  </g>
                </svg>
              ))}
            </div>
            {/* Preloaded so the launch never opens on an empty ground; the optimised mark is a
                few kilobytes and the same file the toolbar shows. */}
            <Image ref={markRef} className={styles.mark} src={SHAPEOS_INTRO.asset}
              alt="" width={SHAPEOS_INTRO.width} height={SHAPEOS_INTRO.height}
              sizes="104px" priority draggable={false} />
          </div>
        </div>
      )}
      <div id="shapeos-content" ref={contentRef} className={styles.content}>
        {children}
      </div>
    </>
  );
}
