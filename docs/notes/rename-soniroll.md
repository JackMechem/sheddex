# The website is "soniroll" now (2026-10-18, web only)

Jack renamed the product from sheddex to **soniroll** and bought soniroll.com. Long naming search
first (he disliked "sheddex" — sounds like a prescription drug); Soniroll = a Sonny Rollins nod,
soni = sound, "on a roll" (streaks), a drum roll, a roll of tunes. 73 logo explorations were made
(in `~/Desktop/soniroll logos`, not in the repo); he picked **#65 "Goal ring"**.

## What changed (looks only)

- **Display name** everywhere a person sees it on the website: `sheddex` → `soniroll`, lowercase
  like before (page titles and the title template, metadata/Open Graph, the sidebar, landing page,
  help, legal pages, Support, Lessons, Community, feedback, Shed Log copy, progress-card images,
  their download file names, the maintenance screen, the changelog's text).
- **Logo** (`components/Logo.tsx`): the daily goal ring from the Shed Log, nearly closed, with a tick
  badge where it's heading and an eighth note inside, beside the "soniroll" wordmark (Poppins
  ExtraBold, stored as outlines in `WORD_PATH`, so no font loads). It's drawn from the theme: the
  ring is `accent`, the track (12% opacity), note, badge and letters are `foreground`, the tick is
  `background` — so it matches every preset and custom theme (checked on Light, Dark and four other
  palettes). `Logo` (mark + word, `height` sets size, aspect 3.5:1) and `LogoMark` (just the ring).
  Because the word is smaller relative to the height than the old wordmark, every use got ~1.5×
  taller (sidebar 34/36, landing 34/22/28, loading 66, reset password and split-screen loader 46).
- **Page-change animation** (`lib/logoAnimation.ts`, replaces `lib/stickStrike.ts`): the ring sweeps
  closed (stroke-dashoffset on `data-ring`, which has `pathLength=1`) and the tick pops
  (`data-badge`). `prefersReducedMotion` moved there too (used by `AppShell`).
- **Icons**: `app/icon.svg` (the ring on the dark default-theme tile), `app/apple-icon.png` (180) and
  `app/favicon.ico` (16/32/48), rendered from the SVG.
- **Link previews** (`app/opengraph-image.tsx`): the new logo on the dark default theme's colours.

## Deliberately unchanged

- **Web addresses**: every `https://sheddex.com/...` link, share link, the setlist share base, the
  "sheddex.com" text in the landing page's mock browser bar, Privacy/Terms, the Support page's
  "Hosting sheddex.com" and the progress cards' footer — the site still lives at sheddex.com. When
  soniroll.com is pointed at Vercel, change these (grep `sheddex.com` in `apps/web`), and
  `metadataBase` in `app/layout.tsx` (or set `NEXT_PUBLIC_SITE_URL`).
- **Internals**: the `sheddex://` chart-link format, window event names (`sheddex:open-feedback`,
  `sheddex:changelog-seen`), storage keys (`jam-practice-…`), package and folder names, the GitHub
  repo URL (`JackMechem/sheddex`), the calendar-invite UID domain.
- **Backend**: Convex functions, emails (sign-up codes, resets, invites, booking emails still say
  whatever `AUTH_EMAIL_FROM` and the email templates say), admin analytics.
- **Feature names**: "Shed Log", "Your shed" (sidebar heading) and "shed" wording in copy ("every
  practice tool in one shed") — not decided yet.
- **The mobile app** (development paused).
- **Screenshots**: the landing page's (`public/landing/v3/`) and Help's (`public/help/v3/`) pictures
  still show the old logo in their sidebars; retake them into new folders (`v4`) and bump `SHOTS`.

Checked: `tsc`, `eslint` (one pre-existing warning in `SettingsBar.tsx`), `pnpm build`, and in nix
Chromium: the sidebar, collapsed sidebar, phone menu, landing page and link-preview image, in
several themes; the page-change animation runs without errors.

## Emails switched (2026-10-18, later)

Jack pointed soniroll.com at Vercel (it serves from `www.soniroll.com`; `soniroll.com` and
`sheddex.com` 308 to it), added it to Resend and Google. The email wording in `packages/convex`
(sign-up codes, password reset, account confirmations, lesson invites and booking emails) now says
soniroll, and the `SITE_URL` fallbacks are `https://www.soniroll.com`. Lesson calendar UIDs stay
`<id>@sheddex.com` on purpose — changing them would make calendars treat updates to existing lessons
as new events.

Convex env: prod `SITE_URL=https://www.soniroll.com`; prod and dev
`AUTH_EMAIL_FROM=soniroll <noreply@soniroll.com>` (set once Resend showed soniroll.com verified;
sending from an unverified domain fails every email, sign-up codes included). The new wording
reaches prod only when `preview` is merged into `main` (the Vercel prod build runs `convex deploy`);
the env changes applied right away.

## The rest of the switch (2026-10-18, later still)

Jack: keep "Shed Log" and "Your shed"; switch the chart links; update the landing page and every
link. Help's screenshots don't show the logo or name, so they weren't retaken.

- **Web addresses:** every `https://sheddex.com` in `apps/web` is now `https://www.soniroll.com`
  (share links for posts, profiles, setlists and routines; the `metadataBase` fallback; Privacy,
  Terms, Support; the progress cards' footer; the profile editor's address hint; the landing page's
  mock browser bar shows `soniroll.com`).
- **Chart links** (`packages/core/chartString.ts`): new links start with `soniroll://`;
  `OLD_SCHEMES` keeps `sheddex://` links importing (checked with a Node script both ways). The
  paused mobile app shares this code, so its exports switch too; an old mobile build can't read
  the new links.
- **Smaller things:** the Lessons tool description in `navLinks.ts` ("Teach with soniroll"), the
  calendar `PRODID`, and the window events (`soniroll:open-feedback`, `soniroll:changelog-seen`).
- **Landing screenshots:** `public/landing/v4/` (`SHOTS = "v4"`). Only `app-light/dark` showed the
  sidebar, so only those were retaken: Jack's **dev** account, 1440×900 at 2×, with the page clock set
  to 2026-10-17 20:30 (`context.clock.install`) so the dashboard shows a practised day instead of an
  empty one. The rest are the v3 files, moved.
- **Docs:** README, PROJECT.md, the style, versioning and deploying guides and architecture.md say
  soniroll and soniroll.com; the deploying checklist lost the finished "fix the email sender" step.
- **Still sheddex on purpose:** the GitHub repo (`JackMechem/sheddex`, not renamed — the in-app
  GitHub links point at it), lesson calendar UIDs (`@sheddex.com`), the bass-file format IDs
  (`sheddex.bass-transcription`, `sheddex.bass-player`, inside exported files — changing them would
  break importing old files), storage keys, the preview demo emails (`@sheddex.test`) and the mobile
  app.

Checked: `tsc` in web, mobile and convex (core has an older `lessonFiles.ts` `.at()` error, not from
this change), `pnpm lint` (the old `SettingsBar.tsx` warning), `convex dev --once`, `pnpm build`; in
nix Chromium, the text of 13 pages (landing, dashboard, legal, support, help, credits, changelog,
lessons, community, shed log, files, chord charts) has no "sheddex", and the landing page loads the
v4 pictures with no errors or overflow. Not checked: exporting a chart link from the editor UI by
hand, the share buttons on a phone.

**Signed-out visitors' saved data:** anything stored in the browser (settings, tunes, logs without an
account) belongs to the address it was saved on. After the redirect, people who used sheddex.com
signed out start fresh on soniroll.com; their old data is still in their browser under sheddex.com
but the site can't read it. Signed-in data is unaffected.
