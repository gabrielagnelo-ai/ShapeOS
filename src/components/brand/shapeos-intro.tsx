"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SHAPEOS_INTRO } from "./shapeos-intro.config";
import styles from "./shapeos-intro.module.css";

const timing = {
  "--intro-duration": `${SHAPEOS_INTRO.sequenceMs}ms`,
  "--intro-fade": `${SHAPEOS_INTRO.fadeMs}ms`,
} as CSSProperties;

export function ShapeOSIntro({ children }: { children: ReactNode }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldPlayRef = useRef<boolean | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    // Keep the first decision during React Strict Mode's setup/cleanup/setup cycle.
    shouldPlayRef.current ??= root.dataset.shapeosIntro === "pending";
    if (!shouldPlayRef.current) return;

    const content = contentRef.current;
    const logo = imageRef.current;
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

    const finish = (fade = true) => {
      if (disposed || ending) return;
      ending = true;
      timers.forEach(window.clearTimeout);
      if (content) content.inert = previousInert;
      if (fade && !motion.matches) {
        root.dataset.shapeosIntro = "leaving";
        schedule(() => {
          release();
          setFinished(true);
        }, SHAPEOS_INTRO.fadeMs);
      } else {
        release();
        setFinished(true);
      }
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
      schedule(() => finish(), SHAPEOS_INTRO.sequenceMs);
    };

    const imageReady = () => {
      if (!logo || logo.naturalWidth === 0) {
        finish(false);
        return;
      }
      // decode() also handles a cached image whose load event preceded hydration.
      logo.decode().then(start, () => finish(false));
    };
    const imageError = () => finish(false);
    const motionChanged = () => { if (motion.matches) finish(false); };
    const keyDown = (event: KeyboardEvent) => {
      // Tab releases the page before the browser moves focus to its first link.
      if (event.key === "Escape" || event.key === "Tab") finish(false);
    };
    const dismiss = () => finish();
    const visibilityChanged = () => {
      if (document.hidden) finish(false);
    };

    root.dataset.shapeosIntro = "pending";
    if (content) content.inert = true;
    const imageTimeout = schedule(() => finish(false), SHAPEOS_INTRO.imageWaitMs);
    schedule(() => finish(false), Math.max(0, deadline - Date.now()));
    logo?.addEventListener("load", imageReady);
    logo?.addEventListener("error", imageError);
    motion.addEventListener("change", motionChanged);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("visibilitychange", visibilityChanged);
    const overlay = document.getElementById("shapeos-intro");
    overlay?.addEventListener("pointerdown", dismiss);
    // A lazy image can report complete=true before it has a current source.
    // Promote only an eligible visit, then wait for real pixels or load/error.
    if (logo) logo.loading = "eager";
    if (logo?.complete && logo.naturalWidth > 0) imageReady();
    if (motion.matches || document.hidden) schedule(() => finish(false), 0);

    return () => {
      disposed = true;
      timers.forEach(window.clearTimeout);
      logo?.removeEventListener("load", imageReady);
      logo?.removeEventListener("error", imageError);
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("visibilitychange", visibilityChanged);
      overlay?.removeEventListener("pointerdown", dismiss);
      release();
    };
  }, []);

  return (
    <>
      {!finished && (
        <div id="shapeos-intro" className={styles.overlay} style={timing} aria-hidden="true">
          <div className={styles.halo} />
          <div className={styles.stage}>
            <div className={styles.edgeLight} />
            <div className={styles.artwork}>
              {/* These complementary regions reconstruct the exact original PNG.
                  The tagline remains in the image, with its original typography.
                  Native lazy loading avoids fetching this asset on skipped visits;
                  the bootstrap makes it visible immediately on the first visit. */}
              <Image ref={imageRef} className={`${styles.logo} ${styles.symbol}`} src={SHAPEOS_INTRO.asset}
                alt="" width={SHAPEOS_INTRO.width} height={SHAPEOS_INTRO.height}
                unoptimized loading="lazy" fetchPriority="high" draggable={false} />
              <Image className={`${styles.logo} ${styles.wordmark}`} src={SHAPEOS_INTRO.asset}
                alt="" width={SHAPEOS_INTRO.width} height={SHAPEOS_INTRO.height}
                unoptimized loading="lazy" draggable={false} />
              <Image className={`${styles.logo} ${styles.tagline}`} src={SHAPEOS_INTRO.asset}
                alt="" width={SHAPEOS_INTRO.width} height={SHAPEOS_INTRO.height}
                unoptimized loading="lazy" draggable={false} />
              <div className={styles.reflection} />
            </div>
            <div className={styles.scanner} />
          </div>
        </div>
      )}
      <div id="shapeos-content" ref={contentRef} className={styles.content}>
        {children}
      </div>
    </>
  );
}
