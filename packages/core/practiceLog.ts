/**
 * The Practice Log's data and calendar math — pure, shared by the web app (and the mobile app
 * later). One synced object holds everything: your routines and a log entry per day.
 *
 * - A **routine** is a named list of tasks (each with minutes and, optionally, its own time of
 *   day), an optional start time, a repeat rule, and attachments (tunes, setlists, charts, tools).
 * - A **day** (keyed `YYYY-MM-DD`, local time) holds what happened: per routine scheduled that
 *   day, the tasks checked off, time spent on each and notes; routines added to just that day;
 *   time from the Practice Timer that wasn't a routine; extra minutes logged by hand; the day's
 *   own notes and attachments. Recordings live in Convex (`recordings.logDate`/`routineId`).
 *
 * Dates are always the plain `YYYY-MM-DD` string of a local calendar day — never a `Date` with a
 * time zone attached — so a routine on "Tuesday" is Tuesday wherever you open it.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type Attachment =
  | { kind: "tune"; id: string; list: "tunes" | "learn"; label: string }
  | { kind: "setlist"; id: string; label: string }
  | { kind: "chart"; id: string; label: string }
  | { kind: "tool"; href: string; label: string };

export type RoutineTask = {
  id: string;
  title: string;
  /** Decimal minutes, like the Practice Timer's segments. */
  minutes: number;
  /** "HH:MM" — a fixed time of day for this task. Without one, a task follows the one before it
      (from the routine's start time, when there is one). */
  time: string | null;
  notes: string;
  attachments: Attachment[];
};

export type RepeatFreq = "once" | "daily" | "weekly" | "monthly";

export type Repeat = {
  freq: RepeatFreq;
  /** Every N days / weeks / months. */
  interval: number;
  /** For weekly: which days. Empty = the start date's weekday. */
  weekdays: Weekday[];
  /** The first day (and, for "once", the only day). */
  start: string;
  /** The last day it can fall on, or null for no end. */
  end: string | null;
};

export type Routine = {
  id: string;
  name: string;
  description: string;
  /** Index into `ROUTINE_COLORS`. */
  color: number;
  /** "HH:MM", or null for "any time". */
  startTime: string | null;
  repeat: Repeat;
  tasks: RoutineTask[];
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
};

/** What happened with one routine on one day. */
export type Occurrence = {
  /** Ids of the tasks checked off. */
  done?: string[];
  /** Time spent per task, in ms (from the timer). */
  spentMs?: Record<string, number>;
  notes?: string;
  /** Skipped for this day (stays on the calendar, struck through). */
  skipped?: boolean;
  /** A start time just for this day ("HH:MM"), instead of the routine's. */
  startTime?: string | null;
};

/** A one-off task on a day, not part of any routine. */
export type DayTask = {
  id: string;
  title: string;
  minutes: number;
  /** "HH:MM", or null for any time. */
  time: string | null;
  done: boolean;
  notes?: string;
  spentMs?: number;
  attachments?: Attachment[];
};

/** The timer `link.routineId` used when running a day's own tasks. */
export const DAY_TASKS_ID = "day";

/** Practice Timer time that wasn't part of a routine. */
export type TimerEntry = { session: string; title: string; ms: number; at: number };

export type DayLog = {
  notes?: string;
  attachments?: Attachment[];
  /** Routines added to just this day (not on their own schedule). */
  added?: string[];
  routines?: Record<string, Occurrence>;
  /** One-off tasks for just this day. */
  tasks?: DayTask[];
  sessions?: TimerEntry[];
  /** Practice logged by hand, in minutes. */
  extraMinutes?: number;
};

export type PracticeLogPrefs = {
  /** Minutes a day to aim for. */
  dailyGoal: number;
  /** The little sounds when you check things off. */
  sounds: boolean;
};

export const DEFAULT_PREFS: PracticeLogPrefs = { dailyGoal: 30, sounds: true };

export type PracticeLogData = {
  routines: Routine[];
  days: Record<string, DayLog>;
  prefs: PracticeLogPrefs;
};

/** Colors a routine can be, as CSS — each reads on both light and dark themes. */
export const ROUTINE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6", "#84cc16"];

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------------------------------------------------------------- dates

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** The local calendar day of a Date, as YYYY-MM-DD. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** A YYYY-MM-DD as a local Date at noon (noon so DST shifts never move it to another day). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function isDateKey(key: unknown): key is string {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function addMonths(key: string, n: number): string {
  const d = fromDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
  return toDateKey(d);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function weekdayOf(key: string): Weekday {
  return fromDateKey(key).getDay() as Weekday;
}

/** The first day of the week containing `key` (weeks start on `weekStart`). */
export function startOfWeek(key: string, weekStart: Weekday = 0): string {
  const back = (weekdayOf(key) - weekStart + 7) % 7;
  return addDays(key, -back);
}

/** The 6×7 (or 5×7) grid of days a month view shows, starting on `weekStart`. */
export function monthGrid(year: number, month: number, weekStart: Weekday = 0): string[] {
  const first = toDateKey(new Date(year, month, 1, 12));
  const start = startOfWeek(first, weekStart);
  const last = toDateKey(new Date(year, month, daysInMonth(year, month), 12));
  const weeks = Math.ceil((daysBetween(start, last) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** "Tuesday, October 17". */
export function formatLongDate(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** "Oct 17". */
export function formatShortDate(key: string): string {
  const d = fromDateKey(key);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

// ---------------------------------------------------------------- times of day

/** "07:30" → 450 (minutes after midnight), or null. */
export function parseTime(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 450 → "07:30" (wraps past midnight). */
export function timeString(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** 450 → "7:30 AM". */
export function formatTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`;
}

/** 95 → "1 h 35 min", 30 → "30 min", 2.5 → "2:30" (a fraction only shows under 10 minutes). */
export function formatMinutesShort(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (Math.abs(minutes - Math.round(minutes)) > 0.001 && minutes < 10) {
    const s = Math.round(minutes * 60);
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---------------------------------------------------------------- repeating

/** Does the routine fall on this day by its own schedule? */
export function occursOn(repeat: Repeat, key: string): boolean {
  if (!isDateKey(repeat.start) || key < repeat.start) return false;
  if (repeat.end && key > repeat.end) return false;
  const every = Math.max(1, Math.round(repeat.interval) || 1);
  switch (repeat.freq) {
    case "once":
      return key === repeat.start;
    case "daily":
      return daysBetween(repeat.start, key) % every === 0;
    case "weekly": {
      const days = repeat.weekdays.length ? repeat.weekdays : [weekdayOf(repeat.start)];
      if (!days.includes(weekdayOf(key))) return false;
      const weeks = Math.floor(daysBetween(startOfWeek(repeat.start), startOfWeek(key)) / 7);
      return weeks % every === 0;
    }
    case "monthly": {
      const s = fromDateKey(repeat.start);
      const d = fromDateKey(key);
      const months = (d.getFullYear() - s.getFullYear()) * 12 + d.getMonth() - s.getMonth();
      if (months % every !== 0) return false;
      // The start's day of the month, or the month's last day when it's shorter.
      const want = Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === want;
    }
  }
}

/** "Every Monday, Wednesday and Friday", "Every 2 days", "Once, on Oct 17". */
export function describeRepeat(repeat: Repeat): string {
  const every = Math.max(1, Math.round(repeat.interval) || 1);
  let text: string;
  switch (repeat.freq) {
    case "once":
      return `Once, on ${formatShortDate(repeat.start)}`;
    case "daily":
      text = every === 1 ? "Every day" : `Every ${every} days`;
      break;
    case "weekly": {
      const days = (repeat.weekdays.length ? repeat.weekdays : [weekdayOf(repeat.start)]).slice().sort();
      const names =
        days.length === 7
          ? "every day"
          : days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d as Weekday))
            ? "weekdays"
            : listJoin(days.map((d) => WEEKDAY_NAMES[d]));
      text =
        every === 1
          ? names === "every day"
            ? "Every day"
            : names === "weekdays"
              ? "Every weekday"
              : `Every ${names}`
          : `Every ${every} weeks on ${names}`;
      break;
    }
    case "monthly": {
      const day = fromDateKey(repeat.start).getDate();
      text = every === 1 ? `Monthly on the ${ordinal(day)}` : `Every ${every} months on the ${ordinal(day)}`;
      break;
    }
  }
  return repeat.end ? `${text}, until ${formatShortDate(repeat.end)}` : text;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** The next `count` days (from `from`, inclusive) the routine falls on, looking up to a year ahead. */
export function nextOccurrences(repeat: Repeat, from: string, count: number): string[] {
  const out: string[] = [];
  let key = from < repeat.start ? repeat.start : from;
  for (let i = 0; i < 400 && out.length < count; i++, key = addDays(key, 1)) {
    if (repeat.end && key > repeat.end) break;
    if (occursOn(repeat, key)) out.push(key);
  }
  return out;
}

// ---------------------------------------------------------------- a day

/** A routine on one day: scheduled by its repeat rule, or added just for the day. */
export type DayRoutine = { routine: Routine; occurrence: Occurrence; added: boolean };

/** The routines on a day, in start-time order (untimed ones last, by name). */
export function routinesOn(data: PracticeLogData, key: string): DayRoutine[] {
  const day = data.days[key];
  const added = new Set(day?.added ?? []);
  const out: DayRoutine[] = [];
  for (const routine of data.routines) {
    const scheduled = occursOn(routine.repeat, key);
    if (!scheduled && !added.has(routine.id)) continue;
    out.push({ routine, occurrence: day?.routines?.[routine.id] ?? {}, added: !scheduled });
  }
  return out.sort((a, b) => {
    const ta = startOf(a.routine, a.occurrence);
    const tb = startOf(b.routine, b.occurrence);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;
    return a.routine.name.localeCompare(b.routine.name);
  });
}

function startOf(routine: Routine, occ: Occurrence): number | null {
  const own = occ.startTime !== undefined ? parseTime(occ.startTime) : parseTime(routine.startTime);
  return own ?? parseTime(routine.tasks.find((t) => t.time)?.time);
}

/** Where each task sits in the day: its own time, or straight after the task before it (from the
    routine's start time). `start` is null for a task with no time to go by. */
export type ScheduledTask = { task: RoutineTask; start: number | null; end: number | null };

export function scheduleTasks(routine: Routine, occ: Occurrence = {}): ScheduledTask[] {
  let cursor: number | null = occ.startTime !== undefined ? parseTime(occ.startTime) : parseTime(routine.startTime);
  return routine.tasks.map((task) => {
    const own = parseTime(task.time);
    const start = own ?? cursor;
    const end = start === null ? null : start + task.minutes;
    cursor = end;
    return { task, start, end };
  });
}

/** When the routine starts and ends that day (from its scheduled tasks), or null when untimed. */
export function routineSpan(routine: Routine, occ: Occurrence = {}): { start: number; end: number } | null {
  const timed = scheduleTasks(routine, occ).filter((s) => s.start !== null);
  if (!timed.length) {
    const start = occ.startTime !== undefined ? parseTime(occ.startTime) : parseTime(routine.startTime);
    return start === null ? null : { start, end: start + totalMinutes(routine) };
  }
  return { start: Math.min(...timed.map((s) => s.start!)), end: Math.max(...timed.map((s) => s.end!)) };
}

export function totalMinutes(routine: Routine): number {
  return routine.tasks.reduce((sum, t) => sum + t.minutes, 0);
}

/** Tasks checked off, of the tasks that still exist. */
export function progressOf(routine: Routine, occ: Occurrence): { done: number; total: number } {
  const done = new Set(occ.done ?? []);
  return { done: routine.tasks.filter((t) => done.has(t.id)).length, total: routine.tasks.length };
}

/** Minutes practiced on a day: timer time on routine tasks (or a checked task's planned minutes
    when it was checked without the timer), Practice Timer sessions, and minutes logged by hand. */
export function minutesOn(data: PracticeLogData, key: string): number {
  const day = data.days[key];
  if (!day) return 0;
  let ms = 0;
  for (const [routineId, occ] of Object.entries(day.routines ?? {})) {
    const routine = data.routines.find((r) => r.id === routineId);
    const spent = occ.spentMs ?? {};
    const tasksWithTime = new Set(Object.keys(spent));
    for (const v of Object.values(spent)) ms += v;
    if (routine) {
      for (const id of occ.done ?? []) {
        if (tasksWithTime.has(id)) continue;
        const task = routine.tasks.find((t) => t.id === id);
        if (task) ms += task.minutes * 60000;
      }
    }
  }
  for (const t of day.tasks ?? []) ms += t.spentMs ?? (t.done ? t.minutes * 60000 : 0);
  for (const s of day.sessions ?? []) ms += s.ms;
  ms += (day.extraMinutes ?? 0) * 60000;
  return ms / 60000;
}

/** Tasks done / planned on a day — routine tasks (not on skipped routines) and the day's own. */
export function dayProgress(data: PracticeLogData, key: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const it of routinesOn(data, key)) {
    if (it.occurrence.skipped) continue;
    const p = progressOf(it.routine, it.occurrence);
    done += p.done;
    total += p.total;
  }
  for (const t of data.days[key]?.tasks ?? []) {
    total++;
    if (t.done) done++;
  }
  return { done, total };
}

/** The longest run of days in a row with any practice, ever. */
export function bestStreak(data: PracticeLogData): number {
  const keys = Object.keys(data.days).filter((k) => minutesOn(data, k) > 0).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Every minute ever logged. */
export function lifetimeMinutes(data: PracticeLogData): number {
  return Object.keys(data.days).reduce((sum, k) => sum + minutesOn(data, k), 0);
}

/** Hours of practice worth celebrating, and the streak lengths that get a fanfare. */
export const HOUR_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365, 500, 730, 1000];

/** The milestone before and after `hours` (for a progress bar). */
export function hourMilestone(hours: number): { from: number; to: number } {
  const to = HOUR_MILESTONES.find((h) => h > hours) ?? Math.ceil((hours + 1) / 1000) * 1000;
  const from = [...HOUR_MILESTONES].reverse().find((h) => h <= hours) ?? 0;
  return { from, to };
}

/** Days in a row, ending today (or yesterday, if today has nothing yet), with any practice. */
export function streak(data: PracticeLogData, today: string): number {
  let key = minutesOn(data, today) > 0 ? today : addDays(today, -1);
  let n = 0;
  while (minutesOn(data, key) > 0 && n < 3650) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

// ---------------------------------------------------------------- the timer

/** One finished (or cut-short) step of a Practice Timer run, as `practiceTimerEngine` records it.
    `link` ties it to a routine on a day; `segmentId` is then the task's id. */
export type PendingTimerEntry = {
  at: number;
  ms: number;
  done: boolean;
  session: string;
  title: string;
  segmentId: string;
  link?: { routineId: string; date: string };
};

/** Folds the Practice Timer's recorded steps into the log: a routine's steps check off (and time)
    their tasks on that routine's day; anything else is a session entry on the day it ran. */
export function applyTimerEntries(data: PracticeLogData, entries: PendingTimerEntry[]): PracticeLogData {
  if (!entries.length) return data;
  const days = { ...data.days };
  for (const e of entries) {
    if (e.ms < 5000 && !e.done) continue; // a stray tap of Skip
    const key = e.link?.date ?? toDateKey(new Date(e.at));
    const day: DayLog = { ...(days[key] ?? {}) };
    if (e.link?.routineId === DAY_TASKS_ID && day.tasks?.some((t) => t.id === e.segmentId)) {
      day.tasks = day.tasks.map((t) => (t.id === e.segmentId ? { ...t, spentMs: (t.spentMs ?? 0) + e.ms, done: t.done || e.done } : t));
    } else if (e.link && data.routines.some((r) => r.id === e.link!.routineId)) {
      const rid = e.link.routineId;
      const occ: Occurrence = { ...(day.routines?.[rid] ?? {}) };
      occ.spentMs = { ...(occ.spentMs ?? {}), [e.segmentId]: (occ.spentMs?.[e.segmentId] ?? 0) + e.ms };
      if (e.done && !(occ.done ?? []).includes(e.segmentId)) occ.done = [...(occ.done ?? []), e.segmentId];
      day.routines = { ...(day.routines ?? {}), [rid]: occ };
    } else {
      day.sessions = [...(day.sessions ?? []), { session: e.session, title: e.title, ms: e.ms, at: e.at }];
    }
    days[key] = day;
  }
  return { ...data, days };
}

// ---------------------------------------------------------------- making things

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function newTask(title = ""): RoutineTask {
  return { id: randomId(), title, minutes: 10, time: null, notes: "", attachments: [] };
}

export function newDayTask(title = ""): DayTask {
  return { id: randomId(), title, minutes: 15, time: null, done: false };
}

export function newRoutine(start: string, color = 0): Routine {
  const now = Date.now();
  return {
    id: randomId(),
    name: "",
    description: "",
    color,
    startTime: null,
    repeat: { freq: "weekly", interval: 1, weekdays: [weekdayOf(start)], start, end: null },
    tasks: [newTask()],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function attachmentKey(a: Attachment): string {
  return a.kind === "tool" ? `tool:${a.href}` : `${a.kind}:${a.id}`;
}

/** Drops days that hold nothing at all, so the stored object doesn't fill with empty entries. */
export function pruneDay(day: DayLog): DayLog | null {
  const occs = Object.entries(day.routines ?? {}).filter(
    ([, o]) => (o.done?.length ?? 0) > 0 || Object.keys(o.spentMs ?? {}).length > 0 || !!o.notes || o.skipped || o.startTime !== undefined,
  );
  const next: DayLog = {
    ...(day.notes ? { notes: day.notes } : {}),
    ...(day.attachments?.length ? { attachments: day.attachments } : {}),
    ...(day.added?.length ? { added: day.added } : {}),
    ...(occs.length ? { routines: Object.fromEntries(occs) } : {}),
    ...(day.tasks?.length ? { tasks: day.tasks } : {}),
    ...(day.sessions?.length ? { sessions: day.sessions } : {}),
    ...(day.extraMinutes ? { extraMinutes: day.extraMinutes } : {}),
  };
  return Object.keys(next).length ? next : null;
}
