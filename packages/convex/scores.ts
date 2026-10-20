import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

/**
 * Score Writer's scores — written with the shared notation editor, private to their owner, and
 * embedded in Shed Notes by id. The web app cleans a score (`cleanScore`) before saving it; here
 * only its shape and size are checked (the shared cleaner pulls in the iReal parser, which doesn't
 * belong in the backend bundle).
 */

const MAX_SCORES = 2000;
/** About 4,000 measures of busy music — well under a document's 1 MiB. */
const MAX_JSON = 700_000;

async function me(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in to save scores to your account.");
  return userId;
}

async function own(ctx: QueryCtx | MutationCtx, userId: Id<"users">, id: Id<"scores">) {
  const row = await ctx.db.get(id);
  if (!row || row.userId !== userId) throw new Error("That score isn't there any more.");
  return row;
}

function prepare(raw: unknown) {
  const data = raw as { title?: unknown; measures?: unknown; timeSignature?: unknown } | null;
  if (!data || typeof data !== "object" || !Array.isArray(data.measures) || !data.measures.length || data.measures.length > 4000 || typeof data.timeSignature !== "object") {
    throw new Error("That isn't a score.");
  }
  if (JSON.stringify(data).length > MAX_JSON) throw new Error("That score is too long to save.");
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 200) : "";
  return { data, title: title || "Untitled score", measureCount: data.measures.length };
}

/** Every score's title and size, newest first (not the music). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("scores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => ({ id: r._id as string, title: r.title, measureCount: r.measureCount, createdAt: r.createdAt, updatedAt: r.updatedAt }));
  },
});

/** One score with its music; null when it's gone or not yours. */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const scoreId = ctx.db.normalizeId("scores", id);
    if (!scoreId) return null;
    const row = await ctx.db.get(scoreId);
    if (!row || row.userId !== userId) return null;
    return { id: row._id as string, data: row.data, updatedAt: row.updatedAt };
  },
});

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const count = (await ctx.db.query("scores").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_SCORES + 1)).length;
    if (count >= MAX_SCORES) throw new Error("You've reached the most scores an account can hold.");
    const now = Date.now();
    const id = await ctx.db.insert("scores", { userId, ...prepare(args.data), createdAt: now, updatedAt: now });
    return id as string;
  },
});

/** Replaces a score's music and details (the editor autosaves). */
export const save = mutation({
  args: { id: v.id("scores"), data: v.any() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    await own(ctx, userId, args.id);
    await ctx.db.patch(args.id, { ...prepare(args.data), updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("scores") },
  handler: async (ctx, { id }) => {
    const userId = await me(ctx);
    await own(ctx, userId, id);
    await ctx.db.delete(id);
  },
});
