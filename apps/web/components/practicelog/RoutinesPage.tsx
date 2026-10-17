"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BackButton, EmptyCard, PageShell } from "@/components/library/shared";
import { PlusIcon } from "@/components/tools";
import {
  ROUTINE_COLORS,
  describeRepeat,
  formatMinutesShort,
  formatShortDate,
  formatTime,
  nextOccurrences,
  parseTime,
  todayKey,
  totalMinutes,
} from "@/lib/practiceLog";
import { usePracticeLog } from "@/lib/usePracticeLog";

const noopSubscribe = () => () => {};

/** `/practice-log/routines` — every routine, with when it's next on. */
export default function RoutinesPage() {
  const { data, ready } = usePracticeLog();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!ready || !mounted) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }
  const today = todayKey();
  const rows = data.routines
    .map((r) => ({ r, next: nextOccurrences(r.repeat, today, 1)[0] ?? null }))
    .sort((a, b) => (a.next && b.next ? (a.next < b.next ? -1 : a.next > b.next ? 1 : 0) : a.next ? -1 : b.next ? 1 : 0));

  return (
    <PageShell>
      <BackButton href="/practice-log" label="Practice Log" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Routines</h1>
        <Link href="/practice-log/routine/edit" className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
          <PlusIcon className="h-4 w-4" /> New routine
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyCard>No routines yet. A routine is a list of tasks — with minutes for each, and times if you like — that repeats on the days you pick.</EmptyCard>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-hover rounded-2xl bg-surface">
          {rows.map(({ r, next }) => {
            const start = parseTime(r.startTime);
            return (
              <li key={r.id}>
                <Link href={`/practice-log/routine?id=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 p-4 hover:bg-surface-hover/50">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ROUTINE_COLORS[r.color % ROUTINE_COLORS.length] }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name || "Untitled routine"}</div>
                    <div className="truncate text-xs text-muted">
                      {describeRepeat(r.repeat)}
                      {start !== null ? ` · ${formatTime(start)}` : ""} · {r.tasks.length} task{r.tasks.length === 1 ? "" : "s"}, {formatMinutesShort(totalMinutes(r))}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted">{next ? (next === today ? "Today" : `Next ${formatShortDate(next)}`) : "Ended"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
