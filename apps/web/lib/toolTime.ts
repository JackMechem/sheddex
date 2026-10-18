"use client";

import { useEffect } from "react";
import { NAV_LINKS } from "@/components/tools";
import { queueLogEntry } from "@/lib/practiceTimerEngine";

/**
 * Counts the time a tool is actually running as practice in the Shed Log — the Metronome
 * playing, an ear-training round going, the Tuner listening, Bass Genius or the Drum Generator
 * playing, a take recording… — not just its page being open. Each tool says when it's running
 * (`useToolActivity`); `useToolTimeTracker` (mounted once, app-wide) adds up the time and hands it
 * to the log a minute at a time and when the tool stops (the log merges it into one entry per tool
 * per sitting, `applyTimerEntries`). Time counts while the tool is running even in a background
 * tab, unless it asked for `visibleOnly`.
 */

type Active = { label: string; since: number; visibleOnly: boolean };

const active = new Map<string, Active>();
const TICK_MS = 5000;
const FLUSH_MS = 60000;
const pending = new Map<string, number>();
let lastTick = Date.now();

function labelOf(href: string) {
  return NAV_LINKS.find((l) => l.href === href)?.label ?? href;
}

function accumulate() {
  const now = Date.now();
  const dt = Math.min(now - lastTick, TICK_MS * 2);
  lastTick = now;
  const visible = typeof document === "undefined" || document.visibilityState === "visible";
  for (const [href, a] of active) {
    if (a.visibleOnly && !visible) continue;
    pending.set(href, (pending.get(href) ?? 0) + dt);
  }
}

function flush(href?: string) {
  for (const [h, ms] of pending) {
    if (href && h !== href) continue;
    if (ms >= 1000) queueLogEntry({ at: Date.now(), ms, done: true, session: labelOf(h), title: labelOf(h), segmentId: `tool:${h}` });
    pending.delete(h);
  }
}

let enabled = true;

/** Marks a tool as running (or not). Call from the tool's component with its running state. */
export function useToolActivity(href: string, running: boolean, { visibleOnly = false }: { visibleOnly?: boolean } = {}) {
  useEffect(() => {
    if (!running) return;
    accumulate();
    active.set(href, { label: labelOf(href), since: Date.now(), visibleOnly });
    return () => {
      accumulate();
      active.delete(href);
      if (enabled) flush(href);
      else pending.delete(href);
    };
  }, [href, running, visibleOnly]);
}

/** Adds up running tools' time and hands it to the log. Mounted once (`PracticeLogGlobal`). */
export function useToolTimeTracker(on: boolean) {
  useEffect(() => {
    enabled = on;
    if (!on) {
      pending.clear();
      return;
    }
    lastTick = Date.now();
    const id = setInterval(() => {
      accumulate();
      for (const [h, ms] of pending) if (ms >= FLUSH_MS) flush(h);
    }, TICK_MS);
    const onHide = () => {
      accumulate();
      flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onHide);
      accumulate();
      flush();
    };
  }, [on]);
}
