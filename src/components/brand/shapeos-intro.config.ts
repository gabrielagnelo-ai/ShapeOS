/**
 * Launch (DS-26, "Anéis em órbita"): Hoje's four rings arrive spinning in depth and close
 * around the mark, then the mark flies to its place in the toolbar while the page opens
 * behind it. ?intro=replay plays it again in a session that has already seen it.
 */
export const SHAPEOS_INTRO = {
  enabled: process.env.NEXT_PUBLIC_SHAPEOS_INTRO !== "false",
  asset: "/shapeos-mark.png",
  width: 1254,
  height: 1254,
  sessionKey: "shapeos:intro:seen",
  /** Time from first paint until the mark takes off. */
  holdMs: 1320,
  flyMs: 620,
  imageWaitMs: 1000,
  safetyMs: 4500,
} as const;

/** Runs before the page is painted; no browser-only values enter React's render. */
export function createIntroBootstrap(enabled = SHAPEOS_INTRO.enabled) {
  return `(() => {
    if (!${JSON.stringify(enabled)}) return;
    const root = document.documentElement;
    const mode = new URLSearchParams(location.search).get("intro");
    if (mode === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (mode !== "replay" && sessionStorage.getItem(${JSON.stringify(SHAPEOS_INTRO.sessionKey)}) === "1") return;
      sessionStorage.setItem(${JSON.stringify(SHAPEOS_INTRO.sessionKey)}, "1");
    } catch { /* Private browsing must never prevent access to the site. */ }
    root.dataset.shapeosIntro = "pending";
    root.dataset.shapeosIntroDeadline = String(Date.now() + ${SHAPEOS_INTRO.safetyMs});
    setTimeout(() => {
      delete root.dataset.shapeosIntro;
      delete root.dataset.shapeosIntroDeadline;
      const content = document.getElementById("shapeos-content");
      if (content) content.inert = false;
    }, ${SHAPEOS_INTRO.safetyMs});
  })();`;
}
