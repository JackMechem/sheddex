<!-- Moved word for word from the old single PROJECT.md (lines 7513–7689) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

## Shared conventions — reuse these before writing something new

- `components/LoadingSpinner.tsx`: the one shared "something's loading" indicator — a small row of
  circles, one lit up at a time in a loop, styled after (and directly requested to be modeled on)
  the metronome's own beat-circle display (`components/BeatIndicator.tsx`), but driven by a
  looping CSS animation (`@keyframes loading-dot` + a `--animate-loading-dot` token, both in
  `app/globals.css` — Tailwind v4's `@theme` convention for a custom animation utility) rather than
  real beat timing, since there's no tempo to follow here. `size` (`sm`/`md`/`lg`), `inline` (sits
  mid-sentence instead of as its own block), and `showLabel` (also renders `label` as visible text
  next to the dots, for a spot specific enough that a sighted user benefits from knowing *what's*
  loading, not just that something is — e.g. Recorder's "Finishing recording…"; when off, `label`
  is still the accessible name via `role="status"`/`aria-label`, just not shown). Reach for this
  instead of a bare "Loading…" string or a one-off spinner — swapped into every place that already
  had one: `AccountPage.tsx` (the whole "is anyone signed in yet" gate), `AccountMenu.tsx` (the
  sidebar button's brief placeholder before that resolves), `PracticeTimer.tsx` (saved sessions
  loading from the account), and `Recorder.tsx` (loading a saved project from IndexedDB, and — a
  spot that had no loading feedback at all before this, just a disabled record button — finishing
  the post-recording burst-tone alignment processing). **Deliberately not** threaded into every
  `useSyncedSettings`/`useSyncedTunes` consumer, even though those *are* "waiting on the server" in
  a literal sense: that hook returns `defaults` while its first Convex read is pending specifically
  so call sites don't need a loading state to use it at all (see its own doc comment) — adding a
  spinner there would undo that design, not extend it.
- `components/ToolLayout.tsx`: the page shell every tool uses. `layout="split"` gives a
  hideable options column (the eye icon); `layout="stacked"` (Slow Downer, Recorder) is
  full-width with options in one card below. Takes `help={<HelpButton .../>}` for a controls
  dialog. The header icon next to the title is auto-picked from `NAV_LINKS` by matching the
  title string, so a new tool's title must exactly match its `NAV_LINKS` label. An optional
  `sidePanel` (+ `sidePanelLabel`) adds a second, independently hide/show-able column on the
  right (split layout only) — its own eye button, persisted via `useSidePanelHidden` in
  `lib/panels.ts` — for things like Note Trainer's time-history panel or the modulation log.
- `lib/meterControls.ts` + `components/MeterFields.tsx`: tempo/meter logic and UI shared by
  Metronome and Polyrhythm Metric Modulation Metronome — the log-scaled BPM slider,
  note-value-only beat unit,
  accent grouping, subdivision picker, tap tempo, and the `TempoHero`/`MeterOptions`/
  `SoundOptions` building blocks. Reuse these before adding another metronome-like tool.
- `lib/clickEngine.ts`'s `startClickEngine` takes an array of tracks (`{getSettings, onBeat}`
  each), all scheduled off one shared `setInterval` tick. Any tool playing more than one
  simultaneous click (like Polyrhythm Metric Modulation Metronome's reference click) should
  run them as tracks
  on the _same_ `startClickEngine` call, not as separate calls — two independent calls each get
  their own timer, and browser timer jitter can nudge one but not the other, so they slowly drift
  apart even though the underlying Web Audio scheduling of each is individually sample-accurate.
- `components/CollapsiblePanel.tsx` (split layout) / `components/OptionsCard.tsx` +
  `OptionSection` (stacked layout) for settings sections. `CollapsiblePanel` supports
  `toggle={{checked,onChange,disabled}}` to put a switch in the header that gates whether the
  section can expand.
  - **Hydration gotcha:** the chevron button in a gated `CollapsiblePanel` must always be
    _rendered_ (visually hidden with a CSS class like `invisible` when not expandable), never
    conditionally mounted/unmounted — the checked value comes from localStorage and can differ
    between the server default and the saved client value, and an element that's added/removed
    based on that will cause a real hydration mismatch. A class-only difference is fine.
  - **Option descriptions are opt-in, per section.** Both `CollapsiblePanel` and `OptionsCard`
    always show a "?" toggle in their header (next to the title, persisted alongside that
    section's open/closed state) and provide a `lib/hints.ts` `HintsContext` down to their
    children, off by default. `SwitchRow` and `AdvancedSlider` only show their own `hint` prop
    text while that context is on; description text that isn't already routed through one of
    those (e.g. a standalone explanatory paragraph, like several in Recorder's option panels)
    should use `components/Hint.tsx` directly instead of a bare `<p>`, so it's covered by the
    same toggle. Descriptions are never shown by default — always add them behind this
    mechanism, not as always-visible text. Every option across every tool now has one — treat
    "add a new setting" as also meaning "add its hint."
- `lib/usePersistedSettings.ts`: the localStorage-backed settings hook nearly every tool uses.
  **Always pass a module-level constant default object**, never an inline literal, or the
  `useSyncExternalStore` memoization (and SSR-safety) breaks. A new tool's settings should use
  `lib/useSyncedSettings.ts` instead — identical signature and rule, but also syncs to the
  account when signed in (see "Backend (Convex)" below); reach for the plain, unsynced hook only
  for something deliberately device-local (a display preference, not real tool data).
- `components/Select.tsx`, `SwitchRow.tsx`, `ConfirmDialog.tsx`, `PromptDialog.tsx`,
  `NumberField.tsx`, `KeyHint.tsx`, `HelpButton.tsx`, `ContextMenu.tsx`: shared
  form/dialog/menu primitives.
- `components/Waveform.tsx` + `lib/multitrack.ts` (the `Engine` class) + `lib/clips.ts`: the
  audio-editing core shared by Slow Downer and Recorder — waveform drawing/interaction (zoom,
  pan, loop, markers, clip trim/repeat/move), and sample-accurate scheduled playback. Read before
  touching; it's the most complex part of the codebase.
- `components/tools.tsx`: every icon component plus `NAV_LINKS` (the sidebar/search/title-icon
  source of truth) and `TOOLS` (currently unused, `NAV_LINKS` minus `/`).
- **Favorites** (`lib/useFavorites.ts`, `components/Sidebar.tsx`'s `NavItems`) — a star next to
  each tool in the sidebar (desktop and the mobile overlay both, via the same shared `NavItems`);
  clicking it adds/removes that tool from a "Favorites" section shown above the normal categories
  (each favorited tool still also stays in its own category below — a quick-access shortcut, not a
  relocation). **Account-only, on purpose** — unlike every other synced setting in this app, there
  is no signed-out local fallback: the star and the Favorites section simply don't render at all
  unless signed in (`useFavorites`'s `isAuthenticated` gate), since which tools you reach for most
  is tied to *you*, not a particular device/browser. Still rides the same generic `syncedSettings`
  Convex table as everything else (a fixed key, `"jam-practice-favorites"`, holding `{hrefs:
  string[]}`) rather than a bespoke account-only mechanism — the signed-out branch
  `useSyncedSettings` always has underneath still technically exists here too, it's just never
  surfaced in the UI. Visually the star sits *inside* each nav button, at its right edge, so the
  button itself stays full width — but it's a DOM sibling of the row's `<Link>`, not actually
  nested inside it (a `<button>` inside an `<a>` is invalid HTML and breaks click handling),
  absolutely positioned over padding the link reserves for it (`pr-11`/`pr-14`) whenever it can
  show, so nothing shifts when it fades in, and stacked on top (`z-10`) so a click there hits the
  star, not the link underneath. Only shown when not collapsed (no room for it in the icon-only
  collapsed sidebar) and signed in. Visibility beyond that: an already-favorited star always stays
  visible, so what's starred is visible at a glance without hovering; an unfavorited one is hidden
  on desktop until the row's hovered or the star itself is keyboard-focused (`opacity-0
  group-hover:opacity-100 focus-visible:opacity-100`), but always visible on mobile regardless,
  where there's no hover to reveal it.
- `lib/noteSpelling.ts` (accidental spelling: sharp/flat/random/both), `lib/trainerUtils.ts`
  (`formatDuration`, `shuffled`), and `components/AdvancedSlider.tsx` /
  `CountdownRing.tsx` / `CountdownLabel.tsx` / `ElapsedTimer.tsx`: pulled out of Note Trainer when
  Scale Trainer was built, since both drill-style trainers need the same note-name spelling, timer
  readouts and countdown ring (`CountdownLabel` is `ElapsedTimer`'s mirror image — a ticking "Ns"
  readout counting down instead of up, both driven by the same rAF-write-to-DOM pattern so a
  fast-ticking display doesn't force a re-render). `lib/noteGrade.ts`'s `Grade` type also carries
  `GRADE_COLOR`/`GRADE_LABEL` (correct/partial/incorrect colors and labels) and `scoreOf`
  (correct = 1, partial = 0.5), for the same reason. `lib/struggleStats.ts` (`bumpGradeCounts`,
  `rankWeak`, `weaknessScore` = incorrect + partial×0.5) is the lifetime per-note/per-scale
  struggle tracking behind both trainers' "Struggles" panel — generic over the string key, so
  Note Trainer keys it by note and Scale Trainer by mode id. Reuse these before adding another
  drill/quiz-style tool.
- `lib/tones.ts`: the "Tone" dropdown shared by Note/Scale/Interval Trainer's "Play note/scale/
  interval out loud", Guess the Interval/Guess the Chord's playback, and Practice Timer's
  transition chime (`TONES`, `DEFAULT_TONE_ID`, `playNote`). Each `Tone` is just an `id`/`label`
  plus a `play(ctx, freq, durationSeconds)` function — simple waveforms (triangle/sine/square/
  sawtooth, plus "organ"/"pluck" as hand-picked `PeriodicWave` Fourier coefficients) share one
  `waveTone` helper building its own Web Audio graph from scratch per note. "Piano" and "Rhodes"
  used to be synthesis functions too (a five-partial detuned-sine model and a 2-operator FM patch,
  respectively) but are now real recordings via `lib/sampledTones.ts` — this app's first actual
  audio *assets*, per an explicit request to stop approximating and use real samples. Neither
  sample set ships in the repo: the browser `fetch()`s the specific note it needs directly from the
  sample's origin host the first time that note comes up (Piano: the Salamander Grand Piano,
  Alexander Holm, CC-BY, hosted by the Tone.js project, sampled at A/C/D#/F# every octave, 30
  notes; Rhodes: the FluidR3 GM SoundFont's "Electric Piano 1" patch converted to per-note mp3s by
  the midi-js-soundfonts project, CC-BY, every semitone across the full 88-key range) and
  `decodeAudioData`s it into an `AudioBuffer`, cached in a module-level `Map` keyed by URL for the
  rest of the tab's lifetime — so only the very first play of a given sample note pays a
  network/decode cost; every repeat, and the browser's own normal HTTP cache on a later visit, are
  instant. A requested note without its own recording gets the *nearest* sample, pitch-shifted via
  `playbackRate` to the exact target frequency — continuous, not limited to semitone steps, same as
  the synthesized tones could render any frequency exactly. Both sets' filenames are generated from
  MIDI note numbers (`midiToAppName`/`midiToFlatName`) rather than hand-typed, and every generated
  URL (118 across both sets) was spot-checked for real — several edge/middle/flat-spelled notes
  fetched directly and confirmed to return actual mp3 data, not guessed from memory. CC-BY requires
  attribution, which lives on `/credits` (`app/credits/page.tsx`, linked from `Home.tsx`'s footer,
  same `LegalPage` shell as `/privacy`/`/terms`) rather than cluttering every tool that has a Tone
  dropdown. `DEFAULT_TONE_ID` is still "triangle" (unchanged, so existing persisted settings aren't
  affected) — Piano/Rhodes stay opt-in via the Tone dropdown, not a new default, for every Tone
  picker *except* Guess the Interval's and Guess the Chord's: those two ("Ear Training" tools,
  specifically — not the other trainers' own "play out loud" Tone pickers or Practice Timer's
  chime, which still offer the full list) were narrowed to real samples only, per a direct
  follow-up request once the samples actually sounded good — `EAR_TRAINING_TONES` (just Piano and
  Rhodes) and `DEFAULT_EAR_TRAINING_TONE_ID` ("piano") in `lib/tones.ts`, filtered from the same
  `TONES` array rather than a separate list to maintain, so a new tone added to `TONES` later needs
  a one-line decision (does it belong in this filter too) rather than being duplicated by hand.
  Each of those two components also clamps its own persisted `toneId` against
  `EAR_TRAINING_TONES` (same pattern as their existing `accidentalStyle` clamp) — a `toneId` saved
  before this narrowing (e.g. still `"triangle"`) falls back to the new default instead of
  silently pointing at a tone no longer offered in the dropdown. `playNotesTogether(notes,
  durationSeconds, toneId)` is the other export alongside `playNote` — used wherever several notes
  need to actually start together (Guess the Chord's block voicing, Guess the Interval's harmonic
  playback), not just be *called* around the same moment. Reported directly: with Piano/Rhodes, one
  note of a block chord would play slightly before the others on a first play, but a replay was
  always fine. Cause: each `playNote` call independently awaited its own sample's fetch+decode
  (`lib/sampledTones.ts`), so if a chord's notes needed different sample files and only some were
  already cached, each note computed "now" whenever *its own* fetch happened to resolve — on replay
  everything's cached so every note resolves near-instantly and the skew vanishes on its own, which
  is exactly why it only showed up on a first play. Scheduling every note for the same future
  `AudioContext` time turned out not to be a real fix on its own: a sample that's still mid-fetch
  when that moment arrives simply doesn't exist yet to play, so it'd still start late regardless of
  what start time was requested (a dead end worth recording so it isn't tried again) — Web Audio
  scheduling can't paper over a network request that hasn't finished. The actual fix is
  `Tone.prepare?: (ctx, freq) => Promise<void>` (optional; absent for every synthesized tone, which
  has nothing to preload) plus `lib/sampledTones.ts`'s `prepareSampledNote`, which fetches+decodes
  into the same `bufferCache` `playSampledNote` reads from without playing anything.
  `playNotesTogether` awaits `Promise.all` of every note's `prepare` call *before* computing a
  shared start time and playing any of them — so a chord genuinely waits for its slowest note to
  finish loading before any note sounds, rather than the fast notes racing ahead. Verified with a
  synthetic script using a fake `AudioContext` whose `currentTime` actually advances in real time
  (necessary — a static fake clock can't distinguish "fixed" from "reads `ctx.currentTime` fresh
  whenever each note happens to resolve", the bug, since both would trivially produce the same
  value against a clock that never moves) and two notes with deliberately different, real
  `setTimeout`-based fetch delays (5ms vs 150ms): both end up scheduled at the *exact* same
  Web Audio time, and that time is provably after the real ~150ms wait actually elapsed, not "0" by
  coincidence — plus a second check that a synthesized tone (no `prepare` step) still resolves
  near-instantly through the same function, unaffected.

