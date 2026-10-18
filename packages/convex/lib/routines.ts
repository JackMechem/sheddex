import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { type PublicRoutine, cleanPublicRoutine, toPublicRoutine, type Routine } from "@jam-practice/core/practiceLog";

const LOG_KEY = "jam-practice-practice-log";

/** The owner's routine as it is right now (from their synced Shed Log), as others see it —
    or null if they no longer have it (callers fall back to their snapshot). */
export async function liveRoutine(ctx: QueryCtx, ownerId: Id<"users">, routineId: string): Promise<PublicRoutine | null> {
  const row = await ctx.db
    .query("syncedSettings")
    .withIndex("by_user_key", (q) => q.eq("userId", ownerId).eq("key", LOG_KEY))
    .unique();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as { routines?: Routine[] };
    const routine = parsed.routines?.find((r) => r && r.id === routineId);
    return routine ? cleanPublicRoutine(toPublicRoutine(routine)) : null;
  } catch {
    return null;
  }
}
