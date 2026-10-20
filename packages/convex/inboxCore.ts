import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { addWorkLink, ensureNumbers } from "./feedback";
import { parseWorkRef } from "./lib/github";

/**
 * The admin inbox's operations on *this* deployment's feedback. `inbox.ts` runs them here, or —
 * on a deployment that shares its inbox with production (FEEDBACK_HUB_URL set) — sends them to
 * production's `/feedback-hub` endpoint, which runs these same functions there. Either way the
 * admin page sees one list.
 */

async function personOf(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return { username: profile?.username || null, name: user?.name ?? null };
}

export type InboxRow = Awaited<ReturnType<typeof rowOut>>;

async function rowOut(ctx: QueryCtx, r: Doc<"feedback">, people: Map<string, { username: string | null; name: string | null }>) {
  let from: { username: string | null; name: string | null } | null = null;
  if (r.userId) {
    if (!people.has(r.userId)) people.set(r.userId, await personOf(ctx, r.userId));
    from = people.get(r.userId) ?? null;
  } else if (r.sender) from = { username: r.sender.username ?? null, name: r.sender.name ?? null };
  return {
    id: r._id as string,
    number: r.number ?? null,
    links: r.links ?? [],
    issue: r.issue ?? null,
    source: r.source ?? null,
    kind: r.kind,
    message: r.message,
    status: r.status,
    adminNote: r.adminNote ?? "",
    page: r.page ?? null,
    userAgent: r.userAgent ?? null,
    version: r.version ?? null,
    email: r.email ?? null,
    target: r.target ?? null,
    screenshotUrl: r.screenshotId ? await ctx.storage.getUrl(r.screenshotId) : null,
    from,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** The inbox, newest first. `kinds`: only these (the reports stay on the deployment they're about). */
export const listLocal = internalQuery({
  args: { kinds: v.optional(v.array(v.string())) },
  handler: async (ctx, { kinds }) => {
    const rows = await ctx.db.query("feedback").withIndex("by_createdAt").order("desc").take(500);
    const people = new Map<string, { username: string | null; name: string | null }>();
    return Promise.all(rows.filter((r) => !r.forwarded && (!kinds || kinds.includes(r.kind))).map((r) => rowOut(ctx, r, people)));
  },
});

export const issueVal = v.object({ number: v.number(), url: v.string(), title: v.string(), state: v.string() });

export const opVal = v.union(
  v.object({ op: v.literal("status"), id: v.string(), status: v.union(v.literal("new"), v.literal("seen"), v.literal("planned"), v.literal("done"), v.literal("closed")) }),
  v.object({ op: v.literal("note"), id: v.string(), note: v.string() }),
  v.object({ op: v.literal("delete"), id: v.string() }),
  v.object({ op: v.literal("addLink"), id: v.string(), input: v.string(), title: v.optional(v.string()) }),
  v.object({ op: v.literal("removeLink"), id: v.string(), url: v.string() }),
  v.object({ op: v.literal("setIssue"), id: v.string(), issue: v.union(issueVal, v.null()) }),
  v.object({ op: v.literal("number") }),
  v.object({ op: v.literal("issueState"), id: v.string(), state: v.string() }),
);

async function rowById(ctx: MutationCtx, id: string) {
  const fid = ctx.db.normalizeId("feedback", id);
  return fid ? await ctx.db.get(fid) : null;
}

/** One change to the inbox. Throws a readable message when it can't. */
export const applyLocal = internalMutation({
  args: { op: opVal },
  handler: async (ctx, { op }) => {
    if (op.op === "number") return ensureNumbers(ctx);
    const row = await rowById(ctx, op.id);
    if (!row) throw new Error("That feedback is gone.");
    const now = Date.now();
    switch (op.op) {
      case "status":
        return ctx.db.patch(row._id, { status: op.status, updatedAt: now });
      case "note":
        return ctx.db.patch(row._id, { adminNote: op.note.slice(0, 4000), updatedAt: now });
      case "delete":
        if (row.screenshotId) await ctx.storage.delete(row.screenshotId);
        return ctx.db.delete(row._id);
      case "addLink": {
        const parsed = parseWorkRef(op.input, (op.title ?? "").trim().slice(0, 200));
        if (!parsed) throw new Error("Paste a commit hash, a PR number like #12, or a GitHub commit or pull request link.");
        return addWorkLink(ctx, row, { ...parsed, at: now });
      }
      case "removeLink":
        return ctx.db.patch(row._id, { links: (row.links ?? []).filter((l) => l.url !== op.url), updatedAt: now });
      case "issueState": {
        if (!row.issue || row.issue.state === op.state) return;
        return ctx.db.patch(row._id, { issue: { ...row.issue, state: op.state }, status: issueStatus(op.state, row.status), updatedAt: now });
      }
      case "setIssue": {
        const moveOn = op.issue && (row.status === "new" || row.status === "seen");
        return ctx.db.patch(row._id, { issue: op.issue ?? undefined, ...(moveOn ? { status: "planned" as const } : {}), updatedAt: now });
      }
    }
  },
});

/** What a GitHub issue is written from. */
export const issueSource = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const fid = ctx.db.normalizeId("feedback", id);
    const r = fid ? await ctx.db.get(fid) : null;
    if (!r) return null;
    return {
      number: r.number ?? null,
      kind: r.kind,
      message: r.message,
      page: r.page ?? null,
      userAgent: r.userAgent ?? null,
      version: r.version ?? null,
      issue: r.issue ?? null,
      screenshotUrl: r.screenshotId ? await ctx.storage.getUrl(r.screenshotId) : null,
    };
  },
});

/** Feedback sent here from another deployment. Returns its FB-number here. */
export const insertForwarded = internalMutation({
  args: {
    kind: v.union(v.literal("bug"), v.literal("feature"), v.literal("other")),
    message: v.string(),
    email: v.optional(v.string()),
    page: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    version: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    source: v.string(),
    sender: v.optional(v.object({ username: v.optional(v.string()), name: v.optional(v.string()) })),
    createdAt: v.number(),
  },
  handler: async (ctx, a) => {
    await ensureNumbers(ctx);
    const top = await ctx.db.query("feedback").withIndex("by_number").order("desc").first();
    const number = (top?.number ?? 0) + 1;
    await ctx.db.insert("feedback", { ...a, message: a.message.slice(0, 5000), number, status: "new", updatedAt: Date.now() });
    return number;
  },
});

/** On the sending side: this feedback reached the shared inbox as FB-<number>. */
export const markForwarded = internalMutation({
  args: { id: v.id("feedback"), number: v.number() },
  handler: async (ctx, { id, number }) => {
    await ctx.db.patch(id, { forwarded: true, number });
  },
});

/** A feedback's status when its GitHub issue opens or closes: closed (resolved or not) → Closed;
    reopened → back to Planned. */
function issueStatus(state: string, status: Doc<"feedback">["status"]): Doc<"feedback">["status"] {
  if (state === "closed") return "closed";
  return status === "done" || status === "closed" ? "planned" : status;
}

/** The feedback whose GitHub issue is `number` (for the issues webhook). */
export const setStatusForIssue = internalMutation({
  args: { issueNumber: v.number(), state: v.string() },
  handler: async (ctx, { issueNumber, state }) => {
    // Few rows have issues; the inbox is small enough to scan.
    for (const r of await ctx.db.query("feedback").withIndex("by_createdAt").order("desc").take(2000)) {
      if (r.issue?.number !== issueNumber) continue;
      await ctx.db.patch(r._id, { issue: { ...r.issue, state }, status: issueStatus(state, r.status), updatedAt: Date.now() });
    }
  },
});
