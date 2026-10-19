import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * How much an account stores, and the limit on it. Everything counts: uploaded files, recordings,
 * tunes' songs, files given to students in Lessons, hand-ins, and profile images. Every upload path
 * checks it (`assertHasRoom` before handing out an upload URL, `assertFits` once the file's real
 * size is known).
 *
 * The limit is 100 MB per account for now. Paid plans with more storage are planned (see
 * docs/notes/files-and-tune-sharing.md); `quotaFor` is where a per-account limit would come from.
 */

/** Largest single file. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
/** What every account can store, in total. */
export const ACCOUNT_QUOTA_BYTES = 100 * 1024 * 1024;

const MB = 1024 * 1024;

/** One account's storage limit. Everyone has the same for now; paid plans would change it here. */
export async function quotaFor(_ctx: QueryCtx, _userId: Id<"users">): Promise<number> {
  return ACCOUNT_QUOTA_BYTES;
}

async function fileSize(ctx: QueryCtx, storageId: Id<"_storage">) {
  const meta = await ctx.db.system.get(storageId);
  return meta?.size ?? 0;
}


export type StoredKind = "file" | "recording" | "song" | "lesson" | "handin" | "profile";

export type StoredItem = {
  kind: StoredKind;
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  url: string | null;
  tuneId: string | null;
  /** Where it's managed, for kinds other than plain files. */
  href: string | null;
};

/** Every file the account stores, newest first. `withUrls: false` skips the download links (for
    totting up the size). */
export async function storedItems(ctx: QueryCtx, userId: Id<"users">, withUrls: boolean): Promise<StoredItem[]> {
  const url = (id: Id<"_storage">) => (withUrls ? ctx.storage.getUrl(id) : Promise.resolve(null));
  const out: StoredItem[] = [];

  const files = await ctx.db.query("files").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  for (const f of files) {
    out.push({ kind: "file", id: f._id, name: f.name, mimeType: f.mimeType, size: f.size, createdAt: f.createdAt, url: await url(f.storageId), tuneId: f.tuneId ?? null, href: null });
  }

  const recordings = await ctx.db.query("recordings").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  for (const r of recordings) {
    out.push({
      kind: "recording",
      id: r._id,
      name: r.name,
      mimeType: r.mimeType,
      size: await fileSize(ctx, r.storageId),
      createdAt: r.createdAt,
      url: await url(r.storageId),
      tuneId: r.tuneId ?? null,
      href: `/recordings/view?id=${r._id}`,
    });
  }

  const songs = await ctx.db.query("tuneSongs").withIndex("by_user_tune", (q) => q.eq("userId", userId)).collect();
  for (const s of songs) {
    out.push({
      kind: "song",
      id: s._id,
      name: s.name,
      mimeType: s.mimeType,
      size: await fileSize(ctx, s.storageId),
      createdAt: s.createdAt,
      url: await url(s.storageId),
      tuneId: s.tuneId,
      href: null,
    });
  }

  // Files you gave your students in Lessons.
  const pairs = await ctx.db.query("lessonStudents").withIndex("by_teacher", (q) => q.eq("teacherId", userId)).collect();
  for (const pair of pairs) {
    const items = await ctx.db.query("lessonItems").withIndex("by_lesson", (q) => q.eq("lessonId", pair._id)).collect();
    for (const item of items) {
      if (!item.fileId) continue;
      out.push({
        kind: "lesson",
        id: item._id,
        name: item.fileName || item.title,
        mimeType: item.fileType ?? "",
        size: await fileSize(ctx, item.fileId),
        createdAt: item.createdAt,
        url: await url(item.fileId),
        tuneId: null,
        href: `/lessons/lesson?pair=${pair._id}&id=${item.sessionId ?? "earlier"}`,
      });
    }
  }

  // Work you handed in to your teachers.
  const asStudent = await ctx.db.query("lessonStudents").withIndex("by_student", (q) => q.eq("studentId", userId)).collect();
  for (const pair of asStudent) {
    const subs = await ctx.db.query("lessonSubmissions").withIndex("by_lesson", (q) => q.eq("lessonId", pair._id)).collect();
    for (const sub of subs) {
      if (sub.studentId !== userId) continue;
      const item = await ctx.db.get(sub.itemId);
      for (const f of sub.files) {
        out.push({
          kind: "handin",
          id: `${sub._id}:${f.fileId}`,
          name: f.name,
          mimeType: f.type,
          size: f.size,
          createdAt: sub.submittedAt,
          url: await url(f.fileId),
          tuneId: null,
          href: `/lessons/lesson?pair=${pair._id}&id=${item?.sessionId ?? "earlier"}`,
        });
      }
    }
  }

  const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  for (const [storageId, name] of [
    [profile?.avatarStorageId, "Profile picture"],
    [profile?.bannerStorageId, "Profile banner"],
  ] as const) {
    if (!storageId) continue;
    const meta = await ctx.db.system.get(storageId);
    out.push({
      kind: "profile",
      id: storageId,
      name,
      mimeType: meta?.contentType ?? "image/jpeg",
      size: meta?.size ?? 0,
      createdAt: meta?._creationTime ?? 0,
      url: await url(storageId),
      tuneId: null,
      href: "/account?tab=profile",
    });
  }

  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function bytesUsed(ctx: QueryCtx, userId: Id<"users">) {
  return (await storedItems(ctx, userId, false)).reduce((sum, item) => sum + item.size, 0);
}


/** Refuses (with a message people can act on) when the account is already full. */
export async function assertHasRoom(ctx: QueryCtx, userId: Id<"users">) {
  if ((await bytesUsed(ctx, userId)) >= (await quotaFor(ctx, userId))) {
    throw new Error(`Your account's storage is full (${(await quotaFor(ctx, userId)) / MB} MB). Delete some files or recordings on the Files page to make room.`);
  }
}

/** Once an upload has arrived: deletes it and throws if it's too big or doesn't fit. `replacing`
    is how much is about to be freed (a tune's old song). Returns the stored file's size and type. */
export async function assertFits(ctx: MutationCtx, userId: Id<"users">, storageId: Id<"_storage">, replacing = 0) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) throw new Error("That upload didn't arrive — try again.");
  if (meta.size > MAX_FILE_BYTES) {
    await ctx.storage.delete(storageId);
    throw new Error(`Files can be up to ${MAX_FILE_BYTES / MB} MB.`);
  }
  // The new file is in storage but not in any table yet, so it isn't counted in bytesUsed.
  const quota = await quotaFor(ctx, userId);
  if ((await bytesUsed(ctx, userId)) - replacing + meta.size > quota) {
    await ctx.storage.delete(storageId);
    throw new Error(`There isn't room for that — your account can store ${quota / MB} MB. Delete some files or recordings on the Files page to make room.`);
  }
  return { size: meta.size, contentType: meta.contentType ?? null };
}
