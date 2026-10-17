"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  DAY_TASKS_ID,
  DEFAULT_PREFS,
  type DayLog,
  type DayTask,
  type PracticeLogPrefs,
  type Occurrence,
  type PracticeLogData,
  type Routine,
  applyTimerEntries,
  pruneDay,
} from "@/lib/practiceLog";
import type { PracticeSession } from "@/lib/practiceTimer";
import {
  PENDING_EVENT,
  getServerSnapshot,
  getSnapshot,
  start,
  subscribe,
  takePendingLogEntries,
} from "@/lib/practiceTimerEngine";
import { DEFAULT_SOUND_SETTINGS, SOUND_SETTINGS_KEY } from "@/lib/practiceTimerSound";
import { useSyncedSettings } from "@/lib/useSyncedSettings";

/** The Practice Log's routines and days — one synced object (`packages/core/practiceLog.ts`),
    in the account when signed in, else this browser. A few years of daily entries stays well
    under Convex's 1 MB per-document limit; very long notes every day would be what fills it. */
const KEY = "jam-practice-practice-log";
const DEFAULTS: PracticeLogData = { routines: [], days: {}, prefs: DEFAULT_PREFS };

export function usePracticeLog({ drainTimer = false }: { drainTimer?: boolean } = {}) {
  const [data, update, ready] = useSyncedSettings(KEY, DEFAULTS);
  // The freshest value — two edits in one tick (or a timer entry arriving mid-edit) both build on
  // the one before, not on the same render's copy.
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);

  const write = useCallback(
    (fn: (prev: PracticeLogData) => PracticeLogData) => {
      const next = fn(latest.current);
      latest.current = next;
      update({ routines: next.routines, days: next.days, prefs: next.prefs });
    },
    [update],
  );

  // Steps the Practice Timer ran (routines or plain sessions) are added once the log has loaded.
  useEffect(() => {
    if (!drainTimer || !ready) return;
    const drain = () => {
      const entries = takePendingLogEntries();
      if (entries.length) write((prev) => applyTimerEntries(prev, entries));
    };
    drain();
    window.addEventListener(PENDING_EVENT, drain);
    return () => window.removeEventListener(PENDING_EVENT, drain);
  }, [drainTimer, ready, write]);

  const updateDay = useCallback(
    (key: string, fn: (day: DayLog) => DayLog) =>
      write((prev) => {
        const next = pruneDay(fn(prev.days[key] ?? {}));
        const days = { ...prev.days };
        if (next) days[key] = next;
        else delete days[key];
        return { ...prev, days };
      }),
    [write],
  );

  const updateOccurrence = useCallback(
    (key: string, routineId: string, fn: (occ: Occurrence) => Occurrence) =>
      updateDay(key, (day) => ({ ...day, routines: { ...(day.routines ?? {}), [routineId]: fn(day.routines?.[routineId] ?? {}) } })),
    [updateDay],
  );

  const toggleTask = useCallback(
    (key: string, routineId: string, taskId: string) =>
      updateOccurrence(key, routineId, (occ) => {
        const done = occ.done ?? [];
        return { ...occ, done: done.includes(taskId) ? done.filter((id) => id !== taskId) : [...done, taskId] };
      }),
    [updateOccurrence],
  );

  const saveRoutine = useCallback(
    (routine: Routine) =>
      write((prev) => {
        const r = { ...routine, updatedAt: Date.now() };
        const exists = prev.routines.some((x) => x.id === r.id);
        return { ...prev, routines: exists ? prev.routines.map((x) => (x.id === r.id ? r : x)) : [...prev.routines, r] };
      }),
    [write],
  );

  /** Deletes the routine and what was logged for it (its recordings stay, on their days). */
  const deleteRoutine = useCallback(
    (id: string) =>
      write((prev) => {
        const days: Record<string, DayLog> = {};
        for (const [key, day] of Object.entries(prev.days)) {
          const routines = { ...(day.routines ?? {}) };
          delete routines[id];
          const next = pruneDay({ ...day, routines, added: (day.added ?? []).filter((x) => x !== id) });
          if (next) days[key] = next;
        }
        return { ...prev, routines: prev.routines.filter((r) => r.id !== id), days };
      }),
    [write],
  );

  const addToDay = useCallback(
    (key: string, routineId: string) =>
      updateDay(key, (day) => ({ ...day, added: [...(day.added ?? []).filter((x) => x !== routineId), routineId] })),
    [updateDay],
  );

  const removeFromDay = useCallback(
    (key: string, routineId: string) =>
      updateDay(key, (day) => {
        const routines = { ...(day.routines ?? {}) };
        delete routines[routineId];
        return { ...day, routines, added: (day.added ?? []).filter((x) => x !== routineId) };
      }),
    [updateDay],
  );

  const saveDayTask = useCallback(
    (key: string, task: DayTask) =>
      updateDay(key, (day) => {
        const tasks = day.tasks ?? [];
        return { ...day, tasks: tasks.some((t) => t.id === task.id) ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task] };
      }),
    [updateDay],
  );

  const removeDayTask = useCallback(
    (key: string, id: string) => updateDay(key, (day) => ({ ...day, tasks: (day.tasks ?? []).filter((t) => t.id !== id) })),
    [updateDay],
  );

  const toggleDayTask = useCallback(
    (key: string, id: string) => updateDay(key, (day) => ({ ...day, tasks: (day.tasks ?? []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
    [updateDay],
  );

  /** Moves a one-off task to another day. */
  const moveDayTask = useCallback(
    (from: string, to: string, task: DayTask) => {
      if (from === to) return saveDayTask(to, task);
      removeDayTask(from, task.id);
      saveDayTask(to, task);
    },
    [saveDayTask, removeDayTask],
  );

  const setPrefs = useCallback((patch: Partial<PracticeLogPrefs>) => write((prev) => ({ ...prev, prefs: { ...prev.prefs, ...patch } })), [write]);

  return { data, ready, updateDay, saveDayTask, removeDayTask, toggleDayTask, moveDayTask, setPrefs, updateOccurrence, toggleTask, saveRoutine, deleteRoutine, addToDay, removeFromDay };
}

/** The Practice Timer as the Practice Log uses it: what's running, and starting a routine on it.
    A routine runs as a timer session whose segments are its tasks, so the sidebar widget, alarm
    mode and surviving a reload all work the same, and each finished task is checked off. */
export function useRoutineTimer() {
  const engine = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [sound] = useSyncedSettings(SOUND_SETTINGS_KEY, DEFAULT_SOUND_SETTINGS);

  function startRoutine(routine: Routine, date: string, fromTaskId?: string, onlyThis = false) {
    let tasks = routine.tasks.filter((t) => t.minutes > 0);
    if (fromTaskId) {
      const i = tasks.findIndex((t) => t.id === fromTaskId);
      if (i >= 0) tasks = onlyThis ? [tasks[i]] : tasks.slice(i);
    }
    if (!tasks.length) return;
    const session: PracticeSession = {
      id: `routine:${routine.id}:${date}`,
      name: routine.name || "Routine",
      type: "custom",
      segments: tasks.map((t) => ({ id: t.id, title: t.title || "Task", minutes: t.minutes })),
      updatedAt: Date.now(),
      link: { routineId: routine.id, date },
    };
    start(session, sound.soundEnabled, sound.toneId, sound.alarmMode, sound.fullScreenAlert);
  }

  /** Runs a day's own tasks on the timer: just `only`, or every one not done yet. */
  function startDayTasks(date: string, tasks: DayTask[], only?: string) {
    const list = (only ? tasks.filter((t) => t.id === only) : tasks.filter((t) => !t.done)).filter((t) => t.minutes > 0);
    if (!list.length) return;
    const session: PracticeSession = {
      id: `day:${date}`,
      name: list.length === 1 ? list[0].title || "Task" : "Today's tasks",
      type: "custom",
      segments: list.map((t) => ({ id: t.id, title: t.title || "Task", minutes: t.minutes })),
      updatedAt: Date.now(),
      link: { routineId: DAY_TASKS_ID, date },
    };
    start(session, sound.soundEnabled, sound.toneId, sound.alarmMode, sound.fullScreenAlert);
  }

  /** The running step's task id when the timer is running this routine on this day. */
  function runningTask(routineId: string, date: string): string | null {
    const s = engine?.session;
    if (!engine || !s || s.type !== "custom" || s.link?.routineId !== routineId || s.link.date !== date) return null;
    return s.segments[engine.index]?.id ?? null;
  }

  return { engine, startRoutine, startDayTasks, runningTask };
}
