import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { staffMe } from "./lib/roles";
import { minutesOn, practiceLogFrom } from "@jam-practice/core/practiceLog";

/**
 * Admin → Analytics. One action that reads the tables it needs a page at a time (so it keeps
 * working as the site grows) and returns per-day series plus breakdowns. Admins only.
 *
 * Days are UTC days ("YYYY-MM-DD"), except practice minutes, which use each person's own log days.
 */

const DAY = 86_400_000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isStaffForAction = internalQuery({
  args: {},
  handler: async (ctx) => !!(await staffMe(ctx)),
});

const TABLES = [
  "users",
  "authSessions",
  "authRefreshTokens",
  "authAccounts",
  "profiles",
  "communityTunes",
  "communityTuneLikes",
  "follows",
  "feedback",
  "recordings",
  "chordChartSongs",
  "lessonStudents",
  "lessonItems",
  "lessonBookings",
  "setlistsShared",
  "usageDaily",
] as const;
type Table = (typeof TABLES)[number];

/** One page of a table, slimmed down to what the charts need. */
export const scan = internalQuery({
  args: { table: v.string(), cursor: v.union(v.string(), v.null()), since: v.string() },
  handler: async (ctx, { table, cursor, since }) => {
    const t = table as Table;
    const real = t === "setlistsShared" ? "sharedSetlists" : t;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (ctx.db.query(real as any) as any).paginate({ cursor, numItems: t === "usageDaily" ? 2000 : 1000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = page.page as any[];
    const out = rows.map((r) => {
      switch (t) {
        case "authSessions":
          return [r._creationTime, r._id, r.userId];
        case "authRefreshTokens":
          return [r._creationTime, r.sessionId];
        case "authAccounts":
          return [r.provider];
        case "profiles":
          return [r.isPublic ? 1 : 0, Array.isArray(r.instruments) ? r.instruments.slice(0, 12) : []];
        case "communityTunes":
          return [r.createdAt, r.kind ?? "tunes"];
        case "communityTuneLikes":
        case "follows":
          return [r.createdAt];
        case "feedback":
          return [r.createdAt, r.kind];
        case "recordings":
          return [r._creationTime, r.durationSec ?? 0];
        case "lessonItems":
          return [r._creationTime, r.kind];
        case "usageDaily":
          return r.day >= since ? [r.day, r.kind, r.key, r.n, r.ms] : null;
        default:
          return [r._creationTime];
      }
    });
    return { rows: out.filter((x) => x !== null), cursor: page.continueCursor as string, done: page.isDone as boolean };
  },
});

/** Practice from the Shed Log blobs: per day minutes and how many people practised, and the
    minutes each tool's running time added. */
export const scanPractice = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), since: v.string() },
  handler: async (ctx, { cursor, since }) => {
    const page = await ctx.db.query("syncedSettings").paginate({ cursor, numItems: 40 });
    const days: Record<string, [number, number]> = {};
    const tools: Record<string, number> = {};
    for (const row of page.page) {
      if (row.key !== "jam-practice-practice-log") continue;
      let raw: unknown;
      try {
        raw = JSON.parse(row.value);
      } catch {
        continue;
      }
      const data = practiceLogFrom(raw);
      if (!data) continue;
      for (const [key, day] of Object.entries(data.days)) {
        if (key < since) continue;
        const min = minutesOn(data, key);
        if (min > 0) {
          const d = (days[key] ??= [0, 0]);
          d[0] += min;
          d[1] += 1;
        }
        for (const s of day.sessions ?? []) if (s.tool) tools[s.tool] = (tools[s.tool] ?? 0) + s.ms / 60000;
      }
    }
    return { days, tools, cursor: page.continueCursor, done: page.isDone };
  },
});

type Series = Record<string, Record<string, number>>;

export const analytics = action({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    if (!(await ctx.runQuery(internal.adminAnalytics.isStaffForAction, {}))) throw new Error("Not allowed.");
    const span = Math.max(7, Math.min(730, Math.round(days)));
    const now = Date.now();
    const since = dayOf(now - (span - 1) * DAY);

    const all = async (table: Table) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[][] = [];
      let cursor: string | null = null;
      for (;;) {
        const r: { rows: unknown[][]; cursor: string; done: boolean } = await ctx.runQuery(internal.adminAnalytics.scan, { table, cursor, since });
        rows.push(...(r.rows as never[]));
        if (r.done) break;
        cursor = r.cursor;
      }
      return rows;
    };

    const series: Series = {};
    const add = (metric: string, day: string, amount = 1) => {
      if (day < since) return;
      const m = (series[metric] ??= {});
      m[day] = (m[day] ?? 0) + amount;
    };

    // Accounts and activity
    const users = await all("users");
    for (const [t] of users) add("signups", dayOf(t));
    const sessions = await all("authSessions");
    const sessionUser = new Map<string, string>(sessions.map(([, id, u]) => [id, u]));
    const active: Record<string, Set<string>> = {};
    const mark = (t: number, user?: string) => {
      const d = dayOf(t);
      if (d < since || !user) return;
      (active[d] ??= new Set()).add(user);
    };
    for (const [t, , u] of sessions) {
      mark(t, u);
      add("signins", dayOf(t));
    }
    for (const [t, sid] of await all("authRefreshTokens")) mark(t, sessionUser.get(sid));
    for (const [d, set] of Object.entries(active)) add("activeAccounts", d, set.size);

    // Community and content
    const postKinds: Record<string, number> = {};
    for (const [t, kind] of await all("communityTunes")) {
      add("posts", dayOf(t));
      if (dayOf(t) >= since) postKinds[kind] = (postKinds[kind] ?? 0) + 1;
    }
    for (const [t] of await all("communityTuneLikes")) add("likes", dayOf(t));
    for (const [t] of await all("follows")) add("follows", dayOf(t));
    const feedbackKinds: Record<string, number> = {};
    for (const [t, kind] of await all("feedback")) {
      add("feedback", dayOf(t));
      if (dayOf(t) >= since) feedbackKinds[kind] = (feedbackKinds[kind] ?? 0) + 1;
    }
    for (const [t, sec] of await all("recordings")) {
      add("recordings", dayOf(t));
      add("recordingMinutes", dayOf(t), sec / 60);
    }
    for (const [t] of await all("chordChartSongs")) add("charts", dayOf(t));
    for (const [t] of await all("lessonStudents")) add("students", dayOf(t));
    for (const [t] of await all("lessonItems")) add("lessonItems", dayOf(t));
    for (const [t] of await all("lessonBookings")) add("bookings", dayOf(t));
    for (const [t] of await all("setlistsShared")) add("sharedSetlists", dayOf(t));

    // Anonymous usage
    const pages: Record<string, number> = {};
    const toolPlays: Record<string, number> = {};
    const toolMs: Record<string, number> = {};
    for (const [day, kind, key, n, ms] of await all("usageDaily")) {
      if (kind === "visit") {
        add("visits", day, n);
        add(key === "account" ? "visitsAccount" : "visitsGuest", day, n);
      } else if (kind === "view") {
        add("pageViews", day, n);
        pages[key] = (pages[key] ?? 0) + n;
      } else if (kind === "play") {
        add("toolStarts", day, n);
        toolPlays[key] = (toolPlays[key] ?? 0) + n;
      } else if (kind === "time") {
        add("toolMinutes", day, ms / 60000);
        toolMs[key] = (toolMs[key] ?? 0) + ms;
      }
    }

    // Practice (Shed Log)
    const practiceTools: Record<string, number> = {};
    {
      let cursor: string | null = null;
      for (;;) {
        const r: { days: Record<string, [number, number]>; tools: Record<string, number>; cursor: string; done: boolean } = await ctx.runQuery(
          internal.adminAnalytics.scanPractice,
          { cursor, since },
        );
        for (const [d, [min, people]] of Object.entries(r.days)) {
          add("practiceMinutes", d, min);
          add("practicers", d, people);
        }
        for (const [k, m] of Object.entries(r.tools)) practiceTools[k] = (practiceTools[k] ?? 0) + m;
        if (r.done) break;
        cursor = r.cursor;
      }
    }

    // Breakdowns that aren't over time
    const providers: Record<string, number> = {};
    for (const [p] of await all("authAccounts")) providers[p] = (providers[p] ?? 0) + 1;
    const instruments: Record<string, number> = {};
    let publicProfiles = 0;
    const profiles = await all("profiles");
    for (const [pub, inst] of profiles) {
      publicProfiles += pub;
      for (const i of inst as string[]) {
        const k = String(i).trim().toLowerCase();
        if (k) instruments[k] = (instruments[k] ?? 0) + 1;
      }
    }

    const toolKeys = new Set([...Object.keys(toolPlays), ...Object.keys(toolMs), ...Object.keys(practiceTools)]);
    return {
      since,
      today: dayOf(now),
      series,
      totals: { accounts: users.length, profiles: profiles.length, publicProfiles },
      tools: [...toolKeys].map((href) => ({
        href,
        starts: toolPlays[href] ?? 0,
        minutes: Math.round((toolMs[href] ?? 0) / 60000),
        practiceMinutes: Math.round(practiceTools[href] ?? 0),
      })),
      pages: Object.entries(pages).map(([path, views]) => ({ path, views })),
      providers,
      instruments,
      postKinds,
      feedbackKinds,
    };
  },
});
