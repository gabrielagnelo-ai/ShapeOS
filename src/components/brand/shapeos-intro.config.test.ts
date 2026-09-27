import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIntroBootstrap, SHAPEOS_INTRO } from "./shapeos-intro.config";

type BootstrapOptions = {
  search?: string;
  seen?: boolean;
  reducedMotion?: boolean;
  storageFailure?: "read" | "write";
  missingContent?: boolean;
  script?: string;
};

function runBootstrap(options: BootstrapOptions = {}) {
  const now = 1_800_000_000_000;
  const dataset: Record<string, string> = {};
  const content = { inert: false };
  const storage = new Map<string, string>(
    options.seen ? [[SHAPEOS_INTRO.sessionKey, "1"]] : [],
  );
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const getItem = vi.fn((key: string) => {
    if (options.storageFailure === "read") throw new Error("Storage unavailable");
    return storage.get(key) ?? null;
  });
  const setItem = vi.fn((key: string, value: string) => {
    if (options.storageFailure === "write") throw new Error("Storage unavailable");
    storage.set(key, value);
  });
  const matchMedia = vi.fn(() => ({ matches: !!options.reducedMotion }));
  const context = {
    document: {
      documentElement: { dataset },
      getElementById: (id: string) =>
        id === "shapeos-content" && !options.missingContent ? content : null,
    },
    location: { search: options.search ?? "" },
    sessionStorage: { getItem, setItem },
    matchMedia,
    URLSearchParams,
    Date: { now: () => now },
    setTimeout: (callback: () => void, delay: number) => {
      timers.push({ callback, delay });
      return timers.length;
    },
  };

  runInNewContext(options.script ?? createIntroBootstrap(true), context);
  return { now, dataset, content, storage, timers, getItem, setItem, matchMedia };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ShapeOS intro bootstrap", () => {
  it("starts the first visit and records the session before hydration", () => {
    const result = runBootstrap();

    expect(result.dataset.shapeosIntro).toBe("pending");
    expect(result.dataset.shapeosIntroDeadline).toBe(
      String(result.now + SHAPEOS_INTRO.safetyMs),
    );
    expect(result.storage.get(SHAPEOS_INTRO.sessionKey)).toBe("1");
    expect(result.timers).toHaveLength(1);
    expect(result.timers[0].delay).toBe(SHAPEOS_INTRO.safetyMs);
    expect(result.content.inert).toBe(false);
  });

  it("does not repeat the intro for a session that has already seen it", () => {
    const result = runBootstrap({ seen: true });

    expect(result.dataset).toEqual({});
    expect(result.timers).toHaveLength(0);
    expect(result.setItem).not.toHaveBeenCalled();
  });

  it("allows replay even when the session has already seen the intro", () => {
    const result = runBootstrap({ seen: true, search: "?intro=replay" });

    expect(result.dataset.shapeosIntro).toBe("pending");
    expect(result.getItem).not.toHaveBeenCalled();
    expect(result.storage.get(SHAPEOS_INTRO.sessionKey)).toBe("1");
  });

  it("disables the intro with the URL switch without consuming the session", () => {
    const result = runBootstrap({ search: "?intro=off" });

    expect(result.dataset).toEqual({});
    expect(result.getItem).not.toHaveBeenCalled();
    expect(result.setItem).not.toHaveBeenCalled();
    expect(result.timers).toHaveLength(0);
  });

  it("honors NEXT_PUBLIC_SHAPEOS_INTRO=false, including replay requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHAPEOS_INTRO", "false");
    vi.resetModules();
    const config = await import("./shapeos-intro.config");
    const result = runBootstrap({ search: "?intro=replay", script: config.createIntroBootstrap() });

    expect(config.SHAPEOS_INTRO.enabled).toBe(false);
    expect(result.dataset).toEqual({});
    expect(result.setItem).not.toHaveBeenCalled();
    expect(result.timers).toHaveLength(0);
  });

  it("skips motion immediately and does not let replay override the preference", () => {
    const result = runBootstrap({ reducedMotion: true, search: "?intro=replay" });

    expect(result.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(result.dataset).toEqual({});
    expect(result.setItem).not.toHaveBeenCalled();
    expect(result.timers).toHaveLength(0);
  });

  it.each(["read", "write"] as const)("tolerates a storage %s failure and retains its safety timer", (storageFailure) => {
    const result = runBootstrap({ storageFailure });

    expect(result.dataset.shapeosIntro).toBe("pending");
    expect(result.timers).toHaveLength(1);
    expect(() => result.timers[0].callback()).not.toThrow();
    expect(result.dataset).toEqual({});
  });

  it("releases the overlay, deadline and inert content if hydration cannot finish", () => {
    const result = runBootstrap();
    result.content.inert = true;
    result.dataset.shapeosIntro = "playing";

    result.timers[0].callback();

    expect(result.dataset).toEqual({});
    expect(result.content.inert).toBe(false);
    expect(() => result.timers[0].callback()).not.toThrow();
  });

  it("also releases the document when page content has not arrived", () => {
    const result = runBootstrap({ missingContent: true });

    expect(() => result.timers[0].callback()).not.toThrow();
    expect(result.dataset).toEqual({});
  });
});
