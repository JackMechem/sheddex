"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Segmented } from "@/components/metronome/MetronomeOptions";
import { CloseIcon } from "@/components/tools";
import {
  type PracticeLogData,
  type PracticeLogPrefs,
  WEEKDAY_LETTER,
  WEEKDAY_NAMES,
  addDays,
  formatMinutesShort,
  minutesOn,
  todayKey,
  weekdayOf,
} from "@/lib/practiceLog";

/**
 * "Your daily goal": one goal for every day, or a goal per weekday (0 = a rest day). A slider and
 * ± for fine control, presets for the usual amounts, and the last 30 days drawn against the goal
 * as you change it — how many of them would have hit it, and your average day with a "Use it".
 * Nothing changes until Save.
 */

const PRESETS = [15, 30, 45, 60, 90, 120];
const MAX = 240;
const HISTORY = 30;

const clamp = (m: number, min = 5) => Math.max(min, Math.min(MAX, Math.round(m / 5) * 5));

function label(m: number) {
  return m <= 0 ? "Rest" : formatMinutesShort(m);
}

export default function GoalDialog({ data, onSave, onClose }: { data: PracticeLogData; onSave: (patch: Partial<PracticeLogPrefs>) => void; onClose: () => void }) {
  const byDay = data.prefs.goalByWeekday;
  const [mode, setMode] = useState<"same" | "weekday">(Array.isArray(byDay) && byDay.length === 7 ? "weekday" : "same");
  const [daily, setDaily] = useState(data.prefs.dailyGoal > 0 ? data.prefs.dailyGoal : 30);
  const [week, setWeek] = useState<number[]>(Array.isArray(byDay) && byDay.length === 7 ? byDay : Array(7).fill(data.prefs.dailyGoal > 0 ? data.prefs.dailyGoal : 30));
  const [picked, setPicked] = useState<number>(weekdayOf(todayKey()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goalFor = (key: string) => (mode === "same" ? daily : week[weekdayOf(key)]);

  // The last 30 days (not counting today), oldest first.
  const today = todayKey();
  const history = useMemo(() => Array.from({ length: HISTORY }, (_, i) => {
    const key = addDays(today, i - HISTORY);
    return { key, minutes: minutesOn(data, key) };
  }), [data, today]);
  const practiced = history.filter((d) => d.minutes > 0);
  const average = practiced.length ? practiced.reduce((a, d) => a + d.minutes, 0) / practiced.length : 0;
  const withGoal = history.filter((d) => goalFor(d.key) > 0);
  const hits = withGoal.filter((d) => d.minutes >= goalFor(d.key)).length;
  const max = Math.max(60, ...history.map((d) => d.minutes), ...history.map((d) => goalFor(d.key)));
  const weekTotal = mode === "same" ? daily * 7 : week.reduce((a, b) => a + b, 0);

  const current = mode === "same" ? daily : week[picked];
  const setCurrent = (m: number) => {
    if (mode === "same") setDaily(clamp(m));
    else setWeek((w) => w.map((v, i) => (i === picked ? clamp(m, 0) : v)));
  };

  function save() {
    onSave(mode === "same" ? { dailyGoal: daily, goalByWeekday: null } : { goalByWeekday: week, dailyGoal: week[weekdayOf(today)] || daily });
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[6vh]" onClick={onClose}>
      <div role="dialog" aria-label="Your daily goal" className="flex w-full max-w-lg flex-col gap-5 rounded-3xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">Your daily goal</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <Segmented
          label="Goal"
          value={mode}
          onChange={setMode}
          options={[
            { value: "same", label: "Same every day" },
            { value: "weekday", label: "By weekday" },
          ]}
        />

        {mode === "weekday" && (
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(i)}
                aria-pressed={picked === i}
                aria-label={`${WEEKDAY_NAMES[i]}: ${m > 0 ? formatMinutesShort(m) : "rest day"}`}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors ${picked === i ? "bg-accent text-accent-foreground" : "bg-background hover:bg-surface-hover"}`}
              >
                <span className="text-xs font-bold opacity-70">{WEEKDAY_LETTER[i]}</span>
                <span className="text-sm font-extrabold tabular-nums">{m > 0 ? (m >= 60 && m % 60 === 0 ? `${m / 60}h` : m) : "–"}</span>
              </button>
            ))}
          </div>
        )}

        {/* The value being set, big, with − / + and a slider. */}
        <div className="flex flex-col items-center gap-3">
          {mode === "weekday" && <p className="text-sm font-semibold text-muted">{WEEKDAY_NAMES[picked]}s</p>}
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setCurrent(current - 5)} aria-label="5 minutes less" className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-2xl font-bold hover:bg-surface-hover">
              −
            </button>
            <div className="min-w-[9rem] text-center">
              <div className="text-5xl font-extrabold tabular-nums tracking-tight">{current > 0 ? formatMinutesShort(current) : "Rest"}</div>
              <div className="text-xs font-semibold text-muted">{current > 0 ? "a day" : "no goal this day"}</div>
            </div>
            <button type="button" onClick={() => setCurrent(current + 5)} aria-label="5 minutes more" className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-2xl font-bold hover:bg-surface-hover">
              +
            </button>
          </div>
          <input
            type="range"
            min={mode === "same" ? 5 : 0}
            max={MAX}
            step={5}
            value={current}
            onChange={(e) => setCurrent(Number(e.target.value))}
            aria-label="Goal in minutes"
            style={{ "--progress": `${((current - (mode === "same" ? 5 : 0)) / (MAX - (mode === "same" ? 5 : 0))) * 100}%` } as React.CSSProperties}
            className="slider h-6 w-full cursor-pointer"
          />
          <div className="flex flex-wrap justify-center gap-1.5">
            {mode === "weekday" && (
              <button type="button" onClick={() => setCurrent(0)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${current === 0 ? "bg-accent text-accent-foreground" : "bg-background hover:bg-surface-hover"}`}>
                Rest day
              </button>
            )}
            {PRESETS.map((m) => (
              <button key={m} type="button" onClick={() => setCurrent(m)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${current === m ? "bg-accent text-accent-foreground" : "bg-background hover:bg-surface-hover"}`}>
                {label(m)}
              </button>
            ))}
          </div>
          {mode === "weekday" && (
            <button type="button" onClick={() => setWeek(Array(7).fill(current))} className="text-xs font-semibold text-muted hover:text-foreground hover:underline">
              Use {current > 0 ? formatMinutesShort(current) : "a rest day"} for every day
            </button>
          )}
        </div>

        {/* The last 30 days against the goal. */}
        <div className="flex flex-col gap-2 rounded-2xl bg-background p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold">Last 30 days</span>
            <span className="text-xs font-semibold text-muted">{formatMinutesShort(weekTotal)} a week</span>
          </div>
          <div className="relative flex h-20 items-end gap-[3px]">
            {history.map((d) => {
              const g = goalFor(d.key);
              const hit = g > 0 && d.minutes >= g;
              return (
                <div key={d.key} className="relative flex h-full flex-1 items-end" title={`${d.key}: ${formatMinutesShort(Math.round(d.minutes))}`}>
                  <div className={`w-full rounded-sm ${hit ? "bg-emerald-500" : d.minutes > 0 ? "bg-accent/50" : "bg-surface-hover"}`} style={{ height: `${Math.max(d.minutes > 0 ? 6 : 3, (d.minutes / max) * 100)}%` }} />
                  {g > 0 && <div className="absolute inset-x-0 border-t-2 border-foreground/40" style={{ bottom: `${(g / max) * 100}%` }} />}
                </div>
              );
            })}
          </div>
          <p className="text-sm">
            {withGoal.length ? (
              <>
                You&apos;d have hit it on <strong>{hits}</strong> of the last {withGoal.length} days.
              </>
            ) : (
              "Every day is a rest day — set at least one goal."
            )}
          </p>
          {average > 0 && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Your average practice day: <strong className="text-foreground">{formatMinutesShort(Math.round(average))}</strong>
              <button type="button" onClick={() => setCurrent(Math.max(5, Math.round(average / 5) * 5))} className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-foreground hover:bg-surface-hover">
                Use it
              </button>
            </p>
          )}
        </div>

        <p className="text-xs text-muted">Hitting your goal fills the ring, stars the day on the calendar and keeps the celebrations coming. Your streak counts any day with practice.</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-background">
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
