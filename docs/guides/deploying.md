# Deploying

soniroll has two separate things to deploy: the website (Vercel) and the backend (Convex). Only
Jack can deploy to production (it needs his accounts and his push).

## Convex deployments

| | Deployment | Used by |
| --- | --- | --- |
| Dev | `befitting-cobra-264` | `localhost`, the "sheddex" Android app |
| Preview | a new one per branch | Vercel preview builds (e.g. of `preview`) |
| Prod | `grandiose-dolphin-564` | soniroll.com, the "sheddex prod" Android app |

- Day-to-day work pushes to **dev**: `npx convex dev --once` from `packages/convex`.
- Prod updates only through a Vercel production build (below). Until then, new functions don't
  exist on prod. Check with a POST to `https://grandiose-dolphin-564.convex.cloud/api/query`.
- `packages/convex/convex.json` must stay (see the traps in PROJECT.md).
- Some changes need a one-off command on prod after deploying, e.g.
  `npx convex run lessons:backfillBookingSessions --prod`. Note them in the feature's notes file.

## Vercel

- The Vercel project's **Root Directory** is `apps/web`.
- `apps/web/vercel.json`'s build command deploys Convex first, then builds the site:
  `cd ../../packages/convex && npx convex deploy --preview-run previewSeed:seed --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'cd ../../apps/web && pnpm build'`.
- `--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` is needed: the command runs from
  `packages/convex`, which isn't a Next.js package, so Convex can't tell which variable name the
  site reads and would otherwise hand the build `CONVEX_URL`. Without it, preview sites crash with
  "Missing environment variable NEXT_PUBLIC_CONVEX_URL".
- It authenticates with `CONVEX_DEPLOY_KEY`. Vercel has **two** of them: the production deploy
  key, scoped to Production only, and a preview deploy key, scoped to Preview only. The type of key
  decides where `convex deploy` goes, so the same build command serves both.

## Preview deployments

Every Vercel preview build (any branch except `main`) gets its own Convex backend, named after the
branch, with its own empty database. It never touches dev or prod data, and no prod data is ever
copied into it. On the free plan a preview backend is deleted 5 days after it was created; the next
push makes a fresh one.

**Demo data:** when a preview backend is first created, the build runs `previewSeed:seed`
(`packages/convex/previewSeed.ts`; Convex runs `--preview-run` only on new preview deployments,
never on prod). It makes:
- a demo account to sign in as: `demo@sheddex.test`, with the password you set in
  `PREVIEW_DEMO_PASSWORD`. It has tunes (some linked to chord charts), a "Jazz standards" playlist
  with three charts, a setlist, a public profile, and three weeks of Shed Log history;
- a second musician, @maya.plays (can't sign in), with tunes and a Community post. She and the demo
  account follow each other.

Or sign up with your own email for an empty account. Signing up as mechemjack@gmail.com makes you
the owner there too (`/admin` works). Google sign-in doesn't work on previews (its redirect address
changes with every preview backend), so use email and password.

**One-time setup** (in this order, before pushing a branch):
1. Convex dashboard → the project's Settings → **Generate Preview Deploy Key**.
2. Vercel → Project Settings → Environment Variables → add `CONVEX_DEPLOY_KEY` = that key, with only
   **Preview** ticked. Leave the production key on Production only.
3. Convex dashboard → the project's Settings → **default environment variables for preview
   deployments**:
   - `PREVIEW_DEMO_PASSWORD` — any password; the demo account's.
   - `JWT_PRIVATE_KEY` and `JWKS` — copy them from the dev deployment's environment variables.
     Sign-in doesn't work without them.
   - `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` — so sign-up codes and password resets are sent.
   - `SITE_URL` — the branch's stable Vercel address (e.g.
     `https://sheddex-git-preview-<team>.vercel.app`), so links in emails go to the preview site.

**If a preview has no variables** (it was made before the defaults were set), copy them from dev
without printing them, from `packages/convex`:
`for n in JWT_PRIVATE_KEY JWKS AUTH_RESEND_KEY AUTH_EMAIL_FROM; do npx convex env get $n | npx convex env set $n --deployment <preview-deployment>; done`
(the deployment name is in the dashboard's picker, e.g. `proper-puffin-311` for `preview/preview`).
Variables take effect at once; no redeploy needed. `npx convex run previewSeed:state --deployment
<preview-deployment>` shows whether the demo account exists.

**If sign-in fails on the preview site** but works against the backend, the site is talking to a
different backend: make sure `NEXT_PUBLIC_CONVEX_URL` isn't set for Preview in Vercel, then
redeploy.

The seed runs only when a preview backend is created. If one was created before
`PREVIEW_DEMO_PASSWORD` was set, run it by hand:
`npx convex run previewSeed:seed --deployment <preview-deployment>` from `packages/convex`. Running it again
does nothing (it skips once the demo account exists, and refuses on any backend that already has
real accounts).

## Environment variables (Convex)

Set with `npx convex env set NAME value` (add `--prod` for prod):
- `AUTH_RESEND_KEY` — Resend API key for all email (sign-up codes, password resets, invites,
  booking emails).
- `AUTH_EMAIL_FROM` — the sender: `soniroll <noreply@soniroll.com>` on prod and dev (soniroll.com
  is verified in Resend; an unverified domain makes every email fail).
- `SITE_URL` — `http://localhost:3000` on dev, `https://www.soniroll.com` on prod (links in emails).
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google sign-in. Redirect URI:
  `https://<deployment>.convex.site/api/auth/callback/google`.

Web reads `NEXT_PUBLIC_CONVEX_URL` (and optionally `NEXT_PUBLIC_SITE_URL`); mobile reads
`EXPO_PUBLIC_CONVEX_URL`, from each app's `.env.local`.

## Launch checklist (open as of 2026-10-18)

1. **Deploy prod.** Lessons, booking, feedback, admin, Mayday, analytics and more are on dev
   only. Run a Vercel production build, watch its log, then check `/admin` on soniroll.com.
2. **Google sign-in:** publish the OAuth consent screen ("In production") in Google Cloud Console.
3. **Limits:** Resend's free plan is 100 emails a day. Check Convex bandwidth and storage after the
   first days (recordings and sample files are the big items).
4. **Test on prod** with a fresh email: sign up, sign in on another device, send feedback, report
   a post, see it in `/admin`.
5. **Backups:** turn on Convex's periodic backups for prod.

## If something goes wrong after launch

Admin → **Mayday** (owner only): maintenance mode, Community off, pause posting / sign-ups /
uploads / feedback, an announcement banner, and "sign everyone out". Details:
`docs/notes/launch-admin-analytics.md`.
