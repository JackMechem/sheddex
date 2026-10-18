import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { staffMe } from "./lib/roles";

/**
 * Admin corrections to the changelog. The releases themselves live in the web app
 * (apps/web/lib/changelog.ts); a row here replaces one version's entry on /changelog, or hides it.
 */

const KINDS = new Set(["new", "improved", "fixed"]);
const VERSION_RE = /^\d+\.\d+\.\d+$/;

type ChangeKind = "new" | "improved" | "fixed";
type Release = { version: string; date: string; title: string; summary?: string; changes: { kind: ChangeKind; text: string }[] };

function str(x: unknown, max: number): string {
  return typeof x === "string" ? x.trim().slice(0, max) : "";
}

/** Checks over a release sent from the browser. */
function cleanRelease(version: string, raw: unknown): Release {
  const r = (raw ?? {}) as Record<string, unknown>;
  const date = str(r.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ConvexError("The date should look like 2026-10-18.");
  const title = str(r.title, 200);
  if (!title) throw new ConvexError("Give the release a title.");
  const changes = (Array.isArray(r.changes) ? r.changes : [])
    .slice(0, 100)
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return { kind: (KINDS.has(o.kind as string) ? o.kind : "improved") as ChangeKind, text: str(o.text, 1000) };
    })
    .filter((c) => c.text);
  const summary = str(r.summary, 2000);
  return { version, date, title, ...(summary ? { summary } : {}), changes };
}

/** Every correction (open to everyone: it's what /changelog shows). */
export const edits = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("changelogEdits").collect();
    return rows.map((r) => ({ version: r.version, release: r.release as Release, hidden: r.hidden, base: r.base }));
  },
});

/** Saves an admin's correction to one version's entry (staff only). */
export const saveEdit = mutation({
  args: { version: v.string(), release: v.any(), hidden: v.boolean(), base: v.string() },
  handler: async (ctx, { version, release, hidden, base }) => {
    const me = await staffMe(ctx);
    if (!me) throw new ConvexError("Only admins can edit the changelog.");
    if (!VERSION_RE.test(version)) throw new ConvexError("That isn't a version.");
    const clean = cleanRelease(version, release);
    const existing = await ctx.db
      .query("changelogEdits")
      .withIndex("by_version", (q) => q.eq("version", version))
      .first();
    const row = { version, release: clean, hidden, base: base.slice(0, 100_000), updatedAt: Date.now(), updatedBy: me.id };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("changelogEdits", row);
  },
});

/** Drops the correction, so the entry from the code shows again (staff only). */
export const revertEdit = mutation({
  args: { version: v.string() },
  handler: async (ctx, { version }) => {
    if (!(await staffMe(ctx))) throw new ConvexError("Only admins can edit the changelog.");
    const existing = await ctx.db
      .query("changelogEdits")
      .withIndex("by_version", (q) => q.eq("version", version))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
