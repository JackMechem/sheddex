import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { MAX_BODY } from "@jam-practice/core/shedNotes";

/**
 * Shed Notes templates — kept apart from notes (they're not in the note list, links or search).
 * A template's title and text can hold {{variables}}; making a note from it asks for their values
 * (in the web app, `lib/noteTemplates.ts`).
 */

const MAX_TEMPLATES = 200;

async function me(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in to use Shed Notes.");
  return userId;
}

const cleanName = (name: string) => name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

async function mine(ctx: MutationCtx, userId: Id<"users">) {
  return ctx.db
    .query("shedNoteTemplates")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

/** Every template of yours, A–Z. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("shedNoteTemplates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .map((t) => ({ id: t._id as string, name: t.name, title: t.title, body: t.body, updatedAt: t.updatedAt }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** A new template; its name is made unique ("Template 2"). */
export const create = mutation({
  args: { name: v.optional(v.string()), title: v.optional(v.string()), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const all = await mine(ctx, userId);
    if (all.length >= MAX_TEMPLATES) throw new Error("That's as many templates as an account can hold.");
    const taken = new Set(all.map((t) => t.name.toLowerCase()));
    const base = cleanName(args.name ?? "") || "New template";
    let name = base;
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`;
    const now = Date.now();
    const id = await ctx.db.insert("shedNoteTemplates", { userId, name, title: (args.title ?? "").slice(0, 300), body: (args.body ?? "").slice(0, MAX_BODY), createdAt: now, updatedAt: now });
    return { id: id as string, name };
  },
});

/** Changes a template's name, title or text (the editor autosaves). */
export const update = mutation({
  args: { id: v.id("shedNoteTemplates"), name: v.optional(v.string()), title: v.optional(v.string()), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await me(ctx);
    const t = await ctx.db.get(args.id);
    if (!t || t.userId !== userId) throw new Error("That template isn't there any more.");
    const patch: { name?: string; title?: string; body?: string; updatedAt: number } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = cleanName(args.name);
      if (!name) throw new Error("Give the template a name.");
      const clash = (await mine(ctx, userId)).some((o) => o._id !== t._id && o.name.toLowerCase() === name.toLowerCase());
      if (clash) throw new Error(`There's already a template called "${name}".`);
      patch.name = name;
    }
    if (args.title !== undefined) patch.title = args.title.replace(/[\r\n]+/g, " ").slice(0, 300);
    if (args.body !== undefined) {
      if (args.body.length > MAX_BODY) throw new Error(`A template can hold up to ${MAX_BODY.toLocaleString()} characters.`);
      patch.body = args.body;
    }
    await ctx.db.patch(t._id, patch);
  },
});

/** Deletes a template. Notes made from it stay as they are. */
export const remove = mutation({
  args: { id: v.id("shedNoteTemplates") },
  handler: async (ctx, { id }) => {
    const userId = await me(ctx);
    const t = await ctx.db.get(id);
    if (!t || t.userId !== userId) return;
    await ctx.db.delete(id);
  },
});
