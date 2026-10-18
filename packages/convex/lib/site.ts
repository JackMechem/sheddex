import type { QueryCtx } from "../_generated/server";
import { isStaff } from "./roles";

/**
 * The site's "mayday" switches (one row in `siteFlags`, key "site"), flipped by the owner from
 * /admin → Mayday. Each is enforced on the server where it matters; the web app also reads them
 * (`site.status`) to show friendly notices instead of errors.
 */
export type SiteFlags = {
  /** The whole site shows a maintenance screen to everyone except admins. */
  maintenance: boolean;
  maintenanceMessage: string;
  /** A banner across the top of every page ("" = none). */
  banner: string;
  bannerTone: "info" | "warning";
  /** Community, public profiles, people search and shared setlist / routine links are hidden. */
  communityOff: boolean;
  /** Nobody can make new Community posts (existing ones stay). */
  postingPaused: boolean;
  /** No new accounts (existing ones sign in as usual). */
  signupsPaused: boolean;
  /** No file uploads: recordings, songs, pictures, banners, lesson files, hand-ins, screenshots. */
  uploadsPaused: boolean;
  /** The feedback form is closed. */
  feedbackPaused: boolean;
};

export const DEFAULT_FLAGS: SiteFlags = {
  maintenance: false,
  maintenanceMessage: "",
  banner: "",
  bannerTone: "info",
  communityOff: false,
  postingPaused: false,
  signupsPaused: false,
  uploadsPaused: false,
  feedbackPaused: false,
};

export async function siteFlags(ctx: QueryCtx): Promise<SiteFlags> {
  const row = await ctx.db
    .query("siteFlags")
    .withIndex("by_key", (q) => q.eq("key", "site"))
    .first();
  return { ...DEFAULT_FLAGS, ...(row?.flags ?? {}) };
}

/** True when Community is switched off and the caller isn't staff (staff still see it, to moderate). */
export async function communityHidden(ctx: QueryCtx): Promise<boolean> {
  return (await siteFlags(ctx)).communityOff && !(await isStaff(ctx));
}

export async function assertUploadsOpen(ctx: QueryCtx) {
  if ((await siteFlags(ctx)).uploadsPaused) throw new Error("Uploads are paused right now. Try again a bit later.");
}
