import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Site roles. The **owner** is the account whose email is OWNER_EMAIL *and* verified
 * (`emailVerificationTime` — Convex Auth only sets it once an emailed code or Google proves the
 * address); hardcoded on purpose, nothing can change it. **Admins** are accounts the owner has
 * added to the `admins` table. See admin.ts.
 */

export const OWNER_EMAIL = "mechemjack@gmail.com";

export type Role = "owner" | "admin";

export function isOwnerUser(user: { email?: string; emailVerificationTime?: number } | null): boolean {
  return !!user && !!user.emailVerificationTime && user.email?.trim().toLowerCase() === OWNER_EMAIL;
}

/** The role of any user: "owner", "admin", or null. */
export async function roleOf(ctx: QueryCtx, userId: Id<"users">): Promise<Role | null> {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  if (isOwnerUser(user)) return "owner";
  const row = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return row ? "admin" : null;
}

/** The signed-in user and their role, or null if they're not staff. */
export async function staffMe(ctx: QueryCtx): Promise<{ id: Id<"users">; role: Role } | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const role = await roleOf(ctx, userId);
  return role ? { id: userId, role } : null;
}

export async function isStaff(ctx: QueryCtx): Promise<boolean> {
  return !!(await staffMe(ctx));
}
