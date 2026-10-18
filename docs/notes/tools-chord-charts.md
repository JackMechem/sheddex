<!-- Moved word for word from the old single PROJECT.md (lines 4225–4870) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

- **Chord Charts** (`components/ChordCharts.tsx`, `components/ChordChart.tsx`,
  `lib/iRealPro.ts`) — paste an iReal Pro playlist link (the `irealb://...` links shared on the
  iReal Pro forums) and read its charts, styled to match the site. The link's chord data is
  scrambled/compressed in an undocumented way; `ireal-reader` (npm, MIT — the one non-audio
  runtime dependency in this repo) handles that part and splits the playlist into songs, but its
  own `measures` output _expands_ repeats/endings into one flattened, played-through list, which
  is right for playback but wrong for display. So `lib/iRealPro.ts` doesn't use that — it walks
  the same un-scrambled `raw` chart string itself (same token grammar: `*A` section letters,
  `{`/`}` repeat barlines, `N1`/`N2` endings, `<...>` directions like "D.C. al Coda", `XyQ` layout
  padding, a chord-token regex) to build a chart model that keeps the notation as written once,
  with repeat signs and ending brackets, instead of expanding it. Imported songs (title, composer,
  style, key, and the parsed bar list) persist in localStorage across playlists you paste in,
  de-duplicated by title/composer/key; "bars per row" is a display setting, not part of the parsed
  data. Verified by running the whole parser over a real ~1,460-song forum playlist (`node
--experimental-strip-types`, not committed) — no exceptions, no malformed chords, ~4.5MB of
  JSON for that whole playlist (comfortably under typical localStorage limits, but worth knowing
  if several large playlists get imported).
  **Every imported chart belongs to a playlist** (`lib/chordChartsLibrary.ts`'s `Library` type —
  `{songs, playlists}`, where a `Playlist` is just a name plus a list of song ids) — per a direct
  follow-up request, since the library used to be one flat list with no grouping at all. Pasting an
  iReal Pro link creates (or, re-pasting the same playlist later, merges into — matched
  case/whitespace-insensitively by name) a playlist named after that playlist's own name
  (`parseIrealPlaylist`'s `name`, e.g. "Real Book vol. 1"); importing from a Community chord-chart
  post (`CommunityChordCharts.tsx`) does the same under that post's title, whether it's "Import
  all" or a single song pulled out of a bigger post — either way it lands in a playlist named after
  the post, so charts from the same post end up grouped together rather than loose. One function,
  `mergeIntoLibrary`, is the single place this happens — both import paths call it, so there's
  exactly one playlist-assignment rule to reason about, not two that could drift. The "Tunes" panel
  shows playlists as collapsible sections (sorted alphabetically) instead of one flat list;
  expand/collapse state is plain ephemeral component state (not persisted — this is a "which
  section is open right now" UI convenience, not real settings data), and a playlist containing the
  currently selected song shows expanded by default with no explicit toggle needed, so picking a
  tune from the search popup always reveals where it lives. `resolvePlaylists` is what actually
  turns `Library` into what gets rendered — it resolves each playlist's song ids back into full
  song objects and, importantly, buckets any song that isn't in *any* playlist into a synthetic
  "Unsorted" playlist shown last. That bucket is what makes "every chart is in a playlist" true for
  a library saved *before* this feature existed too: `playlists` defaults to `[]` and
  `mergeWithDefaults` (`lib/usePersistedSettings.ts`) fills a missing field from the default rather
  than failing, so an old library with songs but no `playlists` field just loads with everything
  showing under "Unsorted" — no migration write needed, nothing to break if it's read on a device
  that hasn't picked up this change yet. Deleting a song removes it from `songs` and from whichever
  playlist(s) reference it (`removeSongFromLibrary`); a playlist left with no songs is dropped
  entirely rather than kept as an empty shell. Verified with a synthetic Node script
  (`mergeIntoLibrary` creating vs. merging into an existing playlist by name, a duplicate song
  correctly skipped in a *new* playlist too — not just the one it was already in, `resolvePlaylists`
  accounting for every song exactly once, the legacy-library-falls-into-Unsorted case, and
  deleting a song both from a solo playlist — which then disappears — and from a multi-song one,
  which doesn't) — not yet clicked through in a real browser (same "genuinely untested" caveat as
  everything else UI-shaped in this app — see that section).
  **Signed in, the library moved off `syncedSettings` onto its own dedicated tables** — the first
  real bug this app has hit from an actual user, not a sandbox-guessed risk: importing a large
  real iReal Pro playlist threw `Uncaught Error: Value is too large (4.62 MiB > maximum size 1
  MiB)` from `syncedSettings:set`, because the *whole* library (every song's full parsed bar list,
  all of it) was being written as one JSON blob in one Convex document, and Convex hard-caps a
  single document at 1 MiB. `lib/useChordChartsLibrary.ts` is the new single entry point both
  `ChordCharts.tsx` and `CommunityChordCharts.tsx` use instead of `useSyncedSettings`/
  `LIBRARY_KEY` directly: signed out, it's a thin, *unchanged* wrapper over
  `lib/chordChartsLibrary.ts`'s pure functions and the original `usePersistedSettings` blob (this
  bug is Convex-specific — localStorage has no equivalent per-key ceiling anywhere near this, so
  there was nothing to fix for a signed-out device); signed in, it's backed by three new Convex
  tables (`chordChartPlaylists`/`chordChartSongs`/`chordChartSongBars`, `convex/schema.ts`) instead
  of the generic blob mechanism, the same kind of exception `practiceSessions` and the Community
  post tables already are, just pushed one step further: a song's *metadata* (title/composer/
  style/key/time signature) is split into its own table from that same song's *bars*, so listing,
  searching or deduping a library (`convex/chordCharts.ts`'s `library`/`importSongs`) never has to
  touch `bars` at all, and `bars` is fetched only for whichever one song is actually
  displayed (`getSongBars`) or, for bundling several already-chosen songs into a Community post,
  in one bulk one-off call right before posting (`getSongsBars`, called via `useConvex().query`
  rather than a live `useQuery` subscription, since it's only ever needed once). The result: no
  single document's size grows with the size of the library, or even the size of one playlist —
  only with the size of *one song*, which in practice is nowhere near 1 MiB (the forum-playlist
  numbers cited above work out to roughly 3 KB/song on average). `migrateFromSyncedSettings` is a
  one-time, entirely server-side migration (never receives the old blob as a mutation argument —
  it's read from the database inside the mutation itself) for anyone who already had a library
  synced the old way before this fix landed, called once per sign-in from the new hook; it's
  provably safe from hitting the very limit it exists to work around, since the old blob could only
  ever have been successfully *written* in the first place if it was already under 1 MiB — the
  failure this fixes was always a rejected *write*, never a value that made it into storage
  oversized. Verified end to end against the real dev Convex deployment (not just `tsc`/
  `next build`): `npx convex dev --once` deploys the new schema/functions cleanly, and a plain
  Node script using `ConvexHttpClient` confirmed the deployed functions are correctly wired and
  behave as expected when called unauthenticated (`library` returns the empty shape rather than
  throwing, `importSongs` throws "Not signed in", `getSongsBars` returns `{}`) — this sandbox still
  can't authenticate as a real user to exercise an actual import end to end, so the one thing this
  *doesn't* prove is that a real "massive playlist" import now actually succeeds for Jack, only
  that the architecture that was silently guaranteed to fail no longer has that specific failure
  mode built into it.

  **Transpose** (per a direct follow-up request, "transpose any of the chord charts into a
  different key"): `lib/iRealPro.ts`'s `transposeSong(song, semitones)` is a pure function that
  returns a new `IRealSong` with every chord's root, slash bass, and the printed key label shifted
  by `semitones`, leaving the quality suffix (`-7`, `^7`, `sus4`, ...) untouched since none of that
  text is a note name. It wraps at the octave (`+13` behaves like `+1` — a chord symbol carries no
  octave of its own) and returns the exact same object, not a copy, for `semitones: 0`, so a call
  site can apply it unconditionally without a special case for "not transposed." Respelling uses a
  fixed table (`PREFER_FLAT`) rather than trying to preserve whatever accidentals the original
  chart happened to use: flats for every altered pitch class except F#, matching how real jazz
  lead books actually spell a transposed key (`Db7`, `Ebm7`, but `F#7` rather than `Gb7`) — getting
  this exactly right for every possible key would need genuine key-signature analysis this app
  doesn't do anywhere else, so it's a deliberate, documented approximation rather than a claim of
  always matching a real book's own spelling.

  This is purely a *display* transform, never written back into the library — the same
  "device-local display preference, not real tool data" category `ChordCharts.tsx`'s existing
  "bars per row" setting is in, just one step more ephemeral: the chosen key is plain `useState`
  (not even `usePersistedSettings`), and resets to "Original" whenever a different tune is
  selected, so a transpose left on from the last chart you looked at can never silently carry over
  and surprise you on the next one. Reset-on-selection-change is done as a render-time state
  adjustment (`if (selectedId !== lastSelectedId) { setLastSelectedId(selectedId);
  setTransposeKey(""); }`) rather than a `useEffect`, the pattern React's own docs recommend for
  "adjust state when a prop changes" — no extra render/flash, and no
  `react-hooks/set-state-in-effect` lint issue to route around (see `AccountMenu.tsx`'s own note
  elsewhere in this file for hitting that rule the effect-based way).

  The control itself is a **key dropdown** (`Select`, the same combobox every other picker in this
  app uses), not a +/- stepper — an explicit direct follow-up correcting an earlier version that
  used semitone-at-a-time −/+ buttons ("the key should be a drop down with all the keys and not a
  + - thing"). `lib/iRealPro.ts` exports `KEY_NAMES` (the 12 pitch classes' canonical names, same
  `PREFER_FLAT` spelling `transposeSong` itself uses — `C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B`)
  and `keyPitchClass(key)` (a chart's own printed key label's tonic pitch class, or `0`/C if the
  label doesn't parse). The "Display" panel's "Key" row offers "Original (<the chart's own key>)"
  plus all 12 names; picking one computes the semitone distance from the chart's *own* key to the
  chosen one (`(KEY_NAMES.indexOf(transposeKey) - keyPitchClass(selected.key) + 12) % 12`, always
  landing in 0-11 since `transposeSong` itself wraps at the octave) and feeds that into
  `transposeSong`. `ChordCharts.tsx` computes `displayed` from this once (`useMemo`) and passes
  `displayed`, not the library's own `selected`, into every `<ChordChart>` render — so the original
  song object in the library is never touched, only what's handed to the renderer for that one
  view. The earlier version also had a second, compact floating pill near the Maximize button for
  quick access without opening the Display panel; that was dropped rather than turned into a
  second dropdown, both because a full `Select` button (label text + chevron) is noticeably wider
  than the icon-only Maximize button it would have sat next to — a real collision risk against the
  chart's own left-aligned title at narrow widths that the old slim +/- pill didn't have — and
  because the dropdown already makes picking a specific key a single action, the main reason a
  quick-access shortcut existed for the old increment-by-one control in the first place.

  Verified with two synthetic Node scripts run directly against the real functions (not mocks).
  The first, against `transposeSong` alone: a real tokenized chart's `+0` returns the identical
  object; `+12` (a full octave) leaves every bar and the key completely unchanged; `+2` correctly
  shifts a chord's root and the printed key while leaving its quality suffix untouched; `-1` and
  `+1` land on the expected natural/flat-spelled names (`B`, `Db`); `+6` specifically lands on
  `F#`, not the enharmonic `Gb`, confirming the deliberate exception in `PREFER_FLAT`; a slash
  chord's bass note transposes correctly and stays a slash chord; and `-13` produces bar-for-bar
  identical output to `-1`, confirming the octave wrap. The second, against `KEY_NAMES`/
  `keyPitchClass` and the exact delta calculation `ChordCharts.tsx` now does: `KEY_NAMES` is the
  expected 12-entry list in order; `keyPitchClass` correctly reads `"C"`/`"Bb"`/`"F#-"` (a minor
  suffix doesn't throw off the tonic) and falls back to `0` for an empty or garbage key string
  rather than throwing; picking each of the 12 `KEY_NAMES` options from a chart in "Bb" computes a
  delta that lands `transposeSong` on exactly that target key, for all 12; and re-selecting the
  chart's own key (picking "Bb" from a chart already in "Bb") is a true no-op — the identical
  object back, not just equivalent content. `tsc`, `eslint`, and `next build` all pass. **Not
  verified**: how the transposed chart actually looks rendered (whether `Db`/`F#` etc. read
  clearly through `ChordLabel`'s existing accidental glyphs, which were only ever exercised
  against an original chart's own accidentals before now) or whether the dropdown itself opens/
  positions sensibly from inside the "Display" panel in a real browser — this sandbox still has no
  working browser, same caveat as everything else UI-shaped in Chord Charts.

  **sheddex's own chart-link format, and a from-scratch chart builder** (per a direct request:
  "make a custom way of representing chord charts in a string kinda like the irealpro links... if
  I paste an ireal pro playlist link into there it should still worki but I dont want it to say
  anywhere that you can do that... create a tool within the chord chart page to create chord
  charts"). Three pieces:
  - `lib/chartString.ts` — `encodeChartString`/`decodeChartString`, a `sheddex://<base64 JSON>`
    string encoding the exact same `IRealPlaylist`/`IRealSong`/`Bar` shape this app already parses
    an iReal chart into, rather than inventing a second token grammar to mimic iReal's own scrambled
    encoding — "kinda like the irealpro links" in that it's one opaque, copy-pasteable string, not
    in how it's actually encoded underneath. UTF-8-safe via `TextEncoder`/`TextDecoder` +
    `btoa`/`atob` (not the deprecated `escape`/`unescape` trick), so a title/composer with accented
    characters round-trips correctly. `decodeChartString` is tolerant of a malformed individual
    song the same way `lib/profileTunes.ts`'s `resolvePublicTunes` already is — a bad entry is
    dropped (missing/wrong-typed fields fall back to sane defaults, e.g. a missing time signature
    becomes 4/4) rather than failing the whole import — and its own error message is deliberately
    generic, never naming iReal Pro, since it's the message a normal user actually sees.
  - **"Import a playlist" now reads this format first** (`ChordCharts.tsx`'s `parsePlaylistInput`):
    `looksLikeChartString` checks for the `sheddex://` prefix, and only if that doesn't match does
    it fall through to the *existing*, completely unmodified `parseIrealPlaylist` — a real iReal
    Pro link genuinely still works, exactly as before, but that fallback is now quiet on purpose:
    the panel's hint text, its textarea placeholder, and the generic catch-all error shown when
    *neither* parser recognizes the input were all rewritten to never mention iReal Pro or
    `irealb://` anywhere a user can see them (grepped the whole user-visible surface for both
    strings afterward to check for a leak, not just the obvious spots — caught and fixed one real
    one this way: `components/tools.tsx`'s `NAV_LINKS` description for this tool, "Import iReal Pro
    playlists...", shown in the sidebar/command palette, had the exact same problem and wasn't
    something a first pass over just `ChordCharts.tsx` would have caught). Code comments inside
    `lib/iRealPro.ts`/`ChordChart.tsx` explaining *why* the parser/renderer work the way they do
    still reference iReal Pro by name, deliberately — that's maintainer-facing, not the user-facing
    surface the request was actually about.
  - **`ChordChartEditor.tsx`** — the new "Create a chord chart" panel's modal, a from-scratch
    builder reached from its own button next to "Import a playlist." Deliberately scoped down from
    everything a pasted iReal chart can represent — no repeats, numbered endings, sections, or
    directives, just a flat ordered list of bars — per the request's own "doesn't need to be crazy
    right now... no need to make it perfect as long as the functionality is there." Metadata
    (title/composer/style/key/time signature) are plain fields; each bar is typed as one line of
    plain text in the *exact* iReal-style shorthand this app already uses everywhere else
    ("`C^7`", "`F-7`", "`Bb7#5/D`", "`NC`" for no chord, space-separated for more than one chord in
    a bar) — reusing the notation rather than building a second, structured per-field chord picker,
    so there's exactly one chord grammar in this app to learn, not two. Two new exports in
    `lib/iRealPro.ts` make this possible: `parseChordToken` (one token -> a `ChordSlot`, reusing
    the same `CHORD_RE`/`splitMain` `tokenizeChart` itself already uses, just applied to a
    standalone token instead of a parsing stream, with a `normalizeChordToken` uppercase-the-letter
    convenience for hand-typed input a pasted chart never needed) and `parseBarSlots` (one bar's
    space-separated tokens -> that bar's slots, silently dropping an unrecognized token rather than
    failing the whole bar, so one typo doesn't erase everything else already typed in that bar). A
    live preview renders the chart being built through the *same* `ChordChart` component every
    other chart in this tool uses — not a separate approximation of it — which doubles as the only
    validation feedback: a typo just doesn't show up as a chord in the preview, rather than a
    separate per-token error message. Two ways a built chart leaves the modal, both reachable from
    its footer: **Save to library** (calls the same `importSongs` "Import a playlist" itself uses,
    in a playlist named after the chart's own title — "every chart is in a playlist" holds the same
    way here as for anything else added to the library) and **Export as chart link** (reveals the
    `sheddex://` string in a read-only textarea with a Copy button, `navigator.clipboard.writeText`
    with no fallback — this app's first use of the Clipboard API, and a genuine platform-only
    choice: if permission is denied or the API's unavailable, the text is still visible and
    selectable by hand in the textarea, so there's no dead end, just a smaller convenience lost).
    Both require a non-empty title first (an inline error message, same shape as every other
    required-field validation already in this app, e.g. Community's own "Give this post a title.").

  Verified with two synthetic Node scripts run directly against the real functions (not mocks).
  The first, against `parseChordToken`/`parseBarSlots`: `"C^7"` and lowercase `"c^7"` both parse to
  the identical chord (confirming the uppercase normalization); `"Bb7#5/D"` correctly splits into
  root/accidental/quality/bass; `"NC"`/`"nc"` both parse as no-chord; a bare `"W7"` (iReal's own
  mid-chart "repeat the last chord" marker, meaningless with no previous-chord context here) is
  correctly rejected rather than silently becoming a chord with an invalid `"W"` root; garbage
  input returns `null` rather than throwing; and a bad token in the middle of a multi-chord bar is
  dropped while the good tokens on either side survive. The second, against
  `encodeChartString`/`decodeChartString`: a full song (multiple bars, a two-chord bar, a blank
  bar, accented-safe title/composer/key) round-trips through encode-then-decode byte-for-byte
  identical to the original; `looksLikeChartString` correctly recognizes the app's own output and
  correctly rejects both a real iReal-style `irealb://` string and arbitrary plain text (confirming
  the two formats stay genuinely distinguishable, not just informally); a non-matching string
  throws an error that was checked, by regex, to never contain the word "ireal" anywhere in its
  message; garbage base64 after a valid `sheddex://` prefix throws instead of crashing; and a
  payload with one well-formed song alongside a titleless object and a bare number correctly keeps
  only the one valid song, with its missing time signature defaulting to 4/4 rather than throwing.
  `tsc`, `eslint`, and `next build` all pass. **Not verified**: that a real iReal Pro link *itself*
  still parses successfully through the now-wrapped fallback path — `parseIrealPlaylist`'s own
  internals are completely untouched by this change (only wrapped in a try/catch one level up), and
  that function was already extensively verified against a real ~1,460-song forum playlist in an
  earlier session (see this tool's own bullet above), so there's no new risk introduced here
  specifically — but this sandbox has no real iReal Pro link on hand to re-run that exact check
  against after the wrapping. Also unverified, the same way everything else in this tool is:
  whether the Copy button's clipboard permission prompt (if a browser shows one) interrupts the
  flow at all, and whether typing chord shorthand by hand feels as easy as the request asked for —
  "as easy to understand as possible" is a UX claim this sandbox has no way to confirm by actually
  using the tool. (`ChordChartEditor`'s original bar-list/live-preview layout described here was
  superseded by the inline-on-the-chart redesign below, two direct follow-ups later.)

  **Layout fix** (a direct follow-up with a screenshot: "not so much space between the options and
  the chart... so like the other pages where everything is in a column in the center"): the options
  sidebar + chart row's own wrapper div had `xl:min-h-[calc(100vh-10rem)] xl:items-center` and no
  width cap — forcing the row to nearly the full viewport height and then vertically centering both
  columns inside it, which is what actually produced the huge gap above everything (the options
  column's real content height is nowhere near that forced minimum), not anything about
  `ToolLayout`'s own `topAligned` prop (already `true` here, and working correctly one level out).
  The uncapped width compounded it horizontally too: `ChordChart.tsx`'s own root div already caps
  and centers the rendered chart at `max-w-2xl` (a deliberate, unrelated design choice, left alone)
  within whatever box it's given, so with no cap on the *row* itself, that box stretched to the
  full remaining viewport width on a wide monitor and centered the chart far right of the
  left-hugging sidebar — exactly the dead space in the screenshot. Fixed by dropping the forced
  min-height and `items-center` (now `xl:items-start`, both columns just take their own natural
  height) and adding `mx-auto max-w-5xl` to the row — the same width split-layout tool pages
  already use for their own two-region (options + content, no side panel) case, `ToolLayout.tsx`'s
  own `xl:max-w-5xl` — so this now matches "the other pages" literally, the same number, not just a
  similar-looking one. Not a restructure into a single vertical column
  the way `layout="stacked"`'s own built-in options-below-content shape works for Slow Downer/
  Recorder (which this tool's custom Tunes/Import/Create/Display sidebar never actually used in
  the first place — `ChordCharts.tsx` passes `options={null}` to `ToolLayout` and builds its own
  layout entirely inside `children`) — the sidebar-beside-chart arrangement itself wasn't what was
  reported as broken, just the space around it, so that's the only thing this touched. `tsc`,
  `eslint`, and `next build` all pass. **Not verified**: how much of the gap this actually closes
  once seen rendered — the reasoning above is sound (traced both the vertical and horizontal cause
  to specific classes, not guessed), but this sandbox still can't render the page to confirm it
  matches what "like the other pages" was actually asking for.

  **The builder redesigned to type directly on the chart, plus a shared symbol keypad** (a direct
  follow-up: "make it so the chart builder is like when you maximise a chart and it lets you type
  directly on the chart with an add bar button on the right of the last bar... make a little
  keypad like the one on sibelius... for all the symbols"). The original version's separate
  bar-list-on-the-left / `ChordChart`-preview-on-the-right split is gone; bars now live in one grid
  built from `ChordChart.tsx`'s own exports (`COL_WIDTH`, `BAR_HEIGHT`, `chordFont`, `ChordLabel`,
  `FitChordRow`, `TimeSignatureGlyph` — all newly `export`ed, previously private to that file) so
  the editor *is* the chart, not a second approximation of one styled to look similar. Each bar
  (`BarCellEditor`) is one of two things: **not** the active bar, it renders its parsed chords
  through the exact same `ChordLabel`/`FitChordRow` the real chart uses (a faint centered dot if
  still blank); **is** the active bar, it's a plain-text `<input>` showing the raw typed shorthand
  instead — deliberately not auto-converting `^`/`h`/`o`/`#`/`b` into their pretty glyphs live
  while typing, which would fight the text cursor mid-keystroke (the same reasoning Guess the
  Chord's own answer field already settled on, now shared). There's always exactly one active bar
  (`activeIndex`, never `null` — a text-cursor-like "there's always a current position" model, not
  a nullable "maybe nothing's selected" one), which is also where the keypad inserts. Clicking a
  different bar, or pressing Enter, moves it: Enter in the *last* bar adds a new one and jumps
  straight into it (satisfying "an add bar button on the right of the last bar" — that button
  still exists, as a plain `+` sitting in the same flex-wrap row immediately after the last bar
  cell, but Enter is the faster path once you're already typing) — in any other bar, Enter just
  steps to the next one, so typing a whole chart can stay a straight "type, Enter, type, Enter..."
  line. Escape inside a bar's input deliberately `stopPropagation`s rather than bubbling up to this
  modal's own Escape-closes-everything handler — it only blurs that one bar, since losing an entire
  typed-out chart because Escape was meant to back out of one bar would be a bad trade the metadata
  fields above don't have to worry about (a stray Escape there closing the whole modal is
  unchanged, and fine — losing an empty Title field is a much smaller loss). Focusing the
  DOM `<input>` after `activeIndex` changes (adding a bar, or clicking a different one) can't
  happen in the same tick that sets it — the input doesn't exist yet, since the *previous* active
  bar is still the one rendered as an input until the next render commits — so a `focusIndexRef`
  plus a `useEffect` watching `[activeIndex, bars.length]` focuses it exactly once the render
  reflecting the change has actually happened — the same "the DOM doesn't have this yet the same
  tick `setState` was called" timing problem the keypad's own cursor-insertion (below) runs into
  for the identical reason, just solved with a `useEffect` here instead of a bare
  `requestAnimationFrame`, since this one has to wait for a full re-render (a different element
  appearing) rather than just a value settling inside an element that already exists.

  **`components/ChordSymbolKeypad.tsx`** is new, pulled out of Guess the Chord rather than built a
  second time: that trainer already had exactly this — a small grid of buttons for `-`/`^`/`o`/`h`/
  `+`/`#`/`b`/`/`/`sus`/`add`, each showing its `prettyQuality`-formatted glyph as the button face
  and inserting the plain iReal text at the field's current cursor position — per the request
  naming Sibelius's own on-screen keypad as the visual reference, now laid out as a fixed
  `grid-cols-5` (a deliberate small palette, not a loosely wrapping button cloud, closer to what a
  real keypad panel looks like) instead of the `flex flex-wrap` it used before. The component
  itself is purely presentational (`onInsert(key.insert)`, one callback) — *where* the text actually
  gets inserted is each caller's own job, since that differs: Guess the Chord always targets its
  one answer field, the chart builder targets whichever bar is currently active, and the underlying
  "insert at cursor position, wait a frame since the DOM `<input>` doesn't have the new value yet
  the same tick `setState` is called, then restore the caret right after it" logic is otherwise
  identical in both, copied from Guess the Chord's own already-working `insertSymbol` rather than
  reinvented. Extracting this shrank `GuessTheChord.tsx` enough that two pre-existing
  `eslint-disable-next-line react-hooks/purity` comments (documented elsewhere in this file, on
  `lockInRound`/`start` — the React Compiler's lint integration bails out of analyzing a
  large/complex component before it would reach that `performance.now()` call, the same false
  positive Guess the Interval's identical pattern still gets flagged for) became genuinely unused
  — `eslint` said so directly (`Unused eslint-disable directive`), not guessed — and were removed;
  Guess the Interval's own pair, in its own separate, still-large file, are untouched and still
  needed.

  A real correctness bug was caught in self-review (not by any tooling — this is plain JS logic
  `tsc`/`eslint` have no way to reason about) and fixed before this ever got used: `removeBar`
  originally just clamped `activeIndex` to the new bar count after a deletion
  (`Math.min(activeIndex, next.length - 1)`), which is right when the removed bar came *after* the
  active one but silently wrong when it came *before* — every later bar's index shifts down by one
  when an earlier bar is deleted, so a plain clamp leaves `activeIndex` pointing at the bar that
  now happens to sit at that old number, not the bar that was actually being edited (e.g. bars
  `[A,B,C,D]` with `C` active, deleting `A`, would silently leave `D` marked active instead of `C`
  tracking its new position). Fixed to shift `activeIndex` down by one specifically when the
  removed bar's index was less than it, verified with a small synthetic script checking all four
  relative orderings (removed-before-active, removed-after, removing the active bar itself, and
  the down-to-one-bar edge case) plus the existing clamp — all five pass.

  Verified: `tsc`, `eslint` (including confirming zero new warnings, and that the two now-stale
  `eslint-disable` comments were safe to remove rather than masking a real regression), and
  `next build` all pass; `git diff --stat` confirms `GuessTheChord.tsx` only shrank (its own
  keypad array and JSX replaced by one `<ChordSymbolKeypad>` call) rather than having any of its
  actual answer-grading logic touched. (The "two-column bar grid / live preview reads through
  `ChordLabel`/`FitChordRow` at natural unscaled size" description here was itself superseded by
  the next round below — see that one for the current design.)

  **Full page, sections, repeat barlines, codas, and genuine 4-bars-per-row** (a direct follow-up:
  "the create chord chart should not be a popup, it should take up the entire chord charts view...
  make it so I can have different sections (A, B, intro, Verse, etc...)... repeats... 4 bars per
  line just like how the regular charts show... I need to be able to put codas in"). Four changes,
  one underlying architectural decision:
  - **Not a popup.** `ChordCharts.tsx` now has an early `if (showEditor) return <ToolLayout...>
    <ChordChartEditor .../></ToolLayout>` branch that replaces its entire normal content area
    (Tunes/Import/Create/Display + the selected chart) with the builder, full width, rather than
    layering a `fixed inset-0` modal over it. `ChordChartEditor` itself lost its backdrop/panel
    shell entirely — it's now a plain in-page section.
  - **Sections, repeat barlines, and codas** — `Bar.section`/`startRepeat`/`endRepeat`/`coda` were
    always part of `lib/iRealPro.ts`'s own type (every pasted iReal chart can already carry them),
    just nothing in this app could ever *write* them before now. Each `EditableBar` in the builder
    gained those four fields (plus `isRepeatBar` for the "%" repeat-previous-bar mark — added
    alongside repeat barlines since the request named "repeats" twice, plausibly meaning both the
    `:‖` barline kind and the `%` mark, and both were equally cheap to add once the data model
    already supported them) and a small "Bar N" toolbar beneath the grid, bound to whichever bar
    is currently active, with a Section text field and toggle buttons for the rest — not per-cell
    controls, since there's no room for five extra toggles inside a single `COL_WIDTH`-wide cell.
    `toRealBar(eb)` converts one `EditableBar` into the exact same `Bar` shape a parsed iReal chart
    already produces; setting a `section` also sets `newRow: true`, the same thing a real `*A`/`*B`
    section token forces during parsing, so a new section always starts a fresh row here too.
  - **Genuine 4-bars-per-row, "just like the regular charts show."** The builder's bar grid used
    to be a loosely wrapping `flex flex-wrap` row (reflowing however many bars fit the available
    width); it's now built from `ChordChart.tsx`'s own `groupRows`/`Row`/`BarCell`/`BarContent` —
    the *exact* components the real chart renders with — reused wholesale rather than a second
    approximation of them, via two small, backward-compatible additions those take only when a
    caller actually passes them (`ChordChart.tsx`'s own top-level component never does, so its own
    rendering is completely unaffected): `Row` gained an optional `renderBarContent?: (bar, i) =>
    ReactNode` (override what's drawn *inside* one specific bar — the builder's "this bar is being
    typed into right now, show an `<input>` instead" case) and `trailing?: ReactNode` (one more
    raw grid item appended after a row's own bars — the builder's "Add bar" button, placed in
    whatever grid column is actually left over after the last bar, only ever passed for the real
    last row); `BarCell` gained a matching `content?: ReactNode` prop (`content ?? <BarContent
    bar={bar} />`). The practical effect: sections, repeat-barline dots, the coda symbol, and the
    time signature on bar 1 now all render through the *same* code that draws a real chart, not a
    hand-rebuilt approximation of each — reusing `BarContent` specifically (now exported) also
    means a bar's "%" repeat-mark Just Works with zero special-casing in the builder itself, since
    `BarContent` already handles `content.kind === "repeat"` on its own. `ChordLabel`/
    `FitChordRow`/`TimeSignatureGlyph` had briefly been exported for the *previous* round's own
    (now-replaced) grid — reverted back to private once nothing outside `ChordChart.tsx` needed
    them directly anymore, confirmed by grepping for every usage first rather than assuming;
    `REPEAT_SIZE`/`SYMBOL_SIZE`/`BADGE_SIZE` got the same treatment after briefly being exported
    "just in case" during this round and turning out unused too — same `grep` check both times,
    not guessed.

  The "Add bar" button still sits immediately after the last bar when that row has room for it
  (an explicit grid item at `gridColumn: lastRowBars.length + 1`, via `trailing`); when the last
  row is already full (exactly a multiple of 4 bars), it falls back to a plain button below the
  whole grid instead, since there's no column left to put it in.

  A real correctness bug was caught in review and fixed before use, the same way the previous
  round's `removeBar` one was: toggling the new "Repeat bar (%)" option on had also been set to
  `disable` the active bar's `<input>` — which, being a disabled `<input>`, silently stops
  receiving *any* keyboard events at all, including the Enter-to-advance-to-the-next-bar flow this
  tool otherwise relies on as its main way to move through a chart quickly. Fixed by leaving the
  input enabled (just visually dimmed, with a placeholder noting the typed text is ignored while
  "%" is on) rather than disabling it — `toRealBar` already prioritizes `isRepeatBar` over
  whatever's typed, so nothing is lost functionally by leaving it editable, and keyboard
  navigation keeps working. A React Compiler lint error was also hit and fixed in the same pass
  (`react-hooks/immutability`'s "Cannot reassign variable after render completes," on a `let
  rowStart` being mutated across a `.map()` to compute each row's global starting bar index) —
  rewritten as a pure `reduce` instead, verified against a synthetic script (run against
  `groupRows` itself, copied verbatim rather than imported, since that file can't be loaded
  standalone outside Next/React) checking four cases: a plain 6-bar chart splitting into rows of
  4 and 2 with the right starting offsets; a section set mid-row correctly forcing an early break
  and landing the section label on the right bar; an exactly-4-bar chart correctly *not* having
  room for the add-button in its own row; and a 5-bar chart correctly having room for it in the
  second row.

  Verified: `tsc`, `eslint` (zero warnings, including the compiler-lint fix above), and
  `next build` all pass; the row-grouping/offset math is confirmed correct by the synthetic script
  above. **Not verified**, the same as everything else in this tool's UI: whether building a chart
  with sections/repeats/codas, saving it, and seeing it rendered back through the real
  (non-editable) `ChordChart` actually looks right end to end — this sandbox still has no way to
  click through any of it, and that round-trip specifically (builder → saved song → real chart
  render) has never been seen, only reasoned through from both sides independently each rendering
  the same `Bar` shape correctly on their own.

  **Fill width** (a direct follow-up with a screenshot: the grid sat at its small natural size,
  left-aligned, with a wide empty gap to its right). Deliberate at the time — the previous round's
  own comment on this grid said it "doesn't run through `PageFit`'s scale-to-fit... so it can stay
  a stable, always-editable size" — but that traded away matching how the real chart actually
  looks, which is what "4 bars per line just like how the regular charts show" (the *previous*
  request) was already asking for. Fixed by wrapping the grid in `PageFit` itself
  (newly exported, `fitHeight={false}` — the exact same mode the normal, non-maximized `ChordChart`
  view already uses to fill its own container's width), rather than leaving it at natural
  `COL_WIDTH`-per-bar size. The "stays stable while typing" concern turned out not to be a real
  tradeoff: every bar cell is the same fixed natural size regardless of whether it's currently
  showing an `<input>` or rendered chord symbols, so the grid's *natural* width never changes as
  `activeIndex` changes — meaning the computed scale factor doesn't change either, so there's no
  jarring re-scale when clicking between bars, exactly as hoped going in rather than something
  separately verified. The "Add bar" fallback button (the one shown below the grid when the last
  row is already full) stays *outside* `PageFit`'s scaled box, as a plain sibling — same reasoning
  as the real chart keeping its own Maximize button outside the scaled area, so it stays one
  consistent, clickable size regardless of how much the chart itself is scaled up or down. `tsc`,
  `eslint`, and `next build` all pass. **Not verified**: whether a `transform: scale()`'d `<input>`
  genuinely behaves correctly for typing/clicking/cursor placement in a real browser — CSS
  transforms are supposed to leave hit-testing and focus entirely alone (the browser maps click
  coordinates through the transform matrix on its own, standard behavior, not something special
  being relied on here), but "supposed to" isn't "confirmed," and this sandbox has no way to
  actually click into a scaled input and find out.

  **Centering, the section badge, and one combined toolbar** (a direct follow-up with a
  screenshot): three separate fixes.
  - **Centering.** The previous round's `PageFit` fix made the grid *fill* the available width up
    to `MAX_SCALE`, but never addressed what happens once that cap is actually hit — `PageFit`'s
    `fitHeight={false}` content was still `left: 0`-anchored, so a scale capped below "fill the
    whole box" left it flush left with the leftover space stranded on the right, exactly the
    screenshot. Fixed by switching to `left-1/2` + `transform: translateX(-50%) scale(s)` — not a
    new technique, the *exact* same `left-1/2` + `translate(-50%, -50%) scale(s)` composition
    `fitHeight={true}` already uses one branch up, just without the vertical half. Considered (and
    rejected) switching `contentRef` out of `position: absolute` entirely in favor of ordinary flex
    centering, which would have been simpler to reason about — but that div being `absolute` is
    exactly what lets `fitHeight={false}` report an *explicit*, JS-computed height back onto its
    own box in the first place (`contentHeight` state); a non-absolute child would hand layout back
    to the browser, which sizes against the *unscaled* natural height, not the scaled one — wrong
    in both directions (too tall if shrinking, clipped if growing). Kept `absolute`, fixed only the
    anchor.
  - **The section badge.** The real chart's own section-badge CSS (`BarCell`, unchanged since this
    badge was built for single-letter `*A`/`*B` markers off a real iReal chart, which is all it
    ever had to render before free-text sections existed anywhere in this app) was a fixed
    `1.7em × 1.7em` square — exactly wide enough for one character, not "Intro." Typing a real word
    into it rendered truncated/overlapping text, the screenshot's "ntro." Fixed by dropping the
    fixed `width` in favor of `min-w-[1.6em]` + horizontal padding + `whitespace-nowrap`, so it
    still reads as a small square badge for a single letter but genuinely grows to fit a longer
    word instead of clipping it. This is a `BarCell` fix, not an editor-only one — it benefits a
    real pasted iReal chart too, if one of those ever has a longer section name, not just charts
    built here.
  - **One combined toolbar, and typing the section name on the chart itself.** The Bar-N toolbar
    (section/repeat/coda) and the chord-symbol keypad used to be two separate boxes; they're now
    one `bg-surface` panel, per "put all the things... all in the section with the chord
    qualit[ies]." Separately, the toolbar's own free-text "Section" field is gone — replaced by a
    single "Add section" / "Remove section" toggle, per "there's just a button to add section
    title and you type where the section title actually is in the chart." Typing itself now
    happens via a *third* optional addition `Row`/`BarCell` take only for this editor
    (`renderSection`, alongside the existing `renderBarContent`/`trailing`): when the active bar
    has a section, an `<input>` replaces the plain badge *in the badge's own on-chart position*
    rather than in a disconnected form field — the same "type directly on the chart" principle this
    whole tool is built around, now extended to section names. A new `hasSection: boolean` field on
    `EditableBar`, kept separate from the `section` text itself, is what actually makes this work:
    clicking "Add section" sets `hasSection: true` *immediately*, forcing the row break
    (`toRealBar`'s `newRow`) before a single character has been typed — without that, the bar
    wouldn't yet be the first bar of its own row, and the inline input (which, like the real badge,
    only ever renders on a row's first bar) would have nowhere correct to appear the instant it's
    added. Leaving the inline input blank and clicking elsewhere (its own `onBlur`) auto-reverts
    `hasSection` back to `false` instead of leaving a label-less, invisible row break behind.
    Enter/Escape in the section input confirm-and-blur rather than bubbling up to the builder's own
    Escape-closes-everything handler, the same reasoning as the chord input's own Escape handling.

  Verified with a synthetic script (run against `toRealBar`/`groupRows`, both copied verbatim
  rather than imported, same reason as every other test in this file that touches `ChordChart.tsx`)
  confirming the specific behavior the whole section-editing design depends on: setting
  `hasSection` with still-empty text forces the row break immediately, not just once text exists;
  typing a label afterward doesn't change the row shape, only the text; "Remove section" fully
  clears both fields (not just blanking the text) and merges the row back into the normal 4-per-row
  flow; and a section set on bar 0 specifically doesn't fragment the first row (nothing precedes it
  to break from), matching how a real chart's own first bar already behaves. `tsc`, `eslint`, and
  `next build` all pass. **Not verified**: how any of this actually looks and feels in a real
  browser, same as this entire tool — in particular, whether the inline section `<input>`'s
  deliberately small, badge-matching size is usable for actually typing into on a touchscreen, and
  whether the auto-focus-on-add / auto-cancel-on-empty-blur sequence feels natural rather than
  surprising when actually clicked through.

  **Two more fixes from the same follow-up round, caught against an actual screenshot**: the
  inline section `<input>` added above still had a *fixed* `w-16` width left over from an earlier
  draft, unlike the read-only badge's own `min-w-[1.6em]` auto-sizing right next to it — rendering
  as a conspicuously wide, mostly-empty orange pill for anything shorter than "Intro" (a single
  letter "F," the actual screenshot). Fixed by dropping the fixed width for the HTML `size`
  attribute (character-count-based intrinsic sizing, not a CSS width) plus the same `min-w-[1.6em]`
  the badge already uses, so it now genuinely grows with what's typed instead of a flat pill.
  Separately: Start repeat/End repeat had no glyph preview at all (just a plain text label), unlike
  Coda and "%" right next to them — and per the request, all four should look like the keypad's own
  glyph-on-top/caption-below keys, not the plain text pill they'd been styled as. Found the actual
  SMuFL glyphs for this — `repeatLeft` (U+E040) and `repeatRight` (U+E041), real engraved
  start/end repeat-barline marks, not a text stand-in — confirmed present in the bundled
  `Petaluma.otf` (`opentype.js` against the real font file, the same verification method used for
  every other SMuFL glyph this app relies on, not assumed from the spec alone) before using them.
  `BarToggle` now branches on whether a `glyph` was passed: with one (all four repeat/coda/%
  toggles), it renders the same stacked glyph-on-top/caption-below shape
  `ChordSymbolKeypad`'s own keys use; without one ("Add/Remove section," which has no symbol of
  its own to show), it stays the plain text-only pill. `tsc`, `eslint`, and `next build` all pass;
  the two new codepoint constants were confirmed to actually decode to U+E040/U+E041 via a direct
  script reading the real file bytes, not just assumed correct from how they were typed. **Not
  verified**: how the resized section input and the four restyled toggle buttons actually look
  once rendered — this sandbox still has no way to see either.

  **The glyph-toggle restyle made things worse, not better** (a direct follow-up with two
  screenshots: "this section just looks bad and is bad UX... also theres too much padding on the
  right of the section title"). Two real defects, both from the previous round:
  - `BarToggle` had branched into *two different button shapes* depending on whether a `glyph` was
    passed — "Add/Remove section" stayed the original single-line pill, while Start/End
    repeat/Coda/"%" became a taller, two-line "keypad key" shape (glyph stacked above a caption).
    Side by side in the same row, that's a visibly mismatched set of buttons at two different
    heights, not a redesign so much as an inconsistency the earlier change introduced — exactly
    what got called out. Fixed by collapsing back to *one* shape for every toggle: a single-line
    pill with an optional glyph beside the label, never above it — `BarToggle` no longer branches
    on `glyph` at all. A thin vertical divider was also added between the section toggle and the
    four repeat/coda/% toggles, grouping the row into two legible clusters instead of one
    undifferentiated line of five buttons.
  - The inline section `<input>`'s width was still being driven by the HTML `size` attribute
    (added two rounds ago to replace an even-worse fixed `w-16`) — `size` is only ever a rough,
    historically-per-browser approximation (based on several "0"-character widths plus its own
    baked-in slack), nowhere near tight enough, which is exactly what the second screenshot showed
    as visibly extra accent-colored background trailing a single-letter "A". Replaced with an
    explicit `width: calc(Nch + 1rem)` computed directly from the typed text's own length — `ch`
    units size against the current font's actual "0" character width, a real CSS sizing mechanism
    rather than an attribute with implementation-defined slack, and the `+ 1rem` accounts for the
    `px-1` padding on each side plus a little room for bold glyphs that render wider than a plain
    "0" — considerably tighter than before without working through actual rendered measurements
    this sandbox has no way to take.

  `tsc`, `eslint`, and `next build` all pass. **Not verified**, same as every visual change in this
  tool: whether the single consistent pill shape and the divider actually read as a coherent,
  well-designed row once seen, and whether the `ch`-based width calculation lands as tightly as
  intended across real fonts/browsers rather than just being *less wrong* than `size` was — this
  sandbox still can't render either to check.

  **Reversed again, this time toward the keypad's own look specifically** — a direct follow-up:
  "start repeat, end repeat, coda, and repeat bar should be styled exactly like the accidentals in
  the keypad are styled." `BarToggle`'s glyph case went back to `ChordSymbolKeypad`'s stacked
  glyph-over-caption shape — but copied from the keypad's *actual* classes this time
  (`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5`, glyph `text-base font-semibold
  leading-none`, caption `text-[0.6rem] leading-none`), not reconstructed from memory of what the
  earlier (reverted) attempt looked like, so it should now match precisely rather than
  approximately. One deliberate, noted deviation: the keypad's own keys are one-shot "insert"
  actions with no state of their own, so their caption is always `text-muted`; these four are real
  on/off toggles, and that grey reads poorly against the accent-colored background an active
  toggle gets — checked the actual `--muted`/`--accent` color values in `app/globals.css` rather
  than guessing, in both light and dark mode — so the caption only stays `text-muted` while off,
  switching to the button's own `text-accent-foreground` once on. "Add/Remove section" is
  untouched (no glyph of its own, and the request named the other four specifically) — back to
  being visually a different shape from its four neighbors in the same row, which is exactly what
  the *previous* round's fix had tried to avoid; left as-is anyway, since this request is explicit
  about wanting the keypad's exact look for those four specifically, not uniformity across the
  whole row as its own goal. `tsc`, `eslint`, and `next build` all pass. **Not verified**: whether
  this now genuinely looks identical to the keypad below it, or whether "Add/Remove section"
  sitting at a different height next to it reads as awkward again once actually seen — this
  sandbox still has no way to render either.

  **The repeat glyphs themselves turned out too tall for that size** — confirmed directly, with a
  screenshot: `repeatLeft`/`repeatRight` (Start/End repeat's own SMuFL glyphs — real, full-height
  barline-and-dots marks, unlike the keypad's own compact `prettyQuality` glyphs) visibly
  overflowed the button's rounded-rectangle outline at the same `text-base` size those use. Per
  explicit direction, fixed by adding more vertical padding (`py-1.5` → `py-2.5`) rather than
  shrinking the glyph — applied to all four buttons in the row (Start/End repeat, Coda, "%"), not
  just the two repeat ones, so the row stays one consistent button size rather than three short
  buttons next to two taller ones. `tsc`, `eslint`, and `next build` all pass. **Not verified**:
  whether `py-2.5` is actually *enough* extra room for these particular glyphs' real rendered
  bounds, or whether Coda/"%" (which didn't have this problem) now just look slightly
  over-padded relative to their own, more modestly-sized glyphs — this sandbox still can't render
  any of it to check either way.

  **Padding alone didn't fix it — the glyph itself was the wrong one** (reported directly: "repeat
  symbols still over flow"). Checked what the previous round only assumed: `repeatLeft`/
  `repeatRight`'s actual bounding box in the bundled font (`opentype.js` against the real file, not
  guessed), and they're ~2.5x a normal glyph's height — SMuFL draws them to span most of a 5-line
  music staff, a full engraved barline, not something meant to sit inside a small UI button at any
  amount of padding. Fixed properly this time by switching glyphs entirely rather than padding
  around the wrong one: `leftRepeatSmall`/`rightRepeatSmall` (U+E04C/U+E04D) are SMuFL's own
  purpose-built compact variants, explicitly for "repeat sign within bar" use — confirmed at
  roughly normal text-glyph proportions (comparable to the "%" toggle's own `repeat1Bar`, which
  never had this problem) before switching, the same way every SMuFL glyph choice in this app has
  been checked against the real font rather than assumed from the spec's glyph name alone. With the
  actual cause fixed, the padding compensation from the previous round was reverted
  (`py-2.5` → `py-1.5`, matching `ChordSymbolKeypad`'s own keys exactly again) — it was only ever
  papering over the wrong glyph, not something these buttons needed on their own merits.
  `tsc`/`eslint`/`next build` all pass, and the two new codepoints were confirmed to actually
  decode to U+E04C/U+E04D via a direct script reading the real file bytes, the same check applied
  to every codepoint constant added this session. **Not verified**: whether these are now
  genuinely the right visual size next to Coda/"%"'s own glyphs, or whether a glyph swap this
  sandbox can reason about only through bounding-box numbers actually reads correctly once seen —
  numbers matching expectations is not the same as an eye confirming it.

  **The metrics were fine; the glyph itself still didn't read as a repeat sign** (reported
  directly, with a screenshot — `leftRepeatSmall`/`rightRepeatSmall` fit the button correctly this
  time, size wasn't the problem anymore, but whatever they actually look like at that size clearly
  isn't recognizable as one). Rather than try a *third* SMuFL codepoint blind — this sandbox has no
  way to render any of them to check before shipping, which is exactly how the previous two rounds
  both shipped something that then had to be reported back as wrong — this one sidesteps font
  rendering entirely: a new `RepeatGlyph` component (`ChordChartEditor.tsx`) builds the icon from
  plain CSS, a thick `bg-current` bar plus two small `bg-current` dots (ordered bar-then-dots for
  "left"/start, dots-then-bar for "right"/end), directly mirroring the real chart's own
  repeat-barline convention — `ChordChart.tsx`'s `RepeatDots` plus its thick border — instead of
  approximating it through an unfamiliar engraving glyph whose actual appearance can't be checked
  from here. `bg-current` means it still automatically follows the button's own current text color
  (muted while off, `accent-foreground` once on), the same behavior the SMuFL glyph had. `BarToggle`'s
  `glyph` prop is now `string | React.ReactNode` rather than just `string`, to accept this directly
  — a string still renders through `chordSymbolFont` exactly as before (Coda and "%" are
  untouched), while a node (`RepeatGlyph`) renders as-is. `tsc`, `eslint`, and `next build` all
  pass. **Not verified**, same as the two attempts before it: whether this actually looks right —
  but unlike those, this doesn't depend on a font's own rendering being legible at a given size at
  all, only on basic CSS box/color primitives this sandbox can at least reason about with full
  confidence, even without being able to see the result.
