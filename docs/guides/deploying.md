# Deploying

sheddex has two separate things to deploy: the website (Vercel) and the backend (Convex). Only
Jack can deploy to production (it needs his accounts and his push).

## Convex deployments

| | Deployment | Used by |
| --- | --- | --- |
| Dev | `befitting-cobra-264` | `localhost`, the "sheddex" Android app |
| Prod | `grandiose-dolphin-564` | sheddex.com, the "sheddex prod" Android app |

- Day-to-day work pushes to **dev**: `npx convex dev --once` from `packages/convex`.
- Prod updates only through a Vercel production build (below). Until then, new functions don't
  exist on prod. Check with a POST to `https://grandiose-dolphin-564.convex.cloud/api/query`.
- `packages/convex/convex.json` must stay (see the traps in PROJECT.md).
- Some changes need a one-off command on prod after deploying, e.g.
  `npx convex run lessons:backfillBookingSessions --prod`. Note them in the feature's notes file.

## Vercel

- The Vercel project's **Root Directory** is `apps/web`.
- `apps/web/vercel.json`'s build command deploys Convex first, then builds the site:
  `cd ../../packages/convex && npx convex deploy --cmd 'cd ../../apps/web && pnpm build'`.
- It authenticates with a production-scoped `CONVEX_DEPLOY_KEY` set in Vercel (Production only).

## Environment variables (Convex)

Set with `npx convex env set NAME value` (add `--prod` for prod):
- `AUTH_RESEND_KEY` — Resend API key for all email (sign-up codes, password resets, invites,
  booking emails).
- `AUTH_EMAIL_FROM` — the sender. Should be `sheddex <noreply@sheddex.com>`; prod and dev still
  say "jackshed" until the domain is verified in Resend.
- `SITE_URL` — `http://localhost:3000` on dev, `https://sheddex.com` on prod (links in emails).
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google sign-in. Redirect URI:
  `https://<deployment>.convex.site/api/auth/callback/google`.

Web reads `NEXT_PUBLIC_CONVEX_URL` (and optionally `NEXT_PUBLIC_SITE_URL`); mobile reads
`EXPO_PUBLIC_CONVEX_URL`, from each app's `.env.local`.

## Launch checklist (open as of 2026-10-18)

1. **Deploy prod.** Lessons, booking, feedback, admin, Mayday, analytics and more are on dev
   only. Run a Vercel production build, watch its log, then check `/admin` on sheddex.com.
2. **Fix the email sender:** verify sheddex.com in Resend (DNS records), then
   `npx convex env set AUTH_EMAIL_FROM 'sheddex <noreply@sheddex.com>' --prod` (and on dev). Send
   yourself a sign-up code to check.
3. **Google sign-in:** publish the OAuth consent screen ("In production") in Google Cloud Console.
4. **Limits:** Resend's free plan is 100 emails a day. Check Convex bandwidth and storage after the
   first days (recordings and sample files are the big items).
5. **Test on prod** with a fresh email: sign up, sign in on another device, send feedback, report
   a post, see it in `/admin`.
6. **Backups:** turn on Convex's periodic backups for prod.

## If something goes wrong after launch

Admin → **Mayday** (owner only): maintenance mode, Community off, pause posting / sign-ups /
uploads / feedback, an announcement banner, and "sign everyone out". Details:
`docs/notes/launch-admin-analytics.md`.
