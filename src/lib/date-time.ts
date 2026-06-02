export const APP_TIME_ZONE = "America/Sao_Paulo";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function startOfTodayInAppTimeZone(referenceDate = new Date()) {
  return startOfDayInTimeZone(referenceDate, APP_TIME_ZONE);
}

export function endOfTodayInAppTimeZone(referenceDate = new Date()) {
  const today = zonedParts(referenceDate, APP_TIME_ZONE);
  const nextDayStart = zonedDateTimeToUtc({
    year: today.year,
    month: today.month,
    day: today.day + 1,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    timeZone: APP_TIME_ZONE,
  });
  return new Date(nextDayStart.getTime() - 1);
}

export function appDateInputValue(referenceDate = new Date()) {
  const parts = appDateParts(referenceDate);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function appDateParts(referenceDate = new Date()) {
  return zonedParts(referenceDate, APP_TIME_ZONE);
}

export function startOfAppDate(year: number, month: number, day: number) {
  return zonedDateTimeToUtc({
    year,
    month,
    day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    timeZone: APP_TIME_ZONE,
  });
}

export function parseAppDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return startOfAppDate(Number(year), Number(month), Number(day));
}

export function startOfDayInTimeZone(referenceDate: Date, timeZone = APP_TIME_ZONE) {
  const parts = zonedParts(referenceDate, timeZone);
  return zonedDateTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    timeZone,
  });
}

function zonedParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateTimeToUtc(input: DateParts & { millisecond: number; timeZone: string }) {
  const utcGuess = new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, input.second, input.millisecond));
  const actualParts = zonedParts(utcGuess, input.timeZone);
  const targetTime = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, input.second, input.millisecond);
  const actualTime = Date.UTC(actualParts.year, actualParts.month - 1, actualParts.day, actualParts.hour, actualParts.minute, actualParts.second, input.millisecond);

  return new Date(utcGuess.getTime() + targetTime - actualTime);
}
