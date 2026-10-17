"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BackButton, PageShell } from "@/components/library/shared";
import { Segmented } from "@/components/metronome/MetronomeOptions";
import { AttachmentList } from "@/components/practicelog/Attachments";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon, TrashIcon } from "@/components/tools";
import {
  type Repeat,
  type RepeatFreq,
  type Routine,
  type RoutineTask,
  type Weekday,
  ROUTINE_COLORS,
  WEEKDAY_LETTER,
  WEEKDAY_NAMES,
  addMonths,
  describeRepeat,
  formatMinutesShort,
  formatTime,
  isDateKey,
  newRoutine,
  newTask,
  parseTime,
  scheduleTasks,
  todayKey,
  totalMinutes,
  weekdayOf,
} from "@/lib/practiceLog";
import { usePracticeLog } from "@/lib/usePracticeLog";

const noopSubscribe = () => () => {};

/** `/practice-log/routine/edit?id=…` (or `?date=…` for a new one starting that day). */
export default function RoutineEditorPage({ id, date }: { id?: string; date?: string }) {
  const log = usePracticeLog();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!log.ready || !mounted) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }
  const existing = id ? log.data.routines.find((r) => r.id === id) : undefined;
  if (id && !existing) {
    return (
      <PageShell>
        <BackButton href="/practice-log" label="Practice Log" />
        <p className="rounded-2xl bg-surface p-4 text-muted">That routine doesn&apos;t exist anymore.</p>
      </PageShell>
    );
  }
  const initial = existing ?? newRoutine(isDateKey(date) ? date : todayKey(), log.data.routines.length % ROUTINE_COLORS.length);
  return <Editor key={initial.id} initial={initial} isNew={!existing} log={log} returnDate={isDateKey(date) ? date : undefined} />;
}

const FREQS: { value: RepeatFreq; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const UNIT: Record<RepeatFreq, string> = { once: "", daily: "day", weekly: "week", monthly: "month" };

function Editor({ initial, isNew, log, returnDate }: { initial: Routine; isNew: boolean; log: ReturnType<typeof usePracticeLog>; returnDate?: string }) {
  const router = useRouter();
  const [r, setR] = useState<Routine>(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<Routine>) => setR((prev) => ({ ...prev, ...patch }));
  const setRepeat = (patch: Partial<Repeat>) => setR((prev) => ({ ...prev, repeat: { ...prev.repeat, ...patch } }));
  const setTask = (i: number, patch: Partial<RoutineTask>) => setR((prev) => ({ ...prev, tasks: prev.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const moveTask = (i: number, dir: -1 | 1) =>
    setR((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.tasks.length) return prev;
      const tasks = [...prev.tasks];
      [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
      return { ...prev, tasks };
    });

  const done = () => router.push(isNew ? `/practice-log${returnDate ? `?date=${returnDate}` : ""}` : `/practice-log/routine?id=${encodeURIComponent(r.id)}`);

  function save() {
    if (!r.name.trim()) {
      setError("Give the routine a name.");
      return;
    }
    if (r.repeat.end && r.repeat.end < r.repeat.start) {
      setError("It ends before it starts.");
      return;
    }
    const tasks = r.tasks.filter((t) => t.title.trim() || t.minutes > 0).map((t) => ({ ...t, title: t.title.trim() }));
    log.saveRoutine({ ...r, name: r.name.trim(), tasks });
    done();
  }

  const color = ROUTINE_COLORS[r.color % ROUTINE_COLORS.length];
  const schedule = scheduleTasks(r);
  const weekdays = r.repeat.weekdays.length ? r.repeat.weekdays : [weekdayOf(r.repeat.start)];

  return (
    <PageShell>
      <BackButton onClick={() => router.back()} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{isNew ? "New routine" : "Edit routine"}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.back()} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-surface">
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            Save
          </button>
        </div>
      </div>
      {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      <Card title="Routine">
        <input
          autoFocus={isNew}
          value={r.name}
          onChange={(e) => {
            set({ name: e.target.value });
            setError(null);
          }}
          placeholder="Name — e.g. Morning warm-up"
          className="rounded-xl bg-background px-3 py-2.5 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <textarea
          value={r.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={2}
          placeholder="What it's for (optional)"
          className="resize-y rounded-xl bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted">Color</span>
          {ROUTINE_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ color: i })}
              aria-label={`Color ${i + 1}`}
              aria-pressed={r.color === i}
              className={`h-7 w-7 rounded-full transition-transform ${r.color === i ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface" : "hover:scale-110"}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </Card>

      <Card title="When">
        <Segmented label="Repeats" value={r.repeat.freq} onChange={(freq) => setRepeat({ freq })} options={FREQS} />
        {r.repeat.freq !== "once" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Every</span>
            <Stepper onSurface value={r.repeat.interval} min={1} max={12} onChange={(interval) => setRepeat({ interval })} />
            <span className="text-muted">
              {UNIT[r.repeat.freq]}
              {r.repeat.interval === 1 ? "" : "s"}
            </span>
          </div>
        )}
        {r.repeat.freq === "weekly" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
            {WEEKDAY_LETTER.map((letter, i) => {
              const on = weekdays.includes(i as Weekday);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAMES[i]}
                  title={WEEKDAY_NAMES[i]}
                  onClick={() => {
                    const next = on ? weekdays.filter((d) => d !== i) : [...weekdays, i as Weekday];
                    if (next.length) setRepeat({ weekdays: next.sort() as Weekday[] });
                  }}
                  className={`h-9 w-9 rounded-full text-sm font-bold ${on ? "text-white" : "bg-background text-muted hover:bg-surface-hover"}`}
                  style={on ? { background: color } : undefined}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">{r.repeat.freq === "once" ? "On" : "Starts"}</span>
            <input
              type="date"
              value={r.repeat.start}
              onChange={(e) => isDateKey(e.target.value) && setRepeat({ start: e.target.value })}
              className="rounded-xl bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          {r.repeat.freq !== "once" && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Ends</span>
              <Segmented
                label="Ends"
                value={r.repeat.end ? "date" : "never"}
                onChange={(v) => setRepeat({ end: v === "never" ? null : (r.repeat.end ?? addMonths(r.repeat.start, 1)) })}
                options={[
                  { value: "never", label: "Never" },
                  { value: "date", label: "On a date" },
                ]}
              />
              {r.repeat.end && (
                <input
                  type="date"
                  value={r.repeat.end}
                  min={r.repeat.start}
                  onChange={(e) => isDateKey(e.target.value) && setRepeat({ end: e.target.value })}
                  className="mt-1 rounded-xl bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              )}
            </div>
          )}
        </div>
        <TimeField label="Start time" value={r.startTime} onChange={(startTime) => set({ startTime })} emptyLabel="Any time" />
        <p className="text-sm text-muted">{describeRepeat(r.repeat)}{r.repeat.freq !== "once" && !r.repeat.end ? ", until you delete it" : ""}{parseTime(r.startTime) !== null ? `, at ${formatTime(parseTime(r.startTime)!)}` : ""}.</p>
      </Card>

      <Card title="Tasks" detail={r.tasks.length ? formatMinutesShort(totalMinutes(r)) : undefined}>
        <ol className="flex flex-col gap-3">
          {r.tasks.map((task, i) => (
            <li key={task.id} className="flex flex-col gap-2 rounded-xl bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                <input
                  value={task.title}
                  onChange={(e) => setTask(i, { title: e.target.value })}
                  placeholder="Task — e.g. Scales in all 12 keys"
                  className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <div className="flex shrink-0">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => moveTask(i, -1)}>
                    <ChevronLeftIcon className="h-4 w-4 rotate-90" />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === r.tasks.length - 1} onClick={() => moveTask(i, 1)}>
                    <ChevronRightIcon className="h-4 w-4 rotate-90" />
                  </IconButton>
                  <IconButton label="Remove task" onClick={() => set({ tasks: r.tasks.filter((_, j) => j !== i) })}>
                    <TrashIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 text-sm">
                <div className="flex items-center gap-2">
                  <Stepper value={task.minutes} min={0} max={600} step={task.minutes < 5 ? 1 : 5} onChange={(minutes) => setTask(i, { minutes })} />
                  <span className="text-muted">min</span>
                </div>
                <TimeField
                  label="At"
                  value={task.time}
                  onChange={(time) => setTask(i, { time })}
                  emptyLabel={schedule[i]?.start !== null && schedule[i]?.start !== undefined ? `Follows on · ${formatTime(schedule[i].start!)}` : "Follows on"}
                  inline
                />
              </div>
              <div className="pl-7">
                <textarea
                  value={task.notes}
                  onChange={(e) => setTask(i, { notes: e.target.value })}
                  rows={1}
                  placeholder="Notes (optional) — what to focus on"
                  className="w-full resize-y rounded-lg bg-surface px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
              <div className="pl-7">
                <AttachmentList items={task.attachments} onChange={(attachments) => setTask(i, { attachments })} compact />
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => set({ tasks: [...r.tasks, newTask()] })}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-hover py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-foreground"
        >
          <PlusIcon className="h-4 w-4" /> Add a task
        </button>
        <p className="text-xs text-muted">
          A task without its own time follows the one before it{r.startTime ? ", starting from the routine's start time" : ""}. Start the routine on its day to run the tasks on the Practice Timer — each one is checked off as its time runs out.
        </p>
      </Card>

      <Card title="Attached">
        <AttachmentList items={r.attachments} onChange={(attachments) => set({ attachments })} />
      </Card>

      {!isNew && (
        <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-sm font-semibold text-danger hover:bg-surface">
          <TrashIcon className="h-4 w-4" /> Delete routine
        </button>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this routine?"
          message="It comes off the calendar, along with what you checked off and noted for it. Recordings you made for it stay on their days."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            log.deleteRoutine(r.id);
            router.push("/practice-log/routines");
          }}
        />
      )}
    </PageShell>
  );
}

function Card({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {detail && <span className="text-sm tabular-nums text-muted">{detail}</span>}
      </div>
      {children}
    </section>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground disabled:opacity-30">
      {children}
    </button>
  );
}

function Stepper({ value, min, max, step = 1, onChange, onSurface = false }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onSurface?: boolean }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className={`flex items-center rounded-full ${onSurface ? "bg-background" : "bg-surface"}`}>
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label="Less" className="h-8 w-8 rounded-full font-bold hover:bg-surface-hover">
        −
      </button>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        className="w-10 bg-transparent text-center font-semibold tabular-nums outline-none"
      />
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label="More" className="h-8 w-8 rounded-full font-bold hover:bg-surface-hover">
        +
      </button>
    </div>
  );
}

/** A time of day, or none ("Any time" / "Follows on"). */
function TimeField({ label, value, onChange, emptyLabel, inline = false }: { label: string; value: string | null; onChange: (v: string | null) => void; emptyLabel: string; inline?: boolean }) {
  const bg = inline ? "bg-surface" : "bg-background";
  return (
    <div className={`flex items-center gap-2 text-sm ${inline ? "" : "flex-wrap"}`}>
      <span className="font-medium text-muted">{label}</span>
      {value ? (
        <>
          <input type="time" value={value} onChange={(e) => onChange(e.target.value || null)} className={`rounded-lg ${bg} px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent`} />
          <button type="button" onClick={() => onChange(null)} aria-label="Clear the time" className="rounded-full p-1 text-muted hover:bg-surface hover:text-foreground">
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button type="button" onClick={() => onChange("08:00")} className={`rounded-lg ${bg} px-2.5 py-1 font-medium text-muted hover:bg-surface-hover hover:text-foreground`}>
          {emptyLabel} · set a time
        </button>
      )}
    </div>
  );
}
