import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { cleanPublicRoutine } from "@jam-practice/core/practiceLog";
import { liveRoutine } from "./lib/routines";

/** Shares a Shed Log routine by link. One link per routine: sharing again updates the same
    row (and returns its id, the link's last segment). The link always shows the routine as it is
    now; `routine` (a `PublicRoutine`) is kept in case it's deleted later. */
export const share = mutation({
  args: { routineId: v.string(), routine: v.any() },
  handler: async (ctx, { routineId, routine }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to share a routine by link.");
    const clean = cleanPublicRoutine(routine);
    if (!clean) throw new Error("That routine couldn't be read.");
    const existing = await ctx.db
      .query("sharedRoutines")
      .withIndex("by_user_routine", (q) => q.eq("userId", userId).eq("routineId", routineId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { routine: clean, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("sharedRoutines", { userId, routineId, routine: clean, createdAt: now, updatedAt: now });
  },
});

/** Stops sharing a routine: its link stops working. */
export const unshare = mutation({
  args: { routineId: v.string() },
  handler: async (ctx, { routineId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const rows = await ctx.db
      .query("sharedRoutines")
      .withIndex("by_user_routine", (q) => q.eq("userId", userId).eq("routineId", routineId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

/** The caller's share link id for one of their routines, or null. */
export const shareFor = query({
  args: { routineId: v.string() },
  handler: async (ctx, { routineId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("sharedRoutines")
      .withIndex("by_user_routine", (q) => q.eq("userId", userId).eq("routineId", routineId))
      .first();
    return row?._id ?? null;
  },
});

/** A shared routine, for anyone with the link (no sign-in needed), or null. */
export const getShared = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const shareId = ctx.db.normalizeId("sharedRoutines", id);
    if (!shareId) return null;
    const row = await ctx.db.get(shareId);
    if (!row) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .unique();
    const viewer = await getAuthUserId(ctx);
    const routine = (await liveRoutine(ctx, row.userId, row.routineId)) ?? cleanPublicRoutine(row.routine);
    if (!routine) return null;
    return {
      id: row._id,
      routine,
      ownerUsername: profile?.isPublic ? profile.username : null,
      isMine: viewer === row.userId,
      routineId: viewer === row.userId ? row.routineId : null,
    };
  },
});
