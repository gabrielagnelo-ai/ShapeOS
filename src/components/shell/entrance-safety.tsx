"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Cards and the backdrop mark enter from opacity 0. If the browser's animation clock is not
 * running (a page drawn while out of view), finish those entrances so nothing stays hidden.
 * It waits for the launch to end, since the cards are paused behind it. When the clock runs
 * the entrances are already over, and this does nothing.
 */
export function EntranceSafety() {
  const pathname = usePathname();
  useEffect(() => {
    let timer = 0;
    const finishEntrances = () => {
      for (const animation of document.getAnimations()) {
        if (!(animation instanceof CSSAnimation) || animation.playState === "finished") continue;
        if (animation.animationName === "card-in" || animation.animationName.endsWith("settle")) animation.finish();
      }
    };
    const waitForLaunch = () => {
      timer = document.documentElement.dataset.shapeosIntro
        ? window.setTimeout(waitForLaunch, 300)
        : window.setTimeout(finishEntrances, 1800);
    };
    waitForLaunch();
    return () => window.clearTimeout(timer);
  }, [pathname]);
  return null;
}
