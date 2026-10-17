"use client";

import Link from "next/link";
import { useState } from "react";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import PracticeTimerRing from "@/components/PracticeTimerRing";
import { AttachmentList } from "@/components/practicelog/Attachments";
import { burstAt } from "@/components/practicelog/Celebrations";
import RecordClip from "@/components/practicelog/RecordClip";
import { RecordingCard } from "@/components/recordings/RecordingParts";
import { CheckIcon, DotsVerticalIcon, PauseIcon, PlayIcon, RepeatIcon, StopIcon } from "@/components/tools";
import {
  type DayRoutine,
  ROUTINE_COLORS,
  describeRepeat,
  formatMinutesShort,
  formatTime,
  progressOf,
  routineSpan,
  scheduleTasks,
  timeString,
} from "@/lib/practiceLog";
import { pause, resume, skip, stop } from "@/lib/practiceTimerEngine";
import type { Recording } from "@/lib/recordings";
import { type usePracticeLog, useRoutineTimer } from "@/lib/usePracticeLog";

type Log = ReturnType<typeof usePracticeLog>;

/** One routine on one day: its tasks to check off (with when each one is), Start (runs it on the
    Practice Timer), what's attached, notes for the day, and the clips recorded for it that day. */
export default function RoutineCard({
  date,
  item,
  log,
  recordings,
  dayRoutines,
}: {
  date: string;
  item: DayRoutine;
  log: Log;
  recordings: Recording[] | undefined;
  dayRoutines: { id: string; name: string }[];
}) {
  const { routine, occurrence, added } = item;
  const { engine, startRoutine, runningTask } = useRoutineTimer();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editingTime, setEditingTime] = useState(false);
  const [showNotes, setShowNotes] = useState(!!occurrence.notes);
  const color = ROUTINE_COLORS[routine.color % ROUTINE_COLORS.length];
  const { done, total } = progressOf(routine, occurrence);
  const complete = total > 0 && done === total;
  const schedule = scheduleTasks(routine, occurrence);
  const span = routineSpan(routine, occurrence);
  const running = runningTask(routine.id, date);
  const doneSet = new Set(occurrence.done ?? []);
  const firstOpen = routine.tasks.find((t) => !doneSet.has(t.id) && t.minutes > 0);
  const skipped = !!occurrence.skipped;
  const mine = recordings?.filter((r) => r.routineId === routine.id) ?? [];
  const timeOverride = occurrence.startTime !== undefined;

  function openMenu(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: rect.right - 208,
      y: rect.bottom + 4,
      items: [
        { label: "Change the time for this day", onSelect: () => setEditingTime(true) },
        ...(timeOverride
          ? [{ label: "Use the routine's own time", onSelect: () => log.updateOccurrence(date, routine.id, (o) => { const n = { ...o }; delete n.startTime; return n; }) }]
          : []),
        { label: showNotes ? "Hide notes" : "Notes for this day", onSelect: () => setShowNotes((v) => !v) },
        complete
          ? { label: "Uncheck every task", onSelect: () => log.updateOccurrence(date, routine.id, (o) => ({ ...o, done: [] })) }
          : { label: "Check every task", onSelect: () => log.updateOccurrence(date, routine.id, (o) => ({ ...o, done: routine.tasks.map((t) => t.id) })) },
        added
          ? { label: "Remove from this day", danger: true, onSelect: () => log.removeFromDay(date, routine.id) }
          : skipped
            ? { label: "Don't skip this day", onSelect: () => log.updateOccurrence(date, routine.id, (o) => ({ ...o, skipped: false })) }
            : { label: "Skip this day", onSelect: () => log.updateOccurrence(date, routine.id, (o) => ({ ...o, skipped: true })) },
      ],
    });
  }

  return (
    <article className={`relative flex flex-col gap-3 rounded-2xl bg-surface p-4 pl-5 ${skipped ? "opacity-60" : ""}`}>
      <span aria-hidden className="absolute bottom-7 left-2 top-7 w-1 rounded-full" style={{ background: color }} />
      <header className="flex items-start gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <Link href={`/practice-log/routine?id=${encodeURIComponent(routine.id)}`} className={`block truncate text-lg font-bold hover:underline ${skipped ? "line-through" : ""}`}>
            {routine.name || "Untitled routine"}
          </Link>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className={timeOverride ? "font-semibold text-foreground" : ""}>
              {span ? `${formatTime(span.start)} – ${formatTime(span.end)}` : "Any time"}
            </span>
            <span>·</span>
            <span>{formatMinutesShort(routine.tasks.reduce((s, t) => s + t.minutes, 0))}</span>
            <span className="flex basis-full items-center gap-1">
              {added ? "Added to this day" : (
                <>
                  <RepeatIcon className="h-3 w-3" /> {describeRepeat(routine.repeat)}
                </>
              )}
            </span>
            {skipped && <span className="font-semibold text-foreground">· Skipped</span>}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${complete ? "text-white" : "bg-background text-muted"}`}
          style={complete ? { background: color } : undefined}
        >
          {done}/{total}
        </span>
        <button type="button" onClick={openMenu} aria-label="Routine options" className="-mr-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground">
          <DotsVerticalIcon className="h-4 w-4" />
        </button>
      </header>

      {total > 0 && (
        <div className="-mt-1 h-1.5 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(done / total) * 100}%`, background: color }} />
        </div>
      )}

      {editingTime && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-2 text-sm">
          <span className="text-muted">Start this day at</span>
          <input
            type="time"
            autoFocus
            defaultValue={occurrence.startTime ?? routine.startTime ?? (span ? timeString(span.start) : "")}
            onChange={(e) => {
              const v = e.target.value;
              log.updateOccurrence(date, routine.id, (o) => ({ ...o, startTime: v || null }));
            }}
            className="rounded-lg bg-surface px-2 py-1"
          />
          <button type="button" onClick={() => setEditingTime(false)} className="ml-auto rounded-full px-3 py-1 font-medium hover:bg-surface">
            Done
          </button>
        </div>
      )}

      {engine && running ? (
        <div className="flex items-center gap-4 rounded-xl bg-background p-3">
          <PracticeTimerRing size="sm" startedAt={engine.startedAt} durationMs={engine.durationMs} paused={engine.paused} remainingMsAtPause={engine.remainingMsAtPause} alarming={engine.alarming} />
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-semibold ${engine.alarming ? "animate-pulse text-danger" : "text-muted"}`}>
              {engine.alarming ? "Time's up" : engine.paused ? "Paused" : "Now"}
            </div>
            <div className="truncate font-semibold">{engine.current.title}</div>
            <div className="truncate text-xs text-muted">{engine.next ? `Next: ${engine.next.title}` : "Last task"}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            {engine.alarming ? (
              <TimerButton label="Continue" onClick={skip} primary>
                <PlayIcon className="h-4 w-4" />
              </TimerButton>
            ) : engine.paused ? (
              <TimerButton label="Resume" onClick={resume} primary>
                <PlayIcon className="h-4 w-4" />
              </TimerButton>
            ) : (
              <TimerButton label="Pause" onClick={pause}>
                <PauseIcon className="h-4 w-4" />
              </TimerButton>
            )}
            {!engine.alarming && (
              <TimerButton label="Skip — don't check it off" onClick={skip}>
                <span className="text-xs font-bold">»</span>
              </TimerButton>
            )}
            <TimerButton label="Stop" onClick={stop}>
              <StopIcon className="h-4 w-4 text-danger" />
            </TimerButton>
          </div>
        </div>
      ) : (
        !skipped &&
        firstOpen && (
          <button
            type="button"
            onClick={() => startRoutine(routine, date, done > 0 ? firstOpen.id : undefined)}
            className="flex items-center justify-center gap-1.5 self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            <PlayIcon className="h-4 w-4" />
            {done > 0 ? `Continue from ${firstOpen.title || "the next task"}` : "Start routine"}
          </button>
        )
      )}

      {routine.tasks.length > 0 && (
        <ul className="flex flex-col">
          {schedule.map(({ task, start }) => {
            const checked = doneSet.has(task.id);
            const spent = occurrence.spentMs?.[task.id];
            const isNow = running === task.id;
            return (
              <li key={task.id} className={`group flex items-start gap-3 rounded-xl px-1 py-2 ${isNow ? "bg-accent/10" : ""}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`${task.title || "Task"} done`}
                  onClick={(e) => {
                    if (!checked) burstAt(e.currentTarget, color);
                    log.toggleTask(date, routine.id, task.id);
                  }}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? "log-check border-transparent text-white" : "border-surface-hover hover:border-muted"}`}
                  style={checked ? { background: color } : undefined}
                >
                  {checked && <CheckIcon className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${checked ? "text-muted line-through" : ""}`}>{task.title || "Untitled task"}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                    {start !== null && <span className={task.time ? "font-semibold" : ""}>{formatTime(start)}</span>}
                    <span>{formatMinutesShort(task.minutes)}</span>
                    {spent ? <span>· {formatMinutesShort(spent / 60000)} on the timer</span> : null}
                  </div>
                  {task.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{task.notes}</p>}
                  {task.attachments.length > 0 && (
                    <div className="mt-1.5">
                      <AttachmentList items={task.attachments} compact />
                    </div>
                  )}
                </div>
                {!skipped && task.minutes > 0 && !isNow && (
                  <button
                    type="button"
                    onClick={() => startRoutine(routine, date, task.id, true)}
                    aria-label={`Time just ${task.title || "this task"}`}
                    title="Time just this task"
                    className="shrink-0 rounded-full p-1.5 text-muted opacity-100 hover:bg-background hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <PlayIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {routine.attachments.length > 0 && <AttachmentList items={routine.attachments} />}

      {showNotes && (
        <textarea
          value={occurrence.notes ?? ""}
          onChange={(e) => log.updateOccurrence(date, routine.id, (o) => ({ ...o, notes: e.target.value }))}
          rows={3}
          placeholder={`How did ${routine.name || "it"} go today?`}
          className="resize-y rounded-xl bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}

      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          {mine.map((r) => (
            <RecordingCard key={r._id} recording={r} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <RecordClip date={date} routineId={routine.id} routines={dayRoutines} compact />
        {!showNotes && (
          <button type="button" onClick={() => setShowNotes(true)} className="rounded-full bg-background px-2.5 py-1 text-xs font-medium hover:bg-surface-hover">
            Add notes
          </button>
        )}
      </div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </article>
  );
}

function TimerButton({ label, onClick, primary = false, children }: { label: string; onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full ${primary ? "bg-accent text-accent-foreground hover:bg-accent-hover" : "bg-surface hover:bg-surface-hover"}`}
    >
      {children}
    </button>
  );
}
