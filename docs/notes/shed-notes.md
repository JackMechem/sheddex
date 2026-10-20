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

**Later the same day:** the ABC notation dialog was replaced. Notation in a note is now a
Score Writer score, written in the shared notation editor (see `score-writer.md`); old
```` ```abc ```` blocks still display.

**Not built (ideas for later):** a graph view, embeds (`![[note]]`), playing notation back, Lessons
notes as Shed Notes (they're shared teacher → student), task and day-task notes, mobile.

**Polish (2026-10-20):**
- The note dialog's writing area is inset and framed (`px-5 pb-4`, a rounded `bg-background` box;
  the editor is absolutely positioned, so padding on its own box did nothing).
- Vim's status bar is a floating pill in the editor's bottom-left corner. `NoteEditor` sets
  `data-vim-mode` on the editor from vim's `vim-mode-change` and gives vim's mode label the class
  `cm-vim-mode`; `editorSetup.ts` hides the "--NORMAL--" text and draws a dot and "Normal",
  "Insert" (a filled accent pill) or "Visual". Pending keys show beside it; `:` widens it into the
  command line.
- Both side panels fold away on desktop with `PanelButton` (the Shed Log's panel icon): the note
  list from the left of the toolbar, the links from its right (replacing the "Links" pill).
  Stored per device in `jam-practice-shed-notes-view` (`listHidden`, `linksHidden`).

Checked in the esbuild harness: the dialog at 900×1184, the pill in every mode in dark and light,
and both panels hiding (with the stored flags). Not on a real phone.
- Narrow panes (2026-10-20): the note pane is a CSS container (`@container`), and the links sit
  beside the note only when the pane is at least `@4xl` (56rem); narrower, they go below the note
  (capped at 40% of the height, scrolling). The toolbar wraps, "Saved" and the folder path hide
  when it's tight, and the title is an auto-growing textarea that wraps instead of being cut off.
  Before this, at about 1400 px with the sidebar and note list open, the toolbar ran over the links.

**Tables, links, page pills (2026-10-20):**
- Tables (`components/shednotes/tables.ts`): a `StateField` finds GFM tables by lines (skipping
  code fences) and draws each as an HTML table (alignment from the dashes line; bold, italic,
  strikethrough, code and links in cells, escaped first) while the cursor is elsewhere; clicking a
  cell puts the cursor in it. With the cursor in it, the source lines get `cm-table-src` (fixed-
  width, nothing adding width). Tab / Shift+Tab (`Prec.high`) re-pads every column
  (`formatTable`) and selects the next / previous cell's text; Tab in the last cell adds a row.
  "Table" in the formatting row (`editor:insert-table`) inserts a 3-column starter.
- Links: a link opens on a plain click whenever it's drawn as a link (`data-live`), Ctrl/⌘-click
  any time — before, a click near where the cursor was did nothing. Bare `https://…` (GFM `URL`)
  and `<…>` autolinks are links too. `openHref`: web in a new tab, site paths ("/tunes") through
  `NoteActions.openPath` (the router), mailto/tel as they are.
- `[[note]]` links and links to site pages are `cm-page-pill`: accent-tinted rounded pills with a
  page icon (a CSS mask); a missing note is a dashed pill.
- Checked in the editor harness: the table drawn with its alignments, all five kinds of link
  opening the right way with the cursor on their line, cell click → source, Tab tidying and
  selecting, a new row from the last cell. Not on a phone.

**Keys for everything, and a search menu (2026-10-20):**
- `DEFAULT_CONFIG.keybindings` now gives every command a key (40; checked: none missing, no
  duplicates). The settings file's `keybindings` are merged on top: a key listed there replaces
  that key's built-in command, `"command": ""` turns it off — so files written before keep
  getting new built-in keys. Keys show as "⌘⇧F" / "Ctrl+Shift+F" (`keyLabel`, `keysFor` in
  `commands.ts`) in the palette, the Reference and the buttons' tooltips. Browser-reserved keys
  (Ctrl-N/T/W, Ctrl-Shift-Q, Ctrl-1…9) are avoided; headings are Ctrl/⌘-Alt-1…6.
- New commands: `app:search`, `view:toggle-note-list`, `view:toggle-links-panel`.
- Search menu (`NoteSearch.tsx`): `/` outside a note (a capture-phase listener that stops the
  site's tool search on this page; the tool search is still in the sidebar) or Ctrl/⌘-Shift-F.
  Titles, folders and #tags match at once, text through `shedNotes.search`, which now returns
  the excerpt around the first matching word; matches highlighted. A search button sits by the gear.
- Checked in the full-page harness: / opens it (and types a slash inside a note), a text match
  opens its note, Ctrl+Shift+F from the editor, heading / bullet / numbered / quote / table /
  rename / note-list keys, palette key labels.

**Create a note from a link (2026-10-20):** typing `[[` with a name no note has adds a last
suggestion, **Create “…”** (`wikilinkCompletion`, type "create", styled by `optionClass`): it
inserts the link and makes the note (`NoteActions.createLinkedNote`) in the current note's folder,
staying on the current note. Clicking a link to a missing note now also makes it in the current
note's folder (was the top level). Lesson notes don't offer it (no `createLinkedNote` there).
Checked in the harness: `[[Bass lines` → Create → note in "Practice", link inserted, still on the
same note; clicking a dashed link made "Ear training plan" in "Practice" and opened it.

**Per-note width and font (2026-10-20):** `shedNotes.view` ({ fullWidth?, font? }), set by
`shedNotes.setView` (null clears; doesn't touch `updatedAt`). The note pane's toolbar has a font
`Select` (the site's `FONTS`, or "Site font") and a full-width button (`view:toggle-full-width`,
Ctrl/⌘-Alt-F); the note's choice overrides the general `readableLineLength`, and the font applies
to the title and the editor (`NoteEditor`'s `fontFamily`). Checked in the harness: full width and
Lora stick to one note and not another, Ctrl+Alt+F toggles.

**Folders: empty folders, clearer tree, drag and drop (2026-10-20):**
- `shedNoteFolders` (userId, path): folders made with New folder, so they can be empty (account
  deletion cascades it). The tree is these plus every note's `folder`. `shedNotes.createFolder`,
  `renameFolder` (also a move: everything inside goes along, subfolders and notes; refuses to put
  a folder inside itself), `deleteFolder` (what's inside moves up to the parent; no note is
  deleted), `folders` (the list).
- `NoteList.tsx` rewritten: folder icons (open/closed), bold names, counts, a guide line down
  each folder's contents, "Empty" for an empty folder; on every folder row New note here, New
  folder inside and ⋮ (rename — name only; move — the folder to go into; delete). New folder no
  longer makes a note.
- Drag and drop (HTML5, mouse): notes onto folders, folders into folders, and onto the "Drop here
  for the top level" strip at the bottom. Phones use Move in the ⋮ menus.
- The note toolbar's font menu became an "Aa" button (it was wrapping the toolbar).
- Checked in the harness: empty folder, subfolder and note from the row buttons, a note dragged
  into a folder, a folder (with its note) into another, a folder into its own subfolder refused,
  a note to the top level, deleting a folder moving its contents up. Not checked with real mouse
  drags (Playwright's dragTo is flaky on this list; the HTML drag events were checked directly).
