import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { noteSnippet } from "@jam-practice/core/shedNotes";
import { normalizeUsername } from "@jam-practice/core/username";
import { linkedThrough, noteAccess } from "./shedNotes";

/**
 * Sharing Shed Notes: with other accounts by username ("Can view" or "Can edit"), and by link —
 * only for the people it's shared with ("invited"), or for anyone with the link (view only). The
 * owner alone shares, changes permissions and sets the link. With `shareLinked` on, the notes it
 * links to are shared the same way (one level). Plus the owner's export of everything.
 */

async function me(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in to share notes.");
  return userId;
}

async function myNote(ctx: QueryCtx | MutationCtx, userId: Id<"users">, id: Id<"shedNotes">) {
  const note = await ctx.db.get(id);
  if (!note || note.userId !== userId) throw new Error("Only the note's owner can do that.");
  return note;
}

async function person(ctx: QueryCtx, userId: Id<"users">) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const user = await ctx.db.get(userId);
  return {
    userId: userId as string,
    username: profile?.username || null,
    name: user?.name ?? null,
    avatarUrl: profile?.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
  };
}

const sharesOfNote = (ctx: QueryCtx | MutationCtx, noteId: Id<"shedNotes">) =>
  ctx.db
    .query("shedNoteShares")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .collect();

/** The owner's notes that `note` links to (the ones that exist), by title. */
async function linkedNotes(ctx: QueryCtx, note: Doc<"shedNotes">) {
  const out: Doc<"shedNotes">[] = [];
  for (const key of note.links.slice(0, 200)) {
    const hit = await ctx.db
      .query("shedNotes")
      .withIndex("by_user_title", (q) => q.eq("userId", note.userId).eq("titleKey", key))
      .first();
    if (hit && hit._id !== note._id) out.push(hit);
  }
  return out;
}

/** Who a note is shared with, its link, and whether the notes it links to go with it (owner
    only). */
export const sharing = query({
  args: { noteId: v.id("shedNotes") },
  handler: async (ctx, { noteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) return null;
    const shares = await sharesOfNote(ctx, noteId);
    return {
      people: await Promise.all(shares.map(async (s) => ({ ...(await person(ctx, s.userId)), role: s.role }))),
      link: note.link ?? null,
      shareLinked: !!note.shareLinked,
      linked: (await linkedNotes(ctx, note)).map((n) => n.title),
    };
  },
});

/** Also share the notes this one links to — with the same people (same role) and through its link —
    or stop. */
export const setShareLinked = mutation({
  args: { noteId: v.id("shedNotes"), on: v.boolean() },
  handler: async (ctx, { noteId, on }) => {
    const userId = await me(ctx);
    await myNote(ctx, userId, noteId);
    await ctx.db.patch(noteId, { shareLinked: on || undefined });
  },
});

/** People to suggest while typing a username: public profiles only (a private account can still
    be shared with by typing its exact username). */
export const suggest = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const userId = await getAuthUserId(ctx);
    const prefix = normalizeUsername(q);
    if (!userId || !prefix) return [];
    const profiles = await ctx.db
      .query("profiles")
      .filter((f) => f.eq(f.field("isPublic"), true))
      .collect();
    const hits = profiles.filter((p) => p.username && p.userId !== userId && p.username.startsWith(prefix)).slice(0, 8);
    return Promise.all(hits.map(async (p) => ({ username: p.username, avatarUrl: p.avatarStorageId ? await ctx.storage.getUrl(p.avatarStorageId) : null })));
  },
});

const role = v.union(v.literal("read"), v.literal("write"));

/** Shares a note with an account by its exact username (public or private). */
export const shareWith = mutation({
  args: { noteId: v.id("shedNotes"), username: v.string(), role },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    await myNote(ctx, userId, args.noteId);
    const username = normalizeUsername(args.username);
    const profile = username
      ? await ctx.db
          .query("profiles")
          .withIndex("by_username", (q) => q.eq("username", username))
          .first()
      : null;
    if (!profile) throw new Error(`No one has the username "${args.username.trim()}".`);
    if (profile.userId === userId) throw new Error("That's you — it's already yours.");
    const shares = await sharesOfNote(ctx, args.noteId);
    if (shares.length >= 50) throw new Error("A note can be shared with up to 50 people.");
    const existing = shares.find((s) => s.userId === profile.userId);
    if (existing) await ctx.db.patch(existing._id, { role: args.role });
    else await ctx.db.insert("shedNoteShares", { noteId: args.noteId, ownerId: userId, userId: profile.userId, role: args.role, createdAt: Date.now() });
    return profile.username;
  },
});

/** Changes what someone can do with a note: view or edit. */
export const setRole = mutation({
  args: { noteId: v.id("shedNotes"), userId: v.string(), role },
  handler: async (ctx, args) => {
    const me_ = await me(ctx);
    await myNote(ctx, me_, args.noteId);
    for (const s of await sharesOfNote(ctx, args.noteId)) if (s.userId === args.userId) await ctx.db.patch(s._id, { role: args.role });
  },
});

/** Stops sharing a note with someone. */
export const unshare = mutation({
  args: { noteId: v.id("shedNotes"), userId: v.string() },
  handler: async (ctx, args) => {
    const me_ = await me(ctx);
    await myNote(ctx, me_, args.noteId);
    for (const s of await sharesOfNote(ctx, args.noteId)) if (s.userId === args.userId) await ctx.db.delete(s._id);
  },
});

/** Someone who was shared a note can leave it (it's no longer in their list). */
export const leave = mutation({
  args: { noteId: v.id("shedNotes") },
  handler: async (ctx, { noteId }) => {
    const userId = await me(ctx);
    for (const s of await sharesOfNote(ctx, noteId)) if (s.userId === userId) await ctx.db.delete(s._id);
  },
});

function newToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

/** The note's link: off, only the people it's shared with, or anyone with it (view only). Keeps
    the same link when switching between the two "on" settings; turning it off and on again makes
    a new one. */
export const setLink = mutation({
  args: { noteId: v.id("shedNotes"), access: v.union(v.literal("off"), v.literal("invited"), v.literal("anyone")) },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const note = await myNote(ctx, userId, args.noteId);
    if (args.access === "off") {
      await ctx.db.patch(note._id, { link: undefined });
      return null;
    }
    const token = note.link?.token ?? newToken();
    await ctx.db.patch(note._id, { link: { token, access: args.access } });
    return token;
  },
});

/** Notes shared with me, newest first. */
export const sharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const shares = await ctx.db
      .query("shedNoteShares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    type Row = { id: string; title: string; snippet: string; updatedAt: number; role: "read" | "write"; owner: string | null; ownerName: string; ownerId: string; via: string | null };
    const out = new Map<string, Row>();
    const add = async (note: Doc<"shedNotes">, role: "read" | "write", via: string | null) => {
      const had = out.get(note._id);
      // Shared directly beats shared through a link; "Can edit" beats "Can view".
      if (had && (had.via === null || via !== null) && (had.role === "write" || role === "read")) return;
      const owner = await person(ctx, note.userId);
      out.set(note._id, {
        id: note._id as string,
        title: note.title,
        snippet: noteSnippet(note.body),
        updatedAt: note.updatedAt,
        role: had?.role === "write" ? "write" : role,
        owner: owner.username,
        ownerName: owner.name ?? "someone",
        ownerId: note.userId as string,
        via: had && had.via === null ? null : via,
      });
    };
    for (const s of shares) {
      const note = await ctx.db.get(s.noteId);
      if (!note) continue;
      await add(note, s.role, null);
      if (note.shareLinked) for (const linked of await linkedNotes(ctx, note)) await add(linked, s.role, note.title);
    }
    return [...out.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** A note opened from its link. "anyone": everyone sees it; "invited": only its owner and the
    people it's shared with (signed in). `role` says what the viewer can do in Shed Notes. With
    `note` (a title), one of the notes it links to, when it shares them (`shareLinked`).
    `linked` are the title keys that open from this page (the link's note and the notes it shares);
    `parent` is the link's own note when showing one of those. */
export const byLink = query({
  args: { token: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const root = await ctx.db
      .query("shedNotes")
      .withIndex("by_link_token", (q) => q.eq("link.token", args.token))
      .first();
    if (!root?.link) return { status: "gone" as const };
    const userId = await getAuthUserId(ctx);
    if (root.link.access === "invited" && !(await noteAccess(ctx, root, userId))) return { status: userId ? ("not-shared" as const) : ("sign-in" as const) };
    const note = args.note ? await linkedThrough(ctx, root, args.note) : root;
    if (!note) return { status: "gone" as const };
    const access = await noteAccess(ctx, note, userId);
    const owner = await person(ctx, note.userId);
    // Only notes that exist (a link to a note not written yet stays a plain pill).
    const linked = root.shareLinked ? [root.titleKey, ...(await linkedNotes(ctx, root)).map((n) => n.titleKey)] : [];
    return {
      status: "ok" as const,
      id: note._id as string,
      title: note.title,
      body: note.body,
      view: note.view ?? {},
      owner: owner.username,
      ownerName: owner.name ?? "someone",
      role: access,
      updatedAt: note.updatedAt,
      linked: note.links.filter((k) => linked.includes(k)),
      parent: note === root ? null : { title: root.title },
    };
  },
});

/** Everything, for "Export all as Markdown": every note's title, folder and text, and the empty
    folders. */
export const exportAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const notes: Doc<"shedNotes">[] = await ctx.db
      .query("shedNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const folders = await ctx.db
      .query("shedNoteFolders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      notes: notes.map((n) => ({ title: n.title, folder: n.folder, body: n.body, view: n.view ?? null, createdAt: n.createdAt, updatedAt: n.updatedAt })),
      folders: folders.map((f) => f.path),
    };
  },
});
