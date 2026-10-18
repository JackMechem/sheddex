"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Momentum from "@/components/practicelog/Momentum";
import { HeatGrid } from "@/components/practicelog/TodayPractice";
import { CloseIcon } from "@/components/tools";
import { type PracticeLogData, type PracticeLogPrefs, type ProgressCardKind, addDays, bestStreak, formatMinutesShort, lifetimeMinutes, minutesOn } from "@/lib/practiceLog";

/** All the stats in one place: the big goal / streak / week / hours cards, the last months as a
    grid of days, and a few more numbers. */
export default function StatsDialog({
  data,
  today,
  onPrefs,
  onShare,
  onClose,
}: {
  data: PracticeLogData;
  today: string;
  onPrefs: (patch: Partial<PracticeLogPrefs>) => void;
  onShare: (kind: ProgressCardKind) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monthStart = `${today.slice(0, 8)}01`;
  let month = 0;
  for (let k = monthStart; k <= today; k = addDays(k, 1)) month += minutesOn(data, k);
  const practicedDays = Object.keys(data.days).filter((k) => minutesOn(data, k) > 0);
  const total = lifetimeMinutes(data);
  const numbers: [string, string][] = [
    [formatMinutesShort(Math.round(month)), "this month"],
    [`${bestStreak(data)} days`, "best streak"],
    [String(practicedDays.length), practicedDays.length === 1 ? "day practiced" : "days practiced"],
    [practicedDays.length ? formatMinutesShort(Math.round(total / practicedDays.length)) : "—", "average practice day"],
  ];

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-black/40 p-2 pt-[4vh] sm:p-4 sm:pt-[6vh]" onClick={onClose}>
      <div role="dialog" aria-label="Your stats" className="flex w-full max-w-5xl flex-col gap-3 rounded-3xl bg-background p-3 shadow-2xl ring-1 ring-surface-hover sm:gap-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Your stats</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <Momentum data={data} today={today} onPrefs={onPrefs} onShare={onShare} />
        <div className="grid gap-4 lg:grid-cols-12">
          <HeatGrid className="lg:col-span-7" />
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            {numbers.map(([value, label]) => (
              <div key={label} className="flex flex-col justify-center rounded-2xl bg-surface p-4">
                <div className="text-2xl font-extrabold tabular-nums">{value}</div>
                <div className="text-xs font-semibold text-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
