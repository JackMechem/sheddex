import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { resolvePublicTunes, type PublicTune } from "@jam-practice/core/profileTunes";

/** The synced-settings keys holding a person's two tune lists — the same keys the apps write. */
const TUNE_LIST_KEYS = ["tunes", "jam-practice-tunes-to-learn"] as const;

/** One of `ownerId`'s tunes (from Tunes I Know or Tunes to Learn), as a `PublicTune` — never its
    notes; its `chordChartId` is left raw for the caller to resolve. `null` if they don't have it. */
export async function ownerTune(ctx: QueryCtx, ownerId: Id<"users">, tuneId: string): Promise<PublicTune | null> {
  for (const key of TUNE_LIST_KEYS) {
    const row = await ctx.db
      .query("syncedSettings")
      .withIndex("by_user_key", (q) => q.eq("userId", ownerId).eq("key", key))
      .unique();
    const tune = resolvePublicTunes(row?.value ?? null).find((t) => t.id === tuneId);
    if (tune) return tune;
  }
  return null;
}
