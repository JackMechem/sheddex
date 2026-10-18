<!-- Moved word for word from the old single PROJECT.md (lines 1800–1867) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### Web: a marketing landing page for signed-out visitors (2026-10-10)

Signed-out visitors to `/` are redirected (server-side, `apps/web/proxy.ts`) to `/welcome`, a
standalone landing page (`components/landing/Landing.tsx` + `previews.tsx`) with no app chrome:
`components/AppChrome.tsx` (in `app/layout.tsx`) skips the sidebar, palette, timer badge, tool dock
and `AppShell` on that one path. CTAs: **Sign up / Log in** (the app's own `AuthForm`, now exported
from `AccountMenu.tsx` with `onSuccess`/`initialFlow`/`googleRedirectTo`, in a modal; success, and
Google's redirect, go to `/`) and **Try it without an account**, which sets the `sheddex-guest`
cookie (`lib/landing.ts`) so `/` opens the app from then on. `AppChrome` also sets that cookie on any
app page, so someone who arrives straight at a tool isn't bounced to the landing page by the
Dashboard link. `/welcome` is open to signed-in users too: the sidebar logo (desktop and mobile)
links there, and signed in its nav shows Account / Dashboard and its CTAs become "Go to your
dashboard" (auth read on the server via `isAuthenticatedNextjs()` so there's no flash). The
sidebar's first item is now **Dashboard** (`/`, no favorite star).

**Home (`/`) is now a dashboard** (`components/Home.tsx`): date + greeting and a search box, then a
12-column card grid: "Pick up where you left off" (most recent tool big with Resume, then recent
tools/tunes/charts), Tune of the day (from Tunes I Know, picked by date), Favorites / Get started
tiles, Your library counts, Setlists, Practice sessions (or the running session's widget), Ear
training weak spots (read-only from Guess the Interval / Guess the Chord's synced `intervalStats` /
`chordStats`), and a compact All tools launcher. Search swaps the grid for tool + tune results.

Visuals: the hero cards and the "Try the real tools" tabs are the app's real components running
live (beat strip, tuner dial, the chord chart renderer with a sample 12-bar blues, VexFlow sticking
notation, a playable interval quiz on the piano samples, and a theme switcher using real presets);
the interface frame, setlist, phone and split-view images are real screenshots in
`public/landing/v2/*-{light,dark}.png` (the folder is `Landing.tsx`'s `SHOTS`; when retaking them,
move them to a new folder and bump it, because Next caches optimized images by URL and an in-place
replacement keeps showing the old picture), swapped by the `.dark` class. They were taken with the nix
chromium + playwright-core setup against the dev server with seeded demo localStorage (tunes,
setlists, charts, recents); retake them if the UI changes noticeably. Verified: `tsc`, `eslint`,
`next build`; in the browser at 1440 (light/dark) and 390 wide, no console errors, no horizontal
overflow; the redirect (307 to `/welcome`, 200 with the guest cookie), each feature tab, the quiz,
the sign-up modal, and the guest button landing in the app with the sidebar. Not verified: an actual
sign-up/sign-in completing from the modal (needs a real account).

**Routing changed the same day: the landing page is `/`, the app's dashboard is `/dashboard`.**
`app/page.tsx` is the landing page for everyone (signed in, it shows Account / Dashboard and "Go to
your dashboard"); `app/dashboard/page.tsx` renders `Home`. Paths live in `lib/landing.ts`
(`LANDING_PATH`, `DASHBOARD_PATH`, `SIGN_IN_PATH = "/?auth=login"`). The guest cookie and the
proxy redirect described above are gone (`proxy.ts` is back to plain `convexAuthNextjsMiddleware()`).
`/welcome` permanently redirects to `/` (`next.config.ts`). The app's "Sign in" links (Community,
New post, public profiles) go to `/?auth=login`, which opens the landing page's sign-in modal;
`?auth=signup` opens sign-up. Sign-in success and Google's redirect go to `/dashboard`; signing out
or deleting the account goes to `/`. The tiling registry key for the dashboard is `/dashboard` (a
saved tiled layout with an old `/` pane shows "not available"; close that pane). Verified in the
browser: `/`, `/welcome` redirect, `?auth=login`, "Try it without an account", sidebar Dashboard and
logo links, Community's Sign in href.

### Forgot password (2026-10-10, web)

`Password({ verify: ResendOTP, reset: ResendPasswordReset })` in `packages/convex/auth.ts`.
`ResendPasswordReset.ts` emails (HTML button + plain-text fallback; `lib/resend.ts`'s `sendEmail`
gained an optional `html`) a one-time link with a 64-hex-char token, valid 1 hour:
`${SITE_URL}/reset-password?email=&token=`. The param is `token`, not `code`, because Convex Auth's
Next.js middleware treats any `?code=` as an OAuth callback. `SITE_URL` is `http://localhost:3000`
on dev and `https://sheddex.com` on prod. The page (`app/reset-password`, `components/
ResetPassword.tsx`, standalone with no sidebar via `AppChrome`): without a token it asks for the
email and calls `signIn("password", { email, flow: "reset" })`, always showing the same "check your
email" message (no revealing which emails have accounts; Google-only accounts have nothing to
reset); with a token it takes the new password twice and calls `flow: "reset-verification"`, which
sets it, signs out other sessions and signs in here; a used/expired/bad token shows "send a new
link". The sign-in form (`AuthForm`) has a "Forgot your password?" link (prefills the email).
Deployed to dev; prod gets it on the next Vercel build. Verified in the browser: request flow,
password-mismatch error, and a bogus token. **Not verified:** a real email arriving and its link
resetting a real account. The mobile app has no "forgot password" link yet (the web page works for
mobile accounts too, same backend).

