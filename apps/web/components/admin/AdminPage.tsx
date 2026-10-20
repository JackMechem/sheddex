"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import type { Id } from "@jam-practice/convex/_generated/dataModel";
import Select from "@/components/Select";
import LoadingSpinner from "@/components/LoadingSpinner";
import { type GitHubItem, recentCommits, recentPulls, repoBranches } from "@/lib/githubWork";
import { LibraryPage } from "@/components/library/ui";
import { BugIcon, CloseIcon, FeedbackIcon, FlagIcon, SearchIcon, ShieldIcon, SparkIcon, TrashIcon, UsersIcon } from "@/components/tools";
import { VERSION_LABEL } from "@/lib/version";
import { useSiteStatus } from "@/lib/useSiteStatus";
import Mayday from "@/components/admin/Mayday";
import ChangelogAdmin from "@/components/admin/ChangelogAdmin";
import Analytics from "@/components/admin/Analytics";

type Tab = "overview" | "analytics" | "inbox" | "posts" | "users" | "changelog" | "mayday";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "inbox", label: "Inbox" },
  { id: "posts", label: "Posts" },
  { id: "users", label: "Users" },
  { id: "changelog", label: "Changelog" },
  { id: "mayday", label: "Mayday" },
];

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * `/admin` — only for the site admin (every query and mutation behind it checks on the server).
 * Overview (numbers and sign-ups), Inbox (feedback and reports: status, notes, reply, delete),
 * Posts (every community post; remove), Users (every account; hide a profile, delete an account).
 */
export default function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isAdmin = useQuery(api.admin.amIAdmin, isAuthenticated ? {} : "skip");
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview") as Tab;
  const stats = useQuery(api.admin.stats, isAdmin ? {} : "skip");
  const role = useQuery(api.admin.myRole, isAdmin ? {} : "skip");
  const site = useSiteStatus();
  const maydayOn = site
    ? [site.maintenance, site.communityOff, site.postingPaused, site.signupsPaused, site.uploadsPaused, site.feedbackPaused, !!site.banner].filter(Boolean).length
    : 0;

  if (isLoading || (isAuthenticated && isAdmin === undefined))
    return (
      <LibraryPage>
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      </LibraryPage>
    );
  if (!isAdmin)
    return (
      <LibraryPage>
        <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-3xl bg-surface p-10 text-center">
          <ShieldIcon className="h-8 w-8 text-muted" />
          <p className="text-lg font-bold">Nothing here</p>
          <p className="text-sm text-muted">This page isn&apos;t available.</p>
        </div>
      </LibraryPage>
    );

  const go = (t: Tab) => router.replace(t === "overview" ? "/admin" : `/admin?tab=${t}`, { scroll: false });

  return (
    <LibraryPage>
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <ShieldIcon className="h-6 w-6 shrink-0 text-accent sm:h-7 sm:w-7" /> <span className="truncate">Admin</span>
            </h1>
            <p className="text-sm text-muted">
              soniroll {VERSION_LABEL} · {role === "owner" ? "Owner" : "Admin"}
            </p>
          </div>
          {stats && stats.newFeedback > 0 && (
            <button type="button" onClick={() => go("inbox")} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover">
              {stats.newFeedback} new in the inbox
            </button>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1">
          {TABS.map((t) => {
            const badge = t.id === "inbox" ? stats?.newFeedback : t.id === "posts" ? stats?.reports : t.id === "mayday" ? maydayOn : 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-background text-foreground shadow" : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {t.label}
                {!!badge && <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === t.id ? "bg-accent text-accent-foreground" : "bg-background"}`}>{badge}</span>}
              </button>
            );
          })}
        </nav>
      </header>

      {tab === "overview" && <Overview onGo={go} />}
      {tab === "inbox" && <Inbox />}
      {tab === "posts" && <Posts />}
      {tab === "users" && <Users />}
      {tab === "mayday" && <Mayday />}
      {tab === "changelog" && <ChangelogAdmin />}
      {tab === "analytics" && <Analytics />}
    </LibraryPage>
  );
}

// ---------------------------------------------------------------- overview

function Stat({
  label,
  value,
  sub,
  tone = "accent",
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "accent" | "green" | "amber" | "red";
  onClick?: () => void;
}) {
  const toneCls = {
    accent: "from-indigo-500/15 text-indigo-600 dark:text-indigo-300",
    green: "from-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    amber: "from-amber-500/15 text-amber-600 dark:text-amber-300",
    red: "from-rose-500/15 text-rose-600 dark:text-rose-300",
  }[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`flex flex-col items-start gap-1 rounded-3xl bg-gradient-to-br ${toneCls} to-transparent bg-surface p-4 text-left ring-1 ring-foreground/5 ${onClick ? "transition-transform hover:-translate-y-0.5" : ""}`}
    >
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="text-3xl font-extrabold tabular-nums text-foreground">{value}</span>
      {sub && <span className="text-xs font-semibold">{sub}</span>}
    </Comp>
  );
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const s = useQuery(api.admin.stats, {});
  const feedback = useQuery(api.admin.feedbackList, {});
  const users = useQuery(api.admin.users, {});
  const [now] = useState(() => Date.now());
  if (!s)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  const max = Math.max(1, ...s.signups);
  const total30 = s.signups.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Accounts" value={s.users} sub={`+${s.newThisWeek} this week`} onClick={() => onGo("users")} />
        <Stat label="Community posts" value={s.posts} sub={`+${s.postsThisWeek} this week`} tone="green" onClick={() => onGo("posts")} />
        <Stat label="Inbox" value={s.openFeedback} sub={s.newFeedback ? `${s.newFeedback} new` : "all read"} tone="amber" onClick={() => onGo("inbox")} />
        <Stat label="Open reports" value={s.reports} sub={s.reports ? "needs a look" : "none"} tone="red" onClick={() => onGo("inbox")} />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-bold">Sign-ups</h2>
              <p className="text-xs text-muted">Last 30 days · {total30} new</p>
            </div>
            <div className="flex gap-4 text-right text-xs text-muted">
              <span>
                <b className="block text-base text-foreground">{s.publicProfiles}</b>public profiles
              </span>
              <span>
                <b className="block text-base text-foreground">{s.teachers}</b>teachers
              </span>
              <span>
                <b className="block text-base text-foreground">{s.students}</b>students
              </span>
            </div>
          </div>
          <div className="flex h-40 items-end gap-1">
            {s.signups.map((n, i) => (
              <div key={i} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-fuchsia-500 transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%`, opacity: n ? 1 : 0.15 }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background group-hover:block">
                  {n} · {new Date(now - (29 - i) * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>30 days ago</span>
            <span>today</span>
          </div>
        </section>
        <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Latest in the inbox</h2>
            <button type="button" onClick={() => onGo("inbox")} className="text-xs font-semibold text-accent hover:underline">
              Open inbox
            </button>
          </div>
          {!feedback ? (
            <LoadingSpinner size="sm" />
          ) : feedback.length === 0 ? (
            <p className="py-4 text-sm text-muted">Nothing yet. Feedback from the site lands here.</p>
          ) : (
            feedback.slice(0, 5).map((f) => (
              <button key={f.id} type="button" onClick={() => onGo("inbox")} className="flex items-start gap-3 rounded-2xl p-2 text-left hover:bg-background">
                <KindBadge kind={f.kind} small />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm">{f.message}</span>
                  <span className="text-[11px] text-muted">
                    {f.from?.username ? `@${f.from.username}` : (f.email ?? "Anonymous")} · {ago(f.createdAt)}
                  </span>
                </span>
                {f.status === "new" && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
              </button>
            ))
          )}
        </section>
      </div>
      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Newest accounts</h2>
          <button type="button" onClick={() => onGo("users")} className="text-xs font-semibold text-accent hover:underline">
            All accounts
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(users ?? []).slice(0, 8).map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-background p-2.5">
              <Avatar url={u.avatarUrl} name={u.username ?? u.email ?? "?"} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{u.username ? `@${u.username}` : (u.name ?? "No username yet")}</span>
                <span className="block truncate text-[11px] text-muted">{ago(u.joined)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Avatar({ url, name, size = 9 }: { url: string | null; name: string; size?: number }) {
  const dim = size === 9 ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  // eslint-disable-next-line @next/next/no-img-element -- remote avatar
  if (url) return <img src={url} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />;
  return (
    <span className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-indigo-500/15 font-extrabold text-indigo-600 dark:text-indigo-300`}>
      {name.replace(/^@/, "").charAt(0).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------- inbox

const KIND_META = {
  bug: { label: "Bug", Icon: BugIcon, cls: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  feature: { label: "Idea", Icon: SparkIcon, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  other: { label: "Other", Icon: FeedbackIcon, cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  report: { label: "Report", Icon: FlagIcon, cls: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300" },
} as const;

function KindBadge({ kind, small = false }: { kind: keyof typeof KIND_META; small?: boolean }) {
  const m = KIND_META[kind];
  return small ? (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${m.cls}`}>
      <m.Icon className="h-4 w-4" />
    </span>
  ) : (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${m.cls}`}>
      <m.Icon className="h-3.5 w-3.5" /> {m.label}
    </span>
  );
}

const STATUSES = [
  { id: "new", label: "New" },
  { id: "seen", label: "Seen" },
  { id: "planned", label: "Planned" },
  { id: "done", label: "Done" },
  { id: "closed", label: "Closed" },
] as const;
type Status = (typeof STATUSES)[number]["id"];

function Inbox() {
  const rows = useQuery(api.admin.feedbackList, {});
  const update = useMutation(api.admin.updateFeedback);
  const ensureNumbers = useMutation(api.admin.ensureFeedbackNumbers);
  // Feedback from before IDs existed gets its FB-number the first time the inbox opens.
  const unnumbered = !!rows?.some((r) => r.number === null);
  useEffect(() => {
    if (unnumbered) void ensureNumbers({});
  }, [unnumbered, ensureNumbers]);
  const remove = useMutation(api.admin.deleteFeedback);
  const removePost = useMutation(api.admin.removePost);
  const [view, setView] = useState<"open" | Status | "all">("open");
  const [kind, setKind] = useState<keyof typeof KIND_META | "all">("all");
  const [q, setQ] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: () => void } | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (view === "all" || (view === "open" ? r.status === "new" || r.status === "seen" : r.status === view)) &&
        (kind === "all" || r.kind === kind) &&
        (!t || `fb-${r.number ?? ""} ${r.message} ${r.email ?? ""} ${r.from?.username ?? ""} ${r.page ?? ""} ${r.target?.label ?? ""} ${r.links.map((l) => `${l.ref} ${l.title}`).join(" ")}`.toLowerCase().includes(t.replace(/^fb\s+/, "fb-"))),
    );
  }, [rows, view, kind, q]);

  if (!rows)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  const count = (v: typeof view) => rows.filter((r) => (v === "all" ? true : v === "open" ? r.status === "new" || r.status === "seen" : r.status === v)).length;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 rounded-3xl bg-surface p-3 lg:sticky lg:top-6">
        <div className="flex flex-col gap-0.5">
          {(["open", ...STATUSES.map((s) => s.id), "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${view === v ? "bg-indigo-600 text-white" : "hover:bg-background"}`}
            >
              {v === "open" ? "Open" : v === "all" ? "Everything" : STATUSES.find((s) => s.id === v)!.label}
              <span className={`text-xs tabular-nums ${view === v ? "text-white/80" : "text-muted"}`}>{count(v)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-foreground/5 pt-3">
          <button
            type="button"
            onClick={() => setKind("all")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${kind === "all" ? "bg-foreground text-background" : "bg-background"}`}
          >
            All kinds
          </button>
          {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${kind === k ? "bg-foreground text-background" : "bg-background"}`}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-col gap-3">
        <SearchField value={q} onChange={setQ} placeholder="Search messages, people, pages" />
        {list.length === 0 ? (
          <p className="rounded-3xl bg-surface p-10 text-center text-sm text-muted">
            {rows.length ? "Nothing here." : "No feedback yet — it'll show up here as people send it."}
          </p>
        ) : (
          list.map((f) => (
            <article key={f.id} className={`flex min-w-0 flex-col gap-3 rounded-3xl bg-surface p-4 ring-1 ${f.status === "new" ? "ring-indigo-500/40" : "ring-foreground/5"}`}>
              <div className="flex flex-wrap items-center gap-2">
                {f.number !== null && <FeedbackId number={f.number} />}
                <KindBadge kind={f.kind} />
                {f.status === "new" && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
                <span className="min-w-0 text-xs text-muted [overflow-wrap:anywhere]">
                  {f.from ? (
                    f.from.username ? (
                      <Link href={`/u/${f.from.username}`} className="font-semibold text-foreground hover:underline">
                        @{f.from.username}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{f.from.name ?? "Account without a username"}</span>
                    )
                  ) : (
                    "Signed out"
                  )}
                  {f.email ? ` · ${f.email}` : ""} · {ago(f.createdAt)}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {f.email && (
                    <a
                      href={`mailto:${f.email}?subject=${encodeURIComponent(`Re: your ${KIND_META[f.kind].label.toLowerCase()} on soniroll`)}&body=${encodeURIComponent(`\n\n> ${f.message.split("\n").join("\n> ")}`)}`}
                      className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                    >
                      Reply
                    </a>
                  )}
                  <button
                    type="button"
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => setConfirm({ title: "Delete this?", body: "It's gone for good (including any screenshot).", action: () => void remove({ id: f.id }) })}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-background hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </span>
              </div>
              {f.target && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-fuchsia-500/10 px-3 py-2 text-sm">
                  <FlagIcon className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-300" />
                  Reported {f.target.type}: <b>{f.target.label}</b>
                  <span className="ml-auto flex gap-1.5">
                    <Link
                      href={f.target.type === "post" ? `/post/${f.target.id}` : `/u/${f.target.label.replace(/^@/, "")}`}
                      className="rounded-full bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-hover"
                    >
                      Open
                    </Link>
                    {f.target.type === "post" && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirm({
                            title: `Remove "${f.target!.label}"?`,
                            body: "The post is deleted for everyone, and reports about it are closed.",
                            action: () => void removePost({ id: f.target!.id as Id<"communityTunes"> }),
                          })
                        }
                        className="rounded-full bg-danger px-3 py-1 text-xs font-bold text-white hover:opacity-90"
                      >
                        Remove post
                      </button>
                    )}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{f.message}</p>
              {f.screenshotUrl && (
                <button type="button" onClick={() => setShot(f.screenshotUrl)} className="self-start overflow-hidden rounded-2xl ring-1 ring-foreground/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded screenshot */}
                  <img src={f.screenshotUrl} alt="Screenshot" className="max-h-56 max-w-full object-contain" />
                </button>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                {f.page && (
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    on{" "}
                    <Link href={f.page} className="font-semibold text-foreground hover:underline">
                      {f.page}
                    </Link>
                  </span>
                )}
                {f.userAgent && (
                  <span className="max-w-full truncate" title={f.userAgent}>
                    {deviceOf(f.userAgent)}
                  </span>
                )}
              </div>
              <WorkLinks id={f.id} links={f.links} />
              <div className="flex flex-wrap items-center gap-2 border-t border-foreground/5 pt-3">
                <div className="flex flex-wrap gap-1 rounded-full bg-background p-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void update({ id: f.id, status: s.id })}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${f.status === s.id ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <NoteField id={f.id} note={f.adminNote} />
              </div>
            </article>
          ))
        )}
      </section>
      {shot && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={() => setShot(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded screenshot */}
          <img src={shot} alt="Screenshot" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function deviceOf(ua: string) {
  const os = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return `${os}${browser ? ` · ${browser}` : ""}`;
}

/** "FB-12": the feedback's ID — click to copy it (for a commit message or PR). */
function FeedbackId({ number }: { number: number }) {
  const [copied, setCopied] = useState(false);
  const id = `FB-${number}`;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy the ID — put it in a commit message or PR to link them (“Fixes FB-12” marks it done on main)"
      className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] font-bold text-foreground hover:bg-surface-hover"
    >
      {copied ? "Copied" : id}
    </button>
  );
}

type WorkLink = { kind: "commit" | "pr"; ref: string; url: string; title: string; merged?: boolean; at: number };

/** The commits and pull requests linked to a feedback, and a field to link one by hand. */
function WorkLinks({ id, links }: { id: Id<"feedback">; links: WorkLink[] }) {
  const add = useMutation(api.admin.addFeedbackLink);
  const removeLink = useMutation(api.admin.removeFeedbackLink);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  async function submit() {
    if (!value.trim()) return;
    try {
      await add({ id, input: value });
      setValue("");
      setError(null);
    } catch (e) {
      setError((e as Error).message.replace(/^[\s\S]*?Uncaught Error:\s*/, "").split("\n")[0]);
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      {links.length > 0 && (
        <ul className="flex flex-col gap-1">
          {links.map((l) => (
            <li key={l.url} className="group flex min-w-0 items-center gap-2 text-xs">
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${l.kind === "pr" ? (l.merged ? "bg-violet-500/15 text-violet-600 dark:text-violet-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300") : "bg-background text-muted"}`}>
                {l.kind === "pr" ? (l.merged ? "PR merged" : "PR") : "Commit"}
              </span>
              <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0 font-mono font-semibold text-foreground hover:underline">
                {l.ref}
              </a>
              <span className="min-w-0 flex-1 truncate text-muted">{l.title}</span>
              <button type="button" onClick={() => void removeLink({ id, url: l.url })} aria-label={`Unlink ${l.ref}`} className="shrink-0 rounded-full px-1.5 text-muted opacity-60 hover:bg-background hover:text-danger hover:opacity-100">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="Link a commit or PR: hash, #12 or a GitHub link"
          aria-label="Link a commit or pull request"
          className="min-w-0 flex-1 rounded-full bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
        />
        {value.trim() ? (
          <button type="button" onClick={() => void submit()} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
            Link
          </button>
        ) : (
          <button type="button" onClick={() => setPicking(true)} className="shrink-0 rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover">
            Pick…
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {picking && (
        <WorkPicker
          linked={new Set(links.map((l) => l.url))}
          onPick={(item) => {
            void add({ id, input: item.url, title: item.title }).catch((e: Error) => setError(e.message));
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/** The repo's recent commits (by branch) and pull requests, to link one with a click. */
function WorkPicker({ linked, onPick, onClose }: { linked: Set<string>; onPick: (item: GitHubItem) => void; onClose: () => void }) {
  const [kind, setKind] = useState<"commits" | "pulls">("commits");
  const [branch, setBranch] = useState("preview");
  const [data, setData] = useState<{ branches: string[]; items: GitHubItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let live = true;
    Promise.all([repoBranches(), kind === "commits" ? recentCommits(branch) : recentPulls()]).then(
      ([branches, items]) => live && (setData({ branches, items }), setError(null)),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [kind, branch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const t = q.trim().toLowerCase();
  const shown = (data?.items ?? []).filter((it) => it.kind === (kind === "commits" ? "commit" : "pr") && (!t || `${it.ref} ${it.title} ${it.detail}`.toLowerCase().includes(t)));
  const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-overlay p-4 pt-[8vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Link work from GitHub" className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl shadow-black/25" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 p-3">
          <div className="flex rounded-full bg-background p-0.5 text-xs font-semibold">
            {(["commits", "pulls"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1 ${kind === k ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>
                {k === "commits" ? "Commits" : "Pull requests"}
              </button>
            ))}
          </div>
          {kind === "commits" && data && (
            <Select value={branch} options={data.branches.map((b) => ({ value: b, label: b }))} onChange={setBranch} className="min-w-32" />
          )}
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search commits" className="min-w-0 flex-1 rounded-full bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? (
            <li className="px-3 py-6 text-center text-sm text-danger">{error}</li>
          ) : !data ? (
            <li className="flex justify-center py-8">
              <LoadingSpinner />
            </li>
          ) : shown.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</li>
          ) : (
            shown.map((it) => {
              const done = linked.has(it.url) || picked.has(it.url);
              return (
                <li key={it.url}>
                  <button
                    type="button"
                    disabled={done}
                    onClick={() => {
                      onPick(it);
                      setPicked((p) => new Set(p).add(it.url));
                    }}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-hover disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-xs font-bold">{it.ref}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{it.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {it.detail} · {date(it.at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-accent">{done ? "Linked" : "Link"}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex justify-end border-t border-foreground/10 p-3">
          <button type="button" onClick={onClose} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteField({ id, note }: { id: Id<"feedback">; note: string }) {
  const update = useMutation(api.admin.updateFeedback);
  const [value, setValue] = useState(note);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== note && void update({ id, adminNote: value })}
      placeholder="Private note…"
      className="min-w-0 flex-1 basis-48 rounded-full bg-background px-3.5 py-1.5 text-xs outline-none ring-1 ring-foreground/5 focus:ring-2 focus:ring-accent"
    />
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-3 ring-1 ring-foreground/5 focus-within:ring-2 focus-within:ring-accent">
      <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </label>
  );
}

function Confirm({
  title,
  body,
  action,
  onClose,
  confirmWord,
  danger = true,
}: {
  title: string;
  body: string;
  action: () => void | Promise<void>;
  onClose: () => void;
  confirmWord?: string;
  danger?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex w-full flex-col gap-4 rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted">{body}</p>
        {confirmWord && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Type <code className="rounded bg-background px-1.5">{confirmWord}</code> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="rounded-xl bg-background px-3.5 py-2.5 text-sm outline-none ring-1 ring-foreground/5 focus:ring-2 focus:ring-accent"
            />
          </label>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-background">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await action();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0] : "Something went wrong.");
                setBusy(false);
              }
            }}
            className={`rounded-full px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 ${danger ? "bg-danger" : "bg-indigo-600"}`}
          >
            {busy ? "Working…" : "Yes, do it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- posts

const POST_KIND: Record<string, string> = { tunes: "Tunes", setlist: "Setlist", routine: "Routine", milestone: "Milestone" };

function Posts() {
  const rows = useQuery(api.admin.posts, {});
  const removePost = useMutation(api.admin.removePost);
  const [q, setQ] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: () => void } | null>(null);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (p) => (!reportedOnly || p.reports > 0) && (!t || `${p.title} ${p.description} ${p.author.username ?? ""} ${p.author.email ?? ""}`.toLowerCase().includes(t)),
    );
  }, [rows, q, reportedOnly]);
  if (!rows)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  const reported = rows.filter((p) => p.reports > 0).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchField value={q} onChange={setQ} placeholder="Search posts and authors" />
        </div>
        <button
          type="button"
          onClick={() => setReportedOnly((v) => !v)}
          className={`rounded-full px-4 py-2.5 text-sm font-semibold ${reportedOnly ? "bg-fuchsia-600 text-white" : "bg-surface ring-1 ring-foreground/10"}`}
        >
          Reported only {reported ? `(${reported})` : ""}
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-foreground/5">
        {list.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">No posts.</p>
        ) : (
          list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-t border-foreground/5 px-4 py-3 first:border-t-0">
              <Avatar url={p.author.avatarUrl} name={p.author.username ?? "?"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/post/${p.id}`} className="truncate font-bold hover:underline">
                    {p.title}
                  </Link>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">{POST_KIND[p.kind] ?? p.kind}</span>
                  {p.unlisted && <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">Unlisted</span>}
                  {p.reports > 0 && (
                    <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-bold text-fuchsia-600 dark:text-fuchsia-300">
                      {p.reports} report{p.reports === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted">
                  {p.author.username ? `@${p.author.username}` : (p.author.email ?? "Unknown")} · {ago(p.createdAt)} · ♥ {p.likes}
                  {p.description ? ` · ${p.description}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfirm({
                    title: `Remove "${p.title}"?`,
                    body: "The post is deleted for everyone. Its author isn't told.",
                    action: () => void removePost({ id: p.id }),
                  })
                }
                className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          ))
        )}
      </div>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- users

function Users() {
  const rows = useQuery(api.admin.users, {});
  const setPublic = useMutation(api.admin.setProfilePublic);
  const deleteUser = useAction(api.admin.deleteUser);
  const grantAdmin = useMutation(api.admin.grantAdmin);
  const revokeAdmin = useMutation(api.admin.revokeAdmin);
  const myRole = useQuery(api.admin.myRole, {});
  const owner = myRole === "owner";
  const [q, setQ] = useState("");
  const [onlyAdmins, setOnlyAdmins] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: () => Promise<void> | void; confirmWord?: string; danger?: boolean } | null>(null);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter((u) => (!onlyAdmins || u.role) && (!t || `${u.username ?? ""} ${u.email ?? ""} ${u.name ?? ""}`.toLowerCase().includes(t)));
  }, [rows, q, onlyAdmins]);
  const adminCount = (rows ?? []).filter((u) => u.role).length;
  if (!rows)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchField value={q} onChange={setQ} placeholder="Search by username, email or name" />
        </div>
        <button
          type="button"
          onClick={() => setOnlyAdmins((v) => !v)}
          className={`rounded-full px-4 py-2.5 text-sm font-semibold ${onlyAdmins ? "bg-indigo-600 text-white" : "bg-surface ring-1 ring-foreground/10"}`}
        >
          Admins ({adminCount})
        </button>
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <UsersIcon className="h-4 w-4" /> {rows.length} account{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {owner && (
        <p className="px-1 text-xs text-muted">
          As the owner you can make other accounts admins. Admins can use this page to moderate, but can&apos;t add admins or change another admin&apos;s account or
          yours.
        </p>
      )}
      <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-foreground/5">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 border-t border-foreground/5 px-4 py-3 first:border-t-0">
            <Avatar url={u.avatarUrl} name={u.username ?? u.email ?? "?"} size={11} />
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex flex-wrap items-center gap-1.5">
                {u.username ? (
                  <Link href={`/u/${u.username}`} className="font-bold hover:underline">
                    @{u.username}
                  </Link>
                ) : (
                  <span className="font-bold text-muted">No username</span>
                )}
                {u.role === "owner" && (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">Owner</span>
                )}
                {u.role === "admin" && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Admin</span>}
                {u.isMe && <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted">You</span>}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.isPublic ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-background text-muted"}`}
                >
                  {u.isPublic ? "Public" : "Private"}
                </span>
                {u.providers.map((p) => (
                  <span key={p} className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted">
                    {p === "google" ? "Google" : p === "password" ? "Email" : p}
                  </span>
                ))}
              </div>
              <p className="truncate text-xs text-muted">
                {u.email ?? "No email"} · joined {ago(u.joined)} · {u.posts} post{u.posts === 1 ? "" : "s"}
              </p>
            </div>
            {!u.isMe && u.role !== "owner" && (owner || !u.role) && (
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {owner &&
                  (u.role === "admin" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: `Remove ${u.username ? `@${u.username}` : (u.email ?? "this account")} as an admin?`,
                          body: "They lose access to the admin page straight away. Their account isn't changed otherwise.",
                          action: async () => {
                            await revokeAdmin({ userId: u.id });
                          },
                        })
                      }
                      className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                    >
                      Remove admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: `Make ${u.username ? `@${u.username}` : (u.email ?? "this account")} an admin?`,
                          body: "They'll be able to read every feedback message and report, see every account's email, remove community posts, and hide or delete regular accounts. They can't add admins or touch another admin's account or yours. You can remove them any time.",
                          confirmWord: u.username ?? u.email ?? "admin",
                          danger: false,
                          action: async () => {
                            await grantAdmin({ userId: u.id });
                          },
                        })
                      }
                      className="flex items-center gap-1 rounded-full bg-indigo-600/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-600/20 dark:text-indigo-300"
                    >
                      <ShieldIcon className="h-3.5 w-3.5" /> Make admin
                    </button>
                  ))}
                {u.isPublic && (
                  <button
                    type="button"
                    onClick={() => void setPublic({ userId: u.id, isPublic: false })}
                    className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                    title="Take their profile off public view"
                  >
                    Make private
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      title: `Delete ${u.username ? `@${u.username}` : (u.email ?? "this account")}?`,
                      body: "Their account and everything in it — profile, posts, library, Shed Log, lessons, recordings and files — is deleted for good. They can sign up again with the same email.",
                      confirmWord: u.username ?? u.email ?? "delete",
                      action: async () => {
                        await deleteUser({ userId: u.id });
                      },
                    })
                  }
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
