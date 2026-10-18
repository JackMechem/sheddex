<!-- Moved word for word from the old single PROJECT.md (lines 1745–1799) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### Mobile: add jazz standards straight to a setlist (2026-10-08)

The "Add tunes" picker (`components/library/TunePickerModal.tsx`, used by a setlist's + and by
`community/new`) now has two sections: **Your tunes** (both lists, as before), then **Jazz
standards** you don't already have in either list (matched by `nameId`; search uses
`searchStandards`, so composer/key match too). A picked standard is created in Tunes I Know on Add
(`standardToTune` — same rule as "Save as my setlist") and its new id goes into the setlist. Rows
have mixed heights (section headers), so `getItemLayout` uses precomputed offsets. **Web too:** `apps/web/components/library/setlistParts.tsx`'s `TunePickerModal` (setlist + and New post) has the same two sections and the same add-to-Tunes-I-Know behaviour; checked signed out in nix Chromium (search, add a standard → in the setlist and in Tunes I Know, no console errors).

**Follow-up:** the Tunes dashboard (app `app/library/index.tsx`, web `components/library/TunesDashboard.tsx`)
has a small + next to the Setlists, Tunes I Know and Tunes to Learn headings (`SectionHeader`'s new
`onAdd`): Setlists → new setlist; the two lists → "Jazz standard" or "New tune" into *that* list
(the standards picker now adds to whichever list it was opened for). `tsc`/`eslint` clean on both,
app preview build installed; web not checked in the browser.

**Bottom spacing above the tab bar (mobile):** the tab bar is an absolute overlay, and screens not
inside a bottom-edged `SafeAreaView` (Home, Tunes, Chord Charts, Community, setlists, tune pages,
account pages, recordings, …) were losing the device's bottom inset out of their `TAB_BAR_CONTENT_HEIGHT
+ N` padding, so the last item sat flush against the bar. `FloatingTabBar.tsx`'s `useTabBarSpace(extra
= 32)` returns bar + inset + extra; use it for any new scrolling page without a bottom safe-area edge
(bottom-edged screens keep `TAB_BAR_CONTENT_HEIGHT + 32`).

**Create a tune from the Add tunes picker (mobile):** the picker's top row is "Create “<search>”"
(when no tune or standard has that name) or "Create a new tune" (asks for a name). Created tunes
list ticked under "New tunes" (tap to drop) and are made in Tunes I Know on Add — name only,
4/4, no key/tempo yet. **Web too** (`setlistParts.tsx` `TunePickerModal`): same rows, Enter in the search creates, and an empty search's "Create a new tune" just focuses the box; checked in nix Chromium (two created tunes land in the setlist and Tunes I Know).

**Web back buttons:** every "← Back" / "← Tunes" text link (tune page, chart view, setlist, tune
lists, new post, setlist chart reader, `PageHeader`'s `back`) is now one shared
`BackButton` (`components/library/shared.tsx`): chevron + semibold label in a pill that gets a
surface background on hover; `href` makes it a link, `label` changes the text.

### Chord charts: one library ("All charts"), playlists are references (2026-10-08, app + web)

A chart lives once in the library; a playlist only references charts, so a chart can be in several
playlists or none. **Backend** (dev deployed; prod on next push): `chordChartSongs.playlistId` is
now optional (one membership kept inline, so existing data needed no migration) and a new
`chordChartPlaylistEntries` table holds any further memberships. `library` returns each chart's
`playlistIds` (plus the first as `playlistId` for older app builds). New `addToPlaylist` /
`removeFromPlaylist`; `importSongs`' `playlistName` is optional (omit = All charts only) and a chart
already in the library is *added to* the target playlist instead of skipped; `deleteSong` removes
the chart everywhere and no longer drops emptied playlists; `deletePlaylist({deleteCharts?})` keeps
the charts by default, or also deletes those in no other playlist; `moveSong` stays for old builds.
Signed out, `packages/core/chordChartsLibrary.ts` matches (`addSongToPlaylist`,
`removeSongFromPlaylist`, `deletePlaylistFromLibrary(…, {deleteCharts})`, no more "Unsorted").
Both `useChordChartsLibrary` hooks return `allSongs` (each with `playlistIds` / `playlistNames`);
everything that looked charts up by walking playlists now uses `allSongs`.
**UI:** the Chord Charts dashboard lists "All charts" first under Playlists (the playlist screen /
page with id `all`), search covers the library once, a chart's ⋮ has Remove from <this playlist> and
Playlists… (app: tick/untick each playlist; web: Add to / Remove from each) plus Add to a new
playlist, and a playlist's ⋮ offers Delete playlist or Delete playlist and its charts. A new chart
can go in no playlist. Verified: `tsc`/`eslint` (app, web, core, convex), `next build`, the dev push,
and on web signed out in nix Chromium (All charts, add to a 2nd playlist, delete a playlist keeping
its charts). **Not verified:** anything signed in (the new Convex functions) and the app on a phone.

