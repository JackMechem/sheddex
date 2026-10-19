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
