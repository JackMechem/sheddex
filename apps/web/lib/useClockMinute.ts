import { useSyncExternalStore } from "react";
import { toDateKey } from "./practiceLog";

const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  ticker ??= setInterval(() => listeners.forEach((l) => l()), 15000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

const minuteNow = () => Math.floor(Date.now() / 60000);

/** The current day and minute of the day, updated each minute (one shared ticker). Null on the
    server and the first client render, so nothing time-dependent is rendered there. */
export function useClockMinute(): { today: string; nowMin: number } | null {
  const minute = useSyncExternalStore(subscribe, minuteNow, () => -1);
  if (minute < 0) return null;
  const d = new Date(minute * 60000);
  return { today: toDateKey(d), nowMin: d.getHours() * 60 + d.getMinutes() };
}
