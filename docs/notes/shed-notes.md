# Shed Notes

## First version (2026-10-20, branch `feat/shed-notes`)

Jack asked for "Shed Notes": a full note-taking app like Obsidian that also works with the Shed
Log, tunes and other notes. That means markdown with a rich live preview, music notation you can
make and insert, full vim keys (off by default, with a toggle), `[[links]]` between notes with
backlinks and forward links, notes attached to a day's routine (the routine card's Add notes button
opens a menu to make a note or pick an existing one), a sidebar entry under the Shed Log, and
settings in a JSON file only (custom keybindings and vim commands).

**What was built**
- **Backend** (`packages/convex/shedNotes.ts`, tables `shedNotes` and `shedNoteLinks`): one
  markdown note per row. `titleKey` (lowercased) is unique per account, so `[[Title]]` always means
  one note. `links` (the title keys a note links to) and `tags` are recomputed on every save, so
  backlinks are a lookup in `list`. There's a search index on `body` for full-text search.
  `shedNoteLinks.target` is a string from `packages/core/shedNotes.ts`'s `targetKey`:
  `day:<date>`, `day:<date>/routine:<id>` or `tune:<id>`. Because a day and its routines share the
  `day:<date>` prefix, `attachedTo({prefix})` can range-scan one index. `rename` rewrites
  `[[Old]]` (keeping `#heading` and `|alias`) in every note that links to it. `remove` leaves
  links to the deleted note in other notes, and opening one makes the note again (as Obsidian
  does). Limits: 200,000 characters a note, 5,000 notes, 50 notes per target. Account deletion
  cascades both tables. The preview seed adds two linked notes (one with notation), one of them
  attached to today's routine.
- **Shared logic** (`packages/core/shedNotes.ts`): wikilink parsing (ignores code), `linkKeys`,
  `renameLinks`, `findTags`, `noteSnippet` (notation becomes ♪), `cleanTitle` (drops `[ ] | #`),
  `uniqueTitle`, `cleanFolder`, `targetKey` / `parseTargetKey`.
- **Editor** (`components/shednotes/NoteEditor.tsx`) is **CodeMirror 6**, the editor Obsidian is
  built on, with `@replit/codemirror-vim`, the same vim port Obsidian uses. Tiptap (used by
  Lessons' `RichNote`) was ruled out because ProseMirror has no real vim mode. The text stays
  markdown; `livePreview.ts` hides marks wherever the cursor isn't and adds:
  - heading sizes;
  - bullets in place of `-`;
  - clickable checkboxes for `- [ ]`;
  - a rule for `---`;
  - a quote bar;
  - `[[links]]`: a click opens the note in Preview, Ctrl/⌘-click in Source; dimmed when the note
    doesn't exist yet;
  - `#tags` as pills and `==highlight==`;
  - ```` ```abc ```` / ```` ```music ```` blocks drawn as notation by **abcjs**, which is
    lazy-loaded and coloured with `currentColor`. A block is replaced by the notation while the
    cursor is outside it; inside, the source shows with a live preview under it. "Edit notation"
    opens the dialog.

  The notation blocks are a `StateField` (block decorations can't come from a ViewPlugin).
  `editorSetup.ts` holds the theme (all CSS tokens), the highlight style and the `[[`
  autocomplete. The editor is created once per note (the parent keys it); settings flow in
  through compartments.
- **Notation** (`NotationDialog.tsx`): title, key, time, clef and tempo become the ABC header.
  The body is a text box, plus click-to-add notes (length, octave, accidental), rests, bars,
  repeats, triplet, tie, beam break and chord symbols, plus three templates, with a live preview.
  It's saved as a ```` ```abc ```` block. The `?` explains ABC.
- **Commands** (`commands.ts`): one list of ids (`editor:*`, `note:*`, `view:*`, `app:*`) used by
  keybindings, vim `:` commands and the command palette (Ctrl/⌘-P). Ctrl/⌘-O is the quick
  switcher, which makes a note by that name if nothing matches.
- **Settings file** (`lib/shedNotesConfig.ts`, edited in `SettingsPane.tsx` at
  `/shed-notes?id=settings`): JSON in synced settings key `jam-practice-shed-notes`, with
  `configText` (exactly as typed) and `goodText` (the last version that parsed, so a half-typed
  file doesn't flip vim off mid-edit). Settings: `vimMode`, `livePreview`, `lineNumbers`,
  `readableLineLength`, `fontSize`, `spellcheck`, `keybindings: [{key, command}]` and
  `vim: {leader, mappings: [vimrc lines], exCommands: {name: commandId}}`. The toolbar's
  Vim / Preview switches rewrite the JSON (`setConfigValue`); they refuse while it's invalid.
  Reference lists every setting and command.
- **Vim** (`vimSetup.ts`): vim's maps are global, so `Vim.mapclear()` runs and the mappings are
  re-applied whenever the file changes. Built-in ex commands: `:w` (save now), `:q`, `:wq`,
  `:e Title`, `:new [Title]`, `:cmd <id>`. **Settings keybindings are `Prec.highest` and come before
  vim**, so Ctrl-P reaches the palette in normal mode (vim was eating it).
- **Page** (`/shed-notes[?id=]`, `ShedNotes.tsx`): the note list (folders, A–Z or Recent, search
  over titles, folders and `#tags` instantly plus body text from the server, ⋮ / right-click to
  rename, move, delete or rename a folder); the note (title field, where renaming rewrites links;
  back/forward history; Preview/Source; Vim; Links; formatting buttons; ⋮); and `LinksPanel` (what
  it's attached to, backlinks, forward links, tags). On phones the list and the note are separate
  screens. The address bar is kept with `history.replaceState`, never the router (see the tiling
  trap). It's also a split-screen pane (`toolRegistry`).
- **Integration** (`AttachedNotes.tsx`): routine cards, the day panel's Notes section and the
  tune page (new "Shed Notes" panel, signed in) list the attached notes. Add notes opens a menu
  (a bottom sheet on phones): "New note" (titled e.g. "Pad Warmup · Oct 20", attached, opened in
  `NoteDialog`) or pick an existing one. `NoteDialog` is the full editor in a dialog with "Take
  off …" and "Open in Shed Notes". **Old plain-text notes** (`Occurrence.notes`, `DayLog.notes`)
  still show and can be edited wherever they exist, with "Make it a Shed Note" (makes an attached
  note from the text, then clears it). The routine ⋮ menu lost "Notes for this day". The tune
  editor's own notes field is unchanged: it goes out with shared tunes.
- Also: `ShedNotesNavCard` under the Shed Log card (note count, last edited), a `NAV_LINKS` entry
  (kept out of the tool list like the Shed Log), a Help topic, a `shedNotes` feature switch on
  Settings, and the privacy page (stored data, deletion; date bumped).

**Verified**
- tsc (web, convex, mobile; core has only the old `lessonFiles.ts` errors), `pnpm lint`,
  `pnpm build`, and `npx convex dev --once` (indexes and the search index were created on dev).
- Pure logic in Node (21 checks: links in and out of code, aliases and headings, rename, tags,
  titles, targets, snippets, config errors, vimrc lines).
- In headless Chromium, the real components bundled with esbuild and injected into a signed-out
  page (so the site's CSS and theme apply), with `convex/react` aliased to an in-memory fake of
  these functions:
  - live preview and Source, dark and light, at 1440 and 390;
  - link click (opening, and making a missing note), checkbox toggle;
  - vim `dd` / `u` / `O`, an `imap jk <Esc>` mapping from the settings, `:w`;
  - `[[` completion, the palette with vim on;
  - the notation dialog (desktop and phone);
  - new note → title → link → follow → backlinks → rename rewriting the other note;
  - the Vim switch writing the JSON, the settings file and Reference;
  - Add notes → new note in the dialog → attach an existing note;
  - the phone list and note screens. No page errors, no overflow.
- Signed out on the real dev server: the `/shed-notes` gate, the sidebar card, the Help topic.

**Not verified**
- Anything signed in against the real backend (no test account here, and bypassing the gate was
  refused): the real Convex functions, rename and search in production, the routine card, day
  panel and tune page in place, account deletion.
- Real phones (iOS keyboard with CodeMirror, touch on checkboxes), Safari, hover styles.
- Large notes' performance, two tabs editing one note (last write wins).

**Not built (ideas for later):** a graph view, embeds (`![[note]]`), playing notation back, Lessons
notes as Shed Notes (they're shared teacher → student), task and day-task notes, mobile.
