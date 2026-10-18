<!-- Moved word for word from the old single PROJECT.md (lines 1–42) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

# sheddex — project notes for AI agents

This file is for picking up work on this repo in a fresh session (including on a different
computer after a clone). It's hand-maintained, separate from the auto-generated Next.js warning
in `AGENTS.md`.

## What this is

A personal collection of browser-based music practice tools, built for Jack (a musician/dev) as a
Next.js (App Router) + Tailwind app, all client components (`"use client"`). Almost everything
still runs client-side — per-tool settings and data (tunes, projects, recordings) persist in the
browser via localStorage / IndexedDB, not on a server, and every tool works fully with no account.
As of this session there's a real backend (Convex) for one thing only: accounts (email+password
and "Sign in with Google"), so far with **nothing synced yet** — see "Backend (Convex)" below for
what exists, what's next, and the honest state of what's been verified.

- **Displayed name:** "sheddex" (all lowercase, shown as the sidebar logo text and page title).
  It's been renamed several times in development (Barn Tools → Woodshed → The Barn → Barn Tools →
  shed.io → jshed.io → jackshed → sheddex) — if asked to rename again, it's a plain find/replace
  for the lowercase name string, but by this point it's spread far wider than just the UI chrome:
  this rename alone touched `app/layout.tsx`, `components/Sidebar.tsx`, `components/Home.tsx`,
  `app/recorder/page.tsx`, `app/credits/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`,
  `README.md`, `convex/account.ts`, `convex/ResendOTP.ts`, `convex/lib/resend.ts` (the email
  "from" display name), `lib/chartString.ts` (the `jackshed://` chart-link scheme itself, now
  `sheddex://` — a real, if small, backward-compatibility break: any chart link exported before
  this rename starts with the *old* scheme and will no longer be recognized by
  `looksLikeChartString`/`decodeChartString`, not something an in-place rename can avoid), and
  several Community-facing components with "jackshed users" style copy
  (`components/CommunityChordCharts.tsx`, `components/CommunityTunes.tsx`,
  `components/AccountMenu.tsx`, `components/PublicProfileEditor.tsx`, `components/ChordCharts.tsx`,
  `components/ChordChartEditor.tsx`) — confirmed by grepping the whole repo for the old name
  afterward (case-sensitive and case-insensitive both) rather than trusting this list alone, since
  the equivalent list from the *previous* rename (just the four UI-chrome files) had already gone
  stale by the time this one happened.
- **GitHub remote:** `git@github.com:JackMechem/sheddex.com.git` (also renamed a few times;
  the home page's GitHub link in `components/Home.tsx` should match whatever it currently is) —
  the actual remote/domain rename is Jack's own external step (can't be done from here), so this
  session's own change just updates the in-app links to the name they're *expected* to point to.
- Jack drives development one request at a time and reviews by screenshot, so expect iterative,
  pixel-level follow-ups rather than big up-front specs. He's comfortable with technical detail in
  replies but the built-in style here favors plain, concrete explanations over jargon.

