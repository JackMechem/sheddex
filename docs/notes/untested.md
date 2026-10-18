<!-- Moved word for word from the old single PROJECT.md (lines 7690–8073) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

## What's genuinely untested

Every change here has passed `next build` + `tsc --noEmit` + `eslint`, and audio-processing logic
(WAV encoding, pitch/beat detection, latency alignment) has been spot-checked with small synthetic
Node scripts — but **none of it has been exercised in a live browser with real audio hardware**.
If Jack reports odd behavior in any of these, treat it as genuinely unverified, not a regression
from something that used to work:

- **Public profiles & follows** (see "Backend (Convex)" above for the full design): genuinely
  nothing about this has been clicked through — this sandbox can't upload a real image file,
  create two different signed-in sessions to test following/searching/viewing each other's
  profiles, or click through a public profile link at all. Specifically unverified: the actual
  avatar upload flow end to end (resize → `generateAvatarUploadUrl` → the raw `fetch()` POST →
  `setAvatar`) in a real browser; whether the client-side `<canvas>` crop/resize produces a
  reasonable-looking square from a real photo (portrait vs. landscape, unusual aspect ratios);
  live username-availability checking while typing; the Community search page's actual results;
  the Follow/Unfollow round-trip and both Following/Followers lists updating live; a public
  profile page correctly showing (or correctly refusing to show) someone else's data depending on
  their `isPublic` flag; and the account-deletion cascade fix (`performDelete` now also removing
  the profile, its avatar file, and follow rows) actually leaving no trace behind in a real
  deployment, not just type-checking. Also unverified, since this session's redesign: that a public
  profile really does show *every* tune automatically with no picker involved; the "Add"/"Learn"
  buttons on `PublicTuneList` actually copying a tune into the viewer's own Tunes/Tunes to Learn
  lists correctly (fresh ids, no `notes` leakage, correctly disabling once already added); and the
  account's own Tunes to Learn tab's edit/delete/clear-all against a list that was actually
  populated by visiting someone else's profile first (as opposed to a script fabricating one).
  Verified so far, purely at the logic level: `lib/username.ts` (valid/invalid formats, boundary
  lengths) and `lib/profileTunes.ts`'s `resolvePublicTunes` (every tune returned in full,
  `notes` never present, tolerant of malformed/missing input, individual bad entries dropped
  without failing the whole list) against synthetic Node scripts, and that the whole feature —
  schema, every new Convex function, every new page — type-checks and deploys cleanly to the dev
  backend.
- **Community chord charts** (see its own paragraph under Backend (Convex) above — now on its
  third storage design, the first two both having broken for real at actual posting scale, most
  recently a ~1,400-song post): partially clicked through by Jack himself (that's how both prior
  bugs were actually found — this sandbox still can't authenticate as a real user, so every fix
  here has been verified against the *architecture*, via the real dev deployment, not by clicking
  the UI). Specifically unverified: that `create`/`importIntoLibrary` actually succeed end to end
  for a genuinely large post now (the original ask) — verified so far only that the specific
  failure modes that broke v1 (a >1 MiB document) and v2 (a >1024-field object) no longer apply
  architecturally, via a real query/mutation reachability check and a dedicated large-array-return
  check against the live dev deployment (see the Backend section), not by actually posting 1,400
  real charts and confirming they show up correctly; that `create` actually refuses posting for a
  non-public profile and the client-side prompt matches; that `list`/`get`/`getSongBars` really do
  drop a post (or song) once its author's profile goes private; that the inline `ChordChart`
  preview inside `PostDetailModal` renders correctly once its now-lazy `getSongBars` fetch
  resolves, in that narrower modal context; that "Import all" and a per-song "Import" actually
  land in `ChordCharts.tsx`'s own library and show up there immediately; and the account-deletion
  cascade now also clearing `communityChordCharts` *and* `communityChordChartSongs` rows. Also
  unverified: whether a playlist's tri-state checkbox (`.indeterminate` set imperatively via a ref
  callback) actually renders the indeterminate dash in every browser rather than just
  checked/unchecked; whether the title-autofill-from-playlist-name behavior feels helpful or
  surprising in practice; and whether search correctly hides a playlist with zero matching songs.
  Verified so far: `tsc`/`eslint`/`next build` all pass; `npx convex dev --once` deploys the
  current three-table shape (`communityChordCharts`/`communityChordChartSongs`, alongside the
  personal library's own `chordChartPlaylists`/`chordChartSongs`/`chordChartSongBars`) cleanly;
  and, against the real dev backend specifically (not a mock), both `create` and
  `importIntoLibrary` correctly reject an unauthenticated caller, and a large (1,500-element) array
  return value — the shape `get`'s song list now uses — succeeds with no limit comparable to the
  one that broke the old object-keyed-by-id bulk fetch. No synthetic Node script was run against
  the dedupe/playlist logic specifically here, since it's now shared with the already-scripted
  `mergeIntoLibrary`/`chordCharts.importSongs` path via `convex/lib/chordCharts.ts`'s
  `findOrCreatePlaylist`/`songKey`, not a second independent implementation to separately verify.
- **Community tunes** (see its own paragraph under Backend (Convex) above): same story, also
  entirely unclicked. Specifically unverified, beyond everything already listed for Community
  chord charts (the same posting-gate/privacy-filter/account-deletion-cascade concerns apply here
  identically): that `PublicTuneList` — a component only ever previously mounted from a public
  profile page — renders and behaves the same way reused here inside `PostDetailModal` (correct
  dedupe against the viewer's own Tunes/Tunes to Learn, correct fresh-id copy on Add/Learn, no
  layout surprises in a modal instead of a full page); and that `toPublicTune` actually strips
  `notes` in practice, not just by reading the function. Verified so far at the same level as
  Community chord charts: `tsc`/`eslint`/`next build` pass and `npx convex dev --once` deploys the
  new `communityTunes` table and functions cleanly — no dedicated synthetic script, for the same
  "thin glue over already-tested pieces" reasoning.
- Recorder: multitrack recording/overdub, the auto-latency burst-tone alignment, "align to beat",
  moving clips between tracks, WAV export/mixdown.
- Note Trainer listen mode: live pitch grading accuracy, the "ignore a held-over note" fix, the
  always-on max-time timer, and the "Sound feedback" click scheduling (a `setTimeout` per
  countdown second, cleared and rescheduled on every note change). "Shed a string" specifically:
  whether two octaves above the open string is actually the right span for a real instrument (no
  fret-count data exists to check against — see the shared-conventions note above) and whether
  the octave-override actually holds through to grading and the results screen as intended.
- Scale Trainer listen mode: same live-pitch-grading machinery as Note Trainer, plus its own
  untested bit — advancing through a scale's notes in sequence (settling between each one so a
  held note's tail isn't graded as an attempt at the next degree), failing the whole round on a
  wrong note (immediately by default, or after a second miss on the same degree with "Partial
  credit" on), the drill queue's per-key/per-octave coverage, and the "Sound feedback" click
  scheduling (a `setTimeout` per countdown second, cleared and rescheduled on every round change).
- Interval Trainer listen mode: same live-pitch-grading machinery again, plus its own untested
  bit — "Continue from previous note" chaining actually starting each round on the prior round's
  target note rather than drifting.
- Guess the Interval: whether the played interval's pitch actually matches what's shown once
  revealed (`playNote`/`lib/tones.ts`), the melodic-vs-harmonic playback timing (two `playNote`
  calls fired simultaneously for harmonic isn't something that's been heard), and the same
  countdown-timing machinery inherited from Interval Trainer (the sound-feedback click scheduling,
  answering early re-syncing the round timer).
- Guess the Chord: everything above, plus its own untested bits — whether a played chord's block
  vs. arpeggio voicing (all the notes at once, several simultaneous oscillators through
  `playNote`) actually sounds like one coherent chord rather than mush, especially on the bigger
  qualities (13th chords are 7 simultaneous notes); whether a fully random slash bass (not
  restricted to an actual chord tone) is musically legible enough to identify by ear at all,
  versus just sounding like noise under the chord; and the typed-answer flow end to end — the
  live-formatting preview while typing, submitting via Enter vs. the Submit button, and the
  timeout path (`onTimeUp` → `gradeAndReveal` → the same `lockInRound` reveal pause an explicit
  answer gets) actually behaving the way the code reads; plus, since this section was last
  written, the "Give the root" prefill (whether the caret really lands after the prefilled text
  rather than before/inside it — `setSelectionRange` after a `useEffect`, not something provable
  without a real focused `<input>` in a real browser) and the symbol keypad (whether a tap really
  inserts at the caret without stealing focus, across actual touch/mouse input rather than the
  synthetic string-splicing check that's all `insertSymbol`'s logic itself got). None of this is
  something this sandbox's lack of a browser can confirm beyond the synthetic parser/round-
  generation/prefill checks already run against `lib/chords.ts` directly.
- `lib/sampledTones.ts`'s "Piano" and "Rhodes" tones: every generated sample URL was checked for
  real (a script fetching representative ones — both range edges, a middle note, and a
  flat-spelled filename from each set — and confirming actual mp3 bytes come back, not a guess
  from memory), and the note-name/frequency/nearest-sample-selection math has a synthetic test
  against the real `noteToFrequency`. Jack reported the samples playing louder in one ear —
  both sets are real stereo recordings (an actual mic'd piano, unlike every other tone here, a
  single inherently-centered mono oscillator), so whatever left/right balance the recording itself
  happened to have was passing straight through; fixed by forcing the gain node's `channelCount`/
  `channelCountMode`/`channelInterpretation` to explicitly downmix to a centered mono signal before
  it reaches `ctx.destination` (the Web Audio spec's standard L+R downmix rule), verified with a
  mocked-Web-Audio-graph script asserting those three properties actually land on the node — but
  **not re-confirmed by ear**, since this sandbox still has no audio output; take "fixed" as
  "the mechanism that would cause this is now provably absent from the graph," not "confirmed
  centered by listening." Also still unconfirmed: whether the pitch-shifted notes between recorded
  samples (especially the piano set's wider, every-third gaps) still sound convincingly like a real
  piano rather than audibly "chipmunked" or "slowed down"; how loud the samples are next to this
  app's other tones (no gain matching was done — the samples' own recorded levels are used as-is,
  now just centered); whether the 80ms release ramp on cutoff sounds natural against a real
  recording's own decay tail versus clicking or cutting it off abruptly; the actual first-note
  network/decode latency in practice; and whether `AudioContext.decodeAudioData`'s promise-based
  (no-callback) form is supported by every browser this app otherwise targets. Jack also reported a
  block chord's notes not starting quite together on a first play (fine on replay) — fixed via
  `playNotesTogether`'s prepare-then-schedule redesign (see `lib/tones.ts`'s bullet above) and
  verified with a synthetic script proving two notes with deliberately different fetch delays
  converge on the exact same Web Audio start time, but same caveat as the left/right fix: not
  re-confirmed by ear in a real browser, since that's still not something this sandbox can do.
- Practice Timer: the engine's live start/pause/resume/skip/stop/auto-advance behavior and its
  restore-from-`localStorage` paths (paused, mid-step, and time-fully-elapsed-while-away) are all
  checked with synthetic Node scripts driving `lib/practiceTimerEngine.ts` directly against a
  mocked `window.localStorage` — but never in a real browser: an actual page reload genuinely
  resuming a running session, the sidebar widget/mobile badge staying in sync with the tool page
  across navigation (the whole reason the tool page's own `Date.now()`-based ring replaced an
  earlier `performance.timeOrigin`-converted one — see the tool's own bullet above — was Jack
  actually seeing the two disagree; this sandbox can't reproduce or re-check that by eye at all),
  and the transition chime (`playTransitionChime`, `lib/tones.ts`) are all unverified by ear/eye.
  Same story for what's new since: alarm mode's repeating chime (whether the 1.5s repeat interval
  actually sounds like a sane alarm cadence rather than too frantic or too slow — a number picked,
  not measured against anything), the sidebar widget's new pause/resume/skip/stop buttons actually
  working when clicked (siblings of the card's `<Link>`, not nested inside it, which fixes a real
  invalid-HTML/broken-click-handling risk on paper, but hasn't been clicked for real), and
  `PracticeTimerAlert`'s full-screen takeover — whether it actually renders above everything else
  app-wide (untestable without a real multi-page browsing session to interrupt), whether its
  `z-[200]` really does sit above every other overlay in the app (a number chosen by reading every
  other `z-` value already in use and going higher, not verified by opening two at once), and
  whether `autoFocus` on its Continue button actually lands keyboard focus there in every browser.
  The state machine itself (holds on `alarming` instead of auto-advancing, stays held rather than
  firing once, `skip()`/`stop()` both work from an alarming state, restoring into an
  already-alarming or just-elapsed-into-alarming state on reload) is covered by synthetic tests —
  see `lib/practiceTimerEngine.ts`'s own bullet above — but that's the logic, not the experience of
  an actual alarm going off while you're doing something else on your phone. The signed-in-reads-
  Convex-only sync switch (`lib/usePracticeSessions.ts`) type-checks and the schema/functions
  deploy cleanly to the dev backend, but the actual cross-device behavior — including that signing
  in really does ignore whatever's in local storage rather than merging it — hasn't been clicked
  through.
- **Every tool's account sync** (`lib/useSyncedSettings.ts`, `lib/useSyncedTunes.ts`,
  `convex/syncedSettings.ts`): `tsc`/`pnpm lint`/`pnpm build` all pass and `npx convex dev --once`
  deploys the schema/functions cleanly, but none of the actual signed-in behavior has been clicked
  through in a real browser — this sandbox can't sign into a real account and watch it happen. In
  particular, unverified: that a tool's settings genuinely round-trip through the account (change
  something, refresh, see it persist via Convex rather than localStorage); that signing in with
  existing local data really does just stop reading it rather than showing something stale or
  erroring; that all four of Jam Practice's tune-list call sites
  (`JamPractice.tsx`/`TunesPanel.tsx`/`TunesManager.tsx`/`StandardsPicker.tsx`) stay in sync with
  each other through `useSyncedTunes` the way they did through the shared `tunesStore` module
  before; and that a large settings object (Chord Charts' imported-song library in particular,
  potentially several hundred KB of JSON per `PROJECT.md`'s own note on that data's size) writes
  and reads back correctly as one `syncedSettings.value` string rather than hitting some
  unanticipated Convex document-size or `useMutation` payload limit.
- Tuner: the tone generator and the per-instrument string tunings.
- Polyrhythm Metric Modulation Metronome: the bar-boundary detection driving each
  modulation (relies on the
  click engine's `onBeat` callback timing).
- Chord Charts' `FitChordRow` (`components/ChordChart.tsx`): keeps a bar's chords on one line by
  measuring the row's natural width against the bar's available width (`ResizeObserver` +
  `scrollWidth`/`clientWidth`) and applying `transform: scaleX()` to compress it exactly enough to
  fit, instead of wrapping or overflowing. This one's untested for a different reason than the
  audio items above — it's plain DOM layout, no special hardware — but this sandbox has no working
  browser to actually render in (Playwright's Chromium is missing OS shared libraries — e.g.
  `libnss3.so`, `libgtk` — and installing them needs `sudo`, which isn't available
  non-interactively here); `next build`/`tsc`/`eslint` are all it's been checked with.
  Same-unverified-for-the-same-reason applies to a later visual pass matching iReal Pro's/Finale's
  chart look more closely, per two rounds of direct follow-up with reference screenshots. Round
  one swapped the chord font from Oswald (a condensed sans, a rough stand-in from when this was
  first built) to Bevan (a bold slab serif) and added a stacked time signature, baseline-aligned
  quality suffix, and an always-thick opening barline — sent back as "not even close... the font
  you just used is horrible... it should be very thin," naming Finale's own "Jazz Text" font as
  the actual reference. Round two (the current state): the font is now EB Garamond — genuinely
  thin-stroked, the opposite of Bevan, and the closest freely-licensed stand-in for Jazz Text
  available via `next/font/google` (Jazz Text itself is bundled with Finale, not distributable for
  web use, so this remains an approximation, not a claim of an exact match — the same honest
  caveat as the first attempt, just aimed at a different reference font this time). More
  consequentially, round two also replaced the chart's entire sizing model: it used to size chord
  text off the container's *width* only (a `cqw`-based scheme), so a long chart (many rows) just
  ran taller than its box and needed a scrollbar — exactly what "the whole chart, regardless of
  length, should be able to fit without scrolling" was asking to fix. Now the chart renders inside
  a single fixed-aspect-ratio box (`aspect-[8.5/11]`, "almost" a sheet of paper, per that same
  request) at one natural (unscaled) size, and a new `PageFit` component measures the whole
  rendered result (`ResizeObserver` + `scrollWidth`/`scrollHeight`, the same "measure then
  `transform: scale()`" idea `FitChordRow` already used for a single bar, now applied to the
  *entire* chart) and applies one uniform scale so it always fits inside that page — shrinking a
  long chart down, or growing a short one up (capped at `MAX_SCALE`, so a 4-bar tune doesn't blow
  up absurdly large). Every row now always renders exactly `barsPerRow` fixed-width columns
  (`COL_WIDTH`), even a short trailing row, leaving the remainder blank rather than stretching —
  matching how a real chart never changes bar width mid-line just because a line ends early. None
  of this has been seen rendered: not whether EB Garamond actually reads as close to Jazz Text, not
  whether `Δ`/`ø`/`°` (outside EB Garamond's coverage too — an existing limitation carried over
  from both earlier fonts, not a new regression) fall back jarringly, not whether the scale-to-fit
  math actually keeps a very long real chart legible rather than shrinking it into illegibly tiny
  text, and not whether the page's own on-screen size (`max-w-2xl` × the 8.5:11 ratio, comfortably
  taller than it is wide) ends up needing the *page itself* to scroll on a shorter viewport even
  though the *chart content* inside it never does — those are two different things, and only the
  second was ever actually promised here.

  Two further direct follow-ups landed on top of this, both also unclicked for the same reason.
  First, the page's own side margins on mobile — both `ChordCharts.tsx`'s display wrapper
  (`p-4 sm:p-6` → `px-1 py-4 sm:p-6`) and `PageFit`'s own inset (`inset-4 sm:inset-6` →
  `inset-x-1 inset-y-4 sm:inset-6`) — shrank to near-zero horizontally below the `sm:` breakpoint,
  deliberately left untouched above it, and deliberately *not* touching `ToolLayout.tsx`'s own
  shared `px-4` page gutter (used by every "stacked"-layout tool, not just this one) — so there's
  still a small unavoidable gutter from that shared layer, not literally edge-to-edge. Second, a
  "maximize" toggle (`MaximizeIcon`/`MinimizeIcon`, new in `components/tools.tsx`) opens the
  selected chart in a `fixed inset-0` full-screen overlay (Escape, or a "minimize" button, to
  close) — a plain CSS overlay rather than the browser's native Fullscreen API, deliberately: iOS
  Safari doesn't support calling `requestFullscreen()` on an arbitrary element at all, which would
  have made the button silently do nothing on an iPhone specifically, a bad outcome for what's
  otherwise a mobile-first practice tool. `ChordChart` itself gained a `fullscreen` prop that drops
  the paper aspect-ratio/width-cap in favor of filling whatever box it's given — maximizing is
  about legibility while practicing, not preserving a page shape that would waste space on a
  landscape phone — while still routing through the same `PageFit` scale-to-fit logic either way,
  so "never needs to scroll" holds in both the normal and maximized views.

  Two more direct follow-ups after that, both also unclicked. First, maximized, the composer name
  used to sit flush right in the header (`justify-between`) — colliding with the "minimize"
  button that sits top-right of the full-screen overlay, per a reported screenshot of "Coleman
  Haw[kins]" overlapping it. Fixed by moving the composer down under the title (left-aligned) only
  when `fullscreen`; the normal (non-maximized) view, which has no button there to collide with,
  keeps the composer flush right as before. Second, and more substantial: a long chart (many rows)
  in the *normal* (non-maximized) view rendered at a fraction of the phone screen's actual width,
  with wasted margin on both sides — `PageFit` had been fitting *both* width and height inside the
  fixed `aspect-[8.5/11]` page box, so a tall chart's height became the binding constraint on the
  scale, and that same (small) scale then applied to width too, shrinking it far more than the
  screen actually required. `PageFit` now takes a `fitHeight` prop: `true` (the full-screen case,
  a genuinely fixed box with no page below it to grow into) keeps fitting both dimensions exactly
  as before; `false` (the new default, normal in-page case) fits *width only* — always scales to
  exactly fill the container's width — and instead reports the resulting scaled *height* back onto
  its own box (`content.scrollHeight * scale`, via a second piece of state), so the page itself
  simply grows taller for a longer chart rather than the whole chart shrinking to preserve a paper
  ratio that was never the point — normal page scroll below a tall chart is fine; the chart
  needing its own internal scrollbar, which this whole `PageFit` mechanism exists to prevent, is
  the thing that was actually promised. Setting the box's own height from inside the same
  `ResizeObserver` callback that watches that box does cause one extra, harmless observer firing
  per settle (the box's height changing is itself a resize) — verified by tracing it through, not
  by watching it run: the second pass recomputes from the *same* `content` natural size (unaffected
  by the box's own height, since `content` is absolutely positioned) and lands on the identical
  scale/height values, so React bails out of re-rendering and it settles after that one bounce
  rather than looping.

  **Round three**, a direct follow-up asking for "a handwritten jazz font like lilyjazz": swapped
  EB Garamond for `lilyjazz-text`, the hand-written text face from the [LilyJAZZ font
  family](https://github.com/OpenLilyPondFonts/lilyjazz) (SIL Open Font License 1.1, copyright
  Abraham Lee) — this app's first actually-bundled font, self-hosted via `next/font/local` rather
  than fetched from Google Fonts. Immediately correctable on two points, both from a direct
  follow-up: **first**, `lilyjazz-text`'s own glyph set was missing three of `prettyQuality`'s five
  substitution characters (`Δ`, `♯`, `♭` — only `ø`/`°` were covered), pointed out directly
  ("the font shuold have flats and stuff"); **second**, there's no lighter weight of
  `lilyjazz-text` to switch to for "make the font thinner." Both together were reason enough to
  replace it outright rather than patch around the gaps.

  **Round four** (the current state) swapped in [Petaluma](https://github.com/steinbergmedia/petaluma)
  instead, per a direct follow-up naming it specifically: "its open source and definately includes
  everything." Petaluma is the SMuFL-compliant notation font family Steinberg built for its Dorico
  scoring software (SIL Open Font License 1.1, copyright Steinberg Media Technologies GmbH) — and
  genuinely does include everything needed, once the right *two* of its three faces are actually
  used together rather than just one:
  - **`PetalumaScript`** — a hand-inked text face, used for root letters, digits, and most of the
    quality suffix (`chordFont` in `ChordChart.tsx`). Its cmap was checked directly (`opentype.js`
    against the real downloaded `.otf`, the same verification method used for every font swap in
    this file, not assumed from the family's README) and — unlike `lilyjazz-text` — it already
    covers `♯`/`♭`/`ø` (three of `prettyQuality`'s five substitution glyphs) at their normal
    Unicode codepoints directly, no second font needed for those.
  - **`Petaluma`** itself (the engraving/symbol face, `chordSymbolFont`) — used for exactly the
    remaining two: `Δ` (major 7) and `°` (diminished). Rather than falling back to whatever other
    font happens to be installed for those two (the gap every earlier font in this chart's history
    had), a new `QualityText` component in `ChordChart.tsx` intercepts just those two characters
    after `prettyQuality` and re-renders them through `Petaluma`'s own dedicated SMuFL "chord
    symbols" glyph range — `csymMajorSeventh` (U+E873) and `csymDiminished` (U+E870), purpose-built
    engraved jazz-chord marks, not a Greek letter or degree sign standing in for them. Confirmed to
    exist in the actual font (not assumed from the SMuFL spec alone) by cross-referencing the
    [SMuFL glyphnames registry](https://github.com/w3c/smufl)'s `csym*` codepoints against
    Petaluma's real cmap. `prettyQuality` itself (`lib/iRealPro.ts`) is completely untouched — still
    the same Δ/ø/°/♯/♭ substitution shared with Guess the Chord's own chord bank — so this is a
    `ChordChart.tsx`-local addition on top of it, not a change to shared logic; Guess the Chord
    keeps rendering those same five characters in whatever ordinary font it already uses, unaffected.

  Both `.otf` files (`components/fonts/petaluma/Petaluma.otf`, `PetalumaScript.otf`, plus the
  family's shared `OFL.txt`/`FONTLOG.txt`) are committed the same way `lilyjazz-text` was, replacing
  it outright — `components/fonts/lilyjazz-text/` was deleted, not left alongside as dead weight.
  `/credits`' "Typeface" section was rewritten to credit Petaluma/Steinberg instead. On "make the
  font thinner" specifically: `PetalumaScript` reads as a visibly lighter weight than `lilyjazz-text`
  on paper, which happens to land closer to what was asked for, but that's a side effect of picking
  a different single-weight font, not an adjustable setting — the Petaluma family ships only one cut
  of `PetalumaScript`, so if it still reads too heavy once actually seen rendered, there's no lighter
  variant within this family to fall back to; a non-variable OTF's own stroke weight can't be thinned
  further through CSS `font-weight` the way a variable font's could. `tsc`, `eslint`, and `next build`
  all pass, and a synthetic Node script (run directly against the real `prettyQuality` plus
  `QualityText`'s own substitution table, not a mock) confirms the character-level logic against real
  quality suffixes pulled from `lib/chords.ts`: `^7`/`^13`/`o7`/`o` correctly isolate `Δ`/`°` for the
  SMuFL substitution, while `h7`/`-7b5`/`7#9`/`sus` correctly need no substitution at all (their
  `ø`/`♭`/`♯` already render through `PetalumaScript` directly). **Not verified**, same as every
  round before it: how any of this actually looks rendered in a browser — whether `PetalumaScript`
  reads as legible hand-written jazz notation at chord-chart sizes, whether it's visibly thin enough
  to satisfy the original ask, and whether the two `Petaluma`-rendered SMuFL glyphs sit at a
  consistent size/baseline next to `PetalumaScript`'s own text (both fonts share the same
  1000-units-per-em design, so no manual scale correction was applied — checked via each font's own
  metrics, but genuinely unconfirmed by eye).

  **Round five**, a direct follow-up with a screenshot of the actual rendered chart: chord symbols
  themselves were correctly in the new font, but the "%" repeat-bar mark and the coda symbol
  (segno wasn't in the screenshot, but shares the exact same code path) were still visibly in a
  plain system font, unchanged by any of the rounds above — both were typed as plain Unicode
  characters (`%`, `⊕`, `𝄋`) with no `chordFont`/`chordSymbolFont` class applied at all, simply
  missed when the font swap first went in. Rather than just adding `chordFont`'s class to those
  same plain characters, this checked whether `Petaluma` (the SMuFL engraving face, already
  bundled for `QualityText`'s `Δ`/`°`) has real dedicated glyphs for these too — cross-referencing
  the SMuFL glyphnames registry again, then confirming directly against the actual bundled
  `Petaluma.otf`'s cmap: it does, `repeat1Bar` (U+E500), `coda` (U+E048), and `segno` (U+E047),
  proper engraved marks rather than a percent sign/circled-plus/musical-repeat-character standing
  in for them (`PetalumaScript`, the text face, has none of the three — confirmed the same way —
  so this is `chordSymbolFont` only, not a choice between the two faces). `BarContent`'s repeat
  case and `BarCell`'s segno/coda span now render those three codepoints through
  `chordSymbolFont.className` instead of the old plain-Unicode characters; `REPEAT_SIZE`/
  `SYMBOL_SIZE` (the same font-size constants each already used) were left as-is rather than
  guessed at anew. `repeat1Bar`'s own bounding box sits mostly *below* the font's baseline
  (`y1: -250, y2: 175` in its 1000-unit em, versus a typed `%`'s more ordinary above-baseline
  shape) — flagged here as a real, not-yet-visually-confirmed risk: normal flex-centering in
  `BarCell` should still land it roughly centered in the bar regardless, since that's centering the
  span's line box rather than reasoning about glyph-specific bbox position, but it's worth a second
  look once this is actually seen rendered, before assuming that math holds. `tsc`, `eslint`, and
  `next build` all pass, and all three codepoints were confirmed present in the real bundled
  `Petaluma.otf` (not assumed from the SMuFL spec). **Not verified**, same as everything else in
  this chart's font history: how the repeat mark, coda, and segno actually look and sit once
  rendered — including that vertical-centering question above.
- Chord Charts' playlist grouping (`lib/chordChartsLibrary.ts`'s `Library`/`Playlist`,
  `PlaylistSection` in `ChordCharts.tsx` — see that tool's own bullet above): the merge/resolve/
  delete logic itself is covered by a synthetic Node script (creating vs. merging into an existing
  playlist by name, a duplicate song skipped correctly even in a brand-new playlist, every song
  accounted for exactly once, the legacy-library-falls-into-"Unsorted" case, and an emptied
  playlist being dropped), but nothing about the actual UI has been clicked through: whether the
  expand/collapse chevrons work and animate sensibly, whether a playlist containing the selected
  song really does show expanded by default without needing a manual click, whether the nested
  indentation reads clearly at the sidebar's narrow width, and — genuinely unknown, not just
  unclicked — how an account with chord charts imported *before* this change actually looks the
  first time it loads under the new "Unsorted" bucket, since this sandbox has no way to seed a real
  pre-existing synced library to check that against.
- Chord Charts' Convex-backed library (`lib/useChordChartsLibrary.ts`, `convex/chordCharts.ts` —
  see the tool's own bullet above for why this exists: the old single-blob storage broke on a real
  "massive playlist" import). Verified so far: the deployed functions are correctly wired and
  behave as expected when called *unauthenticated* (a plain Node script against the real dev
  backend, not a mock), and the signed-out/local code path is provably unchanged (same functions,
  same synthetic-script coverage, as before this session). **Not** verified: an actual signed-in
  import of a large playlist succeeding where it used to fail — this sandbox can't authenticate as
  a real user, so the one thing that actually matters most here (does Jack's original "massive
  playlist" import now work) is unconfirmed by anything stronger than the architecture no longer
  having the specific failure mode that caused it. Also unverified: the one-time
  `migrateFromSyncedSettings` migration actually preserving a real pre-existing library's playlists
  and songs correctly (only reasoned through, never run against real data — this sandbox has
  nothing to migrate); whether `getSongBars`' lazy per-song fetch introduces a noticeable delay
  switching between tunes in a real browser (the `selectedSongLoading` spinner is new and unclicked
  the way everything else visual here is); and whether `CreatePostModal`'s bulk `getSongsBars`
  fetch at submit time (via `useConvex().query`, not `useQuery`) actually returns bars keyed
  correctly by song id in practice, not just by reading the handler's code.

