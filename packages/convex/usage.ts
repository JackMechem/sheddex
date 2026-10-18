import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { isStaff } from "./lib/roles";

/**
 * Anonymous usage counts for the admin's Analytics tab: how many visits a day, which pages are
 * opened, which tools get started and for how long. Only daily totals are stored (`usageDaily`) —
 * no account, no device id, no IP. The web app batches these (`apps/web/lib/usage.ts`), skips them
 * for admins and for browsers that ask not to be tracked (Do Not Track / Global Privacy Control).
 * Open to anyone, so each call is small and bounded.
 */

const KINDS = new Set(["visit", "view", "play", "time"]);
const KEY_RE = /^(\/[a-z0-9\-\[\]]{0,40}){0,4}$|^(account|guest)$/;
const MAX_EVENTS = 40;

export const track = mutation({
  args: { events: v.array(v.object({ kind: v.string(), key: v.string(), n: v.optional(v.number()), ms: v.optional(v.number()) })) },
  handler: async (ctx, { events }) => {
    // Admins are never counted (the web app skips them too, but this doesn't depend on timing).
    if (await isStaff(ctx)) return;
    const day = new Date().toISOString().slice(0, 10);
    for (const e of events.slice(0, MAX_EVENTS)) {
      const key = e.key === "" ? "/" : e.key;
      if (!KINDS.has(e.kind) || key.length > 120 || !KEY_RE.test(key)) continue;
      const n = Math.max(0, Math.min(100, Math.round(e.n ?? 1)));
      const ms = Math.max(0, Math.min(4 * 3_600_000, Math.round(e.ms ?? 0)));
      if (!n && !ms) continue;
      const row = await ctx.db
        .query("usageDaily")
        .withIndex("by_day_kind_key", (q) => q.eq("day", day).eq("kind", e.kind).eq("key", key))
        .first();
      if (row) await ctx.db.patch(row._id, { n: row.n + n, ms: row.ms + ms });
      else await ctx.db.insert("usageDaily", { day, kind: e.kind, key, n, ms });
    }
  },
});
