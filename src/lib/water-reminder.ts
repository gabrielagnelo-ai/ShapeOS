export const WATER_REMINDER_KEY = "shapeos-water-reminder-v2";
export const WATER_REMINDER_INTERVAL = 60 * 60 * 1000;
export type WaterReminderState = { enabled: boolean; nextAt: number | null; due: boolean };
export const EMPTY_REMINDER: WaterReminderState = { enabled: false, nextAt: null, due: false };

export function parseWaterReminder(value: string | null): WaterReminderState {
  try {
    const parsed = JSON.parse(value ?? "null");
    if (parsed?.enabled === true && Number.isFinite(parsed.nextAt) && parsed.nextAt > 0) {
      return { enabled: true, nextAt: parsed.nextAt, due: parsed.due === true };
    }
  } catch { /* A preferência local pode ter sido apagada ou corrompida. */ }
  return EMPTY_REMINDER;
}

export function scheduleWaterReminder(now: number): WaterReminderState {
  return { enabled: true, nextAt: now + WATER_REMINDER_INTERVAL, due: false };
}

export function isWaterReminderDue(state: WaterReminderState, now: number) {
  return state.enabled && !state.due && state.nextAt !== null && now >= state.nextAt;
}
