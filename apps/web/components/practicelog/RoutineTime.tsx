"use client";

import { useState } from "react";
import { Segmented } from "@/components/metronome/MetronomeOptions";
import { type Occurrence, type Routine, formatTime, parseTime, routineSpan, tasksOf, timeString } from "@/lib/practiceLog";
import type { usePracticeLog } from "@/lib/usePracticeLog";

type Log = ReturnType<typeof usePracticeLog>;

const QUICK = [8 * 60, 12 * 60, 17 * 60, 19 * 60];

/** Some of the routine's tasks have a clock time of their own, so moving its start doesn't move them. */
export function hasFixedTimes(routine: Routine, occurrence: Occurrence = {}): boolean {
  return tasksOf(routine, occurrence).some((t) => parseTime(t.time) !== null);
}

/**
 * Picks when a routine happens: a quick time or any time you type, just for this day or every
 * time it comes round. Used for routines that are "any time" (and to change a time).
 */
export default function RoutineTimePicker({
  date,
  routine,
  occurrence,
  log,
  onDone,
}: {
  date: string;
  routine: Routine;
  occurrence: Occurrence;
  log: Log;
  onDone: () => void;
}) {
  const once = routine.repeat.freq === "once";
  const [scope, setScope] = useState<"day" | "always">("day");
  const span = routineSpan(routine, occurrence);
  const current = span ? timeString(span.start) : "";

  function apply(time: string | null) {
    if (scope === "always" || once) {
      log.saveRoutine({ ...routine, startTime: time });
      // The day follows the routine's own time again.
      if (occurrence.startTime !== undefined)
        log.updateOccurrence(date, routine.id, (o) => {
          const n = { ...o };
          delete n.startTime;
          return n;
        });
    } else {
      log.updateOccurrence(date, routine.id, (o) => ({ ...o, startTime: time }));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-background p-2.5">
      {!once && (
        <Segmented
          label="Which days"
          value={scope}
          onChange={setScope}
          options={[
            { value: "day", label: "Just this day" },
            { value: "always", label: "Every time" },
          ]}
        />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              apply(timeString(m));
              onDone();
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${current === timeString(m) ? "bg-accent text-accent-foreground" : "bg-surface hover:bg-surface-hover"}`}
          >
            {formatTime(m).replace(/:00(?= )/, "")}
          </button>
        ))}
        <input
          type="time"
          aria-label="Start time"
          defaultValue={current}
          onChange={(e) => parseTime(e.target.value) !== null && apply(e.target.value)}
          className="min-w-0 rounded-full bg-surface px-3 py-1 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        {span && !hasFixedTimes(routine, occurrence) && (
          <button
            type="button"
            onClick={() => {
              apply(null);
              onDone();
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface hover:text-foreground"
          >
            Make it any time
          </button>
        )}
        <button type="button" onClick={onDone} className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface">
          Done
        </button>
      </div>
    </div>
  );
}
