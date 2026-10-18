"use client";

import { useState } from "react";
import { FlameIcon } from "@/components/practicelog/Celebrations";
import { useDayTimerMs } from "@/components/practicelog/DayTimer";
import GoalDialog from "@/components/practicelog/GoalDialog";
import { CheckIcon, ShareIcon } from "@/components/tools";
import {
  type PracticeLogData,
  type PracticeLogPrefs,
  type ProgressCardKind,
  WEEKDAY_LETTER,
  addDays,
  bestStreak,
  dayProgress,
  formatMinutesShort,
  goalOn,
  hourMilestone,
  lifetimeMinutes,
  minutesOn,
  startOfWeek,
  streak,
  weekdayOf,
} from "@/lib/practiceLog";

/**
 * The cards across the top of the Shed Log — built to make you want to practice: today's
 * goal ring filling up, the streak (and a nudge when it's about to break), the week as bars
 * against your goal, and lifetime hours creeping toward the next milestone.
 */
export default function Momentum({
  data,
  today,
  onPrefs,
  onShare,
}: {
  data: PracticeLogData;
  today: string;
  onPrefs: (patch: Partial<PracticeLogPrefs>) => void;
  onShare: (kind: ProgressCardKind) => void;
}) {
  const goal = goalOn(data, today);
  const [editingGoal, setEditingGoal] = useState(false);
  const watch = useDayTimerMs(data, today);
  // Live while the day timer runs (the stored part is handed over every 30 seconds).
  const minutes = minutesOn(data, today, watch.liveMs);
  const progress = dayProgress(data, today);
  const s = streak(data, today);
  const best = Math.max(s, bestStreak(data));
  const practicedToday = minutes > 0;

  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(weekStart, i);
    return { key, minutes: minutesOn(data, key), goal: goalOn(data, key) };
  });
  const weekTotal = week.reduce((a, d) => a + d.minutes, 0);
  const lastWeek = Array.from({ length: 7 }, (_, i) => minutesOn(data, addDays(weekStart, i - 7))).reduce((a, b) => a + b, 0);
  const daysHit = week.filter((d) => d.goal > 0 && d.minutes >= d.goal).length;
  const goalDays = week.filter((d) => d.goal > 0).length;

  const hours = lifetimeMinutes(data) / 60;
  const ms = hourMilestone(hours);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <GoalCard minutes={minutes} goal={goal} progress={progress} onEdit={() => setEditingGoal(true)} />
      {editingGoal && <GoalDialog data={data} onSave={onPrefs} onClose={() => setEditingGoal(false)} />}

      <Card>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${practicedToday ? "text-white" : s > 0 ? "text-orange-500" : "text-muted"}`}
            style={{ background: practicedToday ? "linear-gradient(160deg, #fb923c, #ef4444)" : "color-mix(in srgb, #f97316 14%, transparent)" }}
          >
            <FlameIcon className={`h-7 w-7 ${practicedToday ? "log-flame" : ""}`} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">{s}</div>
            <div className="text-xs font-semibold text-muted">day streak</div>
          </div>
          <ShareButton onClick={() => onShare("streak")} />
        </div>
        <p className={`text-xs font-medium ${!practicedToday && s > 0 ? "text-orange-500" : "text-muted"}`}>
          {practicedToday
            ? s >= best && s > 1
              ? "Your best streak ever. Keep it rolling."
              : `Best: ${best} day${best === 1 ? "" : "s"}`
            : s > 0
              ? `Practice today to keep your ${s}-day streak alive.`
              : "Practice today to start a streak."}
        </p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">{formatMinutesShort(Math.round(weekTotal))}</div>
            <div className="text-xs font-semibold text-muted">this week</div>
          </div>
          {lastWeek > 0 && (
            <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${weekTotal >= lastWeek ? "bg-emerald-500/15 text-emerald-500" : "bg-background text-muted"}`}>
              {weekTotal >= lastWeek ? "▲" : "▼"} {Math.abs(Math.round(((weekTotal - lastWeek) / lastWeek) * 100))}%
            </span>
          )}
        </div>
        <WeekBars week={week} today={today} />
        <p className="text-xs font-medium text-muted">
          {goalDays > 0 ? `Goal hit ${daysHit} of ${goalDays} days` : "Set a daily goal to track your week"}
        </p>
      </Card>

      <Card wide>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
          <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">
            {hours < 10 ? hours.toFixed(1) : Math.floor(hours)}
            <span className="text-base font-bold text-muted"> h</span>
          </div>
          <div className="text-xs font-semibold text-muted">practiced in total</div>
          </div>
          <ShareButton onClick={() => onShare("hours")} />
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.max(3, Math.min(100, ((hours - ms.from) / (ms.to - ms.from)) * 100))}%`, background: "linear-gradient(90deg, #a78bfa, var(--accent))" }}
          />
        </div>
        <p className="text-xs font-medium text-muted">
          {hours === 0 ? "Your first hour starts with one session" : `${formatMinutesShort(Math.max(1, Math.round((ms.to - hours) * 60)))} to ${ms.to} hour${ms.to === 1 ? "" : "s"}`}
        </p>
      </Card>
    </div>
  );
}

function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Share as an image" title="Share as an image" className="shrink-0 rounded-full p-2 text-muted hover:bg-background hover:text-foreground">
      <ShareIcon className="h-4 w-4" />
    </button>
  );
}

function Card({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`flex min-w-0 flex-col justify-between gap-3 rounded-2xl bg-surface p-4 ${wide ? "sm:col-span-2 xl:col-span-1" : ""}`}>{children}</div>;
}

const R = 30;
const C = 2 * Math.PI * R;

function GoalCard({ minutes, goal, progress, onEdit }: { minutes: number; goal: number; progress: { done: number; total: number }; onEdit: () => void }) {
  const frac = goal > 0 ? Math.min(1, minutes / goal) : 0;
  const met = goal > 0 && minutes >= goal;
  const left = Math.max(0, Math.ceil(goal - minutes));
  const message = goal <= 0
    ? minutes > 0 ? "Practicing on a rest day — nice" : "A rest day, no goal today"
    : met
      ? minutes - goal >= 1
        ? `Goal smashed! +${formatMinutesShort(Math.round(minutes - goal))} bonus`
        : "Goal reached!"
      : minutes > 0
        ? `${formatMinutesShort(left)} to go — you've got this`
        : "Let's get some practice in";
  return (
    <Card wide>
      <div className="flex items-center gap-3">
        <div className="relative h-[72px] w-[72px] shrink-0">
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <circle cx="36" cy="36" r={R} fill="none" strokeWidth="8" className="stroke-background" />
            <circle
              cx="36"
              cy="36"
              r={R}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              stroke={met ? "#22c55e" : "var(--accent)"}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular-nums">{goal > 0 ? `${Math.round(frac * 100)}%` : "—"}</span>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">
            {Math.round(minutes)}
            {goal > 0 && <span className="text-base font-bold text-muted"> / {goal} min</span>}
          </div>
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-muted hover:text-foreground hover:underline">
            {goal > 0 ? "Today's goal · change" : "Rest day · change goal"}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className={`text-xs font-semibold ${met ? "text-emerald-500" : "text-muted"}`}>{message}</p>
        {progress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-muted">
              {progress.done}/{progress.total} tasks
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function WeekBars({ week, today }: { week: { key: string; minutes: number; goal: number }[]; today: string }) {
  const max = Math.max(...week.map((d) => d.goal), ...week.map((d) => d.minutes), 1);
  const same = week.every((d) => d.goal === week[0].goal);
  return (
    <div className="relative flex h-14 items-end gap-1.5">
      {same && week[0].goal > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/50" style={{ bottom: 14 + (week[0].goal / max) * 42 }} />}
      {week.map((d) => {
        const hit = d.goal > 0 && d.minutes >= d.goal;
        const future = d.key > today;
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="relative flex h-[42px] w-full items-end">
              {!same && d.goal > 0 && <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-muted/60" style={{ bottom: `${(d.goal / max) * 100}%` }} />}
              <div
                className={`w-full rounded-t-md rounded-b-sm transition-[height] duration-700 ${hit ? "" : d.minutes > 0 ? "bg-accent/50" : "bg-background"}`}
                style={{ height: `${Math.max(d.minutes > 0 ? 12 : 6, (d.minutes / max) * 100)}%`, ...(hit ? { background: "linear-gradient(180deg, #4ade80, #22c55e)" } : {}), opacity: future ? 0.4 : 1 }}
                title={`${formatMinutesShort(Math.round(d.minutes))}`}
              />
            </div>
            <span className={`h-[12px] text-[10px] font-bold leading-[12px] ${d.key === today ? "text-foreground" : "text-muted"}`}>{WEEKDAY_LETTER[weekdayOf(d.key)]}</span>
          </div>
        );
      })}
    </div>
  );
}


/**
 * The same four stats as `Momentum`, as a row of big rounded pills — the Shed Log shows these
 * beside its title, out of the calendar's way. The goal pill sets the daily goal; the streak and
 * hours pills open "Share your progress".
 */
export function MomentumPills({
  data,
  today,
  onPrefs,
  onShare,
  trailing,
}: {
  data: PracticeLogData;
  today: string;
  onPrefs: (patch: Partial<PracticeLogPrefs>) => void;
  onShare: (kind: ProgressCardKind) => void;
  trailing?: React.ReactNode;
}) {
  const [editingGoal, setEditingGoal] = useState(false);
  const goal = goalOn(data, today);
  const watch = useDayTimerMs(data, today);
  const minutes = minutesOn(data, today, watch.liveMs);
  const frac = goal > 0 ? Math.min(1, minutes / goal) : 0;
  const met = goal > 0 && minutes >= goal;
  const s = streak(data, today);
  const lit = minutes > 0;
  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(weekStart, i);
    return { key, minutes: minutesOn(data, key, key === today ? watch.liveMs : 0), goal: goalOn(data, key) };
  });
  const weekTotal = week.reduce((a, d) => a + d.minutes, 0);
  const max = Math.max(...week.map((d) => d.goal), ...week.map((d) => d.minutes), 1);
  const hours = lifetimeMinutes(data) / 60;
  const ms = hourMilestone(hours);
  const pill = "flex h-11 shrink-0 snap-start items-center gap-2 rounded-full bg-surface pl-1.5 pr-3.5 transition-colors hover:bg-surface-hover sm:h-12 sm:gap-2.5 sm:pr-4";
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    // One row you swipe sideways on a phone; wraps on wider screens.
    <div className="-mx-4 flex snap-x scroll-px-4 items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:flex-nowrap lg:overflow-x-auto [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        className={pill}
        title={met ? "Today's goal reached — change it" : "Today's goal — change it"}
        onClick={() => setEditingGoal(true)}
      >
        <span className="relative h-9 w-9">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-background" />
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round" stroke={met ? "#22c55e" : "var(--accent)"} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 0.8s" }} />
          </svg>
          {met && <CheckIcon className="absolute inset-0 m-auto h-4 w-4 text-emerald-500" />}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-base font-extrabold tabular-nums">
            {Math.round(minutes)}
            {goal > 0 && <span className="text-xs font-bold text-muted"> / {goal} min</span>}
          </span>
          <span className="text-[11px] font-semibold text-muted">{goal > 0 ? "today" : "rest day"}</span>
        </span>
      </button>

      <button type="button" className={pill} onClick={() => onShare("streak")} title={lit ? `${s}-day streak — share it` : s > 0 ? `Practice today to keep your ${s}-day streak` : "Practice today to start a streak"}>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ${lit ? "text-white" : s > 0 ? "text-orange-500" : "text-muted"}`}
          style={{ background: lit ? "linear-gradient(160deg, #fb923c, #ef4444)" : "color-mix(in srgb, #f97316 14%, transparent)" }}
        >
          <FlameIcon className={`h-5 w-5 ${lit ? "log-flame" : ""}`} />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-base font-extrabold tabular-nums">{s}</span>
          <span className={`text-[11px] font-semibold ${!lit && s > 0 ? "text-orange-500" : "text-muted"}`}>{!lit && s > 0 ? "keep it alive" : "day streak"}</span>
        </span>
      </button>

      <div className={`${pill} cursor-default pl-4 hover:bg-surface`} title="This week">
        <span className="flex h-7 items-end gap-[3px]">
          {week.map((d) => {
            const hit = d.goal > 0 && d.minutes >= d.goal;
            return (
              <span
                key={d.key}
                className={`w-1.5 rounded-sm ${hit ? "bg-emerald-500" : d.minutes > 0 ? "bg-accent/60" : "bg-background"} ${d.key === today ? "ring-1 ring-foreground/30" : ""}`}
                style={{ height: `${Math.max(d.minutes > 0 ? 25 : 12, (d.minutes / max) * 100)}%` }}
              />
            );
          })}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-base font-extrabold tabular-nums">{formatMinutesShort(Math.round(weekTotal))}</span>
          <span className="text-[11px] font-semibold text-muted">this week</span>
        </span>
      </div>

      <button type="button" className={pill} onClick={() => onShare("hours")} title={`${formatMinutesShort(Math.max(1, Math.round((ms.to - hours) * 60)))} to ${ms.to} hours — share it`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--accent) ${Math.min(100, ((hours - ms.from) / (ms.to - ms.from)) * 100)}%, var(--background) 0)` }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[10px] font-extrabold">h</span>
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-base font-extrabold tabular-nums">{hours < 10 ? (Math.round(hours * 10) / 10).toFixed(1) : Math.floor(hours)} h</span>
          <span className="text-[11px] font-semibold text-muted">in total</span>
        </span>
      </button>
      {trailing}
      {editingGoal && <GoalDialog data={data} onSave={onPrefs} onClose={() => setEditingGoal(false)} />}
    </div>
  );
}
