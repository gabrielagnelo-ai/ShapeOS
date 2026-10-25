import { describe, expect, it } from "vitest";
import { EMPTY_REMINDER, WATER_REMINDER_INTERVAL, isWaterReminderDue, parseWaterReminder, scheduleWaterReminder } from "./water-reminder";

describe("water reminder scheduling", () => {
  it("fires at one hour and keeps the original deadline after reload/navigation", () => {
    const now = Date.parse("2026-10-23T15:00:00Z");
    const saved = JSON.stringify(scheduleWaterReminder(now));
    const restored = parseWaterReminder(saved);
    expect(restored.nextAt).toBe(now + WATER_REMINDER_INTERVAL);
    expect(isWaterReminderDue(restored, now + WATER_REMINDER_INTERVAL - 1)).toBe(false);
    expect(isWaterReminderDue(restored, now + WATER_REMINDER_INTERVAL)).toBe(true);
  });
  it("shows one overdue reminder on resuming, without a burst of missed alerts", () => {
    const restored = scheduleWaterReminder(1000);
    expect(isWaterReminderDue(restored, 1000 + WATER_REMINDER_INTERVAL * 12)).toBe(true);
    expect(isWaterReminderDue({ ...restored, due: true }, 1000 + WATER_REMINDER_INTERVAL * 12)).toBe(false);
    expect(isWaterReminderDue(EMPTY_REMINDER, Date.now())).toBe(false);
  });
  it.each([null, "1", "{broken", '{"enabled":true,"nextAt":null}', '{"enabled":true,"nextAt":-1}'])("ignores invalid saved data %s", (value) => {
    expect(parseWaterReminder(value)).toEqual(EMPTY_REMINDER);
  });
  it("starts a fresh hour only when explicitly scheduled again", () => {
    const now = Date.now();
    expect(scheduleWaterReminder(now)).toEqual({ enabled: true, nextAt: now + WATER_REMINDER_INTERVAL, due: false });
  });
});
