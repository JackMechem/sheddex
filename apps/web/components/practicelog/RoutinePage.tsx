"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BackButton, EmptyCard, PageShell } from "@/components/library/shared";
import { AttachmentList } from "@/components/practicelog/Attachments";
import { RecordingCard } from "@/components/recordings/RecordingParts";
import { CheckIcon, PencilIcon, PlayIcon } from "@/components/tools";
import {
  type Occurrence,
  type Routine,
  ROUTINE_COLORS,
  describeRepeat,
  formatLongDate,
  formatMinutesShort,
  formatShortDate,
  formatTime,
  nextOccurrences,
  occursOn,
  parseTime,
  progressOf,
  scheduleTasks,
  todayKey,
  totalMinutes,
} from "@/lib/practiceLog";
import { type Recording, recordingsApi } from "@/lib/recordings";
import { usePracticeLog, useRoutineTimer } from "@/lib/usePracticeLog";

const noopSubscribe = () => () => {};

/** Minutes logged for a routine on a day: timer time, or a checked task's planned minutes. */
function minutesFor(routine: Routine, occ: Occurrence): number {
  let ms = 0;
  const spent = occ.spentMs ?? {};
  for (const v of Object.values(spent)) ms += v;
  for (const id of occ.done ?? []) {
    if (spent[id] !== undefined) continue;
    const t = routine.tasks.find((x) => x.id === id);
    if (t) ms += t.minutes * 60000;
  }
  return ms / 60000;
}

/** `/practice-log/routine?id=…` — one routine: when it happens, its tasks, what's attached, every
    day it was practiced, and every clip recorded for it. */
export default function RoutinePage({ id }: { id: string }) {
  const router = useRouter();
  const log = usePracticeLog();
  const { isAuthenticated } = useConvexAuth();
  const { startRoutine, runningTask } = useRoutineTimer();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const recordings = useQuery(recordingsApi.listForRoutine, isAuthenticated ? { routineId: id } : "skip");
  const routine = log.data.routines.find((r) => r.id === id);

  const history = useMemo(() => {
    if (!routine) return [];
    return Object.entries(log.data.days)
      .filter(([, day]) => day.routines?.[id])
      .map(([date, day]) => ({ date, occ: day.routines![id] }))
      .filter(({ occ }) => (occ.done?.length ?? 0) > 0 || Object.keys(occ.spentMs ?? {}).length > 0 || occ.notes || occ.skipped)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [log.data.days, id, routine]);

  const byDate = useMemo(() => {
    const m = new Map<string, Recording[]>();
    for (const r of recordings ?? []) {
      const key = r.logDate ?? "";
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [recordings]);

  if (!log.ready || !mounted) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }
  if (!routine) {
    return (
      <PageShell>
        <BackButton href="/practice-log" label="Practice Log" />
        <EmptyCard>That routine doesn&apos;t exist anymore.</EmptyCard>
      </PageShell>
    );
  }

  const today = todayKey();
  const color = ROUTINE_COLORS[routine.color % ROUTINE_COLORS.length];
  const upcoming = nextOccurrences(routine.repeat, today, 6);
  const completed = history.filter(({ occ }) => {
    const p = progressOf(routine, occ);
    return p.total > 0 && p.done === p.total;
  }).length;
  const minutes = history.reduce((s, h) => s + minutesFor(routine, h.occ), 0);
  const start = parseTime(routine.startTime);
  const schedule = scheduleTasks(routine);
  const running = runningTask(routine.id, today);

  function startToday() {
    if (!routine) return;
    if (!occursOn(routine.repeat, today) && !(log.data.days[today]?.added ?? []).includes(routine.id)) log.addToDay(today, routine.id);
    startRoutine(routine, today);
    router.push(`/practice-log?date=${today}`);
  }

  return (
    <PageShell>
      <BackButton href="/practice-log" label="Practice Log" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate">{routine.name || "Untitled routine"}</span>
          </h1>
          <p className="text-sm text-muted">
            {describeRepeat(routine.repeat)}
            {start !== null ? ` · ${formatTime(start)}` : ""} · {formatMinutesShort(totalMinutes(routine))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/practice-log/routine/edit?id=${encodeURIComponent(routine.id)}`} className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
            <PencilIcon className="h-4 w-4" /> Edit
          </Link>
          {!running && routine.tasks.some((t) => t.minutes > 0) && (
            <button type="button" onClick={startToday} className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              <PlayIcon className="h-4 w-4" /> Start today
            </button>
          )}
        </div>
      </div>
      {routine.description && <p className="whitespace-pre-wrap text-sm">{routine.description}</p>}

      <div className="grid grid-cols-3 gap-3">
        <Stat value={String(completed)} label={`Day${completed === 1 ? "" : "s"} completed`} />
        <Stat value={formatMinutesShort(Math.round(minutes))} label="Practiced" />
        <Stat value={String(recordings?.length ?? 0)} label={`Recording${recordings?.length === 1 ? "" : "s"}`} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-bold">Tasks</h2>
        {routine.tasks.length === 0 ? (
          <EmptyCard>No tasks yet — Edit to add some.</EmptyCard>
        ) : (
          <ol className="flex flex-col divide-y divide-surface-hover rounded-2xl bg-surface">
            {schedule.map(({ task, start }, i) => (
              <li key={task.id} className="flex gap-3 p-3">
                <span className="w-5 shrink-0 pt-0.5 text-center text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{task.title || "Untitled task"}</div>
                  <div className="text-xs text-muted">
                    {start !== null ? `${formatTime(start)} · ` : ""}
                    {formatMinutesShort(task.minutes)}
                  </div>
                  {task.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{task.notes}</p>}
                  {task.attachments.length > 0 && (
                    <div className="mt-1.5">
                      <AttachmentList items={task.attachments} compact />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {routine.attachments.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-lg font-bold">Attached</h2>
          <AttachmentList items={routine.attachments} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-bold">Coming up</h2>
        {upcoming.length === 0 ? (
          <EmptyCard>Nothing coming up{routine.repeat.end ? ` — it ended ${formatShortDate(routine.repeat.end)}` : ""}.</EmptyCard>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcoming.map((date) => (
              <Link key={date} href={`/practice-log?date=${date}`} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-hover">
                {date === today ? "Today" : formatShortDate(date)}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-bold">Recordings</h2>
        {!isAuthenticated ? (
          <EmptyCard>Sign in to record clips — recordings are saved to your account.</EmptyCard>
        ) : recordings === undefined ? (
          <LoadingSpinner />
        ) : recordings.length === 0 ? (
          <EmptyCard>No recordings yet. Record a clip from the routine on any of its days.</EmptyCard>
        ) : (
          byDate.map(([date, list]) => (
            <div key={date || "none"} className="flex flex-col gap-2">
              <Link href={date ? `/practice-log?date=${date}` : "/practice-log"} className="px-1 text-sm font-semibold text-muted hover:text-foreground">
                {date ? formatLongDate(date) : "No day"}
              </Link>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((r) => (
                  <RecordingCard key={r._id} recording={r} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-bold">History</h2>
        {history.length === 0 ? (
          <EmptyCard>Nothing logged yet.</EmptyCard>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-hover rounded-2xl bg-surface">
            {history.map(({ date, occ }) => {
              const p = progressOf(routine, occ);
              const complete = p.total > 0 && p.done === p.total;
              const m = minutesFor(routine, occ);
              return (
                <li key={date}>
                  <Link href={`/practice-log?date=${date}`} className="flex items-start gap-3 p-3 hover:bg-surface-hover/50">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${complete ? "text-white" : "border-2 border-surface-hover"}`}
                      style={complete ? { background: color } : undefined}
                    >
                      {complete && <CheckIcon className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{formatLongDate(date)}</div>
                      <div className="text-xs text-muted">
                        {occ.skipped ? "Skipped" : `${p.done}/${p.total} tasks${m > 0 ? ` · ${formatMinutesShort(Math.round(m))}` : ""}`}
                      </div>
                      {occ.notes && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{occ.notes}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="truncate text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs font-semibold text-muted">{label}</div>
    </div>
  );
}
