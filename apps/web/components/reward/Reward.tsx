"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { burstAt } from "@/components/practicelog/Celebrations";
import { useSyncedSettings } from "@/lib/useSyncedSettings";

/**
 * The "reward" look for a tool's options, in the spirit of the Shed Log: chunky pills with a
 * coloured icon, values that pop and glow when they change, big picker cards that light up in the
 * tool's colour, sliders that fill with a gradient, a sparkle on round numbers, and a "New" badge
 * (and a burst when you pick it) on choices you haven't tried yet.
 *
 * `ToolLayout` turns it on (in the theme's accent, like the rest of the page) for tools on the new Shed Log
 * logging (`LOG_BY_BUTTON` in lib/toolTime.ts); the shared option components (`SettingChip`,
 * `Segmented`, `SubdivisionPicker`, `ClickSoundCards`, the sliders) check `useReward()` and keep
 * their plain look everywhere else.
 */

type Reward = {
  color: string;
  /** Whether a choice (an id like "sound:wood") has been tried — false shows a "New" badge. */
  isNew: (id: string) => boolean;
  /** Marks a choice as tried; the first time, a burst of sparkles comes out of `el`. */
  tried: (id: string, el?: Element | null) => void;
};

const RewardContext = createContext<Reward | null>(null);
export const useReward = () => useContext(RewardContext);

const TRIED_KEY = "jam-practice-tried-options";
const DEFAULT_TRIED: { tools: Record<string, string[]> } = { tools: {} };

export function RewardProvider({ href, color, children }: { href: string; color: string; children: ReactNode }) {
  const [stored, update, ready] = useSyncedSettings(TRIED_KEY, DEFAULT_TRIED);
  const value = useMemo<Reward>(() => {
    const list = stored.tools[href] ?? [];
    return {
      color,
      // Until the list has loaded, nothing is "New" (so badges don't flash on and off).
      isNew: (id) => ready && !list.includes(id),
      tried: (id, el) => {
        if (!ready || list.includes(id)) return;
        if (el) burstAt(el, color);
        update({ tools: { ...stored.tools, [href]: [...list, id].slice(-200) } });
      },
    };
  }, [stored.tools, href, color, ready, update]);
  return <RewardContext.Provider value={value}>{children}</RewardContext.Provider>;
}

/** The tool colour as a lively gradient (for an active card, an icon tile, the Log button). */
export function rewardGradient(color: string) {
  return `linear-gradient(150deg, color-mix(in srgb, ${color} 75%, white) 0%, ${color} 100%)`;
}

/** A value that pops (and its ring glows) each time it changes — not when it first appears. */
export function usePopKey(value: string): number {
  const [seen, setSeen] = useState(value);
  const [n, setN] = useState(0);
  if (seen !== value) {
    setSeen(value);
    setN(n + 1);
  }
  return n;
}

/** A small dot on a choice you haven't tried yet. */
export function NewBadge({ color }: { color: string }) {
  return (
    <span aria-hidden title="Not tried yet" className="pointer-events-none absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-surface" style={{ background: color }} />
    </span>
  );
}

/** A big tappable choice card: lights up in the tool's colour when picked, with a "New" badge
    until it's been tried. */
export function RewardCard({
  id,
  on,
  onPick,
  label,
  className = "",
  children,
}: {
  /** For "New" tracking, e.g. "sub:3". */
  id: string;
  on: boolean;
  onPick: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const reward = useReward();
  const color = reward?.color ?? "var(--accent)";
  const fresh = !on && !!reward?.isNew(id);
  // What you're already using counts as tried (no dot, no burst).
  const unseenCurrent = on && !!reward?.isNew(id);
  useEffect(() => {
    if (unseenCurrent) reward?.tried(id);
  }, [unseenCurrent, reward, id]);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={(e) => {
        onPick();
        reward?.tried(id, e.currentTarget);
      }}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
        on ? "text-accent-foreground shadow-md" : "bg-background text-foreground hover:-translate-y-0.5 hover:bg-surface-hover hover:shadow-sm"
      } ${className}`}
      style={on ? { background: rewardGradient(color), boxShadow: `0 6px 18px -6px color-mix(in srgb, ${color} 70%, transparent)` } : undefined}
    >
      {on && <span key={id} className="reward-glow pointer-events-none absolute inset-0 rounded-2xl" style={{ "--reward": color } as React.CSSProperties} />}
      <span key={on ? "on" : "off"} className={`flex flex-col items-center gap-1 ${on ? "reward-pop" : ""}`}>
        {children}
      </span>
      {fresh && <NewBadge color={color} />}
    </button>
  );
}

/** A ✦ that pops in beside a value when it lands on a round number. */
export function Sparkle({ show, at, color }: { show: boolean; at: string | number; color?: string }) {
  if (!show) return null;
  return (
    <span key={String(at)} aria-hidden className="star-pop inline-block text-base leading-none" style={{ color: color ?? "var(--accent)" }}>
      ✦
    </span>
  );
}
