"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import Celebrations, { useCelebrations } from "@/components/practicelog/Celebrations";
import Momentum from "@/components/practicelog/Momentum";
import TaskDialog from "@/components/practicelog/TaskDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Segmented } from "@/components/metronome/MetronomeOptions";
import { MonthView, WeekView } from "@/components/practicelog/Calendar";
import DayPanel from "@/components/practicelog/DayPanel";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, PlusIcon, SpeakerIcon } from "@/components/tools";
import {
  type DayTask,
  type PracticeLogData,
  MONTH_NAMES,
  dayProgress,
  newDayTask,
  addDays,
  addMonths,
  formatShortDate,
  fromDateKey,
  isDateKey,
  minutesOn,
  monthGrid,
  startOfWeek,
  streak,
  todayKey,
} from "@/lib/practiceLog";
import { recordingsApi } from "@/lib/recordings";
import { usePersistedSettings } from "@/lib/usePersistedSettings";
import { usePracticeLog } from "@/lib/usePracticeLog";

const VIEW_KEY = "jam-practice-practice-log-view";
const VIEW_DEFAULTS = { view: "month" as "month" | "week" };
const noopSubscribe = () => () => {};

/**
 * The Practice Log — a calendar for planning and logging practice. Routines (lists of tasks, each
 * with minutes and optionally a time) repeat on a schedule; on each day you check tasks off — or
 * run the routine on the Practice Timer, which checks them off as each one finishes — write
 * notes, attach tunes / setlists / charts / tools, and record clips (on the day, or on one of its
 * routines). Plain Practice Timer sessions are logged on the day they ran, too.
 */
export default function PracticeLog({ initialDate }: { initialDate?: string }) {
  const log = usePracticeLog({ drainTimer: true });
  const { data, ready } = log;
  const router = useRouter();
  const [addMenu, setAddMenu] = useState<MenuState | null>(null);
  const [newTask, setNewTask] = useState<DayTask | null>(null);
  useCelebrations(data, ready);
  const { isAuthenticated } = useConvexAuth();
  const [{ view }, setView] = usePersistedSettings(VIEW_KEY, VIEW_DEFAULTS);
  // "Today" is the visitor's own day, which the server can't know — so nothing date-dependent is
  // rendered until the page is running in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [picked, setPicked] = useState<string | null>(isDateKey(initialDate) ? initialDate : null);
  const today = mounted ? todayKey() : null;
  const selected = picked ?? today;

  const range = useMemo(() => {
    if (!selected) return null;
    if (view === "week") {
      const from = startOfWeek(selected);
      return { from, to: addDays(from, 6) };
    }
    const d = fromDateKey(selected);
    const grid = monthGrid(d.getFullYear(), d.getMonth());
    return { from: grid[0], to: grid[grid.length - 1] };
  }, [selected, view]);
  const recordings = useQuery(recordingsApi.listForLogRange, isAuthenticated && range ? range : "skip");
  const clipsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recordings ?? []) if (r.logDate) m.set(r.logDate, (m.get(r.logDate) ?? 0) + 1);
    return m;
  }, [recordings]);

  if (!selected || !today) {
    return (
      <Shell>
        <LoadingSpinner />
      </Shell>
    );
  }

  const d = fromDateKey(selected);

  const title =
    view === "month"
      ? `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
      : (() => {
          const from = startOfWeek(selected);
          const to = addDays(from, 6);
          return `${formatShortDate(from)} – ${formatShortDate(to)}${fromDateKey(to).getFullYear() !== new Date().getFullYear() ? `, ${fromDateKey(to).getFullYear()}` : ""}`;
        })();
  const step = (n: number) => setPicked(view === "month" ? addMonths(selected, n) : addDays(selected, 7 * n));

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <CalendarIcon className="h-7 w-7 text-accent" /> Practice Log
          </h1>
          <p className="text-sm text-muted">{greeting(data, today)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => log.setPrefs({ sounds: !data.prefs.sounds })}
            aria-pressed={data.prefs.sounds}
            aria-label={data.prefs.sounds ? "Turn sounds off" : "Turn sounds on"}
            title={data.prefs.sounds ? "Sounds on" : "Sounds off"}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-surface hover:bg-surface-hover ${data.prefs.sounds ? "" : "text-muted"}`}
          >
            <SpeakerIcon className="h-4 w-4" />
            {!data.prefs.sounds && <span className="absolute h-5 w-0.5 rotate-45 rounded bg-current" />}
          </button>
          <Link href="/practice-log/routines" className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
            <ListIcon className="h-4 w-4" /> Routines
            {data.routines.length > 0 && <span className="tabular-nums text-muted">{data.routines.length}</span>}
          </Link>
          <button
            type="button"
            aria-label="Add a task or routine"
            title="Add a task or routine"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setAddMenu({
                x: Math.max(8, r.right - 208),
                y: r.bottom + 6,
                items: [
                  { label: `Task on ${selected === today ? "today" : formatShortDate(selected)}`, onSelect: () => setNewTask(newDayTask()) },
                  { label: "Routine", onSelect: () => router.push(`/practice-log/routine/edit?date=${selected}`) },
                ],
              });
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform hover:scale-105 hover:bg-accent-hover"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Momentum data={data} today={today} onGoalChange={(dailyGoal) => log.setPrefs({ dailyGoal })} />

      <div className="grid items-start gap-6 lg:flex-1 lg:items-stretch lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem] 2xl:grid-cols-[minmax(0,1fr)_32rem]">
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-[34rem]">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label={view === "month" ? "Previous month" : "Previous week"} className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={view === "month" ? "Next month" : "Next week"} className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground">
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <h2 className="order-first min-w-0 basis-full truncate text-xl font-bold sm:order-none sm:flex-1 sm:basis-auto">{title}</h2>
            {selected !== today && (
              <button type="button" onClick={() => setPicked(today)} className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-hover">
                Today
              </button>
            )}
            <div className="ml-auto w-40">
              <Segmented
                label="Calendar view"
                onPage
                value={view}
                onChange={(v) => setView({ view: v })}
                options={[
                  { value: "month", label: "Month" },
                  { value: "week", label: "Week" },
                ]}
              />
            </div>
          </div>
          {view === "month" ? (
            <MonthView year={d.getFullYear()} month={d.getMonth()} data={data} selected={selected} onSelect={setPicked} clipsByDate={clipsByDate} />
          ) : (
            <WeekView data={data} selected={selected} onSelect={setPicked} />
          )}
          {!ready && <LoadingSpinner size="sm" label="Loading your log" showLabel />}
        </div>
        <DayPanel date={selected} log={log} recordings={recordings} onDateChange={setPicked} />
      </div>
      <Celebrations />
      {addMenu && <ContextMenu menu={addMenu} onClose={() => setAddMenu(null)} />}
      {newTask && (
        <TaskDialog
          initial={newTask}
          date={selected}
          isNew
          onSave={(task, to) => {
            log.saveDayTask(to, task);
            setPicked(to);
          }}
          onClose={() => setNewTask(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex w-full flex-col gap-6 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:min-h-full lg:px-8 lg:pb-8 lg:pt-8">{children}</main>
  );
}

/** A line under the title that changes with the day: what's on, how it's going. */
function greeting(data: PracticeLogData, today: string): string {
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const p = dayProgress(data, today);
  const minutes = minutesOn(data, today);
  const goal = data.prefs.dailyGoal;
  if (p.total > 0 && p.done === p.total) return `${hello} — everything's done today. Great work.`;
  if (goal > 0 && minutes >= goal) return `${hello} — today's goal is in the bag.`;
  if (p.total > 0 && p.done > 0) return `${hello} — ${p.total - p.done} task${p.total - p.done === 1 ? "" : "s"} left today. Keep going.`;
  if (p.total > 0) return `${hello} — ${p.total} task${p.total === 1 ? "" : "s"} lined up for today.`;
  const s = streak(data, today);
  if (s > 0 && minutes === 0) return `${hello} — keep your ${s}-day streak going today.`;
  return `${hello} — plan your practice and watch the days fill up.`;
}
