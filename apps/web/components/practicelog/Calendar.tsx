"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, MicIcon, StarIcon } from "@/components/tools";
import {
  type DayRoutine,
  type PracticeLogData,
  ROUTINE_COLORS,
  WEEKDAY_SHORT,
  addDays,
  formatMinutesShort,
  formatTime,
  fromDateKey,
  dayProgress,
  minutesOn,
  monthGrid,
  parseTime,
  progressOf,
  routinesOn,
  scheduleTasks,
  startOfWeek,
  todayKey,
  weekdayOf,
} from "@/lib/practiceLog";

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
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface lg:flex-1">
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
          const goal = data.prefs.dailyGoal;
          const goalMet = goal > 0 && minutes >= goal;
          const heat = minutes > 0 ? 8 + 26 * Math.min(1, goal > 0 ? minutes / goal : 1) : 0;
          const prog = dayProgress(data, key);
          // Every task planned that day checked off: the day goes green with a check.
          const completed = prog.total > 0 && prog.done === prog.total;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={`${d.toDateString()}${items.length ? `, ${items.length} routine${items.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={isSel}
              className={`relative flex min-h-[4.5rem] flex-col gap-1 border-surface-hover p-1 text-left transition-colors sm:min-h-[7rem] sm:p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${
                isSel ? "ring-2 ring-inset ring-accent" : "hover:bg-surface-hover/50"
              } ${inMonth ? "" : "opacity-60"}`}
              style={
                completed
                  ? { background: "color-mix(in srgb, #22c55e 24%, transparent)" }
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
                  {completed && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white" title="Everything done">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
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
                  <RoutineDot key={it.routine.id} item={it} />
                ))}
                {tasks.length > 0 && <span className="h-1.5 w-1.5 rounded-full" style={tasks.every((t) => t.done) ? { background: TASK_COLOR } : { boxShadow: `inset 0 0 0 1.5px ${TASK_COLOR}` }} />}
              </div>
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {items.slice(0, tasks.length ? 2 : 3).map((it) => (
                  <RoutineChip key={it.routine.id} item={it} />
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

function RoutineDot({ item }: { item: DayRoutine }) {
  const { done, total } = progressOf(item.routine, item.occurrence);
  const complete = total > 0 && done === total;
  const color = colorOf(item.routine.color);
  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={complete ? { background: color } : { boxShadow: `inset 0 0 0 1.5px ${color}`, opacity: item.occurrence.skipped ? 0.4 : 1 }}
    />
  );
}

function RoutineChip({ item }: { item: DayRoutine }) {
  const { done, total } = progressOf(item.routine, item.occurrence);
  const complete = total > 0 && done === total;
  const color = colorOf(item.routine.color);
  return (
    <span
      className={`flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium leading-tight ${item.occurrence.skipped ? "line-through opacity-50" : ""}`}
      style={{ background: `color-mix(in srgb, ${color} ${complete ? 30 : 14}%, transparent)` }}
    >
      {complete ? <CheckIcon className="h-3 w-3 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{item.routine.name || "Untitled routine"}</span>
      {!complete && done > 0 && <span className="ml-auto shrink-0 tabular-nums text-muted">{done}/{total}</span>}
    </span>
  );
}

const HOUR_PX = 48;

type Block = { routineId: string; color: string; title: string; tasks: string[]; start: number; end: number; complete: boolean; skipped: boolean; lane: number; lanes: number };

/** A routine's timed tasks as blocks — tasks back to back are one block. */
function blocksFor(item: DayRoutine): Omit<Block, "lane" | "lanes">[] {
  const { routine, occurrence } = item;
  const doneSet = new Set(occurrence.done ?? []);
  const out: Omit<Block, "lane" | "lanes">[] = [];
  let cur: Omit<Block, "lane" | "lanes"> | null = null;
  let allDone = true;
  for (const s of scheduleTasks(routine, occurrence)) {
    if (s.start === null || s.end === null) continue;
    if (!doneSet.has(s.task.id)) allDone = false;
    if (cur && Math.abs(cur.end - s.start) < 0.5) {
      cur.end = s.end;
      cur.tasks.push(s.task.title || "Task");
    } else {
      cur = {
        routineId: routine.id,
        color: colorOf(routine.color),
        title: routine.name || "Untitled routine",
        tasks: [s.task.title || "Task"],
        start: s.start,
        end: Math.max(s.end, s.start + 10),
        complete: false,
        skipped: !!occurrence.skipped,
      };
      out.push(cur);
    }
  }
  for (const b of out) b.complete = allDone && routine.tasks.length > 0;
  return out;
}

/** Side-by-side lanes for blocks that overlap. */
function layoutLanes(blocks: Omit<Block, "lane" | "lanes">[]): Block[] {
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

/** A week on a time grid: each routine's timed tasks where they fall in the day, untimed routines
    in the "Any time" row above. Tap a day (or a block) to open that day. */
export function WeekView({
  data,
  selected,
  onSelect,
}: {
  data: PracticeLogData;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const start = startOfWeek(selected);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const today = todayKey();
  const perDay = useMemo(
    () =>
      days.map((key) => {
        const items = routinesOn(data, key);
        const tasks = data.days[key]?.tasks ?? [];
        const taskBlocks = tasks
          .filter((t) => parseTime(t.time) !== null)
          .map((t) => {
            const start = parseTime(t.time)!;
            return { routineId: `task-${t.id}`, color: TASK_COLOR, title: t.title, tasks: [], start, end: start + Math.max(10, t.minutes), complete: t.done, skipped: false };
          });
        return {
          key,
          untimed: items.filter((it) => !scheduleTasks(it.routine, it.occurrence).some((s) => s.start !== null)),
          untimedTasks: tasks.filter((t) => parseTime(t.time) === null),
          blocks: layoutLanes([...items.flatMap(blocksFor), ...taskBlocks]),
          minutes: minutesOn(data, key),
        };
      }),
    [days, data],
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

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface lg:flex-1">
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-surface-hover">
        <div />
        {perDay.map(({ key, minutes }) => {
          const d = fromDateKey(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`flex flex-col items-center gap-0.5 py-2 ${key === selected ? "bg-accent/10" : "hover:bg-surface-hover/50"}`}
            >
              <span className="text-xs font-semibold text-muted">{WEEKDAY_SHORT[weekdayOf(key)]}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${key === today ? "bg-accent text-accent-foreground" : ""}`}>{d.getDate()}</span>
              <span className="h-3 text-[10px] tabular-nums text-muted">{minutes > 0 ? formatMinutesShort(Math.round(minutes)) : ""}</span>
            </button>
          );
        })}
      </div>
      {hasUntimed && (
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-surface-hover">
          <div className="px-1 py-1.5 text-right text-[10px] font-semibold leading-tight text-muted">Any time</div>
          {perDay.map(({ key, untimed, untimedTasks }) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5 border-l border-surface-hover p-0.5">
              {untimed.map((it) => (
                <button key={it.routine.id} type="button" onClick={() => onSelect(key)} className="min-w-0 text-left">
                  <RoutineChip item={it} />
                </button>
              ))}
              {untimedTasks.length > 0 && (
                <button type="button" onClick={() => onSelect(key)} className="min-w-0 text-left">
                  <TasksChip tasks={untimedTasks} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} className="max-h-[32rem] overflow-y-auto lg:h-0 lg:max-h-none lg:min-h-[20rem] lg:flex-1">
        <div className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]" style={{ height: hours.length * HOUR_PX }}>
          <div className="relative">
            {hours.map((h, i) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : formatTime(h * 60).replace(":00", "")}
              </span>
            ))}
          </div>
          {perDay.map(({ key, blocks }) => (
            <div key={key} className={`relative border-l border-surface-hover ${key === selected ? "bg-accent/5" : ""}`} onClick={() => onSelect(key)}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-surface-hover/60" style={{ top: i * HOUR_PX }} />
              ))}
              {blocks.map((b, i) => {
                const top = ((b.start - firstHour * 60) / 60) * HOUR_PX;
                const height = Math.max(18, ((b.end - b.start) / 60) * HOUR_PX - 2);
                return (
                  <button
                    key={`${b.routineId}-${i}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(key);
                    }}
                    title={`${b.title}: ${formatTime(b.start)} – ${formatTime(b.end)}${b.tasks.length ? `\n${b.tasks.join(", ")}` : ""}`}
                    className={`absolute overflow-hidden rounded-md px-1 py-0.5 text-left text-[11px] leading-tight ${b.skipped ? "opacity-40 line-through" : ""}`}
                    style={{
                      top,
                      height,
                      left: `calc(${(b.lane / b.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / b.lanes}% - 2px)`,
                      background: `color-mix(in srgb, ${b.color} ${b.complete ? 45 : 22}%, var(--surface))`,
                      boxShadow: `inset 3px 0 0 ${b.color}`,
                    }}
                  >
                    <span className="flex items-center gap-0.5 font-semibold">
                      {b.complete && <CheckIcon className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{b.title}</span>
                    </span>
                    {height > 34 && <span className="block truncate text-muted">{formatTime(b.start)}</span>}
                    {height > 52 && b.tasks.length > 0 && <span className="block truncate">{b.tasks.join(" · ")}</span>}
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
    </div>
  );
}
