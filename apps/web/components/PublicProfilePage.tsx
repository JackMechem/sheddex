"use client";

import EarTrainingProgress from "@/components/learning/EarTrainingProgress";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@jam-practice/convex/_generated/api";
import { Id } from "@jam-practice/convex/_generated/dataModel";
import { PostListItem } from "@/components/CommunityTunes";
import FollowButton from "@/components/FollowButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import PublicTuneList from "@/components/PublicTuneList";
import UserAvatar from "@/components/UserAvatar";
import ProfileBanner from "@/components/ProfileBanner";
import { SIGN_IN_PATH } from "@/lib/landing";
import { shareLink } from "@/lib/shareLink";
import { CalendarIcon, CheckIcon, FlagIcon, ShareIcon, StopwatchIcon } from "@/components/tools";
import { openFeedback } from "@/components/feedback/FeedbackForm";
import { FlameIcon } from "@/components/practicelog/Celebrations";
import { BackButton } from "@/components/library/shared";
import { useRouter } from "next/navigation";
import { type PublicPracticeStats, todayKey } from "@/lib/practiceLog";

/** A public profile page (`app/u/[username]/page.tsx`) — reachable by anyone, signed in or not;
    this is the shareable link. `getPublicByUsername` returns `null` for both "no such username"
    and "that profile exists but isn't public", deliberately indistinguishable from here — a
    visitor can't tell the difference by probing usernames. "Tunes" and "Tunes to Learn" are two
    separate sections, both rendered with `PublicTuneList` (the same Jam-Practice-styled row layout
    for both — see that component for why one component covers both), which also lets a signed-in
    viewer copy a tune they see into their own lists.

    "Posts" is this profile's Community posts (`communityTunes.listByUser`) — added per a direct
    follow-up request ("when looking at another user's profile it should show their posts"),
    reusing the exact `PostListItem` component Community's own Feed renders with, so clicking a
    post from here opens the same `/post/[id]` full page either way. Used to be two sections
    ("Chord Chart Posts"/"Tune Posts") — collapsed into one once
    Community itself dropped its separate chord-chart-only post type (see `Community.tsx`'s own doc
    comment); a post's own `chartCount` still shows as a small badge on each row. Gated on the
    *viewer* being signed in, same as Community's own Posts section — browsing posts needs an
    account there, so it needs one here too, rather than this page quietly having a looser rule for
    the same underlying data depending on which page you reached it from. */
type ProfileTab = "posts" | "tunes" | "learn" | "ear";

export default function PublicProfilePage({ username }: { username: string }) {
  const router = useRouter();
  const [today] = useState(() => todayKey());
  const profile = useQuery(api.profiles.getPublicByUsername, { username, today });
  const viewer = useQuery(api.users.current);
  const userId = profile ? (profile.userId as Id<"users">) : null;
  const posts = useQuery(api.communityTunes.listByUser, userId ? { userId } : "skip");
  const followers = useQuery(api.follows.listFollowers, userId ? { userId } : "skip");
  const following = useQuery(api.follows.listFollowing, userId ? { userId } : "skip");
  const likedIds = useQuery(api.communityTunes.myLikes);
  const [tab, setTab] = useState<ProfileTab | null>(null);
  const [copied, setCopied] = useState(false);

  const likedSet = useMemo(() => new Set(likedIds ?? []), [likedIds]);

  if (profile === undefined || viewer === undefined) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-16">
        <LoadingSpinner />
      </main>
    );
  }

  if (profile === null) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-2 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] text-center sm:px-6 lg:pt-16">
        <h1 className="text-xl font-semibold">This profile isn&apos;t available</h1>
        <p className="text-sm text-muted">It might not exist, or its owner hasn&apos;t made it public.</p>
      </main>
    );
  }

  const isOwnProfile = viewer?._id === profile.userId;
  const earTraining = profile.earTraining;
  const levelsPassed = earTraining ? earTraining.interval.passed + earTraining.chord.passed + earTraining.progression.passed : 0;
  const canAdd = !isOwnProfile && !!viewer;
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: viewer ? posts?.length : undefined },
    { id: "tunes", label: "Tunes I Know", count: profile.tunes.length },
    { id: "learn", label: "Tunes to Learn", count: profile.tunesToLearn.length },
    ...(earTraining && levelsPassed > 0 ? [{ id: "ear" as const, label: "Ear training", count: levelsPassed }] : []),
  ];
  const current: ProfileTab = tab ?? (viewer && (posts?.length ?? 0) > 0 ? "posts" : profile.tunes.length ? "tunes" : "posts");
  const stats: [string, number | undefined][] = [
    ["Posts", viewer ? posts?.length : undefined],
    ["Followers", followers?.length],
    ["Following", following?.length],
    ["Tunes", profile.tunes.length],
  ];

  async function share() {
    if ((await shareLink(`@${profile!.username} on soniroll`, `https://www.soniroll.com/u/${profile!.username}`)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:max-w-none lg:px-8 lg:pt-12">
      <BackButton onClick={() => (window.history.length > 1 ? router.back() : router.push("/community"))} className="self-start" />
      <section className="overflow-hidden rounded-3xl bg-surface">
        <ProfileBanner banner={profile.banner} className="h-28 sm:h-40" />
        <div className="-mt-12 flex flex-col gap-4 px-5 pb-5 sm:-mt-14 sm:px-6">
          <div className="flex items-end gap-3">
            <span className="relative z-10 rounded-full ring-[6px] ring-surface">
              <UserAvatar url={profile.avatarUrl} size="xl" />
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2 self-start pt-14 sm:pt-16">
              <button type="button" onClick={() => void share()} aria-label="Share profile" className="flex h-9 items-center gap-1.5 rounded-full bg-background px-3 sm:px-3.5 text-sm font-semibold hover:bg-surface-hover">
                {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <ShareIcon className="h-4 w-4" />} <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
              </button>
              {!isOwnProfile && (
                <button
                  type="button"
                  onClick={() => openFeedback({ kind: "report", target: { type: "profile", id: profile.userId, label: `@${profile.username}` } })}
                  aria-label="Report this profile"
                  title="Report this profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted hover:bg-surface-hover hover:text-danger"
                >
                  <FlagIcon className="h-4 w-4" />
                </button>
              )}
              {isOwnProfile ? (
                <Link href="/account?tab=profile" className="flex h-9 items-center rounded-full bg-background px-4 text-sm font-semibold hover:bg-surface-hover">
                  Edit profile
                </Link>
              ) : viewer ? (
                <FollowButton targetUserId={profile.userId as Id<"users">} />
              ) : (
                <Link href={SIGN_IN_PATH} className="flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                  Sign in to follow
                </Link>
              )}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">@{profile.username}</h1>
            {profile.instruments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.instruments.map((name) => (
                  <span key={name} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Musician on soniroll</p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {stats.map(([label, n]) => (
              <div key={label} className="flex flex-col items-center rounded-2xl bg-background py-2.5">
                <span className="text-xl font-extrabold tabular-nums">{n ?? "–"}</span>
                <span className="text-[11px] font-semibold text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {profile.practice && <PracticeCard stats={profile.practice} username={profile.username} />}

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={current === t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${current === t.id ? "bg-accent text-accent-foreground" : "bg-surface text-muted hover:text-foreground"}`}
          >
            {t.label}
            {t.count !== undefined && <span className={`tabular-nums ${current === t.id ? "opacity-80" : "opacity-60"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {current === "posts" &&
        (!viewer ? (
          <Empty>
            <Link href={SIGN_IN_PATH} className="font-semibold text-accent hover:underline">
              Sign in
            </Link>{" "}
            to see @{profile.username}&apos;s posts.
          </Empty>
        ) : posts === undefined ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="sm" />
          </div>
        ) : posts.length === 0 ? (
          <Empty>No posts yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostListItem key={post.id} post={post} liked={likedSet.has(post.id)} />
            ))}
          </ul>
        ))}

      {current === "tunes" &&
        (profile.tunes.length ? (
          <div className="rounded-3xl bg-surface p-4 sm:p-5">
            <PublicTuneList tunes={profile.tunes} canAdd={canAdd} />
          </div>
        ) : (
          <Empty>No tunes yet.</Empty>
        ))}

      {current === "learn" &&
        (profile.tunesToLearn.length ? (
          <div className="rounded-3xl bg-surface p-4 sm:p-5">
            <PublicTuneList tunes={profile.tunesToLearn} canAdd={canAdd} />
          </div>
        ) : (
          <Empty>Nothing on the list yet.</Empty>
        ))}

      {current === "ear" && earTraining && (
        <div className="rounded-3xl bg-surface p-4 sm:p-5">
          <EarTrainingProgress summaries={earTraining} links={isOwnProfile} />
        </div>
      )}
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">{children}</p>;
}

const LEVEL_BG = ["var(--background)", "#0e4429", "#006d32", "#26a641", "#39d353"];

/** Their Shed Log, as far as a profile shows it: the streak (and best), hours, days, goal days,
    the last 26 weeks of practice, and the milestones reached. */
function PracticeCard({ stats, username }: { stats: PublicPracticeStats; username: string }) {
  const lit = stats.streak > 0;
  const fmtH = (h: number) => (h < 10 ? String(Math.round(h * 10) / 10) : String(Math.floor(h)));
  const tiles: [string, string][] = [
    [String(stats.best), "best streak"],
    [fmtH(stats.hours), "hours practiced"],
    [String(stats.days), "days this year"],
    [fmtH(stats.weekHours), "hours this week"],
  ];
  const weeks = Math.ceil(stats.levels.length / 7);
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-extrabold">Shed Log</h2>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${lit ? "text-white" : "text-orange-500"}`}
            style={{ background: lit ? "linear-gradient(160deg, #fb923c, #ef4444)" : "color-mix(in srgb, #f97316 14%, transparent)" }}
          >
            <FlameIcon className={`h-8 w-8 ${lit ? "log-flame" : ""}`} />
          </span>
          <div>
            <div className="text-4xl font-extrabold tabular-nums leading-none">{stats.streak}</div>
            <div className="text-sm font-semibold text-muted">day streak</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map(([v, l]) => (
            <div key={l} className="flex flex-col rounded-2xl bg-background px-3 py-2.5">
              <span className="text-xl font-extrabold tabular-nums">{v}</span>
              <span className="text-[11px] font-semibold text-muted">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold text-muted">
          <span>Last {weeks} weeks</span>
          <span>{stats.goalDays} of the last 30 days on goal</span>
        </div>
        <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))", gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
          {Array.from(stats.levels).map((l, i) => (
            <span key={i} className="aspect-square rounded-[3px]" style={{ background: LEVEL_BG[Number(l)] ?? LEVEL_BG[0] }} />
          ))}
        </div>
      </div>

      {stats.achievements.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted">Milestones</h3>
          <div className="flex flex-wrap gap-2">
            {stats.achievements.map((a) => (
              <span
                key={`${a.kind}${a.value}`}
                title={a.kind === "streak" ? `Practiced ${a.value} days in a row` : `${a.value} hours of practice logged`}
                className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold ${a.kind === "streak" ? "bg-orange-500/12 text-orange-600 dark:text-orange-400" : "bg-accent/12 text-accent"}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${a.kind === "streak" ? "bg-gradient-to-br from-orange-400 to-red-500" : "bg-accent"}`}>
                  {a.kind === "streak" ? <FlameIcon className="h-3.5 w-3.5" /> : <StopwatchIcon className="h-3.5 w-3.5" />}
                </span>
                {a.kind === "streak" ? `${a.value}-day streak` : `${a.value} ${a.value === 1 ? "hour" : "hours"}`}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="sr-only">Shed Log stats for @{username}</p>
    </section>
  );
}
