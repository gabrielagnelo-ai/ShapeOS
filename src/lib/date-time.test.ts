import { describe, expect, it } from "vitest";
import { appDateInputValue, endOfTodayInAppTimeZone, parseAppDate, startOfTodayInAppTimeZone } from "./date-time";

describe("app date time", () => {
  it("uses Sao Paulo day instead of server UTC day", () => {
    const reference = new Date("2026-06-02T01:30:00.000Z");

    expect(appDateInputValue(reference)).toBe("2026-06-01");
    expect(startOfTodayInAppTimeZone(reference).toISOString()).toBe("2026-06-01T03:00:00.000Z");
    expect(endOfTodayInAppTimeZone(reference).toISOString()).toBe("2026-06-02T02:59:59.999Z");
  });

  it("parses app dates as Sao Paulo midnight", () => {
    expect(parseAppDate("2026-06-02")?.toISOString()).toBe("2026-06-02T03:00:00.000Z");
  });
});
