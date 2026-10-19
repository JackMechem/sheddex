"use client";

/**
 * Anonymous usage counts (see `packages/convex/usage.ts`): visits a day, page views, tools started
 * and how long they ran. Events are added up here and sent in small batches by `UsageTracker`
 * (mounted once in `AppChrome`). Nothing identifies the person: no account, no device id.
 * Off for admins and for browsers with Do Not Track or Global Privacy Control turned on.
 */

type Kind = "visit" | "view" | "play" | "time";
const queue = new Map<string, { kind: Kind; key: string; n: number; ms: number }>();
// Blocked until UsageTracker knows who this is (admins are never counted).
let blocked = true;
let onQueued: (() => void) | null = null;

/** UsageTracker's hook: called whenever something is queued, so it can send soon after. */
export function setUsageListener(cb: (() => void) | null) {
  onQueued = cb;
}

export function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

export function setUsageBlocked(b: boolean) {
  blocked = b;
  if (b) queue.clear();
}

function add(kind: Kind, key: string, n = 1, ms = 0) {
  if (blocked || optedOut()) return;
  const id = `${kind}|${key}`;
  const e = queue.get(id) ?? { kind, key, n: 0, ms: 0 };
  e.n += n;
  e.ms += ms;
  queue.set(id, e);
  onQueued?.();
}

/** A path with ids taken out, so pages group together (/post/abc → /post/[id]). */
export function normalizePath(path: string): string {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const parts = p.split("/").filter(Boolean);
  const dynamic: Record<string, string> = { post: "[id]", u: "[username]", setlist: "[id]", routine: "[id]", tune: "[id]", file: "[id]" };
  if (parts.length >= 2 && dynamic[parts[0]]) return `/${parts[0]}/${dynamic[parts[0]]}`;
  return ("/" + parts.slice(0, 3).join("/")).toLowerCase();
}

export const trackView = (path: string) => add("view", normalizePath(path));
export const trackToolStart = (href: string) => add("play", href);
export const trackToolTime = (href: string, ms: number) => ms >= 1000 && add("time", href, 0, Math.min(ms, 4 * 3_600_000));

/** One visit per browser per local day. */
export function trackVisit(signedIn: boolean) {
  const today = new Date().toLocaleDateString("en-CA");
  try {
    if (localStorage.getItem("jam-practice-visit-day") === today) return;
    localStorage.setItem("jam-practice-visit-day", today);
  } catch {
    return;
  }
  add("visit", signedIn ? "account" : "guest");
}

/** Takes the queued events (at most 40) for sending. */
export function drainUsage() {
  const events = [...queue.values()].slice(0, 40);
  for (const e of events) queue.delete(`${e.kind}|${e.key}`);
  return events.map((e) => ({ kind: e.kind, key: e.key, n: e.n, ms: e.ms }));
}
