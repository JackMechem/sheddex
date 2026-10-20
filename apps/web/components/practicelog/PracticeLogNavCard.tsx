"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { FlameIcon } from "@/components/practicelog/Celebrations";
import { useDayTimerMs } from "@/components/practicelog/DayTimer";
import { CalendarIcon } from "@/components/tools";
import RoutineIcon from "@/components/practicelog/RoutineIcon";
import { ROUTINE_COLORS, dayProgress, formatTime, isRoutineNow, minutesOn, routineSpan, routinesOn, streak, todayKey, goalOn } from "@/lib/practiceLog";
import { useClockMinute } from "@/lib/useClockMinute";
import { usePracticeLog } from "@/lib/usePracticeLog";

const noop = () => () => {};

/**
 * The Shed Log's place in the sidebar — not one tool among the others but its own card right
 * under Dashboard, with today at a glance: minutes against the goal (a bar that fills), the streak,
 * tasks done, and a dot while the day timer runs. Collapsed, it's the icon with a goal ring.
 */
export default function PracticeLogNavCard({ active, collapsed, large, onNavigate }: { active: boolean; collapsed?: boolean; large?: boolean; onNavigate?: () => void }) {
  const { data, ready } = usePracticeLog();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const signedOut = !isLoading && !isAuthenticated;
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const today = mounted ? todayKey() : "";
  const watch = useDayTimerMs(data, today);
  const show = ready && mounted && isAuthenticated;
  const minutes = show ? minutesOn(data, today, watch.liveMs) : 0;
  const goal = goalOn(data, today);
  const frac = goal > 0 ? Math.min(1, minutes / goal) : 0;
  const met = goal > 0 && minutes >= goal;
  const s = show ? streak(data, today) : 0;
  const p = show ? dayProgress(data, today) : { done: 0, total: 0 };
  // The routine whose time it is right now, if any.
  const clock = useClockMinute();
  const current = show && clock ? routinesOn(data, clock.today).find((it) => isRoutineNow(it, clock.nowMin)) : undefined;
  const currentEnd = current ? routineSpan(current.routine, current.occurrence)?.end : undefined;
  const currentColor = current ? ROUTINE_COLORS[current.routine.color % ROUTINE_COLORS.length] : undefined;
  const currentName = current ? current.routine.name || "Untitled routine" : "";

  if (collapsed) {
    const R = 15;
    const C = 2 * Math.PI * R;
    return (
      <Link href="/shed-log" onClick={onNavigate} title={`Shed Log — ${Math.round(minutes)} of ${goal} min today${current ? ` · Now: ${currentName}` : ""}`} className="relative mx-auto flex h-10 w-10 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={R} fill="none" strokeWidth="3" className="stroke-surface-hover" />
          <circle cx="18" cy="18" r={R} fill="none" strokeWidth="3" strokeLinecap="round" stroke={met ? "#22c55e" : "var(--accent)"} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <CalendarIcon className={`h-4 w-4 ${active ? "text-accent" : "text-foreground"}`} />
        {watch.running && <span className="absolute right-0.5 top-0.5 h-2 w-2 animate-pulse rounded-full bg-danger" />}
        {current && <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full" style={{ background: currentColor }} />}
      </Link>
    );
  }

  return (
    <Link
      href="/shed-log"
      onClick={onNavigate}
      className={`group flex flex-col gap-2 rounded-2xl p-2.5 transition-colors border ${active ? "border-accent/30 bg-accent/15" : "border-transparent bg-accent/[0.07] hover:bg-accent/15"}`}
    >
      <div className="flex items-center gap-2">
        <span className={`relative flex shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground ${large ? "h-10 w-10" : "h-7 w-7"}`}>
          <CalendarIcon className={large ? "h-5 w-5" : "h-4 w-4"} />
          {watch.running && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-surface bg-danger" title="Day timer running" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1.5 whitespace-nowrap font-bold ${large ? "text-base" : "text-sm"}`}>
            <span className="min-w-0 truncate">Shed Log</span>
          </div>
          <div className="truncate text-xs text-muted">
            {signedOut ? "Sign in to start yours" : show ? (p.total ? `${p.done}/${p.total} tasks today` : minutes > 0 ? "Practiced today" : "Nothing logged today") : " "}
          </div>
        </div>
        {show && (
          <span
            className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-extrabold tabular-nums ${minutes > 0 ? "text-white" : s > 0 ? "text-orange-500" : "text-muted"}`}
            style={{ background: minutes > 0 ? "linear-gradient(160deg, #fb923c, #ef4444)" : "color-mix(in srgb, #f97316 14%, transparent)" }}
          >
            <FlameIcon className="h-3 w-3" />
            {s}
          </span>
        )}
      </div>
      {!signedOut && (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${frac * 100}%`, background: met ? "#22c55e" : "var(--accent)" }} />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted">
          {Math.round(minutes)}/{goal} min
        </span>
      </div>
      )}
      {current && (
        <div className="flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5" style={{ boxShadow: `inset 0 0 0 1.5px ${currentColor}` }}>
          <RoutineIcon icon={current.routine.icon} color={current.routine.color} size="xs" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{currentName}</span>
          {currentEnd !== undefined && <span className="shrink-0 text-[11px] tabular-nums text-muted">until {formatTime(currentEnd)}</span>}
        </div>
      )}
    </Link>
  );
}
