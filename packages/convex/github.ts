import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { REPO } from "./lib/github";

/**
 * The repo's recent commits and pull requests, for the admin inbox's "Pick" list (so linking
 * work to feedback doesn't mean hunting on GitHub). The repo is public; a GITHUB_TOKEN env var,
 * if set, only raises GitHub's rate limit (60 requests an hour without one).
 */

export type GitHubItem = { kind: "commit" | "pr"; ref: string; url: string; title: string; detail: string; at: number; merged?: boolean };

async function gh(path: string) {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "soniroll-admin", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers });
  if (res.status === 403 || res.status === 429) throw new Error("GitHub's rate limit is reached for now — try again in a while (or set GITHUB_TOKEN).");
  if (!res.ok) throw new Error(`GitHub didn't answer (${res.status}).`);
  return res.json();
}

export const recentWork = action({
  args: { kind: v.union(v.literal("commits"), v.literal("pulls")), branch: v.optional(v.string()) },
  handler: async (ctx, { kind, branch }): Promise<{ branches: string[]; items: GitHubItem[] }> => {
    if (!(await ctx.runQuery(api.admin.amIAdmin, {}))) throw new Error("Admins only.");
    const branches = ((await gh("/branches?per_page=100")) as { name: string }[]).map((b) => b.name);
    if (kind === "pulls") {
      const pulls = (await gh("/pulls?state=all&sort=updated&direction=desc&per_page=50")) as {
        number: number;
        html_url: string;
        title: string;
        state: string;
        merged_at: string | null;
        updated_at: string;
        head: { ref: string };
        base: { ref: string };
      }[];
      return {
        branches,
        items: pulls.map((p) => ({
          kind: "pr",
          ref: `#${p.number}`,
          url: p.html_url,
          title: p.title,
          detail: `${p.head.ref} → ${p.base.ref} · ${p.merged_at ? "merged" : p.state}`,
          at: Date.parse(p.updated_at),
          merged: !!p.merged_at,
        })),
      };
    }
    const sha = branch && branches.includes(branch) ? branch : "preview";
    const commits = (await gh(`/commits?sha=${encodeURIComponent(sha)}&per_page=60`)) as {
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } | null };
    }[];
    return {
      branches,
      items: commits.map((c) => ({
        kind: "commit",
        ref: c.sha.slice(0, 7),
        url: c.html_url,
        title: c.commit.message.split("\n")[0],
        detail: c.commit.author?.name ?? "",
        at: c.commit.author ? Date.parse(c.commit.author.date) : 0,
      })),
    };
  },
});
