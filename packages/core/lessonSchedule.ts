/**
 * Lesson scheduling, shared by the backend and the site: a teacher's weekly availability (in their
 * own time zone), the open lesson times it gives, and the calendar invite (.ics) / Google Calendar
 * link a confirmed lesson comes with. Times are UTC milliseconds everywhere except the windows,
 * which are wall-clock "HH:MM" on a weekday in `timeZone`.
 */

/** One stretch of a weekday the teacher usually teaches (0 = Sunday). `end` is exclusive. */
export type WeeklyWindow = { weekday: number; start: string; end: string };

export type Availability = {
  timeZone: string;
  windows: WeeklyWindow[];
  /** Length of a lesson a student can request, in minutes. */
  lengthMin: number;
  /** Gap kept free after every lesson. */
  bufferMin: number;
  /** Requests need at least this much notice. */
  noticeHours: number;
  /** How far ahead students can book. */
  aheadDays: number;
  /** Days off ("YYYY-MM-DD", in the teacher's time zone). */
  blockedDates: string[];
  /** Whether students can request times from these windows. */
  allowRequests: boolean;
};

export type Slot = { start: number; end: number };

export const DEFAULT_AVAILABILITY: Omit<Availability, "timeZone"> = {
  windows: [],
  lengthMin: 60,
  bufferMin: 0,
  noticeHours: 24,
  aheadDays: 28,
  blockedDates: [],
  allowRequests: true,
};

export const LESSON_LENGTHS = [15, 20, 30, 45, 60, 75, 90, 120];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function minutesOf(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function hhmmOf(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return m >= 24 * 60 ? "24:00" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** The wall clock in `tz` at `ms`. */
export function wallClock(ms: number, tz: string) {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) if (p.type !== "literal") parts[p.type] = Number(p.value);
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute, second: parts.second };
}

/** How far `tz` is ahead of UTC at `ms`, in ms. */
function offsetAt(ms: number, tz: string) {
  const w = wallClock(ms, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
}

/** "YYYY-MM-DD" in `tz` at `ms`. */
export function dateKeyIn(ms: number, tz: string): string {
  const w = wallClock(ms, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** The UTC instant of a wall-clock time (`minutes` past midnight) on `dateKey` in `tz`. (Around a clock change,
    a time that doesn't exist lands an hour off.) */
export function zonedTime(dateKey: string, minutes: number, tz: string): number {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, 0) + minutes * 60_000;
  return guess - offsetAt(guess - offsetAt(guess, tz), tz);
}

function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const windowEnd = (w: WeeklyWindow) => (w.end === "24:00" ? 24 * 60 : minutesOf(w.end));

const overlaps = (a: Slot, b: Slot) => a.start < b.end && b.start < a.end;

/** Checks over availability from the client (or an old row) and fills in anything missing. */
export function cleanAvailability(raw: Partial<Availability> | null | undefined, fallbackTz = "UTC"): Availability {
  const r = raw ?? {};
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
  const windows = (Array.isArray(r.windows) ? r.windows : [])
    .filter((w) => w && Number.isInteger(w.weekday) && w.weekday >= 0 && w.weekday <= 6 && HHMM.test(w.start) && (HHMM.test(w.end) || w.end === "24:00"))
    .filter((w) => windowEnd(w) > minutesOf(w.start))
    .slice(0, 70)
    .map((w) => ({ weekday: w.weekday, start: w.start, end: w.end }))
    .sort((a, b) => a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start));
  return {
    timeZone: typeof r.timeZone === "string" && isValidTimeZone(r.timeZone) ? r.timeZone : fallbackTz,
    windows,
    lengthMin: num(r.lengthMin, 10, 240, DEFAULT_AVAILABILITY.lengthMin),
    bufferMin: num(r.bufferMin, 0, 120, DEFAULT_AVAILABILITY.bufferMin),
    noticeHours: num(r.noticeHours, 0, 24 * 14, DEFAULT_AVAILABILITY.noticeHours),
    aheadDays: num(r.aheadDays, 1, 120, DEFAULT_AVAILABILITY.aheadDays),
    blockedDates: (Array.isArray(r.blockedDates) ? r.blockedDates : []).filter((d) => typeof d === "string" && DATE_KEY.test(d)).slice(0, 200),
    allowRequests: typeof r.allowRequests === "boolean" ? r.allowRequests : DEFAULT_AVAILABILITY.allowRequests,
  };
}

/**
 * The lesson times open to students: every `lengthMin` slot that fits in a window (back to back,
 * with the buffer between), from `noticeHours` after `now` up to `aheadDays` ahead, skipping days
 * off and anything that overlaps `busy` (other lessons, each kept `bufferMin` clear).
 */
export function openSlots(av: Availability, busy: Slot[], now: number, lengthMin = av.lengthMin): Slot[] {
  const out: Slot[] = [];
  const earliest = now + av.noticeHours * 3_600_000;
  const pad = av.bufferMin * 60_000;
  const blocked = new Set(av.blockedDates);
  const padded = busy.map((b) => ({ start: b.start - pad, end: b.end + pad }));
  const first = dateKeyIn(now, av.timeZone);
  for (let d = 0; d <= av.aheadDays; d++) {
    const day = addDays(first, d);
    if (blocked.has(day)) continue;
    const wd = weekdayOf(day);
    for (const w of av.windows) {
      if (w.weekday !== wd) continue;
      const step = lengthMin + av.bufferMin;
      for (let m = minutesOf(w.start); m + lengthMin <= windowEnd(w); m += step) {
        const start = zonedTime(day, m, av.timeZone);
        const slot = { start, end: start + lengthMin * 60_000 };
        if (start < earliest) continue;
        if (padded.some((b) => overlaps(slot, b))) continue;
        out.push(slot);
      }
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out.filter((s, i) => i === 0 || s.start !== out[i - 1].start);
}

/** Whether `slot` is one of `openSlots` (any length that fits a window counts). */
export function isOpenSlot(av: Availability, busy: Slot[], now: number, slot: Slot): boolean {
  const len = Math.round((slot.end - slot.start) / 60_000);
  return openSlots(av, busy, now, len).some((s) => s.start === slot.start && s.end === slot.end);
}

export function slotsOverlap(a: Slot, b: Slot) {
  return overlaps(a, b);
}

// ---------------------------------------------------------------- formatting

/** "Tue, Oct 21 · 4:00 – 5:00 PM" in `tz` (the viewer's, when left out). */
export function formatSlot(slot: Slot, tz?: string, locale = "en-US"): string {
  const opts = tz ? { timeZone: tz } : {};
  const day = new Intl.DateTimeFormat(locale, { ...opts, weekday: "short", month: "short", day: "numeric" }).format(slot.start);
  const time = new Intl.DateTimeFormat(locale, { ...opts, hour: "numeric", minute: "2-digit" });
  return `${day} · ${time.format(slot.start)} – ${time.format(slot.end)}`;
}

/** A time zone's short name at `ms` ("PDT", "GMT+1"). */
export function zoneName(tz: string, ms = Date.now(), locale = "en-US"): string {
  try {
    const p = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" }).formatToParts(ms).find((x) => x.type === "timeZoneName");
    return p?.value ?? tz;
  } catch {
    return tz;
  }
}

export function durationLabel(slot: Slot): string {
  const min = Math.round((slot.end - slot.start) / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// ---------------------------------------------------------------- calendar

const icsStamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function icsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to 75 octets, as iCalendar wants. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (curLen + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export type LessonEvent = {
  /** Stable per lesson, so a cancellation replaces the same event. */
  uid: string;
  slot: Slot;
  title: string;
  description: string;
  url?: string;
  /** Bumped on every change to the same lesson. */
  sequence?: number;
  cancelled?: boolean;
};

/** A calendar file (.ics) for one lesson — Google Calendar, Apple Calendar and Outlook open it. */
export function lessonIcs(ev: LessonEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//sheddex//Lessons//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence ?? 0}`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(ev.slot.start)}`,
    `DTEND:${icsStamp(ev.slot.end)}`,
    `SUMMARY:${icsText(ev.cancelled ? `Cancelled: ${ev.title}` : ev.title)}`,
    `DESCRIPTION:${icsText(ev.description + (ev.url ? `\n\n${ev.url}` : ""))}`,
    ...(ev.url ? [`URL:${ev.url}`] : []),
    `STATUS:${ev.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(ev.cancelled ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(ev.title)}`, "TRIGGER:-PT30M", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A link that opens Google Calendar with the lesson filled in. */
export function googleCalendarUrl(ev: LessonEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsStamp(ev.slot.start)}/${icsStamp(ev.slot.end)}`,
    details: ev.description + (ev.url ? `\n\n${ev.url}` : ""),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Base64 of UTF-8 text (for email attachments; no `btoa`/`Buffer` assumed). */
export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (i + 1 < bytes.length ? abc[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? abc[n & 63] : "=");
  }
  return out;
}
