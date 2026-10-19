import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { communityHidden, assertUploadsOpen } from "./lib/site";
import { resolveLinkedChart } from "./lib/chordCharts";
import { ownerTune } from "./lib/tunes";
import { MAX_FILE_BYTES, assertFits, assertHasRoom, bytesUsed, quotaFor, storedItems } from "./lib/storage";
import type { PublicRecording, PublicTune } from "@jam-practice/core/profileTunes";

/**
 * Files: anything a person uploads to keep with their account (PDFs, images, audio, video,
 * notation, documents), on its own or attached to one of their tunes. Uploading is the usual two
 * steps: `generateUploadUrl`, POST the file there, then `create` with the returned `storageId`.
 *
 * Also here: `storage` (everything the account stores — files, recordings, tune songs, lesson
 * files, hand-ins, profile pictures — for the Files page) and sharing a tune by link (`/tune/<id>`),
 * which shows the tune with its chord chart, files and recordings.
 */

const MAX_NAME = 200;

/** Everything the caller's account stores, plus how much space it takes. */
export const storage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const items = await storedItems(ctx, userId, true);
    return { items, used: items.reduce((sum, item) => sum + item.size, 0), quota: await quotaFor(ctx, userId), maxFile: MAX_FILE_BYTES };
  },
});

// ---------------------------------------------------------------- files

function fileView(row: Doc<"files">, url: string | null) {
  return {
    _id: row._id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    tuneId: row.tuneId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    url,
  };
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await assertUploadsOpen(ctx);
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to upload files.");
    await assertHasRoom(ctx, userId);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Saves an uploaded file (after POSTing it to a `generateUploadUrl` URL). Too big, or no room
    left: the upload is deleted and it throws. */
export const create = mutation({
  args: { storageId: v.id("_storage"), name: v.string(), tuneId: v.optional(v.string()) },
  handler: async (ctx, { storageId, name, tuneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to upload files.");
    const meta = await assertFits(ctx, userId, storageId);
    const now = Date.now();
    return await ctx.db.insert("files", {
      userId,
      storageId,
      name: name.trim().slice(0, MAX_NAME) || "File",
      mimeType: meta.contentType ?? "application/octet-stream",
      size: meta.size,
      ...(tuneId ? { tuneId: tuneId.slice(0, 100) } : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** The caller's files, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("files").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").collect();
    return Promise.all(rows.map(async (row) => fileView(row, await ctx.storage.getUrl(row.storageId))));
  },
});

/** The caller's files attached to one tune, newest first. */
export const listForTune = query({
  args: { tuneId: v.string() },
  handler: async (ctx, { tuneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("files")
      .withIndex("by_user_tune", (q) => q.eq("userId", userId).eq("tuneId", tuneId))
      .order("desc")
      .collect();
    return Promise.all(rows.map(async (row) => fileView(row, await ctx.storage.getUrl(row.storageId))));
  },
});

/** Rename, or attach to a tune / detach (`tuneId: null`). */
export const update = mutation({
  args: { id: v.id("files"), name: v.optional(v.string()), tuneId: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { id, name, tuneId }) => {
    const userId = await getAuthUserId(ctx);
    const row = await ctx.db.get(id);
    if (!userId || !row || row.userId !== userId) throw new Error("File not found.");
    await ctx.db.patch(id, {
      ...(name !== undefined ? { name: name.trim().slice(0, MAX_NAME) || row.name } : {}),
      ...(tuneId !== undefined ? { tuneId: tuneId ? tuneId.slice(0, 100) : undefined } : {}),
      updatedAt: Date.now(),
    });
  },
});

/** Deletes a file and its stored data. */
export const remove = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const row = await ctx.db.get(id);
    if (!userId || !row || row.userId !== userId) return;
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(id);
  },
});

// ---------------------------------------------------------------- sharing a tune

/** The link's id for one of the caller's tunes, or null if it isn't shared. */
export const tuneShare = query({
  args: { tuneId: v.string() },
  handler: async (ctx, { tuneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("sharedTunes")
      .withIndex("by_user_tune", (q) => q.eq("userId", userId).eq("tuneId", tuneId))
      .first();
    return row?._id ?? null;
  },
});

/** Shares one of the caller's tunes by link (or refreshes the link's fallback copy) and returns
    the link's id. The tune is looked up on the server, from the caller's own tune lists. */
export const shareTune = mutation({
  args: { tuneId: v.string() },
  handler: async (ctx, { tuneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to share a tune.");
    const tune = await ownerTune(ctx, userId, tuneId);
    if (!tune) throw new Error("That tune isn't in your lists.");
    const { chordChartId: _chart, ...snapshot } = tune;
    const existing = await ctx.db
      .query("sharedTunes")
      .withIndex("by_user_tune", (q) => q.eq("userId", userId).eq("tuneId", tuneId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { snapshot, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("sharedTunes", { userId, tuneId, snapshot, createdAt: now, updatedAt: now });
  },
});

/** Stops sharing a tune: its link stops working. */
export const unshareTune = mutation({
  args: { tuneId: v.string() },
  handler: async (ctx, { tuneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const rows = await ctx.db
      .query("sharedTunes")
      .withIndex("by_user_tune", (q) => q.eq("userId", userId).eq("tuneId", tuneId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

/** A tune shared by link, for anyone with the link — no sign-in needed. The tune as it is now,
    its chord chart, attached files and recordings (never its notes). `null` if the link is wrong
    or the tune isn't shared any more. */
export const getSharedTune = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    if (await communityHidden(ctx)) return null;
    const shareId = ctx.db.normalizeId("sharedTunes", id);
    if (!shareId) return null;
    const row = await ctx.db.get(shareId);
    if (!row) return null;
    const live = await ownerTune(ctx, row.userId, row.tuneId);
    const base = (live ?? row.snapshot) as PublicTune;
    const { chordChartId, ...tune } = base;
    const linkedChart = live ? await resolveLinkedChart(ctx, row.userId, chordChartId) : null;

    const files = live
      ? await Promise.all(
          (
            await ctx.db
              .query("files")
              .withIndex("by_user_tune", (q) => q.eq("userId", row.userId).eq("tuneId", row.tuneId))
              .order("desc")
              .collect()
          ).map(async (f) => ({ id: f._id, name: f.name, mimeType: f.mimeType, size: f.size, createdAt: f.createdAt, url: await ctx.storage.getUrl(f.storageId) })),
        )
      : [];
    const recordings: PublicRecording[] = live
      ? await Promise.all(
          (
            await ctx.db
              .query("recordings")
              .withIndex("by_user_tune", (q) => q.eq("userId", row.userId).eq("tuneId", row.tuneId))
              .order("desc")
              .collect()
          ).map(async (r) => ({ id: r._id, name: r.name, durationSec: r.durationSec, createdAt: r.createdAt, url: await ctx.storage.getUrl(r.storageId) })),
        )
      : [];

    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", row.userId)).unique();
    const viewer = await getAuthUserId(ctx);
    return {
      id: row._id,
      tune: { ...tune, ...(linkedChart ? { linkedChart } : {}) } as PublicTune,
      files,
      recordings,
      // Only a public profile's username is shown; a private one stays anonymous.
      ownerUsername: profile?.isPublic ? profile.username : null,
      isMine: viewer === row.userId,
      ownTuneId: viewer === row.userId ? row.tuneId : null,
      updatedAt: row.updatedAt,
    };
  },
});

/** The stored files attached to a shared tune (for copying them), or null if it isn't shared. */
export const sharedTuneFiles = internalQuery({
  args: { shareId: v.id("sharedTunes"), userId: v.id("users") },
  handler: async (ctx, { shareId, userId }) => {
    const row = await ctx.db.get(shareId);
    if (!row) return null;
    const files = await ctx.db
      .query("files")
      .withIndex("by_user_tune", (q) => q.eq("userId", row.userId).eq("tuneId", row.tuneId))
      .collect();
    return {
      files: files.map((f) => ({ storageId: f.storageId, name: f.name, size: f.size })),
      used: await bytesUsed(ctx, userId),
      quota: await quotaFor(ctx, userId),
    };
  },
});

export const insertCopiedFile = internalMutation({
  args: { userId: v.id("users"), storageId: v.id("_storage"), name: v.string(), tuneId: v.string() },
  handler: async (ctx, { userId, storageId, name, tuneId }) => {
    const meta = await ctx.db.system.get(storageId);
    const now = Date.now();
    await ctx.db.insert("files", {
      userId,
      storageId,
      name,
      mimeType: meta?.contentType ?? "application/octet-stream",
      size: meta?.size ?? 0,
      tuneId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Copies a shared tune's files into the caller's account, attached to `tuneId` (their own copy of
    the tune). Returns how many were copied; stops short (and says so) when there isn't room. */
export const copySharedFiles = action({
  args: { shareId: v.string(), tuneId: v.string() },
  handler: async (ctx, { shareId, tuneId }): Promise<{ copied: number; skipped: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save files.");
    const id = await ctx.runQuery(internal.files.normalizeShareId, { id: shareId });
    if (!id) throw new Error("That tune isn't shared any more.");
    const shared = await ctx.runQuery(internal.files.sharedTuneFiles, { shareId: id, userId });
    if (!shared) throw new Error("That tune isn't shared any more.");
    let used = shared.used;
    let copied = 0;
    let skipped = 0;
    for (const f of shared.files) {
      if (used + f.size > shared.quota) {
        skipped += 1;
        continue;
      }
      const blob = await ctx.storage.get(f.storageId);
      if (!blob) {
        skipped += 1;
        continue;
      }
      const storageId = await ctx.storage.store(blob);
      await ctx.runMutation(internal.files.insertCopiedFile, { userId, storageId, name: f.name, tuneId });
      used += f.size;
      copied += 1;
    }
    return { copied, skipped };
  },
});

export const normalizeShareId = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => ctx.db.normalizeId("sharedTunes", id),
});
