# Files, and sharing a tune by link (2026-10-18, web; backend dev deployed)

Jack asked to upload files (e.g. a PDF) to any tune, to share a tune with its files and chord chart,
to upload files that aren't on any tune, and for a file browser showing everything the account
stores.

## Backend (`packages/convex/files.ts`, `lib/tunes.ts`; dev only until the next prod deploy)

- **Table `files`**: userId, storageId, name, mimeType, size, optional `tuneId` (a plain string,
  like `recordings.tuneId`), createdAt/updatedAt. Indexes `by_user`, `by_user_tune`.
- **Upload** is the usual two steps: `generateUploadUrl` (refuses while Mayday "pause uploads" is
  on, or when the account is full), POST the file, then `create({storageId, name, tuneId?})`.
  `create` reads the real size and type from `_storage` (it never trusts the client), and deletes
  the upload and throws when it's over **100 MB** (`MAX_FILE_BYTES`) or over the account's
  **1 GB** (`ACCOUNT_QUOTA_BYTES`). The quota counts **everything** the account stores (uploads,
  recordings, tune songs, lesson files, hand-ins, profile images), via `storedItems`.
- `list`, `listForTune`, `update` (rename; `tuneId` to attach, `null` to detach), `remove`
  (deletes the stored file too).
- **`storage`**: everything the account stores, newest first, each with kind
  (`file | recording | song | lesson | handin | profile`), size, download URL, `tuneId`, and an
  `href` to where it's managed; plus `used`, `quota`, `maxFile`. Lesson files are found through
  the teacher's `lessonStudents` → `lessonItems.fileId`; hand-ins through the student's
  `lessonStudents` → `lessonSubmissions` (filtered by `studentId`, as there's no index on it).
- **Table `sharedTunes`**: userId, tuneId, `snapshot` (a `PublicTune` without notes or chart id),
  createdAt/updatedAt. One per (owner, tune).
  - `shareTune({tuneId})` looks the tune up **on the server** from the owner's own synced lists
    (`ownerTune` in `lib/tunes.ts`) and upserts the row; `unshareTune`; `tuneShare({tuneId})` returns the
    link id or null.
  - `getSharedTune({id})` is open to anyone (null while Community is off, like shared setlists):
    the tune **as it is now**, its linked chart (`resolveLinkedChart`), its files with URLs and its
    recordings. Never its notes. If the owner deleted the tune, it falls back to the snapshot with
    no chart, files or recordings.
  - `copySharedFiles({shareId, tuneId})` (an action): copies the shared tune's files into the
    caller's account, attached to their copy of the tune (`ctx.storage.get` → `store`), skipping any
    that don't fit the caller's quota. Returns `{copied, skipped}`.
- Account deletion deletes `files` (and their storage) and `sharedTunes`.

## Web

- **`/files`** (`components/files/FilesPage.tsx`): Hero with the library tabs (now **Tunes ·
  Setlists · Chord Charts · Files**; on phones the icons hide and "Chord Charts" reads "Charts"),
  Upload, search (names and tune names), a storage bar, filter chips by source and by type, sort
  (newest, name, largest), and one list. Uploads have a ⋮ menu (open, rename, attach / move to a
  tune, detach, delete); other kinds open in place with a link to where they're managed. Dropping
  files anywhere on the page uploads them. Help topic `files` (first-visit intro).
- **A tune's page** (`TuneHub`): a **Files** section under the chart (`TuneFiles`: upload, drop,
  "From my files" to attach existing ones, ⋮ per file with "Remove from this tune") and a **Share**
  button in the header (signed in only) opening `TuneShareDialog` (what's included — chart, N files,
  N recordings, "your notes are never shared" — then make the link / share or copy / open / stop
  sharing).
- **`/tune/<id>`** (`components/files/SharedTunePage.tsx`): name, key badge, time/tempo/keys, the
  chart (transposable; hidden when there's none), files (open in place, download), recordings.
  **Save to my tunes**: uses your tune of the same name if you have one, else adds it to Tunes I
  Know; imports the chart into a "Shared with me" playlist (if your tune has no chart yet); signed
  in, copies the files too (signed out it says "Sign in to copy its files too"). The owner sees
  "This is your tune — open it". Counted as a Community page by the Mayday switch and grouped as
  `/tune/[id]` in usage counts. `/tune` (no id) is still the old redirect.
- Shared pieces in `components/files/FileParts.tsx`: `FileTypeIcon` (type → icon and a theme
  category colour), `FileRow`, `fileDetail`, `FilePreviewDialog` (PDF in an iframe, image, audio,
  video; anything else is a download), `useFileUploader` (multi-file, drop target, progress, error
  text), `useFileActions` (⋮ menu, preview with actions, rename/attach/delete dialogs — portaled
  at z-80 so they open **above** the preview, which is z-70), `FileSelectDialog`, `TuneFiles`.
  `lib/files.ts`: `fileKind`, `formatBytes`, `uploadFile`, `errorText`. New icons in `tools.tsx`:
  `UploadIcon`, `FileIcon`, `DocumentIcon`, `ImageIcon`, `VideoIcon`.
- Privacy policy: files in "Your stuff" (with the 1 GB limit) and shared tunes in "Posts and shared
  links". Terms: "files" added to "Your content".

## Verified

- `tsc` (web, convex), `eslint`, `pnpm build`, Convex push to dev (two tables, four indexes).
- Signed-out calls: `storage` → null, `list` → [], uploads and sharing refused, a bad share id → null.
- In nix Chromium against the dev backend, with a throwaway account made for the test and deleted
  afterwards (with its files and link): uploading a PDF and an image on `/files`, the PDF preview,
  attaching it to a tune from the preview (the bug where the tune picker opened under the preview was
  found and fixed here), renaming from the ⋮ menu, the type filter, the tune page's Files section
  and an upload there, the share dialog, the shared page signed out (files listed and openable,
  the tune's notes **not** on the page), Save to my tunes signed out, a bad link, and 390 px wide
  (no overflow) on `/files`, `/tunes` and a tune page; light and dark. `copySharedFiles` was run
  through the CLI with `--identity` (2 copied, right sizes and tune).

## Not done / not verified

- **Mobile app:** none of this yet (no Files screen, no Files on its tune page, no share link).
  Files attached on web don't show in the app.
- Not exercised: the quota limits for real (a 100 MB+ upload, a full account), video and audio
  previews with real media, Save to my tunes **signed in** through the page (only the action itself,
  via the CLI), and the Mayday "Community off" gate on `/tune/<id>`.
- Convex's free plan has 1 GB of storage for the **whole** deployment, not per account. The 1 GB per
  account limit here is about fairness between people; the plan's total will run out first if
  several people upload a lot. Check usage in the Convex dashboard.
