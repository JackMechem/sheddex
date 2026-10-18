"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CloseIcon } from "@/components/tools";
import { formatLongDate, formatMinutesShort, routinesOn, tasksOf } from "@/lib/practiceLog";
import type { usePracticeLog } from "@/lib/usePracticeLog";

type Log = ReturnType<typeof usePracticeLog>;
type Target = { kind: "day" } | { kind: "routine"; routineId: string; taskId: string } | { kind: "task"; taskId: string };

const QUICK = [5, 10, 15, 20, 30, 45, 60, 90];

/** Log practice by hand — for when you forgot the timer: how long, and on the day as a whole or
    on one of its tasks (which can be checked off at the same time). */
export default function LogTimeDialog({ date, log, onClose }: { date: string; log: Log; onClose: () => void }) {
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(15);
  const [target, setTarget] = useState<Target>({ kind: "day" });
  const [markDone, setMarkDone] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = Math.max(0, hours * 60 + mins);
  const items = routinesOn(log.data, date);
  const dayTasks = log.data.days[date]?.tasks ?? [];
  const key = (t: Target) => (t.kind === "day" ? "day" : t.kind === "routine" ? `r:${t.routineId}:${t.taskId}` : `t:${t.taskId}`);
  const options: { target: Target; label: string; group?: string }[] = [
    { target: { kind: "day" }, label: "The day (no particular task)" },
    ...items.flatMap(({ routine, occurrence }) =>
      tasksOf(routine, occurrence).map((t) => ({ target: { kind: "routine", routineId: routine.id, taskId: t.id } as Target, label: t.title || "Task", group: routine.name || "Routine" })),
    ),
    ...dayTasks.map((t) => ({ target: { kind: "task", taskId: t.id } as Target, label: t.title, group: "Tasks" })),
  ];

  function save() {
    if (!total) return;
    const ms = total * 60000;
    // Everything logged by hand goes on the day timer (the day's total); a task also gets it as its time.
    log.addDayTime(date, ms);
    if (target.kind === "day") {
      // nothing more
    } else if (target.kind === "routine") {
      const { routineId, taskId } = target;
      log.updateOccurrence(date, routineId, (o) => ({
        ...o,
        spentMs: { ...(o.spentMs ?? {}), [taskId]: (o.spentMs?.[taskId] ?? 0) + ms },
        ...(markDone && !(o.done ?? []).includes(taskId) ? { done: [...(o.done ?? []), taskId] } : {}),
      }));
    } else {
      const t = dayTasks.find((x) => x.id === target.taskId);
      if (t) log.saveDayTask(date, { ...t, spentMs: (t.spentMs ?? 0) + ms, done: t.done || markDone });
    }
    onClose();
  }

  let lastGroup: string | undefined;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]" onClick={onClose}>
      <div role="dialog" aria-label="Log time" className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Log time</h2>
            <p className="text-xs text-muted">{formatLongDate(date)} — for when you forgot the timer</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setHours(Math.floor(m / 60));
                setMins(m % 60);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${total === m ? "bg-accent text-accent-foreground" : "bg-background hover:bg-surface-hover"}`}
            >
              {formatMinutesShort(m)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input inputMode="numeric" value={hours} onChange={(e) => setHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))} aria-label="Hours" className="w-16 rounded-xl bg-background px-3 py-2 text-center font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          <span className="text-muted">h</span>
          <input inputMode="numeric" value={mins} onChange={(e) => setMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} aria-label="Minutes" className="w-16 rounded-xl bg-background px-3 py-2 text-center font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          <span className="text-muted">min</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted">For</span>
          <div className="flex max-h-56 flex-col overflow-y-auto rounded-xl bg-background p-1">
            {options.map((o) => {
              const on = key(o.target) === key(target);
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <div key={key(o.target)}>
                  {header && <div className="px-2 pb-0.5 pt-2 text-[11px] font-bold text-muted">{header}</div>}
                  <button type="button" onClick={() => setTarget(o.target)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${on ? "bg-accent/15 font-semibold" : "hover:bg-surface"}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent bg-accent" : "border-surface-hover"}`}>{on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                    <span className="truncate">{o.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        {target.kind !== "day" && (
          <label className="flex items-center gap-2 text-sm">
            <button type="button" role="checkbox" aria-checked={markDone} onClick={() => setMarkDone((v) => !v)} className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${markDone ? "border-transparent bg-accent text-accent-foreground" : "border-surface-hover"}`}>
              {markDone && <CheckIcon className="h-3.5 w-3.5" />}
            </button>
            Check the task off too
          </label>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={!total} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50">
            Log {total ? formatMinutesShort(total) : "time"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
