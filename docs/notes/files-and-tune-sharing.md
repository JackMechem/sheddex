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
  the upload and throws when it's over **100 MB** (`MAX_FILE_BYTES`) or doesn't fit the account's
  limit. The limit counts **everything** the account stores (uploads, recordings, tune songs, lesson
  files, hand-ins, profile images). See "The storage limit" below.
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
- See "The storage limit" below for how the per-account limit relates to Convex's free plan.

## The storage limit: 100 MB per account (2026-10-18)

First built as 1 GB per account, then lowered to **100 MB** after Jack asked whether 30 users would
stay on Convex's free plan. They wouldn't at 1 GB: the free plan has **1 GB of file storage for the
whole deployment (backups included)** and **1 GB a month of downloads (data egress)** — every
played recording, opened PDF or profile picture counts — plus 0.5 GB of database.

- **`packages/convex/lib/storage.ts`** holds it all now (moved out of `files.ts`):
  `ACCOUNT_QUOTA_BYTES` (100 MB), `MAX_FILE_BYTES` (100 MB), `storedItems` / `bytesUsed`,
  `quotaFor(ctx, userId)` (the one place a per-account limit comes from — everyone gets the same
  for now), `assertHasRoom` (before handing out an upload URL) and `assertFits` (once the upload
  has arrived: deletes it and throws if it's too big or doesn't fit; `replacing` frees the size of
  a tune's old song).
- **Every upload path checks it**: `files` (URL + create), `recordings` (URL + create),
  `tuneSongs.set` (fits, counting the replaced song as freed), `lessons.generateUploadUrl` and
  `generateSubmitUploadUrl` (refused when already full — lesson files and hand-ins aren't checked
  again after upload, so one upload can take an account a little past 100 MB). Profile pictures
  and feedback screenshots aren't limited (small, resized).
- Existing data over the limit isn't touched; those accounts just can't upload more until they
  delete something.
- Web: the Files page says how much every account has, turns the note red when full, and says
  "Need more room? Plans with more storage are coming." Recording, song and lesson-file errors now
  show the backend's message (`errorText`) instead of the raw Convex error. Help topic and privacy
  policy say 100 MB.
- Checked on a local throwaway Convex backend: two 60 MB uploads — the first saved, the second
  refused with the "There isn't room" message and deleted (usage stayed at 60 MB).
- 30 accounts × 100 MB is still 3 GB, so the free plan isn't guaranteed if everyone fills up; a
  site-wide stop (refuse uploads when the whole deployment nears ~800 MB) was suggested but not
  built yet.

## Planned: paid plans for more storage

Jack wants people to be able to **subscribe for more storage** later (100 MB stays free). Not built.
When it is:
- `quotaFor` in `lib/storage.ts` returns the account's plan limit (e.g. from a `subscriptions` table
  kept up to date by the payment provider's webhook).
- Payments: Stripe, or Lemon Squeezy / Paddle (they handle sales tax as merchant of record). A
  checkout, a webhook into Convex, a "manage subscription" link on the Account page.
- Convex: paid storage pushes past the free plan, so move to the pay-as-you-go plan and price the
  subscription above what the storage and downloads cost.
- Wording: the landing page, README and privacy policy say sheddex is free and non-commercial;
  they'd need updating (the tools stay free), plus Terms (payments, refunds, cancelling).
- **Licenses first:** the Rhodes samples (jRhodes3d, Jeff Learman) are **CC BY-NC**. A site with a
  paid tier is arguably commercial even though the Rhodes itself stays free — ask the author for
  permission or switch to a CC0 / CC BY Rhodes **before** charging. Re-check the other samples'
  licenses too (they're CC0 / CC BY today).
