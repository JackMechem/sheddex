import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/** A feedback to send on to the shared inbox, with who sent it (their account isn't there). */
export const forwardSource = internalQuery({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    let sender: { username?: string; name?: string } | undefined;
    if (r.userId) {
      const user = await ctx.db.get(r.userId);
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", r.userId!))
        .first();
      sender = { ...(profile?.username ? { username: profile.username } : {}), ...(user?.name ? { name: user.name } : {}) };
    }
    return { ...r, sender };
  },
});
