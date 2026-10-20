import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { feedbackRefs, validSignature } from "./lib/github";
import { hub } from "./inbox";

const http = httpRouter();

auth.addHttpRoutes(http);

const MAIN = "main";

/**
 * GitHub webhook (repo Settings → Webhooks: `<deployment>.convex.site/github-webhook`, JSON, the
 * secret in the GITHUB_WEBHOOK_SECRET env var, events: pushes, pull requests and issues). A commit
 * message or PR title/description that mentions FB-<number> links it to that feedback; "fixes
 * FB-<number>" marks it done once it's on main (a push to main, or a PR merged into main); closing
 * a feedback's GitHub issue marks it done (reopening moves it back to planned).
 */
http.route({
  path: "/github-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return new Response("Not set up", { status: 503 });
    const body = await req.text();
    if (!(await validSignature(secret, body, req.headers.get("x-hub-signature-256")))) return new Response("Bad signature", { status: 401 });
    const event = req.headers.get("x-github-event");
    const payload = JSON.parse(body) as Record<string, unknown>;
    const now = Date.now();
    let linked = 0;

    if (event === "push") {
      const onMain = payload.ref === `refs/heads/${MAIN}`;
      const commits = (payload.commits ?? []) as { id: string; message: string; url: string }[];
      for (const c of commits) {
        const { mentioned, fixes } = feedbackRefs(c.message);
        for (const number of mentioned) {
          const title = c.message.split("\n")[0];
          await ctx.runMutation(internal.feedback.linkWork, {
            number,
            link: { kind: "commit", ref: c.id.slice(0, 7), url: c.url, title, at: now },
            done: onMain && fixes.includes(number),
          });
          linked++;
        }
      }
    } else if (event === "issues") {
      // An issue made from feedback closed (or reopened) on GitHub: the feedback follows.
      const action = payload.action;
      const issue = payload.issue as { number: number; state: string };
      if (action === "closed" || action === "reopened") {
        await ctx.runMutation(internal.inboxCore.setStatusForIssue, { issueNumber: issue.number, state: issue.state });
        linked++;
      }
    } else if (event === "pull_request") {
      const pr = payload.pull_request as { number: number; html_url: string; title: string; body: string | null; merged: boolean; base: { ref: string } };
      const { mentioned, fixes } = feedbackRefs(`${pr.title}\n${pr.body ?? ""}`);
      const mergedToMain = pr.merged && pr.base.ref === MAIN;
      for (const number of mentioned) {
        await ctx.runMutation(internal.feedback.linkWork, {
          number,
          link: { kind: "pr", ref: `#${pr.number}`, url: pr.html_url, title: pr.title, merged: pr.merged, at: now },
          done: mergedToMain && fixes.includes(number),
        });
        linked++;
      }
    }
    return new Response(JSON.stringify({ ok: true, linked }), { status: 200, headers: { "content-type": "application/json" } });
  }),
});

/** The shared feedback inbox (production): other deployments send and read feedback here. */
http.route({ path: "/feedback-hub", method: "POST", handler: hub });

export default http;
