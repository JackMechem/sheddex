# Changelog

The changelog lives in the app now: **[sheddex.com/changelog](https://sheddex.com/changelog)** ("What's
new", linked from the version number under the sidebar logo).

- **Entries** are in [`apps/web/lib/changelog.ts`](apps/web/lib/changelog.ts) (`RELEASES`, newest
  first). Every version bump adds one there: its version, date, a title, and one line per change
  (`new`, `improved` or `fixed`).
- **Fixing an entry:** Admin → Changelog. A fix is stored in Convex (`changelogEdits`) and replaces
  that version's entry on the site; later changes to the file never overwrite it, and "Revert"
  brings the original back.

## Versioning

sheddex uses [semantic versioning](https://semver.org): **MAJOR.MINOR.PATCH**, in small steps:
each update bumps PATCH (0.9.1, 0.9.2, …), features included; MINOR is saved for a big milestone,
and MAJOR for 1.0. The version lives
in `apps/web/package.json` (shown under the sidebar logo); it's **beta** until 1.0
(`apps/web/lib/version.ts`).
