<!-- Moved word for word from the old single PROJECT.md (lines 1475–1522) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### Web parity, round 2 (2026-10-07): setlists, Community redesign, Home dashboard, new logo

After the mobile app gained setlists, the Community redesign, the Home dashboard and Jack's new
"Syncopation" logo, all of it was ported to `apps/web` ("implement all the new features you
implemented on the mobile to the nextjs site"). Same Convex functions and the same synced keys as
mobile (`jam-practice-setlists`, `jam-practice-tool-recents` is device-local), so setlists made on
one show up on the other.

- **Setlists:** `lib/useSetlists.ts` (same shape as mobile's, incl. per-tune `overrides` key/tempo).
  `/tunes/setlists` (search, Recent/A–Z) and `/tunes/setlist?id=` (`components/library/SetlistPage.tsx`):
  numbered tunes, drag-to-reorder by the grip (`DraggableList` in `components/library/setlistParts.tsx`
  — Pointer Events, mouse and touch), ⋮ per tune (move to top/up/down, "Key & tempo for this set"
  → `SetlistTuneDialog`, open chart, remove), ⋮ for the setlist (rename, description, share link,
  post to Community / View post via `communityTunes.postForSetlist`, stop sharing, delete). The
  Tunes dashboard got a Setlists stat card, a Setlists section and "New setlist" in its + menu.
- **Sharing:** `lib/shareLink.ts` uses `navigator.share` where there is one, else copies — used by
  setlist share links and every post's Share button (previously copy-only). `/setlist/[id]`
  (`SharedSetlistPage`) is the page mobile's share links (`https://sheddex.com/setlist/<id>`)
  point at — it didn't exist on web before this, so those links 404'd until now. "Save as my
  setlist" (`lib/useSaveSetlist.ts`) needed web's `useChordChartsLibrary.importSongs` to return
  the imported charts' ids, as mobile's already did.
- **"View all charts":** `/setlist-charts?mine=|post=|shared=&start=` — one chart per page in a
  CSS scroll-snap strip (swipe on touch), ←/→ keys and ‹ › buttons, each chart transposed to the
  setlist's key and fitted to the screen (`ChordChart fullscreen`).
- **Community** (`components/Community.tsx`) is now a dashboard like Tunes/Chord Charts: + (Post
  tunes / Post a setlist… → your setlists), one search over people and posts, Liked / Following /
  My posts stat cards (now `/community/liked|following|posts`), Latest posts. Posting is a full
  page, `/community/new[?setlist=]` (`NewPostPage`), replacing `CommunityTunes`' modal — a
  setlist post stays in sync with the setlist. `PostListItem` (still exported from
  `CommunityTunes.tsx`, which now only holds it) is the mobile-style card; `PostPage` renders a
  setlist post with `PublicSetlist` (View all charts / Save as my setlist / Edit setlist).
- **Home** (`components/Home.tsx`) is the mobile dashboard: logo, search (tools *and* your
  tunes), Favorites (starter set until you star some; stars only signed in, as before), Jump back
  in (`lib/toolRecents.ts`, recorded in `AppShell`, plus recent tunes/charts), Your library
  (Tunes/Setlists/Charts), every tool by category. The signed-out pitch is one line under the logo;
  the donation note and footer stay. The old hero/preview cluster is gone.
- **Logo:** `components/Logo.tsx` (same paths as mobile's, theme-coloured) replaces `Wordmark.tsx`
  (deleted) in the sidebar, Home, `app/loading.tsx` and the tiling-pane loader; `app/icon.svg`,
  `app/apple-icon.png` and `app/favicon.ico` are the new app icon.

Verified: `tsc`, `eslint`, `next build`; and in the local nix-chromium browser, signed out with
seeded tunes/charts — creating a setlist, adding tunes, ⋮ reorder, an actual pointer drag
reorder, a per-set key/tempo (shown in accent; the reader showed the chart transposed to it),
paging the reader with the arrow keys, Home search finding tunes, Jump back in, and every new page
at 390px with no overflow and no console errors. **Not verified** (needs a signed-in account):
sharing a link and opening it, posting a setlist, the new post cards with real posts, and Save as
my setlist.

