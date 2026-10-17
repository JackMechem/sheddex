"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AttachmentList } from "@/components/practicelog/Attachments";
import { CloseIcon, TrashIcon } from "@/components/tools";
import { type DayTask, formatLongDate, isDateKey } from "@/lib/practiceLog";

/** Make or edit a one-off task: what, which day, how long, optionally when, notes and attachments. */
export default function TaskDialog({
  initial,
  date,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  initial: DayTask;
  date: string;
  isNew: boolean;
  onSave: (task: DayTask, date: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [task, setTask] = useState(initial);
  const [day, setDay] = useState(date);
  const set = (patch: Partial<DayTask>) => setTask((t) => ({ ...t, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    onSave({ ...task, title: task.title.trim() || "Practice" }, day);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]" onClick={onClose}>
      <div role="dialog" aria-label={isNew ? "New task" : "Edit task"} className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{isNew ? "New task" : "Edit task"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <input
          autoFocus
          value={task.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="What to practice — e.g. Transcribe a chorus"
          className="rounded-xl bg-background px-3 py-2.5 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-medium text-muted">Day</span>
            <input type="date" value={day} onChange={(e) => isDateKey(e.target.value) && setDay(e.target.value)} className="rounded-xl bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-muted">Minutes</span>
            <div className="flex items-center rounded-xl bg-background">
              <button type="button" onClick={() => set({ minutes: Math.max(0, task.minutes - 5) })} aria-label="Less" className="h-9 w-9 rounded-xl font-bold hover:bg-surface-hover">
                −
              </button>
              <input
                inputMode="decimal"
                value={task.minutes}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) set({ minutes: Math.min(600, Math.max(0, n)) });
                }}
                className="min-w-0 flex-1 bg-transparent text-center font-semibold tabular-nums outline-none"
              />
              <button type="button" onClick={() => set({ minutes: Math.min(600, task.minutes + 5) })} aria-label="More" className="h-9 w-9 rounded-xl font-bold hover:bg-surface-hover">
                +
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-muted">At (optional)</span>
            <input type="time" value={task.time ?? ""} onChange={(e) => set({ time: e.target.value || null })} className="rounded-xl bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          </label>
        </div>
        <textarea
          value={task.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          placeholder="Notes (optional)"
          className="resize-y rounded-xl bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <AttachmentList items={task.attachments ?? []} onChange={(attachments) => set({ attachments })} />
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-danger hover:bg-background"
            >
              <TrashIcon className="h-4 w-4" /> Delete
            </button>
          )}
          <span className="ml-auto text-xs text-muted">{formatLongDate(day)}</span>
          <button type="button" onClick={save} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            {isNew ? "Add task" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
