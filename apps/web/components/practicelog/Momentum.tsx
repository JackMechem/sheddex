"use client";

import { useState } from "react";
import { FlameIcon } from "@/components/practicelog/Celebrations";
import {
  type PracticeLogData,
  WEEKDAY_LETTER,
  addDays,
  bestStreak,
  dayProgress,
  formatMinutesShort,
  hourMilestone,
  lifetimeMinutes,
  minutesOn,
  startOfWeek,
  streak,
  weekdayOf,
} from "@/lib/practiceLog";

/**
 * The cards across the top of the Practice Log — built to make you want to practice: today's
 * goal ring filling up, the streak (and a nudge when it's about to break), the week as bars
 * against your goal, and lifetime hours creeping toward the next milestone.
 */
export default function Momentum({
  data,
  today,
  onGoalChange,
}: {
  data: PracticeLogData;
  today: string;
  onGoalChange: (minutes: number) => void;
}) {
  const goal = data.prefs.dailyGoal;
  const minutes = minutesOn(data, today);
  const progress = dayProgress(data, today);
  const s = streak(data, today);
  const best = Math.max(s, bestStreak(data));
  const practicedToday = minutes > 0;

  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(weekStart, i);
    return { key, minutes: minutesOn(data, key) };
  });
  const weekTotal = week.reduce((a, d) => a + d.minutes, 0);
  const lastWeek = Array.from({ length: 7 }, (_, i) => minutesOn(data, addDays(weekStart, i - 7))).reduce((a, b) => a + b, 0);
  const daysHit = week.filter((d) => goal > 0 && d.minutes >= goal).length;

  const hours = lifetimeMinutes(data) / 60;
  const ms = hourMilestone(hours);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <GoalCard minutes={minutes} goal={goal} progress={progress} onGoalChange={onGoalChange} />

      <Card>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${practicedToday ? "text-white" : s > 0 ? "text-orange-500" : "text-muted"}`}
            style={{ background: practicedToday ? "linear-gradient(160deg, #fb923c, #ef4444)" : "color-mix(in srgb, #f97316 14%, transparent)" }}
          >
            <FlameIcon className={`h-7 w-7 ${practicedToday ? "log-flame" : ""}`} />
          </span>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">{s}</div>
            <div className="text-xs font-semibold text-muted">day streak</div>
          </div>
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
          <div>
            <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">{formatMinutesShort(Math.round(weekTotal))}</div>
            <div className="text-xs font-semibold text-muted">this week</div>
          </div>
          {lastWeek > 0 && (
            <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${weekTotal >= lastWeek ? "bg-emerald-500/15 text-emerald-500" : "bg-background text-muted"}`}>
              {weekTotal >= lastWeek ? "▲" : "▼"} {Math.abs(Math.round(((weekTotal - lastWeek) / lastWeek) * 100))}%
            </span>
          )}
        </div>
        <WeekBars week={week} goal={goal} today={today} />
        <p className="text-xs font-medium text-muted">
          {goal > 0 ? `Goal hit ${daysHit} of 7 days` : "Set a daily goal to track your week"}
        </p>
      </Card>

      <Card wide>
        <div>
          <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">
            {hours < 10 ? hours.toFixed(1) : Math.floor(hours)}
            <span className="text-base font-bold text-muted"> h</span>
          </div>
          <div className="text-xs font-semibold text-muted">practiced in total</div>
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

function Card({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`flex min-w-0 flex-col justify-between gap-3 rounded-2xl bg-surface p-4 ${wide ? "col-span-2 xl:col-span-1" : ""}`}>{children}</div>;
}

const R = 30;
const C = 2 * Math.PI * R;

function GoalCard({ minutes, goal, progress, onGoalChange }: { minutes: number; goal: number; progress: { done: number; total: number }; onGoalChange: (m: number) => void }) {
  const [editing, setEditing] = useState(false);
  const frac = goal > 0 ? Math.min(1, minutes / goal) : 0;
  const met = goal > 0 && minutes >= goal;
  const left = Math.max(0, Math.ceil(goal - minutes));
  const message = goal <= 0
    ? "No daily goal set"
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
            <span className="text-base font-bold text-muted"> / {goal} min</span>
          </div>
          {editing ? (
            <div className="flex items-center gap-1 text-xs">
              <button type="button" onClick={() => onGoalChange(Math.max(5, goal - 5))} aria-label="Lower the goal" className="h-6 w-6 rounded-full bg-background font-bold hover:bg-surface-hover">
                −
              </button>
              <button type="button" onClick={() => onGoalChange(Math.min(600, goal + 5))} aria-label="Raise the goal" className="h-6 w-6 rounded-full bg-background font-bold hover:bg-surface-hover">
                +
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-full px-2 py-0.5 font-semibold hover:bg-background">
                Done
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-muted hover:text-foreground hover:underline">
              Today&apos;s goal · change
            </button>
          )}
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

function WeekBars({ week, goal, today }: { week: { key: string; minutes: number }[]; goal: number; today: string }) {
  const max = Math.max(goal, ...week.map((d) => d.minutes), 1);
  return (
    <div className="relative flex h-14 items-end gap-1.5">
      {goal > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/50" style={{ bottom: 14 + (goal / max) * 42 }} />}
      {week.map((d) => {
        const hit = goal > 0 && d.minutes >= goal;
        const future = d.key > today;
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex h-[42px] w-full items-end">
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
