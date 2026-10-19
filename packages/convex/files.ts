import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { communityHidden, assertUploadsOpen } from "./lib/site";
import { resolveLinkedChart } from "./lib/chordCharts";
import { ownerTune } from "./lib/tunes";
import { MAX_FILE_BYTES, assertFits, assertHasRoom, bytesUsed, quotaFor, storedItems, type StoredKind } from "./lib/storage";
import type { PublicRecording, PublicTune } from "@jam-practice/core/profileTunes";

/**
 * Files: anything a person uploads to keep with their account (PDFs, images, audio, video,
 * notation, documents), on its own or attached to one of their tunes. Uploading is the usual two
 * steps: `generateUploadUrl`, POST the file there, then `create` with the returned `storageId`.
 *
 * Also here: `storage` (everything the account stores — files, recordings, tune songs, lesson
 * files, hand-ins, profile pictures — for the Files page), renaming, deleting and sharing any of
 * those by kind (`renameItem`, `removeItem`, `shareItem` → `/file/<id>`), and sharing a tune by link
 * (`/tune/<id>`), which shows the tune with its chord chart, files and recordings.
 */

const MAX_NAME = 200;

/** Everything the caller's account stores, plus how much space it takes. `sharedId` is the item's
    link id when it's shared by link (`/file/<id>`). */
export const storage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const shares = await ctx.db.query("sharedFiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const shareOf = new Map(shares.map((row) => [`${row.kind}:${row.itemId}`, row._id as string]));
    const items = (await storedItems(ctx, userId, true)).map((item) => ({ ...item, sharedId: shareOf.get(`${item.kind}:${item.id}`) ?? null }));
    return { items, used: items.reduce((sum, item) => sum + item.size, 0), quota: await quotaFor(ctx, userId), maxFile: MAX_FILE_BYTES };
  },
});

// ---------------------------------------------------------------- any stored item, by kind

const kindArg = v.union(
  v.literal("file"),
  v.literal("recording"),
  v.literal("song"),
  v.literal("lesson"),
  v.literal("handin"),
  v.literal("profile"),
);

type OwnedItem = { storageId: Id<"_storage">; name: string; mimeType: string; size: number; createdAt: number };

/** One of `userId`'s stored files, by its kind and id (as `storage` lists them), or null if it
    doesn't exist or isn't theirs. Ids come from the client, so every kind re-checks ownership. */
async function ownedItem(ctx: QueryCtx, userId: Id<"users">, kind: StoredKind, id: string): Promise<OwnedItem | null> {
  const sizeOf = async (storageId: Id<"_storage">) => (await ctx.db.system.get(storageId))?.size ?? 0;
  if (kind === "file") {
    const fileId = ctx.db.normalizeId("files", id);
    const row = fileId && (await ctx.db.get(fileId));
    return row && row.userId === userId ? { storageId: row.storageId, name: row.name, mimeType: row.mimeType, size: row.size, createdAt: row.createdAt } : null;
  }
  if (kind === "recording") {
    const recId = ctx.db.normalizeId("recordings", id);
    const row = recId && (await ctx.db.get(recId));
    return row && row.userId === userId ? { storageId: row.storageId, name: row.name, mimeType: row.mimeType, size: await sizeOf(row.storageId), createdAt: row.createdAt } : null;
  }
  if (kind === "song") {
    const songId = ctx.db.normalizeId("tuneSongs", id);
    const row = songId && (await ctx.db.get(songId));
    return row && row.userId === userId ? { storageId: row.storageId, name: row.name, mimeType: row.mimeType, size: await sizeOf(row.storageId), createdAt: row.createdAt } : null;
  }
  if (kind === "lesson") {
    const itemId = ctx.db.normalizeId("lessonItems", id);
    const item = itemId && (await ctx.db.get(itemId));
    if (!item || item.teacherId !== userId || !item.fileId) return null;
    const meta = await ctx.db.system.get(item.fileId);
    return { storageId: item.fileId, name: item.fileName || item.title, mimeType: item.fileType || meta?.contentType || "", size: meta?.size ?? 0, createdAt: item.createdAt };
  }
  if (kind === "handin") {
    const [subPart, filePart] = id.split(":");
    const subId = ctx.db.normalizeId("lessonSubmissions", subPart ?? "");
    const sub = subId && (await ctx.db.get(subId));
    if (!sub || sub.studentId !== userId) return null;
    const f = sub.files.find((file) => file.fileId === filePart);
    return f ? { storageId: f.fileId, name: f.name, mimeType: f.type, size: f.size, createdAt: sub.submittedAt } : null;
  }
  const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  const which = profile?.avatarStorageId === id ? "Profile picture" : profile?.bannerStorageId === id ? "Profile banner" : null;
  if (!profile || !which) return null;
  const meta = await ctx.db.system.get(id as Id<"_storage">);
  return { storageId: id as Id<"_storage">, name: which, mimeType: meta?.contentType ?? "image/jpeg", size: meta?.size ?? 0, createdAt: meta?._creationTime ?? 0 };
}

/** Removes the links to one item (it was deleted). */
async function dropShares(ctx: MutationCtx, userId: Id<"users">, kind: StoredKind, itemId: string) {
  const rows = await ctx.db
    .query("sharedFiles")
    .withIndex("by_user_item", (q) => q.eq("userId", userId).eq("kind", kind).eq("itemId", itemId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}

/** Renames anything on the Files page except profile images. A lesson file's new name is what the
    student sees; a hand-in's is what the teacher sees. */
export const renameItem = mutation({
  args: { kind: kindArg, id: v.string(), name: v.string() },
  handler: async (ctx, { kind, id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ownedItem(ctx, userId, kind, id))) throw new Error("File not found.");
    const clean = name.trim().slice(0, MAX_NAME);
    if (!clean) throw new Error("Give it a name.");
    const now = Date.now();
    if (kind === "file") await ctx.db.patch(id as Id<"files">, { name: clean, updatedAt: now });
    else if (kind === "recording") await ctx.db.patch(id as Id<"recordings">, { name: clean, updatedAt: now });
    else if (kind === "song") await ctx.db.patch(id as Id<"tuneSongs">, { name: clean });
    else if (kind === "lesson") {
      const item = (await ctx.db.get(id as Id<"lessonItems">))!;
      // A file item's title is its file name unless the teacher gave it its own.
      const title = item.kind === "file" && item.title === item.fileName ? { title: clean } : {};
      await ctx.db.patch(item._id, { fileName: clean, ...title, updatedAt: now });
    } else if (kind === "handin") {
      const [subId, fileId] = id.split(":");
      const sub = (await ctx.db.get(subId as Id<"lessonSubmissions">))!;
      await ctx.db.patch(sub._id, { files: sub.files.map((f) => (f.fileId === fileId ? { ...f, name: clean } : f)), updatedAt: now });
    } else throw new Error("Profile pictures can't be renamed.");
  },
});

/** Deletes anything on the Files page for good, with its stored data and any link to it. A lesson
    file is taken out of the lesson (a file on its own goes with it); a hand-in file is taken out of
    the hand-in; a profile image is removed from the profile. */
export const removeItem = mutation({
  args: { kind: kindArg, id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const owned = await ownedItem(ctx, userId, kind, id);
    if (!owned) return;
    await ctx.storage.delete(owned.storageId);
    if (kind === "file") await ctx.db.delete(id as Id<"files">);
    else if (kind === "recording") await ctx.db.delete(id as Id<"recordings">);
    else if (kind === "song") await ctx.db.delete(id as Id<"tuneSongs">);
    else if (kind === "lesson") {
      const item = (await ctx.db.get(id as Id<"lessonItems">))!;
      if (item.kind === "file") {
        for (const sub of await ctx.db.query("lessonSubmissions").withIndex("by_item", (q) => q.eq("itemId", item._id)).collect()) {
          for (const f of sub.files) await ctx.storage.delete(f.fileId);
          await ctx.db.delete(sub._id);
        }
        await ctx.db.delete(item._id);
      } else {
        await ctx.db.patch(item._id, { fileId: undefined, fileName: undefined, fileType: undefined, updatedAt: Date.now() });
      }
    } else if (kind === "handin") {
      const [subId, fileId] = id.split(":");
      const sub = (await ctx.db.get(subId as Id<"lessonSubmissions">))!;
      await ctx.db.patch(sub._id, { files: sub.files.filter((f) => f.fileId !== fileId), updatedAt: Date.now() });
    } else {
      const profile = (await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique())!;
      await ctx.db.patch(profile._id, profile.avatarStorageId === id ? { avatarStorageId: undefined, updatedAt: Date.now() } : { bannerStorageId: undefined, updatedAt: Date.now() });
    }
    await dropShares(ctx, userId, kind, id);
  },
});

// ---------------------------------------------------------------- sharing one file by link

/** The link's id for one of the caller's items, or null if it isn't shared. */
export const itemShare = query({
  args: { kind: kindArg, id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("sharedFiles")
      .withIndex("by_user_item", (q) => q.eq("userId", userId).eq("kind", kind).eq("itemId", id))
      .first();
    return row?._id ?? null;
  },
});

/** Shares one of the caller's files by link (`/file/<id>`) and returns the link's id. Anyone with
    the link can open and download it. */
export const shareItem = mutation({
  args: { kind: kindArg, id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to share a file.");
    if (kind === "profile") throw new Error("Profile pictures show on your profile instead.");
    if (!(await ownedItem(ctx, userId, kind, id))) throw new Error("File not found.");
    const existing = await ctx.db
      .query("sharedFiles")
      .withIndex("by_user_item", (q) => q.eq("userId", userId).eq("kind", kind).eq("itemId", id))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("sharedFiles", { userId, kind, itemId: id, createdAt: Date.now() });
  },
});

/** Stops sharing a file: its link stops working. */
export const unshareItem = mutation({
  args: { kind: kindArg, id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    await dropShares(ctx, userId, kind, id);
  },
});

/** A file shared by link, for anyone with the link — no sign-in needed. Null if the link is wrong,
    the file was deleted or stopped being shared, or Community is switched off. */
export const getSharedFile = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    if (await communityHidden(ctx)) return null;
    const shareId = ctx.db.normalizeId("sharedFiles", id);
    const row = shareId && (await ctx.db.get(shareId));
    if (!row) return null;
    const item = await ownedItem(ctx, row.userId, row.kind as StoredKind, row.itemId);
    if (!item) return null;
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", row.userId)).unique();
    const viewer = await getAuthUserId(ctx);
    return {
      id: row._id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      createdAt: item.createdAt,
      url: await ctx.storage.getUrl(item.storageId),
      // Only a public profile's username is shown; a private one stays anonymous.
      ownerUsername: profile?.isPublic ? profile.username : null,
      isMine: viewer === row.userId,
    };
  },
});

/** The stored file behind a link (for copying it), with the caller's space. */
export const sharedFileSource = internalQuery({
  args: { id: v.string(), userId: v.id("users") },
  handler: async (ctx, { id, userId }) => {
    const shareId = ctx.db.normalizeId("sharedFiles", id);
    const row = shareId && (await ctx.db.get(shareId));
    if (!row || (await communityHidden(ctx))) return null;
    const item = await ownedItem(ctx, row.userId, row.kind as StoredKind, row.itemId);
    if (!item) return null;
    return { storageId: item.storageId, name: item.name, size: item.size, used: await bytesUsed(ctx, userId), quota: await quotaFor(ctx, userId) };
  },
});

/** "Save to my files": copies a shared file into the caller's account (not on any tune). */
export const copySharedFile = action({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }): Promise<{ id: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save files.");
    const source = await ctx.runQuery(internal.files.sharedFileSource, { id: shareId, userId });
    if (!source) throw new Error("That file isn't shared any more.");
    if (source.used + source.size > source.quota) throw new Error("There isn't room for this file in your account. Delete something first.");
    const blob = await ctx.storage.get(source.storageId);
    if (!blob) throw new Error("That file isn't available any more.");
    const storageId = await ctx.storage.store(blob);
    return { id: await ctx.runMutation(internal.files.insertCopiedFile, { userId, storageId, name: source.name }) };
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
    await dropShares(ctx, userId, "file", id);
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
  args: { userId: v.id("users"), storageId: v.id("_storage"), name: v.string(), tuneId: v.optional(v.string()) },
  handler: async (ctx, { userId, storageId, name, tuneId }) => {
    const meta = await ctx.db.system.get(storageId);
    const now = Date.now();
    return await ctx.db.insert("files", {
      userId,
      storageId,
      name,
      mimeType: meta?.contentType ?? "application/octet-stream",
      size: meta?.size ?? 0,
      ...(tuneId ? { tuneId } : {}),
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
