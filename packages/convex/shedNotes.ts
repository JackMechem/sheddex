import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  MAX_BODY,
  cleanFolder,
  cleanTitle,
  findTags,
  linkKeys,
  noteSnippet,
  parseTargetKey,
  renameLinks,
  titleKey,
  uniqueTitle,
} from "@jam-practice/core/shedNotes";

/**
 * Shed Notes — markdown notes private to their owner, linked to each other with `[[Title]]` and
 * attachable to a day, a routine on a day, or a tune (`shedNoteLinks`). Titles are unique per
 * account (compared case-insensitively), so a `[[link]]` always means one note; renaming a note
 * rewrites the links to it in the owner's other notes.
 */

async function me(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in to use Shed Notes.");
  return userId;
}

async function ownNote(ctx: QueryCtx | MutationCtx, userId: Id<"users">, noteId: Id<"shedNotes">) {
  const note = await ctx.db.get(noteId);
  if (!note || note.userId !== userId) throw new Error("That note isn't there any more.");
  return note;
}

async function allNotes(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return ctx.db
    .query("shedNotes")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

async function titleTaken(ctx: QueryCtx | MutationCtx, userId: Id<"users">, key: string, except?: Id<"shedNotes">) {
  const hit = await ctx.db
    .query("shedNotes")
    .withIndex("by_user_title", (q) => q.eq("userId", userId).eq("titleKey", key))
    .first();
  return !!hit && hit._id !== except;
}

const meta = (n: Doc<"shedNotes">) => ({
  id: n._id as string,
  title: n.title,
  folder: n.folder,
  links: n.links,
  tags: n.tags,
  snippet: noteSnippet(n.body),
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

/** Every note's title, folder, links and a snippet (not the bodies) — the note list, the
    `[[` suggestions, backlinks and forward links all come from this. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return (await allNotes(ctx, userId)).map(meta);
  },
});

/** One note with its body and what it's attached to. Null when it's gone (or not yours). */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const noteId = ctx.db.normalizeId("shedNotes", id);
    if (!noteId) return null;
    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) return null;
    const attached = await ctx.db
      .query("shedNoteLinks")
      .withIndex("by_note", (q) => q.eq("noteId", noteId))
      .collect();
    return {
      ...meta(note),
      body: note.body,
      attached: attached.map((a) => ({ target: a.target, label: a.label })),
    };
  },
});

/** Full-text search over the bodies (titles are matched on the client from `list`). */
export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const userId = await getAuthUserId(ctx);
    const text = q.trim();
    if (!userId || !text) return [];
    const hits = await ctx.db
      .query("shedNotes")
      .withSearchIndex("search_body", (s) => s.search("body", text).eq("userId", userId))
      .take(30);
    // The bit of text around the first word searched for (what the search menu shows).
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return hits.map((n) => {
      const lower = n.body.toLowerCase();
      const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0), Infinity);
      const excerpt = Number.isFinite(at) ? noteSnippet(n.body.slice(Math.max(0, at - 50), at + 110), 150) : noteSnippet(n.body, 150);
      return { id: n._id as string, title: n.title, folder: n.folder, snippet: excerpt };
    });
  },
});

/** The notes attached to targets starting with `prefix` (a whole `targetKey`, or `day:<date>` for
    a day and its routines), with each one's title and snippet. */
export const attachedTo = query({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !prefix) return [];
    const rows = await ctx.db
      .query("shedNoteLinks")
      .withIndex("by_user_target", (q) => q.eq("userId", userId).gte("target", prefix).lt("target", `${prefix}￿`))
      .take(200);
    const out = [];
    for (const r of rows) {
      const note = await ctx.db.get(r.noteId);
      if (!note) continue;
      out.push({ target: r.target, noteId: r.noteId as string, title: note.title, snippet: noteSnippet(note.body, 120), updatedAt: note.updatedAt });
    }
    return out;
  },
});

const attachArg = v.optional(v.object({ target: v.string(), label: v.string() }));

async function attach(ctx: MutationCtx, userId: Id<"users">, noteId: Id<"shedNotes">, target: string, label: string) {
  if (!parseTargetKey(target)) throw new Error("Can't attach a note there.");
  const existing = await ctx.db
    .query("shedNoteLinks")
    .withIndex("by_user_target", (q) => q.eq("userId", userId).eq("target", target))
    .collect();
  if (existing.some((e) => e.noteId === noteId)) return;
  if (existing.length >= 50) throw new Error("That has as many notes attached as it can take.");
  await ctx.db.insert("shedNoteLinks", { userId, noteId, target, label: label.slice(0, 200), createdAt: Date.now() });
}

/** A new note. The title is made unique ("Untitled 2"); returns its id and the title it got. */
export const create = mutation({
  args: { title: v.optional(v.string()), folder: v.optional(v.string()), body: v.optional(v.string()), attach: attachArg },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const taken = new Set((await allNotes(ctx, userId)).map((n) => n.titleKey));
    if (taken.size >= 5000) throw new Error("You've reached the most notes an account can hold.");
    const title = uniqueTitle(args.title ?? "Untitled", taken);
    const body = (args.body ?? "").slice(0, MAX_BODY);
    const now = Date.now();
    const id = await ctx.db.insert("shedNotes", {
      userId,
      title,
      titleKey: titleKey(title),
      folder: cleanFolder(args.folder ?? ""),
      body,
      links: linkKeys(body),
      tags: findTags(body),
      createdAt: now,
      updatedAt: now,
    });
    if (args.attach) await attach(ctx, userId, id, args.attach.target, args.attach.label);
    return { id: id as string, title };
  },
});

/** Saves a note's text (the editor autosaves). */
export const save = mutation({
  args: { id: v.id("shedNotes"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await me(ctx);
    const note = await ownNote(ctx, userId, id);
    if (body.length > MAX_BODY) throw new Error(`A note can hold up to ${MAX_BODY.toLocaleString()} characters.`);
    if (body === note.body) return;
    await ctx.db.patch(id, { body, links: linkKeys(body), tags: findTags(body), updatedAt: Date.now() });
  },
});

/** Renames a note and rewrites `[[Old title]]` links in your other notes. Returns the new title,
    or throws if another note already has it. */
export const rename = mutation({
  args: { id: v.id("shedNotes"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const note = await ownNote(ctx, userId, args.id);
    const title = cleanTitle(args.title);
    if (!title) throw new Error("Give the note a title.");
    if (title === note.title) return title;
    const key = titleKey(title);
    if (await titleTaken(ctx, userId, key, note._id)) throw new Error(`There's already a note called "${title}".`);
    const now = Date.now();
    if (key !== note.titleKey) {
      for (const other of await allNotes(ctx, userId)) {
        if (!other.links.includes(note.titleKey)) continue;
        const body = renameLinks(other.body, note.title, title);
        const self = other._id === note._id;
        if (body !== other.body) await ctx.db.patch(other._id, { body, links: linkKeys(body), ...(self ? {} : { updatedAt: now }) });
      }
    }
    await ctx.db.patch(note._id, { title, titleKey: key, updatedAt: now });
    return title;
  },
});

/** Moves a note into a folder ("" = the top level). */
export const move = mutation({
  args: { id: v.id("shedNotes"), folder: v.string() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    await ownNote(ctx, userId, args.id);
    await ctx.db.patch(args.id, { folder: cleanFolder(args.folder) });
  },
});

/** Renames a folder (and its subfolders) by moving every note in it. */
export const renameFolder = mutation({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const from = cleanFolder(args.from);
    const to = cleanFolder(args.to);
    if (!from || from === to) return;
    for (const n of await allNotes(ctx, userId)) {
      if (n.folder === from || n.folder.startsWith(`${from}/`)) await ctx.db.patch(n._id, { folder: to + n.folder.slice(from.length) });
    }
  },
});

/** Deletes a note and its attachments to days and tunes. Links to it in other notes stay (as
    links to a note that doesn't exist, which can make it again — the way Obsidian does it). */
export const remove = mutation({
  args: { id: v.id("shedNotes") },
  handler: async (ctx, { id }) => {
    const userId = await me(ctx);
    await ownNote(ctx, userId, id);
    const links = await ctx.db
      .query("shedNoteLinks")
      .withIndex("by_note", (q) => q.eq("noteId", id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);
    await ctx.db.delete(id);
  },
});

/** Attaches an existing note to a day, a routine on a day, or a tune. */
export const attachNote = mutation({
  args: { noteId: v.id("shedNotes"), target: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    await ownNote(ctx, userId, args.noteId);
    await attach(ctx, userId, args.noteId, args.target, args.label);
  },
});

/** Takes a note off a day, routine or tune (the note itself stays). */
export const detachNote = mutation({
  args: { noteId: v.id("shedNotes"), target: v.string() },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const rows = await ctx.db
      .query("shedNoteLinks")
      .withIndex("by_user_target", (q) => q.eq("userId", userId).eq("target", args.target))
      .collect();
    for (const r of rows) if (r.noteId === args.noteId) await ctx.db.delete(r._id);
  },
});
