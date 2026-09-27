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

  it("rejects nonexistent calendar dates instead of moving entries to another day", () => {
    for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-12", "2026-01-00", "ontem"]) expect(parseAppDate(value)).toBeNull();
    expect(appDateInputValue(parseAppDate("2024-02-29")!)).toBe("2024-02-29");
  });
});
