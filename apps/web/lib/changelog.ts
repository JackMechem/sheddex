/**
 * The changelog shown at /changelog — one entry per version, newest first.
 *
 * **Adding a release** (whenever the version in apps/web/package.json is bumped): put a new entry
 * at the top of RELEASES with the same version, today's date, a short title, and one line per
 * change. Kinds: "new" (a feature), "improved" (a change to something that existed), "fixed" (a
 * bug). `**bold**` works inside a line. Write for the people using the site, not for developers.
 *
 * The admin panel (Admin → Changelog) can correct any entry; those corrections live in Convex
 * (`changelogEdits`) and replace the entry below on the site, so editing this file never undoes
 * them. Keep a version's entry here even after it's been edited there.
 */

export type ChangeKind = "new" | "improved" | "fixed";

export type Change = { kind: ChangeKind; text: string };

export type Release = {
  /** "0.9.1" — must match the version it describes. */
  version: string;
  /** "YYYY-MM-DD". */
  date: string;
  title: string;
  summary?: string;
  changes: Change[];
};

export const CHANGE_KINDS: { kind: ChangeKind; label: string }[] = [
  { kind: "new", label: "New" },
  { kind: "improved", label: "Improved" },
  { kind: "fixed", label: "Fixed" },
];

export const RELEASES: Release[] = [
  {
    version: "0.9.2",
    date: "2026-10-18",
    title: "Hello, soniroll — and Files",
    summary: "sheddex is now soniroll, with a new logo. Plus a home for your files: upload, rename, share and delete everything your account stores.",
    changes: [
      { kind: "new", text: "**A new name:** sheddex is now **soniroll**, at soniroll.com. Old sheddex.com links still work and bring you here. The Shed Log keeps its name." },
      { kind: "new", text: "**A new logo:** the daily goal ring, drawn in your theme's colours so it matches whichever theme you pick." },
      { kind: "new", text: "**Files:** upload PDFs, lead sheets, images, audio and video to your account, on their own or attached to a tune. Drop files anywhere on the Files page to upload them." },
      { kind: "new", text: "**Everything in one place:** the Files page lists everything your account stores (uploads, recordings, tune songs, lesson files, hand-ins and profile images), with search, filters and columns you can sort by." },
      { kind: "new", text: "**Rename, share and delete anything** from its ⋮ menu or by right-clicking it. Tick several files to delete them together." },
      { kind: "new", text: "**Share a file by link:** anyone with the link can open and download it, no account needed, and save a copy to their own files if they're signed in." },
      { kind: "new", text: "**Share a tune by link** with its chord chart, files and recordings (never your notes). Whoever opens it can save it to their own tunes." },
      { kind: "new", text: "A **Files** section on every tune's page: upload there, or add files you've already uploaded." },
      { kind: "improved", text: "Every account has **100 MB** of storage for uploads, recordings, songs and lesson files. The Files page shows how much you've used." },
      { kind: "improved", text: "The sidebar is grouped into **Your shed** (Shed Log, Library), **People** (Community, Lessons) and **Tools**. The Tunes card is now **Library**." },
      { kind: "improved", text: "Supporting soniroll is easier to find: a Support row in the sidebar, a card on the dashboard, and a Support page that explains where the money goes." },
      { kind: "improved", text: "Chord chart links now start with soniroll://. Links made before still import." },
      { kind: "improved", text: "Emails (sign-up codes, password resets, lesson invites) now come from soniroll." },
    ],
  },
  {
    version: "0.9.1",
    date: "2026-10-18",
    title: "A day view for the Shed Log, and a changelog",
    summary: "Plan and log one day at a time, with clearer sections. And this page, so you can see what's changed.",
    changes: [
      { kind: "new", text: "**What's new:** this changelog. Open it from the version number under the logo, or from the sidebar's ⋮ menu." },
      { kind: "new", text: "**Shed Log day view:** a Day option next to Month and Week hides the calendar and gives the day the whole page." },
      { kind: "improved", text: "The Shed Log's day is split into clear sections, each with a heading: Progress, Routines, Extra tasks, Log time, Notes and Recordings." },
      { kind: "improved", text: "**Extra tasks** (one-off tasks for just that day) sit below your routines, with an Add button and bigger checkboxes and buttons on phones." },
      { kind: "improved", text: "**Log time:** add practice you did without the timer in one tap (+5 min up to +1 h), with Undo. Or pick another amount, or log it on a particular task." },
      { kind: "fixed", text: "On phones you can now remove a subtask (its × only showed on hover)." },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-10-17",
    title: "The first public beta",
    summary: "Everything soniroll does, out in the open for the first time.",
    changes: [
      { kind: "new", text: "**Practice tools:** Metronome (with changing meters), Polyrhythm Metric Modulation metronome, Tempo Trainer, Tuner, Note / Scale / Interval Trainers with mic listen modes, Practice Timer, Recorder (with a tune's song and a mixer), Slow Downer." },
      { kind: "new", text: "**Play along:** Jam Practice, Bass Genius (walking bass, chords and drums over your charts, and bass players learned from transcriptions), Drum Generator (32 styles), Random Sticking Warmup, Syncopation." },
      { kind: "new", text: "**Ear training:** Guess the Interval, Chord and Progression, with a levelled Learn mode." },
      { kind: "new", text: "**Library:** Tunes I Know and Tunes to Learn, setlists, and chord charts (iReal Pro import, an editor, playlists)." },
      { kind: "new", text: "**Shed Log:** a practice calendar with routines, a day timer, goals, streaks and progress cards." },
      { kind: "new", text: "**Community:** profiles, follows, and posts (tunes, setlists, routines, milestones)." },
      { kind: "new", text: "**Lessons:** teachers and students, a page per lesson, assignments with hand-ins and feedback, lesson notes, booking with calendar invites." },
      { kind: "new", text: "**Feedback:** a Report a bug button on every page, plus /feedback for ideas and anything else. Report posts or profiles, and see what you've sent and its status." },
      { kind: "improved", text: "Shared soniroll links show a preview card with the logo." },
      { kind: "fixed", text: "On iPhone and iPad, sound plays with silent mode on." },
    ],
  },
];

/** An admin correction to a release, from Convex. */
export type ReleaseEdit = { version: string; release: Release; hidden: boolean; base: string };

export type ShownRelease = Release & { edited: boolean; hidden: boolean; originalChanged: boolean; original: Release };

/** What the site shows: each release from the file, replaced by its admin correction if it has
    one. `originalChanged`: the file's entry changed after the correction was made. */
export function mergeReleases(releases: Release[], edits: ReleaseEdit[] | undefined): ShownRelease[] {
  const byVersion = new Map((edits ?? []).map((e) => [e.version, e]));
  return releases.map((r) => {
    const e = byVersion.get(r.version);
    if (!e) return { ...r, edited: false, hidden: false, originalChanged: false, original: r };
    return { ...e.release, version: r.version, edited: true, hidden: e.hidden, originalChanged: e.base !== releaseKey(r), original: r };
  });
}

/** A stable string for a release's content (used to notice the file changing under an edit). */
export function releaseKey(r: Release): string {
  return JSON.stringify({ date: r.date, title: r.title, summary: r.summary ?? "", changes: r.changes });
}

/** "October 18, 2026". */
export function formatReleaseDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "v0-9-1" — the anchor for a release on /changelog. */
export function releaseAnchor(version: string): string {
  return `v${version.replace(/\./g, "-")}`;
}

/** The latest version someone has seen on /changelog, per device. */
export const CHANGELOG_SEEN_KEY = "jam-practice-changelog-seen";
