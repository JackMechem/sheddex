<!-- Moved word for word from the old single PROJECT.md (lines 3683–3721) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### Versioning (2026-10-17)

sheddex is **v0.9.0 beta**, with semantic versioning (PATCH for fixes, MINOR for features, MAJOR at
1.0). There's one source: `"version"` in `apps/web/package.json`.
- `next.config.ts` passes the version in as `NEXT_PUBLIC_APP_VERSION` (`env`), which
  `lib/version.ts` reads. It holds `APP_VERSION`, `CHANNEL` ("beta" until 1.0) and
  `VERSION_LABEL`.
- It shows under the sidebar logo (desktop and phone menu: "v0.9.0" plus a Beta tag;
  `VersionTag` in `Sidebar.tsx`), and as the tooltip on the collapsed logo.
- The dev server reads `next.config.ts` only when it starts, so restart it to see a new version.

### Changelog page and the version-bump routine (2026-10-18, web; backend dev deployed)

`/changelog` ("What's new", `components/changelog/ChangelogPage.tsx`) lists every version, newest
first: a header with the current version and Everything / New / Improved / Fixed filters, a
version list to jump between (desktop), and a timeline of releases, each grouped into New (accent),
Improved (violet) and Fixed (green) cards; `**bold**` works in a line, and each release has a
copy-link anchor (`#v0-9-1`). Reached from the version number under the sidebar logo (desktop and
phone menu; it's now its own link, separate from the logo's link to the landing page), "What's new
· vX" in both sidebar ⋮ menus, and the landing page and dashboard footers. The version tag shows a
"New" pill until the latest version has been opened on that device (`lib/useChangelogUnseen.ts`,
localStorage `jam-practice-changelog-seen`; a first-ever visit counts as seen, so new people
aren't nagged).

- **Entries live in the code:** `apps/web/lib/changelog.ts` `RELEASES`. **Every version bump adds
  an entry at the top** (version, date, title, optional summary, `changes` of kind
  new / improved / fixed), written for people using the site. CHANGELOG.md just points here now.
- **Admin → Changelog** (`components/admin/ChangelogAdmin.tsx`) corrects entries: date, title,
  summary, changes (kind, text, reorder, add, remove), hide a version, with a preview. A correction
  is a `changelogEdits` row (`packages/convex/changelog.ts`: `edits` — open to all —, `saveEdit`
  and `revertEdit` — staff only, input cleaned server-side). It replaces that version's entry on
  the site (`mergeReleases`) and later edits to the file never overwrite it; `base` remembers the
  file's entry at the time, so the panel says "Updated since your edit" when the file changes
  under it, and "Revert to original" drops the row.
- **Bumping:** Jack wants small steps: PATCH (0.9.1, 0.9.2, …) for ordinary updates, features included; MINOR only for a big milestone, and only when he says so. After a bump,
  tell Jack it's a good point to commit.
- 0.9.1 (2026-10-18): the changelog itself, and the Shed Log's Day view / section headings /
  Extra tasks / Log time redesign.

