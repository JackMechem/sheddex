"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ShedLogTour from "@/components/practicelog/ShedLogTour";
import { Shot, TopicIcon } from "@/components/help/helpParts";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, HelpIcon, PlayIcon, SearchIcon, SlidersIcon, StarIcon } from "@/components/tools";
import { HELP_GROUPS, HELP_TOPICS, type HelpTopic, topicById } from "@/lib/helpContent";

/**
 * `/help[?topic=…]` — every tool and feature listed on the left (grouped like the sidebar, with a
 * search), and the picked one on the right: what it's for, a screenshot of it (light or dark to
 * match the theme), how to use it in numbered steps, its main features and a few tips. On phones
 * the list comes first and a topic opens full width with a back button. The topic is kept in the
 * address bar (`history.replaceState`, so it doesn't reload or add history entries) so a link to
 * a topic can be shared.
 */

/** The topics in the order the list shows them (for Previous / Next). */
const ORDERED = HELP_GROUPS.flatMap((g) => HELP_TOPICS.filter((t) => t.group === g));

function TopicList({ query, selected, onPick }: { query: string; selected: string; onPick: (id: string) => void }) {
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const match = (t: HelpTopic) => !q || `${t.title} ${t.tagline} ${t.features.join(" ")} ${(t.options ?? []).map((o) => o.name).join(" ")}`.toLowerCase().includes(q);
    return HELP_GROUPS.map((g) => ({ group: g, topics: HELP_TOPICS.filter((t) => t.group === g && match(t)) })).filter((g) => g.topics.length);
  }, [q]);
  if (!groups.length) return <p className="px-2 py-6 text-center text-sm text-muted">Nothing matches.</p>;
  return (
    <nav aria-label="Help topics" className="flex flex-col gap-4">
      {groups.map(({ group, topics }) => (
        <div key={group}>
          <h2 className="mb-1 px-2 text-xs font-semibold text-muted">{group}</h2>
          <ul className="flex flex-col gap-0.5">
            {topics.map((t) => {
              const on = t.id === selected;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onPick(t.id)}
                    aria-current={on ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${
                      on ? "bg-accent/15 font-semibold text-foreground" : "hover:bg-surface-hover"
                    }`}
                  >
                    <TopicIcon topic={t} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <ChevronRightIcon className={`h-4 w-4 shrink-0 text-muted lg:hidden`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function TopicDetail({ topic, onPick, onBack }: { topic: HelpTopic; onPick: (id: string) => void; onBack: () => void }) {
  const [touring, setTouring] = useState(false);
  const index = ORDERED.indexOf(topic);
  const prev = ORDERED[index - 1];
  const next = ORDERED[index + 1];
  return (
    <article className="settings-pop mx-auto flex w-full max-w-4xl flex-col gap-8">
      <button type="button" onClick={onBack} className="-ml-1 flex items-center gap-1 self-start rounded-full px-2 py-1 text-sm font-semibold text-muted hover:bg-surface-hover hover:text-foreground lg:hidden">
        <ChevronLeftIcon className="h-4 w-4" /> All topics
      </button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <TopicIcon topic={topic} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-accent">{topic.group}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{topic.title}</h1>
          <p className="mt-1 text-lg font-semibold">{topic.tagline}</p>
          <p className="mt-1 text-muted">{topic.purpose}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topic.href && (
              <Link href={topic.href} className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                <PlayIcon className="h-4 w-4" /> Open {topic.title}
              </Link>
            )}
            {topic.id === "shed-log" && (
              <button type="button" onClick={() => setTouring(true)} className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
                <HelpIcon className="h-4 w-4" /> Take the quick tour
              </button>
            )}
          </div>
        </div>
      </header>

      {topic.shot && <Shot name={topic.shot} alt={`${topic.title} screenshot`} />}

      <section>
        <h2 className="mb-3 text-lg font-bold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {topic.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl bg-surface p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {topic.options?.length ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <SlidersIcon className="h-5 w-5 text-accent" /> The options
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {topic.options.map((o) => (
              <div key={o.name} className="rounded-2xl border border-surface-hover p-4">
                <dt className="font-semibold">{o.name}</dt>
                <dd className="mt-1 text-sm text-muted">{o.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <CheckIcon className="h-5 w-5 text-accent" /> At a glance
        </h2>
        <ul className="flex flex-wrap gap-2">
          {topic.features.map((f) => (
            <li key={f} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium">
              {f}
            </li>
          ))}
        </ul>
      </section>

      {topic.tips?.length ? (
        <section className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <StarIcon className="h-5 w-5 text-accent" /> Tips
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {topic.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label="More topics" className="grid grid-cols-2 gap-3 border-t border-surface-hover pt-6">
        {prev ? (
          <button type="button" onClick={() => onPick(prev.id)} className="flex min-w-0 items-center gap-2 rounded-2xl bg-surface p-3 text-left hover:bg-surface-hover">
            <ChevronLeftIcon className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block text-xs text-muted">Previous</span>
              <span className="block truncate text-sm font-semibold">{prev.title}</span>
            </span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" onClick={() => onPick(next.id)} className="flex min-w-0 items-center justify-end gap-2 rounded-2xl bg-surface p-3 text-right hover:bg-surface-hover">
            <span className="min-w-0">
              <span className="block text-xs text-muted">Next</span>
              <span className="block truncate text-sm font-semibold">{next.title}</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
          </button>
        )}
      </nav>
      {touring && <ShedLogTour onClose={() => setTouring(false)} />}
    </article>
  );
}

export default function HelpPage({ initialTopic }: { initialTopic?: string }) {
  const [selected, setSelected] = useState(() => topicById(initialTopic).id);
  // Phones show the list or a topic, not both; arriving with ?topic= opens it straight away.
  const [showDetail, setShowDetail] = useState(Boolean(initialTopic));
  const [query, setQuery] = useState("");
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname !== "/help") return;
    url.searchParams.set("topic", selected);
    window.history.replaceState(window.history.state, "", url);
  }, [selected]);

  function pick(id: string) {
    setSelected(id);
    setShowDetail(true);
    detailRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }

  const topic = topicById(selected);

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:h-full lg:min-h-0 lg:px-8 lg:pb-0 lg:pt-8">
      <div className={`items-center gap-2 ${showDetail ? "hidden lg:flex" : "flex"}`}>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          <HelpIcon className="h-6 w-6 text-accent sm:h-7 sm:w-7" /> Help
        </h1>
      </div>
      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className={`flex-col gap-3 lg:flex lg:min-h-0 ${showDetail ? "hidden" : "flex"}`}>
          <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
            <SearchIcon className="h-4 w-4 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help" aria-label="Search help" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
            <TopicList query={query} selected={selected} onPick={pick} />
          </div>
        </aside>
        <div ref={detailRef} className={`lg:block lg:min-h-0 lg:overflow-y-auto lg:pb-8 ${showDetail ? "block" : "hidden"}`}>
          <TopicDetail key={topic.id} topic={topic} onPick={pick} onBack={() => setShowDetail(false)} />
        </div>
      </div>
    </main>
  );
}
