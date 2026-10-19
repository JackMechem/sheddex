"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import { CheckIcon, CloseIcon, MicIcon, PlusIcon, StarIcon } from "@/components/tools";
import RoutineIcon from "@/components/practicelog/RoutineIcon";
import WeekPopover, { type WeekTarget } from "@/components/practicelog/WeekPopover";
import {
  type DayRoutine,
  type PracticeLogData,
  ROUTINE_COLORS,
  WEEKDAY_SHORT,
  addDays,
  formatMinutesShort,
  formatTime,
  fromDateKey,
  dayStatus,
  routineStatus,
  type DayStatus,
  minutesOn,
  monthGrid,
  parseTime,
  progressOf,
  routineSpan,
  routinesOn,
  scheduleTasks,
  startOfWeek,
  timeString,
  todayKey,
  weekdayOf,
  goalOn,
} from "@/lib/practiceLog";
import type { usePracticeLog } from "@/lib/usePracticeLog";

type Log = ReturnType<typeof usePracticeLog>;

const colorOf = (i: number) => ROUTINE_COLORS[i % ROUTINE_COLORS.length];
/** One-off tasks (not part of a routine) on the calendar. */
const TASK_COLOR = "#64748b";

/** A month: each day with its routines (a check once every task's done), minutes practiced and
    how many clips were recorded. Tap a day to open it. */
export function MonthView({
  year,
  month,
  data,
  selected,
  onSelect,
  clipsByDate,
}: {
  year: number;
  month: number;
  data: PracticeLogData;
  selected: string;
  onSelect: (date: string) => void;
  clipsByDate: Map<string, number>;
}) {
  const days = useMemo(() => monthGrid(year, month), [year, month]);
  const today = todayKey();
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface lg:min-h-0 lg:flex-1">
      <div className="grid grid-cols-7 border-b border-surface-hover">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {days.map((key, i) => {
          const d = fromDateKey(key);
          const inMonth = d.getMonth() === month;
          const items = routinesOn(data, key);
          const minutes = minutesOn(data, key);
          const clips = clipsByDate.get(key) ?? 0;
          const isSel = key === selected;
          const tasks = data.days[key]?.tasks ?? [];
          const goal = goalOn(data, key);
          const goalMet = goal > 0 && minutes >= goal;
          const heat = minutes > 0 ? 8 + 26 * Math.min(1, goal > 0 ? minutes / goal : 1) : 0;
          // A past day: green with a check when everything was done, yellow with a dash when
          // some of it was (or time was logged), red with an X when nothing was.
          const status = dayStatus(data, key, today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={`${d.toDateString()}${items.length ? `, ${items.length} routine${items.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={isSel}
              className={`relative flex min-h-[4.5rem] flex-col gap-1 border-surface-hover p-1 text-left transition-colors sm:min-h-[7rem] sm:p-1.5 lg:min-h-0 lg:overflow-hidden ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${
                isSel ? "ring-2 ring-inset ring-accent" : "hover:bg-surface-hover/50"
              } ${inMonth ? "" : "opacity-60"}`}
              style={
                status
                  ? { background: `color-mix(in srgb, ${STATUS_COLOR[status]} ${status === "partial" ? 26 : status === "done" ? 24 : 20}%, transparent)` }
                  : heat
                    ? { background: `color-mix(in srgb, var(--accent) ${heat}%, transparent)` }
                    : undefined
              }
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1">
                  <span
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${
                      key === today ? "bg-accent text-accent-foreground" : inMonth ? "" : "text-muted"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {status && <StatusBadge status={status} />}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold tabular-nums text-muted">
                  {goalMet && <StarIcon filled className="h-3.5 w-3.5 text-amber-400" />}
                  {clips > 0 && (
                    <span className="flex items-center gap-0.5" title={`${clips} recording${clips === 1 ? "" : "s"}`}>
                      <MicIcon className="h-3 w-3" />
                      <span className="hidden sm:inline">{clips}</span>
                    </span>
                  )}
                  {minutes > 0 && <span className="hidden whitespace-nowrap sm:inline">{formatMinutesShort(Math.round(minutes))}</span>}
                </span>
              </div>
              {/* Phones: a dot per routine. */}
              <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                {items.map((it) => (
                  <RoutineDot key={it.routine.id} item={it} status={routineStatus(it, key, today)} />
                ))}
                {tasks.length > 0 && <span className="h-1.5 w-1.5 rounded-full" style={tasks.every((t) => t.done) ? { background: TASK_COLOR } : { boxShadow: `inset 0 0 0 1.5px ${TASK_COLOR}` }} />}
              </div>
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {items.slice(0, tasks.length ? 2 : 3).map((it) => (
                  <RoutineChip key={it.routine.id} item={it} status={routineStatus(it, key, today)} />
                ))}
                {items.length > (tasks.length ? 2 : 3) && <span className="px-1 text-[10px] font-semibold text-muted">+{items.length - (tasks.length ? 2 : 3)} more</span>}
                {tasks.length > 0 && <TasksChip tasks={tasks} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TasksChip({ tasks }: { tasks: { title: string; done: boolean }[] }) {
  const done = tasks.filter((t) => t.done).length;
  const all = done === tasks.length;
  return (
    <span
      className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium leading-tight"
      style={{ background: `color-mix(in srgb, ${TASK_COLOR} ${all ? 30 : 14}%, transparent)` }}
    >
      {all ? <CheckIcon className="h-3 w-3 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: TASK_COLOR }} />}
      <span className="truncate">{tasks.length === 1 ? tasks[0].title : `${tasks.length} tasks`}</span>
      {!all && tasks.length > 1 && done > 0 && <span className="ml-auto shrink-0 tabular-nums text-muted">{done}/{tasks.length}</span>}
    </span>
  );
}

function RoutineDot({ item, status = null }: { item: DayRoutine; status?: DayStatus | null }) {
  const { done, total } = progressOf(item.routine, item.occurrence);
  const complete = total > 0 && done === total;
  const color = status && status !== "done" ? STATUS_COLOR[status] : colorOf(item.routine.color);
  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={complete ? { background: color } : { boxShadow: `inset 0 0 0 1.5px ${color}`, opacity: item.occurrence.skipped ? 0.4 : 1 }}
    />
  );
}

/** `fill`: the chip fills from the left as its tasks are done. */
function RoutineChip({ item, status = null, fill = false }: { item: DayRoutine; status?: DayStatus | null; fill?: boolean }) {
  const { done, total } = progressOf(item.routine, item.occurrence);
  const complete = total > 0 && done === total;
  const color = colorOf(item.routine.color);
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <span
      className={`flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium leading-tight ${item.occurrence.skipped ? "line-through opacity-50" : ""}`}
      style={{
        background:
          fill && !complete && pct > 0
            ? `linear-gradient(90deg, color-mix(in srgb, ${color} 32%, transparent) ${pct}%, color-mix(in srgb, ${color} 14%, transparent) ${pct}%)`
            : `color-mix(in srgb, ${color} ${complete ? 30 : 14}%, transparent)`,
      }}
    >
      <RoutineIcon icon={item.routine.icon} color={item.routine.color} size="xs" />
      <span className="truncate">{item.routine.name || "Untitled routine"}</span>
      {complete ? (
        <CheckIcon className="ml-auto h-3 w-3 shrink-0" />
      ) : status === "missed" ? (
        <span className="ml-auto flex shrink-0 items-center gap-0.5 font-semibold text-red-500" title={item.occurrence.skipped ? "Skipped" : "Missed"}>
          <CloseIcon className="h-3 w-3" />
        </span>
      ) : status === "partial" ? (
        <span className="ml-auto flex shrink-0 items-center gap-0.5 font-semibold text-amber-600 dark:text-amber-400" title="Partly done">
          {!fill && <span className="tabular-nums">{done}/{total}</span>}
          <span className="h-0.5 w-2 rounded-full bg-current" />
        </span>
      ) : (
        !fill && done > 0 && <span className="ml-auto shrink-0 tabular-nums text-muted">{done}/{total}</span>
      )}
    </span>
  );
}

const HOUR_PX = 48;

type BlockBase = {
  id: string;
  target: WeekTarget;
  color: string;
  icon?: string;
  colorIdx?: number;
  title: string;
  tasks: string[];
  start: number;
  end: number;
  done: number;
  total: number;
  skipped: boolean;
};
type Block = BlockBase & { lane: number; lanes: number };

/** A routine's timed tasks as blocks — tasks back to back are one block. */
function blocksFor(item: DayRoutine, key: string): BlockBase[] {
  const { routine, occurrence } = item;
  const { done, total } = progressOf(routine, occurrence);
  const out: BlockBase[] = [];
  let cur: BlockBase | null = null;
  for (const s of scheduleTasks(routine, occurrence)) {
    if (s.start === null || s.end === null) continue;
    if (cur && Math.abs(cur.end - s.start) < 0.5) {
      cur.end = s.end;
      cur.tasks.push(s.task.title || "Task");
    } else {
      cur = {
        id: `${routine.id}-${s.start}`,
        target: { kind: "routine", date: key, routineId: routine.id },
        color: colorOf(routine.color),
        icon: routine.icon ?? "note",
        colorIdx: routine.color,
        title: routine.name || "Untitled routine",
        tasks: [s.task.title || "Task"],
        start: s.start,
        end: Math.max(s.end, s.start + 10),
        done,
        total,
        skipped: !!occurrence.skipped,
      };
      out.push(cur);
    }
  }
  return out;
}

/** Side-by-side lanes for blocks that overlap. */
function layoutLanes(blocks: BlockBase[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    for (const b of cluster) b.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(b.end);
    } else laneEnds[lane] = b.end;
    const block: Block = { ...b, lane, lanes: 1 };
    cluster.push(block);
    out.push(block);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  flush();
  return out;
}

/** Where a pointer is in a day's column, as minutes into the day (snapped to half hours). */
function slotAt(e: React.MouseEvent, firstHour: number): number {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const half = Math.floor(((e.clientY - r.top) / HOUR_PX) * 2);
  return Math.min(24 * 60 - 30, firstHour * 60 + Math.max(0, half) * 30);
}

/**
 * A week. On wider screens a time grid: each routine's timed tasks where they fall in the day,
 * untimed ones in the "Any time" row above; click a free time to add a task there. On phones a
 * list of the seven days with each one's routines as big buttons. Either way, tapping a routine
 * (or a day's tasks) opens it in a popover to tick tasks off or start it, and swiping sideways
 * changes the week.
 */
export function WeekView({
  log,
  selected,
  onSelect,
  onStep,
  onOpenDay,
  onAddTask,
}: {
  log: Log;
  selected: string;
  onSelect: (date: string) => void;
  /** -1 / +1: the week before / after. */
  onStep: (n: number) => void;
  /** Opens the day on its own (day view). */
  onOpenDay: (date: string) => void;
  /** A new one-off task on a day, at a time ("HH:MM") or any time. */
  onAddTask: (date: string, time: string | null) => void;
}) {
  const { data } = log;
  const router = useRouter();
  const start = startOfWeek(selected);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const today = todayKey();
  const perDay = useMemo(
    () =>
      days.map((key) => {
        const items = routinesOn(data, key);
        const tasks = data.days[key]?.tasks ?? [];
        const taskBlocks: BlockBase[] = tasks
          .filter((t) => parseTime(t.time) !== null)
          .map((t) => {
            const start = parseTime(t.time)!;
            return {
              id: `task-${t.id}`,
              target: { kind: "tasks", date: key, ids: [t.id] },
              color: TASK_COLOR,
              title: t.title || "Task",
              tasks: [],
              start,
              end: start + Math.max(10, t.minutes),
              done: t.done ? 1 : 0,
              total: 1,
              skipped: false,
            };
          });
        const minutes = minutesOn(data, key);
        const goal = goalOn(data, key);
        return {
          key,
          items,
          tasks,
          untimed: items.filter((it) => !scheduleTasks(it.routine, it.occurrence).some((s) => s.start !== null)),
          untimedTasks: tasks.filter((t) => parseTime(t.time) === null),
          blocks: layoutLanes([...items.flatMap((it) => blocksFor(it, key)), ...taskBlocks]),
          status: dayStatus(data, key, today),
          minutes,
          goal,
          goalPct: goal > 0 ? Math.min(1, minutes / goal) : minutes > 0 ? 1 : 0,
        };
      }),
    [days, data, today],
  );
  const allBlocks = perDay.flatMap((d) => d.blocks);
  const firstHour = Math.max(0, Math.min(6, ...allBlocks.map((b) => Math.floor(b.start / 60))));
  const lastHour = Math.min(24, Math.max(22, ...allBlocks.map((b) => Math.ceil(b.end / 60))));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const scroller = useRef<HTMLDivElement>(null);
  const earliest = allBlocks.length ? Math.min(...allBlocks.map((b) => b.start)) : 8 * 60;

  // Scrolled to the week's first block (or 8 AM) when the week changes.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = Math.max(0, ((earliest - firstHour * 60) / 60) * HOUR_PX - 16);
  }, [start, earliest, firstHour]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hasUntimed = perDay.some((d) => d.untimed.length > 0 || d.untimedTasks.length > 0);

  const [pop, setPop] = useState<{ target: WeekTarget; anchor: DOMRect } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  // The free half hour under the mouse, shown as a "+ 3:00 PM" slot.
  const [ghost, setGhost] = useState<{ key: string; min: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  function openPop(e: React.MouseEvent, target: WeekTarget) {
    e.stopPropagation();
    onSelect(target.date);
    setPop({ target, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() });
  }

  function openSlotMenu(e: React.MouseEvent, key: string, min: number) {
    onSelect(key);
    const onDay = new Set(routinesOn(data, key).map((i) => i.routine.id));
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: `Task at ${formatTime(min)}`, icon: <PlusIcon className="h-4 w-4 text-accent" />, onSelect: () => onAddTask(key, timeString(min)) },
        { label: "New routine starting this day", icon: <PlusIcon className="h-4 w-4 text-muted" />, onSelect: () => router.push(`/shed-log/routine/edit?date=${key}`) },
        ...data.routines
          .filter((r) => !onDay.has(r.id))
          .map((r) => ({ label: `Add ${r.name || "Untitled routine"} to this day`, icon: <RoutineIcon icon={r.icon} color={r.color} size="sm" />, onSelect: () => log.addToDay(key, r.id) })),
      ],
    });
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl bg-surface lg:min-h-0 lg:flex-1"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) onStep(dx < 0 ? 1 : -1);
      }}
    >
      {/* Phones: the seven days as a list. */}
      <ul className="flex flex-col divide-y divide-surface-hover sm:hidden">
        {perDay.map(({ key, items, tasks, minutes, status, goalPct }) => {
          const isSel = key === selected;
          return (
            <li key={key} className={`flex gap-3 px-2.5 py-2.5 transition-colors ${isSel ? "bg-accent/10" : ""}`}>
              <button type="button" onClick={() => onSelect(key)} aria-pressed={isSel} aria-label={fromDateKey(key).toDateString()} className="flex w-11 shrink-0 flex-col items-center gap-1 pt-0.5">
                <span className={`text-[11px] font-semibold ${isSel ? "text-accent" : "text-muted"}`}>{WEEKDAY_SHORT[weekdayOf(key)]}</span>
                <DayNumber dayKey={key} today={today} status={status} />
                <DayGoal dayKey={key} today={today} minutes={minutes} pct={goalPct} status={status} />
              </button>
              <div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-1.5">
                {items.map((it) => (
                  <AgendaPill key={it.routine.id} item={it} dayKey={key} today={today} onOpen={openPop} />
                ))}
                {tasks.length > 0 && <AgendaTasksPill tasks={tasks} dayKey={key} onOpen={openPop} />}
                {items.length === 0 && tasks.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onAddTask(key, null)}
                    className="col-span-2 flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-surface-hover px-3 text-xs font-semibold text-muted active:bg-surface-hover"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> {key < today ? "Nothing planned" : "Add a task"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Wider screens: the time grid. */}
      <div className="hidden grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-surface-hover sm:grid">
        <div />
        {perDay.map(({ key, minutes, status, goalPct }) => {
          const isSel = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              onDoubleClick={() => onOpenDay(key)}
              title="Click to open the day · double-click for day view"
              aria-pressed={isSel}
              className={`flex flex-col items-center gap-1 py-2 transition-colors ${isSel ? "bg-accent/10" : "hover:bg-surface-hover/50"}`}
            >
              <span className={`text-xs font-semibold ${isSel ? "text-accent" : "text-muted"}`}>{WEEKDAY_SHORT[weekdayOf(key)]}</span>
              <DayNumber dayKey={key} today={today} status={status} />
              <DayGoal dayKey={key} today={today} minutes={minutes} pct={goalPct} status={status} />
            </button>
          );
        })}
      </div>
      {hasUntimed && (
        <div className="hidden grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-surface-hover sm:grid">
          <div className="px-1 py-1.5 text-right text-[10px] font-semibold leading-tight text-muted">Any time</div>
          {perDay.map(({ key, untimed, untimedTasks }) => (
            <div key={key} className={`flex min-w-0 flex-col gap-0.5 border-l border-surface-hover p-0.5 ${key === selected ? "bg-accent/5" : ""}`}>
              {untimed.map((it) => (
                <button
                  key={it.routine.id}
                  type="button"
                  onClick={(e) => openPop(e, { kind: "routine", date: key, routineId: it.routine.id })}
                  className="min-w-0 rounded text-left transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <RoutineChip item={it} status={routineStatus(it, key, today)} fill />
                </button>
              ))}
              {untimedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => openPop(e, { kind: "tasks", date: key, ids: untimedTasks.map((t) => t.id) })}
                  className="min-w-0 rounded text-left transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <TasksChip tasks={untimedTasks} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} className="hidden max-h-[32rem] overflow-y-auto sm:block lg:h-0 lg:max-h-none lg:min-h-[20rem] lg:flex-1">
        {allBlocks.length === 0 && (
          <div className="pointer-events-none sticky top-2 z-20 h-0">
            <p className="mx-auto w-fit rounded-full bg-background/90 px-3 py-1 text-xs text-muted shadow-sm">Nothing at a set time this week. Click a time to add a task there.</p>
          </div>
        )}
        <div className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]" style={{ height: hours.length * HOUR_PX }}>
          <div className="relative">
            {hours.map((h, i) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : formatTime(h * 60).replace(":00", "")}
              </span>
            ))}
          </div>
          {perDay.map(({ key, blocks }) => (
            <div
              key={key}
              className={`relative cursor-cell border-l border-surface-hover ${key === selected ? "bg-accent/5" : ""}`}
              onPointerMove={(e) => {
                if (e.pointerType !== "mouse") return;
                if (e.target !== e.currentTarget) {
                  if (ghost) setGhost(null);
                  return;
                }
                const min = slotAt(e, firstHour);
                if (ghost?.key !== key || ghost.min !== min) setGhost({ key, min });
              }}
              onPointerLeave={() => setGhost(null)}
              onClick={(e) => {
                if (e.target === e.currentTarget) openSlotMenu(e, key, slotAt(e, firstHour));
              }}
            >
              {hours.map((h, i) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-surface-hover/60" style={{ top: i * HOUR_PX }} />
              ))}
              {ghost?.key === key && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 flex items-start gap-1 rounded-md border border-dashed border-accent/60 bg-accent/10 px-1 py-0.5 text-[11px] font-semibold text-accent"
                  style={{ top: ((ghost.min - firstHour * 60) / 60) * HOUR_PX + 1, height: HOUR_PX / 2 - 2 }}
                >
                  <PlusIcon className="mt-px h-3 w-3 shrink-0" /> <span className="truncate">{formatTime(ghost.min)}</span>
                </div>
              )}
              {blocks.map((b) => {
                const top = ((b.start - firstHour * 60) / 60) * HOUR_PX;
                const height = Math.max(18, ((b.end - b.start) / 60) * HOUR_PX - 2);
                const complete = b.total > 0 && b.done === b.total;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(e) => openPop(e, b.target)}
                    title={`${b.title}: ${formatTime(b.start)} – ${formatTime(b.end)}${b.tasks.length ? `\n${b.tasks.join(", ")}` : ""}`}
                    className={`absolute z-[1] overflow-hidden rounded-md px-1 py-0.5 text-left text-[11px] leading-tight transition-[filter,box-shadow] hover:z-[2] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-accent ${b.skipped ? "opacity-40 line-through" : ""}`}
                    style={{
                      top,
                      height,
                      left: `calc(${(b.lane / b.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / b.lanes}% - 2px)`,
                      background: `color-mix(in srgb, ${b.color} ${complete ? 45 : 22}%, var(--surface))`,
                      boxShadow: `inset 3px 0 0 ${b.color}`,
                    }}
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      {b.icon !== undefined && <RoutineIcon icon={b.icon} color={b.colorIdx ?? 0} size="xs" />}
                      {complete && <CheckIcon className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{b.title}</span>
                    </span>
                    {height > 34 && (
                      <span className="block truncate text-muted">
                        {formatTime(b.start)}
                        {b.total > 1 && b.done > 0 && !complete && ` · ${b.done}/${b.total}`}
                      </span>
                    )}
                    {height > 52 && b.tasks.length > 0 && <span className="block truncate">{b.tasks.join(" · ")}</span>}
                    {b.total > 1 && b.done > 0 && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: `linear-gradient(90deg, ${b.color} ${(b.done / b.total) * 100}%, transparent 0)` }} />
                    )}
                  </button>
                );
              })}
              {key === today && nowMin >= firstHour * 60 && nowMin <= lastHour * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: ((nowMin - firstHour * 60) / 60) * HOUR_PX }}>
                  <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {pop && <WeekPopover target={pop.target} anchor={pop.anchor} log={log} onClose={() => setPop(null)} onOpenDay={onOpenDay} />}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

/** The date in a circle: the accent for today, the day's status colour for a past day. */
function DayNumber({ dayKey, today, status }: { dayKey: string; today: string; status: DayStatus | null }) {
  const isToday = dayKey === today;
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums ${isToday ? "bg-accent text-accent-foreground shadow-md shadow-accent/30" : status ? "text-white" : ""}`}
      style={!isToday && status ? { background: STATUS_COLOR[status] } : undefined}
      title={status ? STATUS_LABEL[status] : undefined}
    >
      {fromDateKey(dayKey).getDate()}
    </span>
  );
}

/** Under the date: minutes practiced and a small bar toward that day's goal (none for days to come). */
function DayGoal({ dayKey, today, minutes, pct, status }: { dayKey: string; today: string; minutes: number; pct: number; status: DayStatus | null }) {
  if (dayKey > today) return <span className="h-[1.375rem]" />;
  const met = pct >= 1;
  return (
    <span className="flex flex-col items-center gap-1">
      <span className={`flex h-3 items-center gap-0.5 whitespace-nowrap text-[10px] tabular-nums ${status === "missed" && minutes === 0 ? "font-bold text-red-500" : met ? "font-bold text-green-600 dark:text-green-400" : "text-muted"}`}>
        {minutes > 0 ? (
          formatMinutesShort(Math.round(minutes))
        ) : status === "missed" ? (
          <>
            <CloseIcon className="h-2.5 w-2.5" /> Missed
          </>
        ) : (
          "0 min"
        )}
      </span>
      <span className="h-1 w-9 overflow-hidden rounded-full bg-background" title={met ? "Daily goal met" : undefined}>
        <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: met ? STATUS_COLOR.done : "var(--accent)" }} />
      </span>
    </span>
  );
}

/** A routine on the phone list: its icon, name, time and how much is done. Opens the popover. */
function AgendaPill({ item, dayKey, today, onOpen }: { item: DayRoutine; dayKey: string; today: string; onOpen: (e: React.MouseEvent, target: WeekTarget) => void }) {
  const { routine, occurrence } = item;
  const color = colorOf(routine.color);
  const span = routineSpan(routine, occurrence);
  const { done, total } = progressOf(routine, occurrence);
  const status = routineStatus(item, dayKey, today);
  const skipped = !!occurrence.skipped;
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e, { kind: "routine", date: dayKey, routineId: routine.id })}
      className={`flex min-h-10 min-w-0 items-center gap-1.5 rounded-xl py-1.5 pl-1.5 pr-2 text-left active:scale-[0.98] ${skipped ? "opacity-50" : ""}`}
      style={{ background: `color-mix(in srgb, ${color} ${total > 0 && done === total ? 30 : 15}%, transparent)` }}
    >
      <RoutineIcon icon={routine.icon} color={routine.color} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-semibold ${skipped ? "line-through" : ""}`}>{routine.name || "Untitled routine"}</span>
        {span && <span className="block truncate text-[10px] text-muted">{formatTime(span.start)}</span>}
      </span>
      <ProgressMark done={done} total={total} color={color} status={skipped ? null : status} />
    </button>
  );
}

/** A day's own tasks on the phone list, as one pill. */
function AgendaTasksPill({ tasks, dayKey, onOpen }: { tasks: { id: string; title: string; done: boolean }[]; dayKey: string; onOpen: (e: React.MouseEvent, target: WeekTarget) => void }) {
  const done = tasks.filter((t) => t.done).length;
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e, { kind: "tasks", date: dayKey, ids: tasks.map((t) => t.id) })}
      className="flex min-h-10 min-w-0 items-center gap-1.5 rounded-xl py-1.5 pl-1.5 pr-2 text-left active:scale-[0.98]"
      style={{ background: `color-mix(in srgb, ${TASK_COLOR} ${done === tasks.length ? 30 : 15}%, transparent)` }}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: TASK_COLOR }}>
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{tasks.length === 1 ? tasks[0].title || "Task" : `${tasks.length} tasks`}</span>
      <ProgressMark done={done} total={tasks.length} color={TASK_COLOR} status={null} />
    </button>
  );
}

/** A small ring filling up as tasks are done: a check when all are, an X when the day was missed. */
function ProgressMark({ done, total, color, status }: { done: number; total: number; color: string; status: DayStatus | null }) {
  if (total > 0 && done === total)
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  if (status === "missed")
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: STATUS_COLOR.missed }}>
        <CloseIcon className="h-3 w-3" />
      </span>
    );
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 -rotate-90" aria-label={`${done} of ${total} done`}>
      <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/15" />
      {done > 0 && <circle cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(done / total) * c} ${c}`} />}
    </svg>
  );
}

const STATUS_COLOR: Record<DayStatus, string> = { done: "#22c55e", partial: "#eab308", missed: "#ef4444" };
const STATUS_LABEL: Record<DayStatus, string> = { done: "Everything done", partial: "Partly done", missed: "Missed" };

/** The round badge on a past day: a check, a dash or an X. */
function StatusBadge({ status }: { status: DayStatus }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: STATUS_COLOR[status] }} title={STATUS_LABEL[status]}>
      {status === "done" ? <CheckIcon className="h-3.5 w-3.5" /> : status === "missed" ? <CloseIcon className="h-3 w-3" /> : <span className="h-0.5 w-2.5 rounded-full bg-white" />}
    </span>
  );
}
