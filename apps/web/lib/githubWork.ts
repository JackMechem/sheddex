import { REPO } from "@jam-practice/convex/lib/github";

/**
 * The repo's recent commits and pull requests, fetched from the browser (the repo is public and
 * GitHub's API allows it). Not from Convex: its servers share addresses with other apps, so
 * GitHub's 60-requests-an-hour limit for them was often already used up; from the browser the
 * limit is just the admin's own. Each list is kept for 5 minutes.
 */

export type GitHubItem = { kind: "commit" | "pr"; ref: string; url: string; title: string; detail: string; at: number; merged?: boolean };

const cache = new Map<string, { at: number; data: Promise<unknown> }>();

async function gh<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data as Promise<T>;
  const data = (async () => {
    const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const when = reset ? new Date(reset * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
      throw new Error(`GitHub's limit of 60 lookups an hour is used up${when ? ` — it resets at ${when}` : ""}. Paste a hash or link instead for now.`);
    }
    if (!res.ok) throw new Error(`GitHub didn't answer (${res.status}).`);
    return res.json();
  })();
  cache.set(path, { at: Date.now(), data });
  data.catch(() => cache.delete(path));
  return data as Promise<T>;
}

export async function repoBranches(): Promise<string[]> {
  return (await gh<{ name: string }[]>("/branches?per_page=100")).map((b) => b.name);
}

export async function recentCommits(branch: string): Promise<GitHubItem[]> {
  const commits = await gh<{ sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null } }[]>(
    `/commits?sha=${encodeURIComponent(branch)}&per_page=60`,
  );
  return commits.map((c) => ({
    kind: "commit",
    ref: c.sha.slice(0, 7),
    url: c.html_url,
    title: c.commit.message.split("\n")[0],
    detail: c.commit.author?.name ?? "",
    at: c.commit.author ? Date.parse(c.commit.author.date) : 0,
  }));
}

export async function recentPulls(): Promise<GitHubItem[]> {
  const pulls = await gh<{ number: number; html_url: string; title: string; state: string; merged_at: string | null; updated_at: string; head: { ref: string }; base: { ref: string } }[]>(
    "/pulls?state=all&sort=updated&direction=desc&per_page=50",
  );
  return pulls.map((p) => ({
    kind: "pr",
    ref: `#${p.number}`,
    url: p.html_url,
    title: p.title,
    detail: `${p.head.ref} → ${p.base.ref} · ${p.merged_at ? "merged" : p.state}`,
    at: Date.parse(p.updated_at),
    merged: !!p.merged_at,
  }));
}

export type GitHubIssue = { number: number; url: string; title: string; state: string; labels: string[]; at: number };

/** The repo's issues, newest activity first (pull requests left out). */
export async function recentIssues(): Promise<GitHubIssue[]> {
  const issues = await gh<{ number: number; html_url: string; title: string; state: string; labels: { name: string }[]; updated_at: string; pull_request?: unknown }[]>(
    "/issues?state=all&sort=updated&direction=desc&per_page=60",
  );
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => ({ number: i.number, url: i.html_url, title: i.title, state: i.state, labels: i.labels.map((l) => l.name), at: Date.parse(i.updated_at) }));
}

/** "#45" or an issue link → the issue (looked up, so the title and state are right). */
export async function issueByRef(input: string): Promise<GitHubIssue | null> {
  const m = /(?:issues\/|#|^)(\d+)\s*$/.exec(input.trim());
  if (!m) return null;
  const i = await gh<{ number: number; html_url: string; title: string; state: string; labels: { name: string }[]; updated_at: string; pull_request?: unknown }>(`/issues/${m[1]}`);
  if (i.pull_request) return null;
  return { number: i.number, url: i.html_url, title: i.title, state: i.state, labels: i.labels.map((l) => l.name), at: Date.parse(i.updated_at) };
}
