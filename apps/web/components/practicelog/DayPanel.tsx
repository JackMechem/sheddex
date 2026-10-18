"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import { AttachmentList } from "@/components/practicelog/Attachments";
import RecordClip from "@/components/practicelog/RecordClip";
import RoutineCard from "@/components/practicelog/RoutineCard";
import RoutineIcon from "@/components/practicelog/RoutineIcon";
import { RecordingCard } from "@/components/recordings/RecordingParts";
import { SHARE_PROGRESS_EVENT, burstAt } from "@/components/practicelog/Celebrations";
import TaskDialog from "@/components/practicelog/TaskDialog";
import Subtasks from "@/components/practicelog/Subtasks";
import LogTimeDialog from "@/components/practicelog/LogTimeDialog";
import DayTimer, { useDayTimerMs } from "@/components/practicelog/DayTimer";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, DotsVerticalIcon, NAV_LINKS, PlayIcon, PlusIcon, ShareIcon, StopwatchIcon } from "@/components/tools";
import {
  type DayTask,
  addDays,
  clearDayTime,
  dayProgress,
  newDayTask,
  newSubtask,
  parseTime,
  formatLongDate,
  formatMinutesShort,
  formatTime,
  minutesOn,
  routinesOn,
  todayKey,
} from "@/lib/practiceLog";
import type { Recording } from "@/lib/recordings";
import { type usePracticeLog, useRoutineTimer } from "@/lib/usePracticeLog";

type Log = ReturnType<typeof usePracticeLog>;

/** Everything on one day: its routines, Practice Timer time, minutes logged by hand, the day's
    notes and attachments, and the clips recorded that day. */
export default function DayPanel({
  date,
  log,
  recordings,
  onDateChange,
}: {
  date: string;
  log: Log;
  recordings: Recording[] | undefined;
  onDateChange: (date: string) => void;
}) {
  const router = useRouter();
  const { data } = log;
  const day = data.days[date] ?? {};
  const items = routinesOn(data, date);
  const watch = useDayTimerMs(data, date);
  const minutes = minutesOn(data, date, watch.liveMs);
  const progress = dayProgress(data, date);
  const isToday = date === todayKey();
  const dayRoutines = items.map((i) => ({ id: i.routine.id, name: i.routine.name || "Untitled routine" }));
  const dayRecordings = recordings?.filter((r) => r.logDate === date) ?? [];
  const loose = dayRecordings.filter((r) => !r.routineId || !items.some((i) => i.routine.id === r.routineId));
  const [addMenu, setAddMenu] = useState<MenuState | null>(null);
  const [logging, setLogging] = useState(false);

  function openAddMenu(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const onDay = new Set(items.map((i) => i.routine.id));
    const others = data.routines.filter((r) => !onDay.has(r.id));
    setAddMenu({
      x: Math.min(rect.left, window.innerWidth - 216),
      y: rect.bottom + 4,
      items: [
        { label: "New routine starting this day", icon: <PlusIcon className="h-4 w-4 text-muted" />, onSelect: () => router.push(`/shed-log/routine/edit?date=${date}`) },
        ...others.map((r) => ({
          label: `Add ${r.name || "Untitled routine"} to this day`,
          icon: <RoutineIcon icon={r.icon} color={r.color} size="sm" />,
          onSelect: () => log.addToDay(date, r.id),
        })),
      ],
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onDateChange(addDays(date, -1))} aria-label="Previous day" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground">
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-xl font-extrabold">{formatLongDate(date)}</h2>
          <p className="text-xs text-muted">
            {isToday ? "Today · " : ""}
            {minutes > 0 ? `${formatMinutesShort(Math.round(minutes))} practiced` : "Nothing logged yet"}
            {date <= todayKey() && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent(SHARE_PROGRESS_EVENT, { detail: { kind: "day", date } }))}
                  className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                >
                  <ShareIcon className="h-3 w-3" /> Day report
                </button>
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground">
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {progress.total > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(progress.done / progress.total) * 100}%`,
                background: progress.done === progress.total ? "linear-gradient(90deg, #4ade80, #22c55e)" : "var(--accent)",
              }}
            />
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums">
            {progress.done === progress.total ? "All done!" : `${progress.done} of ${progress.total} done`}
          </span>
        </div>
      )}

      <DayTimer data={data} date={date} onClear={() => log.updateDay(date, clearDayTime)} />

      <DayTasks date={date} log={log} />

      {items.length === 0 ? (
        (day.tasks?.length ?? 0) === 0 && (
          <div className="rounded-2xl bg-surface p-4 text-sm text-muted">
            {data.routines.length === 0 ? "No routines yet. Make one to plan what to practice and when — or just add a task above." : "No routines on this day."}
          </div>
        )
      ) : (
        items.map((item) => (
          <RoutineCard key={item.routine.id} date={date} item={item} log={log} recordings={recordings} dayRoutines={dayRoutines} />
        ))
      )}
      <button
        type="button"
        onClick={openAddMenu}
        className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-surface-hover px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-foreground"
      >
        <PlusIcon className="h-4 w-4" /> Add a routine to this day
      </button>

      {(day.sessions?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <StopwatchIcon className="h-4 w-4 text-accent" /> Timed practice
          </h3>
          <ul className="flex flex-col text-sm">
            {day.sessions!.map((s, i) => {
              const tool = s.tool ? NAV_LINKS.find((l) => l.href === s.tool) : undefined;
              const ToolIcon = tool?.icon ?? StopwatchIcon;
              return (
              <li key={i} className="flex items-center justify-between gap-2 py-0.5">
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <ToolIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                  {s.tool ? <Link href={s.tool} className="truncate hover:underline">{s.title}</Link> : s.title}
                  {s.session !== s.title && <span className="text-muted"> · {s.session}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {formatTime(new Date(s.at).getHours() * 60 + new Date(s.at).getMinutes())} · {formatMinutesShort(Math.max(1, Math.round(s.ms / 60000)))}
                </span>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Logged by hand</h3>
            <button type="button" onClick={() => setLogging(true)} className="mt-1 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
              <PlusIcon className="h-3.5 w-3.5" /> Log time
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => log.addDayTime(date, -5 * 60000)}
              aria-label="5 minutes less"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-background font-bold hover:bg-surface-hover"
            >
              −
            </button>
            <span className="w-16 text-center text-sm font-semibold tabular-nums">5 min</span>
            <button
              type="button"
              onClick={() => log.addDayTime(date, 5 * 60000)}
              aria-label="5 minutes more"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-background font-bold hover:bg-surface-hover"
            >
              +
            </button>
          </div>
        </div>
        <textarea
          value={day.notes ?? ""}
          onChange={(e) => log.updateDay(date, (d) => ({ ...d, notes: e.target.value }))}
          rows={3}
          placeholder="Notes for the day — what you worked on, how it went"
          className="resize-y rounded-xl bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <AttachmentList items={day.attachments ?? []} onChange={(attachments) => log.updateDay(date, (d) => ({ ...d, attachments }))} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Recordings</h3>
          {dayRecordings.length > 0 && <span className="text-xs tabular-nums text-muted">{dayRecordings.length}</span>}
        </div>
        {loose.map((r) => (
          <RecordingCard key={r._id} recording={r} />
        ))}
        {dayRecordings.length > loose.length && (
          <p className="text-xs text-muted">
            {dayRecordings.length - loose.length} more with{" "}
            {[...new Set(dayRecordings.filter((r) => !loose.includes(r)).map((r) => items.find((i) => i.routine.id === r.routineId)?.routine.name))].filter(Boolean).join(", ")} above.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <RecordClip date={date} routines={dayRoutines} />
        </div>
      </div>
      {addMenu && <ContextMenu menu={addMenu} onClose={() => setAddMenu(null)} />}
      {logging && <LogTimeDialog date={date} log={log} onClose={() => setLogging(false)} />}
    </section>
  );
}

/** The day's own tasks (not part of a routine): a quick-add box, a checklist, and the timer. */
function DayTasks({ date, log }: { date: string; log: Log }) {
  const tasks = log.data.days[date]?.tasks ?? [];
  const { engine, startDayTasks, runningTask } = useRoutineTimer();
  const running = runningTask("day", date);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<{ task: DayTask; isNew: boolean } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const sorted = [...tasks].sort((a, b) => {
    const ta = parseTime(a.time);
    const tb = parseTime(b.time);
    if (ta !== null && tb !== null) return ta - tb;
    return ta !== null ? -1 : tb !== null ? 1 : 0;
  });
  const open = tasks.filter((t) => !t.done && t.minutes > 0);

  function quickAdd() {
    const t = title.trim();
    if (!t) return;
    log.saveDayTask(date, { ...newDayTask(t) });
    setTitle("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Tasks</h3>
        {open.length > 1 && !running && (
          <button type="button" onClick={() => startDayTasks(date, tasks)} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
            <PlayIcon className="h-3.5 w-3.5" /> Start all
          </button>
        )}
      </div>
      {sorted.length > 0 && (
        <ul className="flex flex-col">
          {sorted.map((t) => {
            const isNow = running === t.id;
            const time = parseTime(t.time);
            return (
              <li key={t.id} className={`group flex items-start gap-3 rounded-xl px-1 py-2 ${isNow ? "bg-accent/10" : ""}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={t.done}
                  aria-label={`${t.title} done`}
                  onClick={(e) => {
                    if (!t.done) burstAt(e.currentTarget, "var(--accent)");
                    log.toggleDayTask(date, t.id);
                  }}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${t.done ? "log-check border-transparent bg-accent text-accent-foreground" : "border-surface-hover hover:border-muted"}`}
                >
                  {t.done && <CheckIcon className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setEditing({ task: t, isNew: false })} className="w-full text-left">
                  <div className={`font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                    {time !== null && <span className="font-semibold">{formatTime(time)}</span>}
                    <span>{formatMinutesShort(t.minutes)}</span>
                    {t.spentMs ? <span>· {formatMinutesShort(t.spentMs / 60000)} logged</span> : null}
                  </div>
                  {t.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{t.notes}</p>}
                </button>
                {t.done && !t.spentMs && t.minutes > 0 && (
                  <button
                    type="button"
                    onClick={() => log.saveDayTask(date, { ...t, spentMs: t.minutes * 60000 })}
                    className="mt-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent/25"
                    title="Checked off without the timer — log its time"
                  >
                    + Log {formatMinutesShort(t.minutes)}
                  </button>
                )}
                <Subtasks
                  items={t.subtasks ?? []}
                  isDone={(id) => !!t.subtasks?.find((x) => x.id === id)?.done}
                  onToggle={(id) => log.saveDayTask(date, { ...t, subtasks: (t.subtasks ?? []).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) })}
                  onAdd={(title) => log.saveDayTask(date, { ...t, subtasks: [...(t.subtasks ?? []), newSubtask(title)] })}
                  onRemove={(id) => log.saveDayTask(date, { ...t, subtasks: (t.subtasks ?? []).filter((x) => x.id !== id) })}
                />
                </div>
                {isNow && engine ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">{engine.paused ? "Paused" : "Timing"}</span>
                ) : (
                  t.minutes > 0 &&
                  !t.done && (
                    <button
                      type="button"
                      onClick={() => startDayTasks(date, tasks, t.id)}
                      aria-label={`Time ${t.title}`}
                      title="Start the timer"
                      className="shrink-0 rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <PlayIcon className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-label="Task options"
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenu({
                      x: r.right - 208,
                      y: r.bottom + 4,
                      items: [
                        { label: "Edit", onSelect: () => setEditing({ task: t, isNew: false }) },
                        { label: "Move to the next day", onSelect: () => log.moveDayTask(date, addDays(date, 1), { ...t, done: false }) },
                        { label: "Delete", danger: true, onSelect: () => log.removeDayTask(date, t.id) },
                      ],
                    });
                  }}
                  className="shrink-0 rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground"
                >
                  <DotsVerticalIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-1.5">
        <PlusIcon className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickAdd()}
          placeholder="Add a task — press Enter"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
        />
        {title.trim() && (
          <button type="button" onClick={() => setEditing({ task: newDayTask(title.trim()), isNew: true })} className="shrink-0 text-xs font-semibold text-muted hover:text-foreground">
            More…
          </button>
        )}
      </div>
      {editing && (
        <TaskDialog
          initial={editing.task}
          date={date}
          isNew={editing.isNew}
          onSave={(task, to) => {
            log.moveDayTask(date, to, task);
            if (editing.isNew) setTitle("");
          }}
          onDelete={editing.isNew ? undefined : () => log.removeDayTask(date, editing.task.id)}
          onClose={() => setEditing(null)}
        />
      )}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
