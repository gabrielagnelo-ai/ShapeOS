/** The PNG is deliberately served unchanged: no optimizer, filters or redrawn text. */
export const SHAPEOS_INTRO = {
  enabled: process.env.NEXT_PUBLIC_SHAPEOS_INTRO !== "false",
  asset: "/shapeos-logo.png",
  width: 1105,
  height: 285,
  sessionKey: "shapeos:intro:seen",
  sequenceMs: 6000,
  fadeMs: 650,
  imageWaitMs: 1000,
  safetyMs: 8000,
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
