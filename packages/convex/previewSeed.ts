import { createAccount } from "@convex-dev/auth/server";
import { toDateKey, type DayLog, type PracticeLogData, type Routine } from "@jam-practice/core/practiceLog";
import { toPublicTune } from "@jam-practice/core/profileTunes";
import { TUNES_TO_LEARN_KEY } from "@jam-practice/core/tunesToLearn";
import type { Tune } from "@jam-practice/core/types";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";

/**
 * Demo data for **Vercel preview deployments** (see docs/guides/deploying.md). The Vercel build
 * runs `npx convex deploy --preview-run previewSeed:seed`; Convex only runs that on preview
 * deployments, never on prod. Each preview backend starts empty, so this makes:
 *
 * - a demo account you can sign in as (`demo@sheddex.test`, password from the preview-only
 *   environment variable `PREVIEW_DEMO_PASSWORD`), with tunes, chord charts, setlists, a public
 *   profile and three weeks of Shed Log history;
 * - a second demo musician (@maya.plays, no password, can't sign in) with tunes and a Community
 *   post, so the feed, profiles and following have something in them.
 *
 * Safe to run again: it does nothing once the demo account exists (a preview is reused for every
 * push to its branch). It also refuses to run without `PREVIEW_DEMO_PASSWORD` or on a backend that
 * already has real accounts, so it can't add demo data to dev or prod by accident.
 */

const DEMO_EMAIL = "demo@sheddex.test";
const MAYA_EMAIL = "maya@sheddex.test";
const MAX_EXISTING_USERS = 5;

export const seed = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const password = process.env.PREVIEW_DEMO_PASSWORD;
    if (!password) {
      console.log("previewSeed: PREVIEW_DEMO_PASSWORD isn't set, so no demo data was added.");
      return "skipped: no PREVIEW_DEMO_PASSWORD";
    }
    const state = await ctx.runQuery(internal.previewSeed.state, {});
    if (state.demoExists) return "skipped: already seeded";
    if (state.userCount > MAX_EXISTING_USERS) {
      throw new Error("previewSeed: this backend already has accounts — it doesn't look like a fresh preview.");
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: DEMO_EMAIL, secret: password },
      profile: { email: DEMO_EMAIL, name: "Demo" },
    });
    await ctx.runMutation(internal.previewSeed.fill, { userId: user._id });
    return "seeded";
  },
});

export const state = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(MAX_EXISTING_USERS + 1);
    const demo = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", DEMO_EMAIL))
      .first();
    return { userCount: users.length, demoExists: demo !== null };
  },
});

export const fill = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    // Sign-in with a password asks for an emailed code until the email is verified.
    await ctx.db.patch(userId, { emailVerificationTime: now });
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
      .first();
    if (account) await ctx.db.patch(account._id, { emailVerified: DEMO_EMAIL });

    await ctx.db.insert("profiles", {
      userId,
      username: "demo",
      instruments: ["Piano", "Upright bass"],
      isPublic: true,
      showPracticeStats: true,
      updatedAt: now,
    });

    // Chord charts, then tunes linked to them.
    const playlistId = await ctx.db.insert("chordChartPlaylists", { userId, name: "Jazz standards", createdAt: now });
    const chartIds: Record<string, Id<"chordChartSongs">> = {};
    for (const song of DEMO_CHARTS) {
      const songId = await ctx.db.insert("chordChartSongs", {
        userId,
        playlistId,
        title: song.title,
        composer: song.composer,
        style: song.style,
        key: song.key,
        timeSignature: song.timeSignature,
        createdAt: now,
      });
      await ctx.db.insert("chordChartSongBars", { songId, bars: song.bars });
      chartIds[song.title] = songId;
    }

    const known: Tune[] = [
      tune("Autumn Leaves", [120, 160], ["G-", "E-"], "4/4", chartIds["Autumn Leaves"]),
      tune("Blue Bossa", [140], ["C-"], "4/4", chartIds["Blue Bossa"]),
      tune("F Blues", [120, 180], ["F", "Bb"], "4/4", chartIds["F Blues"]),
      tune("All the Things You Are", [150], ["Ab"], "4/4"),
      tune("Someday My Prince Will Come", [160], ["Bb"], "3/4"),
    ];
    const toLearn: Tune[] = [tune("Stella by Starlight", [130], ["Bb"], "4/4"), tune("Footprints", [140], ["C-"], "6/4")];
    await setSetting(ctx, userId, "tunes", known);
    await setSetting(ctx, userId, TUNES_TO_LEARN_KEY, toLearn);
    await setSetting(ctx, userId, "jam-practice-setlists", {
      setlists: [
        {
          id: "demo-setlist-friday",
          name: "Friday night gig",
          description: "First set at the café",
          tuneIds: [known[0].id, known[1].id, known[2].id, known[4].id],
          overrides: { [known[1].id]: { tempo: 150 } },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    await setSetting(ctx, userId, "jam-practice-practice-log", practiceLog(now, known[0].name));

    // A second musician, with a Community post, who follows (and is followed by) the demo account.
    const mayaId = await ctx.db.insert("users", { name: "Maya Chen", email: MAYA_EMAIL });
    await ctx.db.insert("profiles", {
      userId: mayaId,
      username: "maya.plays",
      instruments: ["Tenor saxophone"],
      isPublic: true,
      updatedAt: now,
    });
    const mayaTunes = [
      tune("Take the A Train", [180], ["C"], "4/4"),
      tune("Solar", [160], ["C-"], "4/4"),
      tune("Blue Bossa", [150], ["C-"], "4/4"),
    ];
    await setSetting(ctx, mayaId, "tunes", mayaTunes);
    await ctx.db.insert("communityTunes", {
      userId: mayaId,
      title: "Tunes for Thursday's jam",
      description: "Bring these and we'll call them in any order.",
      tunes: mayaTunes.map(toPublicTune),
      unlisted: false,
      createdAt: now - 2 * 3_600_000,
    });
    await ctx.db.insert("follows", { followerId: userId, followingId: mayaId, createdAt: now });
    await ctx.db.insert("follows", { followerId: mayaId, followingId: userId, createdAt: now });
  },
});

async function setSetting(ctx: MutationCtx, userId: Id<"users">, key: string, value: unknown) {
  await ctx.db.insert("syncedSettings", { userId, key, value: JSON.stringify(value), updatedAt: Date.now() });
}

let nextId = 0;
function id(prefix: string) {
  nextId += 1;
  return `demo-${prefix}-${nextId}`;
}

function tune(name: string, tempos: number[], keys: string[], timeSignature: string, chartId?: string): Tune {
  return {
    id: id("tune"),
    name,
    tempos: tempos.map((value, i) => ({ id: id("tempo"), value, enabled: i === 0 })),
    keys: keys.map((value, i) => ({ id: id("key"), value, enabled: i === 0 })),
    timeSignature,
    notes: "",
    ...(chartId ? { chordChartId: chartId } : {}),
  };
}

// The chart shapes from @jam-practice/core/iRealPro, written out here because importing that file
// would pull its iReal-link parser (an npm package) into the Convex bundle.
type ChordSlot = { kind: "chord"; letter: string; accidental?: "b" | "#"; quality: string; bass?: { letter: string; accidental?: "b" | "#" } };
type Bar = { content: { kind: "chords"; slots: ChordSlot[] } | { kind: "repeat" }; section?: string; newRow?: boolean };
type IRealSong = { title: string; composer: string; style: string; key: string; timeSignature: { top: number; bottom: number }; bars: Bar[] };

/** "Bb7b9/D" → a chord slot, in iReal's spelling (the same result as core's `parseChordToken`). */
function chord(token: string): ChordSlot {
  const m = /^([A-G])([b#]?)(.*?)(?:\/([A-G])([b#]?))?$/.exec(token);
  if (!m) throw new Error(`previewSeed: bad chord "${token}"`);
  const [, letter, acc, quality, bassLetter, bassAcc] = m;
  return {
    kind: "chord",
    letter,
    ...(acc ? { accidental: acc as "b" | "#" } : {}),
    quality,
    ...(bassLetter ? { bass: { letter: bassLetter, ...(bassAcc ? { accidental: bassAcc as "b" | "#" } : {}) } } : {}),
  };
}

/** One bar per string: chords separated by spaces, "%" for a repeat bar, "A:" in front to start a
    section. */
function bars(text: string[]): Bar[] {
  return text.map((raw) => {
    const match = /^([A-Z]):\s*(.*)$/.exec(raw);
    const section = match?.[1];
    const body = (match ? match[2] : raw).trim();
    const bar: Bar =
      body === "%" ? { content: { kind: "repeat" } } : { content: { kind: "chords", slots: body.split(/\s+/).map(chord) } };
    return section ? { ...bar, section, newRow: true } : bar;
  });
}

const DEMO_CHARTS: IRealSong[] = [
  {
    title: "Autumn Leaves",
    composer: "Joseph Kosma",
    style: "Medium Swing",
    key: "G-",
    timeSignature: { top: 4, bottom: 4 },
    bars: bars([
      "A: C-7", "F7", "Bb^7", "Eb^7", "Ah7", "D7b9", "G-6", "%",
      "C-7", "F7", "Bb^7", "Eb^7", "Ah7", "D7b9", "G-6", "%",
      "B: Ah7", "D7b9", "G-6", "%", "C-7", "F7", "Bb^7", "Eb^7",
      "Ah7", "D7b9", "G-7 C7", "F-7 Bb7", "Ah7", "D7b9", "G-6", "%",
    ]),
  },
  {
    title: "Blue Bossa",
    composer: "Kenny Dorham",
    style: "Bossa Nova",
    key: "C-",
    timeSignature: { top: 4, bottom: 4 },
    bars: bars([
      "A: C-7", "%", "F-7", "%", "Dh7", "G7b9", "C-7", "%",
      "Eb-7", "Ab7", "Db^7", "%", "Dh7", "G7b9", "C-7", "Dh7 G7b9",
    ]),
  },
  {
    title: "F Blues",
    composer: "Traditional",
    style: "Medium Swing",
    key: "F",
    timeSignature: { top: 4, bottom: 4 },
    bars: bars(["A: F7", "Bb7", "F7", "C-7 F7", "Bb7", "Bo7", "F7", "A-7 D7", "G-7", "C7", "F7 D7", "G-7 C7"]),
  },
];

/** A daily routine and the past three weeks of practice on it (a few days missed). */
function practiceLog(now: number, tuneName: string): PracticeLogData {
  const day = 86_400_000;
  const start = toDateKey(new Date(now - 21 * day));
  const routine: Routine = {
    id: "demo-routine-warmup",
    name: "Daily warm-up",
    description: "Long tones, scales, then a tune.",
    color: 0,
    icon: "note",
    startTime: "09:00",
    repeat: { freq: "daily", interval: 1, weekdays: [], start, end: null },
    tasks: [
      { id: "demo-task-tones", title: "Long tones", minutes: 10, time: null, notes: "", attachments: [] },
      { id: "demo-task-scales", title: "Scales in all 12 keys", minutes: 10, time: null, notes: "", attachments: [] },
      {
        id: "demo-task-tune",
        title: `Work on ${tuneName}`,
        minutes: 15,
        time: null,
        notes: "Play the head, then two choruses of solo.",
        attachments: [],
        subtasks: [
          { id: "demo-sub-head", title: "Head from memory" },
          { id: "demo-sub-solo", title: "Two choruses of solo" },
        ],
      },
    ],
    attachments: [],
    createdAt: now - 21 * day,
    updatedAt: now - 21 * day,
  };
  const taskIds = routine.tasks.map((t) => t.id);
  const days: Record<string, DayLog> = {};
  const missed = new Set([4, 11, 12, 17]);
  for (let ago = 20; ago >= 1; ago -= 1) {
    if (missed.has(ago)) continue;
    const partial = ago % 5 === 0;
    const done = partial ? taskIds.slice(0, 2) : taskIds;
    const minutes = partial ? 20 : 35 + (ago % 3) * 10;
    days[toDateKey(new Date(now - ago * day))] = {
      routines: { [routine.id]: { done } },
      stopwatchMs: minutes * 60_000,
    };
  }
  return { routines: [routine], days, prefs: { dailyGoal: 30, sounds: true, trackTools: true } };
}
