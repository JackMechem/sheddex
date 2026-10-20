# Score Writer and the shared notation editor

## First version (2026-10-20, branch `feat/shed-notes`)

Jack asked for the notation in Shed Notes to be "an actual music notation software" like Bass
Genius's transcription editor. He then asked for a tool just for writing music that every notation
editor in the site uses.

**One editor for all notation**
- `components/notation/Score.tsx` (was `bassgenius/TranscriptionScore.tsx`) and
  `components/notation/ScoreEditor.tsx` (was the body of `bassgenius/TranscriptionEditor.tsx`)
  are now the only notation view and editor. They're used by Score Writer, Shed Notes (in a
  dialog, and read-only inside notes) and Bass Genius.
- `bassgenius/TranscriptionEditor.tsx` is now a thin wrapper. It keeps its old props, adds the
  back button, title, Details, Export and Delete through the editor's `header` render prop, and
  uses `sound="upright-bass"`. It also exports `useAutosave`, `SAVE_LABEL`, `downloadJson` and
  `safeFilename`, which the other callers reuse.
- `ScoreEditor` props:
  - `initial` (frozen on mount, so a caller passing a fresh object after its own save doesn't
    count as an edit);
  - `onChange` (every new version; the caller saves);
  - `header(t, setMeta)`;
  - `sound` ("piano", the sampled piano, or "upright-bass");
  - `staffControls` (clef, key, time, tempo);
  - `autoFocus`.
- **Model** (`packages/core/bassTranscription.ts`, still named for its history):
  - `Transcription` gained optional `clef` and `key` (sharps positive, flats negative, -7…7).
  - `STAFFS`/`staffOf`: `treble`, `bass` (concert pitch, as written) and `bass8` (bass guitar and
    upright, written an octave above where it sounds). A missing clef means `bass8`, so every
    Bass Genius transcription draws exactly as before. The first version had a single "bass" with
    the octave shift, which put concert-pitch bass parts an octave too high; that's why there are
    two.
  - `keyAlters`, `KEY_NAMES`, `CLEF_NAMES`; `nearestPitch` takes a range.
  - `cleanScore` is like `cleanTranscription` but keeps clef, key and any time signature (the
    old one forces 4/4 for Bass Genius's analysis).
- **Engraving**: clef and key signature at the start of every row, the time signature only on
  the first. Accidentals are drawn against the key, with naturals within a bar. Beams group by
  dotted quarter in 6/8, 9/8 and 12/8.
- **Entry follows the key**: a typed letter or a clicked note takes the key's sharp or flat (F in
  G major is F♯), as MuseScore does.
- **Changing the time signature** re-bars the music (`rebar` in `ScoreEditor`). Notes and chords
  keep their place in time; it refuses, with a message, if a note would cross a new bar line
  (splitting into ties isn't built).
- React Compiler fixes needed after the move: the "dirty" ref was replaced by comparing with the
  frozen opening score (`setMeta` now runs inside the `header` render prop), and the chord
  clipboard is written through a module-level function.

**Score Writer** (`/score-writer`, `components/scorewriter/ScoreWriter.tsx`)
- A list of scores (cards: title, bars, date; ⋮ / right-click to delete), New score (treble, 4/4,
  eight bars), Import (its own `soniroll.score` JSON, or a Bass Genius transcription file), and the
  editor with title, save state, Export and Delete. `?id=` is kept with `history.replaceState`.
  It's in `NAV_LINKS` (Practice tools), has a new `ScoreIcon`, a split-screen pane and a Help
  topic (whose first-visit intro shows on the list).
- **Storage** (`lib/useScores.ts`): signed in, the `scores` table (`packages/convex/scores.ts`:
  list/get/create/save/remove, 2,000 per account, ~700 KB each, account deletion cascades);
  signed out, localStorage `jam-practice-scores`, so the tool works without an account like every
  tool. The client cleans with `cleanScore` before saving. The server only checks the shape and
  size, because importing the shared cleaner would pull the iReal parser (`ireal-reader`) into
  the backend bundle.

**Shed Notes**
- The Notation button (`editor:insert-notation`, `NoteActions.openScore`) opens
  `components/notation/ScoreDialog.tsx`: the editor in a near-full-screen dialog. A new score is
  only created on the first save; "Add to note" (or ✕, or Ctrl/⌘-Enter) inserts
  ```` ```score\n<id>\n``` ````. With the cursor in a score block, Notation edits that score.
- In the note, a score block is a `ScoreWidget`. CodeMirror widgets live outside React and the
  score needs Convex, so the widget registers its empty DOM node in
  `components/shednotes/embedStore.ts` with the owning editor's `ownerFacet` id (`useId`), and
  `ScoreEmbeds` inside `NoteEditor` portals a read-only `Score` into it. It has a title, Edit
  (double-click works too) and "Open in Score Writer". A ResizeObserver calls
  `view.requestMeasure()` once the score has drawn.
- Old ```` ```abc ```` blocks still render with abcjs (with no edit dialog); the ABC
  `NotationDialog` is gone.
- Gotcha: `scoreEmbeds.ts` next to `ScoreEmbeds.tsx` differed only in case, which breaks on
  case-insensitive filesystems (macOS). It's `embedStore.ts`.

**Verified**
- tsc (web, convex, mobile, core apart from the old `lessonFiles.ts` errors), lint,
  `pnpm build`, `convex dev --once`.
- The real app signed out in headless Chromium:
  - Score Writer: list, new score, G major (typing `f` stored F♯5), eighths, a chord with
    Ctrl-K, 4/4 → 2/4 re-barring the stored measures correctly, bass clef, reload keeping `?id=`;
    phone width in light mode with no overflow (the title row then wrapped).
  - Bass Genius: player → transcription → typing E G A B stored E2 G2 A2 B2 with no clef, drawn
    as before.
- Shed Notes in the esbuild harness with the in-memory Convex fake (now with `scores:*`):
  Notation → type eight notes → Add to note made score `s2` and the block, the note drew it (four
  rows of SVG), and Edit reopened it with all eight notes. No page errors anywhere.

**Not verified**
- Signed in against the real backend (scores in the account, embeds of real scores).
- Playback by ear (piano or bass).
- Real phones and Safari.
- Very long scores inside notes (each embed draws every bar).

**Ideas for later:** split notes into ties when re-barring, MusicXML import of any part (the
current importer takes the bass part), printing or PDF, multiple staves, lyrics.
