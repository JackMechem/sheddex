import { v } from "convex/values";
import { assertUploadsOpen, siteFlags } from "./lib/site";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { WorkLink } from "./lib/github";
import { internal } from "./_generated/api";

/**
 * "Send feedback": bug reports, feature ideas, anything else, and reports of a post or profile.
 * Anyone can send (signed out, with an optional email to reply to); a screenshot needs an account.
 * Only the admin reads them (`admin.ts`); senders see their own and their status on /feedback.
 */

const MAX_MESSAGE = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Per account, per hour — enough for real use, a brake on accidents and spam. */
/** Signed-out feedback, across the whole site, per hour. */
const MAX_ANON_PER_HOUR = 30;
const MAX_PER_HOUR = 10;

export const submit = mutation({
  args: {
    kind: v.union(v.literal("bug"), v.literal("feature"), v.literal("other"), v.literal("report")),
    message: v.string(),
    email: v.optional(v.string()),
    page: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    version: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    target: v.optional(v.object({ type: v.union(v.literal("post"), v.literal("profile")), id: v.string(), label: v.string() })),
  },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    const message = a.message.trim().slice(0, MAX_MESSAGE);
    if (!message && a.kind !== "report") throw new Error("Write a few words first.");
    if (a.screenshotId && !userId) throw new Error("Sign in to attach a screenshot.");
    const now = Date.now();
    if ((await siteFlags(ctx)).feedbackPaused) {
      if (a.screenshotId) await ctx.storage.delete(a.screenshotId);
      throw new Error("Feedback is paused right now. Try again a bit later.");
    }
    if (!userId) {
      // Signed-out messages share one site-wide limit, so a script can't flood the inbox.
      const anon = (
        await ctx.db
          .query("feedback")
          .withIndex("by_createdAt", (q) => q.gt("createdAt", now - 3_600_000))
          .collect()
      ).filter((f) => !f.userId);
      if (anon.length >= MAX_ANON_PER_HOUR) throw new Error("Lots of people are sending feedback right now. Try again in a bit, or sign in to send it.");
    }
    if (userId) {
      const recent = await ctx.db
        .query("feedback")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(MAX_PER_HOUR);
      if (recent.length >= MAX_PER_HOUR && recent[MAX_PER_HOUR - 1].createdAt > now - 3_600_000) {
        if (a.screenshotId) await ctx.storage.delete(a.screenshotId);
        throw new Error("That's a lot of feedback in one hour — thanks! Try again a bit later.");
      }
    }
    const email = (a.email ?? "").trim().toLowerCase();
    const user = userId ? await ctx.db.get(userId) : null;
    // Sharing the inbox with production: bugs, ideas and other notes go there (reports about posts
    // and profiles stay here, with what they're about); its FB-number comes back once it's there.
    const shared = !!process.env.FEEDBACK_HUB_URL && a.kind !== "report";
    const number = shared ? undefined : await nextNumber(ctx);
    const id = await ctx.db.insert("feedback", {
      ...(number !== undefined ? { number } : {}),
      ...(userId ? { userId } : {}),
      ...(EMAIL_RE.test(email) ? { email: email.slice(0, 200) } : user?.email ? { email: user.email } : {}),
      kind: a.kind,
      message: message || "(no details)",
      ...(a.page ? { page: a.page.slice(0, 500) } : {}),
      ...(a.userAgent ? { userAgent: a.userAgent.slice(0, 400) } : {}),
      ...(a.version ? { version: a.version.slice(0, 40) } : {}),
      ...(a.screenshotId ? { screenshotId: a.screenshotId } : {}),
      ...(a.target ? { target: { type: a.target.type, id: a.target.id.slice(0, 100), label: a.target.label.slice(0, 200) } } : {}),
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
    if (shared) await ctx.scheduler.runAfter(0, internal.inbox.forward, { id });
    return { number: number ?? null };
  },
});

/** Gives every feedback without an ID one, oldest first, after the highest so far (from before
    IDs existed — runs once, the first time it's needed). */
export async function ensureNumbers(ctx: MutationCtx) {
  const unnumbered = await ctx.db
    .query("feedback")
    .withIndex("by_number", (q) => q.eq("number", undefined))
    .first();
  if (!unnumbered) return;
  const top = await ctx.db.query("feedback").withIndex("by_number").order("desc").first();
  let n = top?.number ?? 0;
  for (const row of await ctx.db.query("feedback").withIndex("by_createdAt").collect()) {
    if (row.number === undefined) await ctx.db.patch(row._id, { number: ++n });
  }
}

/** The next feedback ID (FB-<n>): one more than the highest so far. */
export async function nextNumber(ctx: MutationCtx): Promise<number> {
  await ensureNumbers(ctx);
  const top = await ctx.db.query("feedback").withIndex("by_number").order("desc").first();
  return (top?.number ?? 0) + 1;
}

/** An upload URL for a screenshot (signed in only). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await assertUploadsOpen(ctx);
    if (!(await getAuthUserId(ctx))) throw new Error("Sign in to attach a screenshot.");
    return ctx.storage.generateUploadUrl();
  },
});

/** Your own feedback and where it's at. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("feedback")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows.map((r) => ({ id: r._id, number: r.number ?? null, kind: r.kind, message: r.message, status: r.status, target: r.target ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt }));
  },
});

/** Adds (or updates, by URL) a commit or PR on a feedback. */
export async function addWorkLink(ctx: MutationCtx, row: Doc<"feedback">, link: WorkLink) {
  const links = row.links ?? [];
  const existing = links.find((l) => l.url === link.url);
  const next = existing
    ? links.map((l) => (l.url === link.url ? { ...l, title: link.title || l.title, ...(link.merged !== undefined ? { merged: link.merged } : {}) } : l))
    : [...links, link].slice(-30);
  await ctx.db.patch(row._id, { links: next, updatedAt: Date.now() });
}

const linkArg = v.object({
  kind: v.union(v.literal("commit"), v.literal("pr")),
  ref: v.string(),
  url: v.string(),
  title: v.string(),
  merged: v.optional(v.boolean()),
  at: v.number(),
});

/** From the GitHub webhook: work that mentions FB-<number>. `done` marks it done (a fix reached
    main); otherwise new/seen feedback moves to "planned" (someone's on it). */
export const linkWork = internalMutation({
  args: { number: v.number(), link: linkArg, done: v.boolean() },
  handler: async (ctx, { number, link, done }) => {
    await ensureNumbers(ctx);
    const row = await ctx.db
      .query("feedback")
      .withIndex("by_number", (q) => q.eq("number", number))
      .first();
    if (!row) return;
    await addWorkLink(ctx, row, { ...link, title: link.title.slice(0, 200) });
    if (done) await ctx.db.patch(row._id, { status: "done" });
    else if (row.status === "new" || row.status === "seen") await ctx.db.patch(row._id, { status: "planned" });
  },
});
