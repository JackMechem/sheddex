import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, httpAction, internalAction, type ActionCtx } from "./_generated/server";
import { type InboxRow, opVal } from "./inboxCore";
import { REPO } from "./lib/github";

/**
 * The admin inbox, the same on every deployment. Production holds the one shared list: a
 * deployment with FEEDBACK_HUB_URL (production's `.convex.site` URL) and FEEDBACK_HUB_SECRET set
 * sends its bugs and ideas there (`forward`) and reads and changes that list through production's
 * `/feedback-hub` endpoint. Without them, a deployment simply uses its own feedback. GitHub issues
 * are only ever made or linked by the admin, here (`createIssue`), with GITHUB_TOKEN on whichever
 * deployment holds the list.
 */

/** Base64 without Node's Buffer (Convex functions run in a browser-like runtime). */
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hubUrl = () => process.env.FEEDBACK_HUB_URL?.replace(/\/+$/, "") || null;

/** Where this deployment's forwarded feedback says it came from. */
const sourceName = () => process.env.FEEDBACK_SOURCE_NAME || new URL(process.env.CONVEX_CLOUD_URL ?? "https://unknown").hostname.split(".")[0];

async function callHub<T>(body: unknown): Promise<T> {
  const res = await fetch(`${hubUrl()}/feedback-hub`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-secret": process.env.FEEDBACK_HUB_SECRET ?? "" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `The shared inbox didn't answer (${res.status}).`);
  return JSON.parse(text) as T;
}

async function mustAdmin(ctx: ActionCtx) {
  if (!(await ctx.runQuery(api.admin.amIAdmin, {}))) throw new Error("Not allowed.");
}

export type Row = InboxRow & { where: "shared" | "here" };
type Issue = { number: number; url: string; title: string; state: string };
type IssueSource = {
  number: number | null;
  kind: string;
  message: string;
  page: string | null;
  userAgent: string | null;
  version: string | null;
  issue: Issue | null;
  screenshotUrl: string | null;
};

/** The inbox: the shared list (or this deployment's), plus what's still only here. */
export const list = action({
  args: {},
  handler: async (ctx): Promise<{ rows: Row[]; shared: boolean }> => {
    await mustAdmin(ctx);
    if (!hubUrl()) {
      const rows: InboxRow[] = await ctx.runQuery(internal.inboxCore.listLocal, {});
      return { rows: rows.map((r) => ({ ...r, where: "here" as const })), shared: false };
    }
    const [hub, reports]: [InboxRow[], InboxRow[]] = await Promise.all([
      callHub<InboxRow[]>({ op: "list" }),
      // Here: reports (about posts and profiles here), and anything from before this deployment
      // shared its inbox (it can be moved over with `moveToShared`).
      ctx.runQuery(internal.inboxCore.listLocal, {}),
    ]);
    const rows = [...hub.map((r) => ({ ...r, where: "shared" as const })), ...reports.map((r) => ({ ...r, where: "here" as const }))];
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return { rows, shared: true };
  },
});

/** A change to one feedback (status, note, delete, links, its issue) — wherever it lives. */
export const apply = action({
  args: { op: opVal, where: v.union(v.literal("shared"), v.literal("here")) },
  handler: async (ctx, { op, where }) => {
    await mustAdmin(ctx);
    if (where === "shared" && hubUrl()) await callHub({ op: "apply", change: op });
    else await ctx.runMutation(internal.inboxCore.applyLocal, { op });
  },
});

/** Sends one older bug, idea or note from here to the shared inbox. */
export const moveToShared = action({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<void> => {
    await mustAdmin(ctx);
    if (!hubUrl()) throw new Error("This deployment doesn't share its inbox.");
    await ctx.runAction(internal.inbox.forward, { id: id as Id<"feedback">, attempt: 5 });
    const after = await ctx.runQuery(internal.inboxForward.forwardSource, { id: id as Id<"feedback"> });
    if (after && !after.forwarded) throw new Error("Couldn't reach the shared inbox — try again in a bit.");
  },
});

// ---------------------------------------------------------------- GitHub issues

const DEVICE = (ua: string | null) => {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  return [os, browser].filter(Boolean).join(" · ") || null;
};

/** Makes the GitHub issue for a feedback (on the deployment that holds it). */
async function createIssueHere(ctx: ActionCtx, id: string, includeScreenshot: boolean): Promise<Issue> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Set GITHUB_TOKEN in this deployment's Convex environment to make issues.");
  const src: IssueSource | null = await ctx.runQuery(internal.inboxCore.issueSource, { id });
  if (!src) throw new Error("That feedback is gone.");
  if (src.issue) return src.issue;
  if (src.kind !== "bug" && src.kind !== "feature") throw new Error("Only bugs and ideas get GitHub issues.");
  const firstLine = src.message.split("\n")[0].trim();
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 77).trimEnd()}…` : firstLine || (src.kind === "bug" ? "Bug report" : "Idea");
  const site = process.env.SITE_URL?.replace(/\/+$/, "") || "https://www.soniroll.com";
  const facts = [
    src.number !== null && `**ID:** FB-${src.number}`,
    `**Kind:** ${src.kind === "bug" ? "Bug" : "Idea"}`,
    src.version && `**Version:** v${src.version}`,
    src.page && `**Page:** [${src.page}](${site}${src.page})`,
    DEVICE(src.userAgent) && `**Device:** ${DEVICE(src.userAgent)}`,
  ].filter(Boolean);
  const body = [
    src.message.split("\n").map((l: string) => `> ${l}`).join("\n"),
    "",
    facts.join("  \n"),
    includeScreenshot && src.screenshotUrl ? `\n![Screenshot](${src.screenshotUrl})` : "",
    "",
    "<sub>Sent through soniroll's feedback form.</sub>",
  ].join("\n");
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "soniroll-admin", "X-GitHub-Api-Version": "2022-11-28", "content-type": "application/json" },
    body: JSON.stringify({ title, body, labels: [src.kind === "bug" ? "bug" : "enhancement"] }),
  });
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { message?: string } | null)?.message;
    throw new Error(`GitHub didn't make the issue (${res.status}${detail ? `: ${detail}` : ""}). Check the token can write issues on ${REPO}.`);
  }
  const made = (await res.json()) as { number: number; html_url: string; title: string; state: string };
  const issue = { number: made.number, url: made.html_url, title: made.title, state: made.state };
  await ctx.runMutation(internal.inboxCore.applyLocal, { op: { op: "setIssue", id, issue } });
  return issue;
}

/** "Create GitHub issue" on a bug or idea (with the screenshot only if asked). */
export const createIssue = action({
  args: { id: v.string(), where: v.union(v.literal("shared"), v.literal("here")), includeScreenshot: v.boolean() },
  handler: async (ctx, { id, where, includeScreenshot }): Promise<Issue> => {
    await mustAdmin(ctx);
    if (where === "shared" && hubUrl()) return callHub<Issue>({ op: "createIssue", id, includeScreenshot });
    return createIssueHere(ctx, id, includeScreenshot);
  },
});

// ---------------------------------------------------------------- sharing with production

/** Sends a feedback sent here on to the shared inbox (with its screenshot), and keeps its
    FB-number from there. Tries again a few times if production can't be reached. */
export const forward = internalAction({
  args: { id: v.id("feedback"), attempt: v.optional(v.number()) },
  handler: async (ctx, { id, attempt = 0 }) => {
    if (!hubUrl()) return;
    const row = await ctx.runQuery(internal.inboxForward.forwardSource, { id });
    if (!row || row.forwarded || row.kind === "report") return;
    let screenshot: string | null = null;
    if (row.screenshotId) {
      const blob = await ctx.storage.get(row.screenshotId);
      if (blob) screenshot = toBase64(new Uint8Array(await blob.arrayBuffer()));
    }
    try {
      const { number } = await callHub<{ number: number }>({
        op: "submit",
        feedback: {
          kind: row.kind,
          message: row.message,
          ...(row.email ? { email: row.email } : {}),
          ...(row.page ? { page: row.page } : {}),
          ...(row.userAgent ? { userAgent: row.userAgent } : {}),
          ...(row.version ? { version: row.version } : {}),
          createdAt: row.createdAt,
          source: sourceName(),
          sender: row.sender,
        },
        screenshot,
      });
      await ctx.runMutation(internal.inboxCore.markForwarded, { id, number });
    } catch (e) {
      if (attempt < 5) await ctx.scheduler.runAfter(60_000 * 2 ** attempt, internal.inbox.forward, { id, attempt: attempt + 1 });
      else console.error("Couldn't send feedback to the shared inbox:", e);
    }
  },
});



/** Production's end: `POST /feedback-hub` from the other deployments (checked by the shared
    secret). */
export const hub = httpAction(async (ctx, req) => {
  const secret = process.env.FEEDBACK_HUB_SECRET;
  if (!secret) return new Response("The shared inbox isn't set up here.", { status: 503 });
  if (req.headers.get("x-hub-secret") !== secret) return new Response("Not allowed.", { status: 401 });
  const json = (await req.json()) as Record<string, unknown>;
  const ok = (data: unknown) => new Response(JSON.stringify(data ?? null), { status: 200, headers: { "content-type": "application/json" } });
  try {
    switch (json.op) {
      case "list":
        return ok(await ctx.runQuery(internal.inboxCore.listLocal, { kinds: ["bug", "feature", "other"] }));
      case "apply":
        return ok(await ctx.runMutation(internal.inboxCore.applyLocal, { op: json.change as never }));
      case "createIssue":
        return ok(await createIssueHere(ctx, String(json.id), !!json.includeScreenshot));
      case "submit": {
        const f = json.feedback as Record<string, unknown>;
        let screenshotId: Id<"_storage"> | undefined;
        if (typeof json.screenshot === "string" && json.screenshot.length < 12_000_000) {
          screenshotId = await ctx.storage.store(new Blob([fromBase64(json.screenshot)], { type: "image/png" }));
        }
        const number = await ctx.runMutation(internal.inboxCore.insertForwarded, { ...(f as object), ...(screenshotId ? { screenshotId } : {}) } as never);
        return ok({ number });
      }
    }
    return new Response("Unknown request.", { status: 400 });
  } catch (e) {
    return new Response((e as Error).message, { status: 400 });
  }
});
