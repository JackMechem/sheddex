"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { HomeIcon } from "@/components/tools";
import { DASHBOARD_PATH } from "@/lib/landing";

const noop = () => () => {};

/** The sidebar's starting place: the dashboard as a card — the home icon on a tile, a greeting
    and today's date — above the Shed Log card. Collapsed, it's the icon on its tile. */
export default function DashboardNavCard({ active, collapsed, large, onNavigate }: { active: boolean; collapsed?: boolean; large?: boolean; onNavigate?: () => void }) {
  const now = useSyncExternalStore(noop, () => new Date().toDateString(), () => null);
  const d = now ? new Date(now) : null;
  const h = new Date().getHours();
  const hello = !d ? "Your starting place" : h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const date = d ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";

  if (collapsed) {
    return (
      <Link href={DASHBOARD_PATH} onClick={onNavigate} title="Dashboard" className="mx-auto flex h-10 w-10 items-center justify-center">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "bg-foreground text-background" : "bg-surface-hover text-foreground"}`}>
          <HomeIcon className="h-4 w-4" />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={DASHBOARD_PATH}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-colors ${active ? "border-foreground/15 bg-surface-hover" : "border-transparent bg-surface-hover/60 hover:bg-surface-hover"}`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-foreground text-background ${large ? "h-10 w-10" : "h-7 w-7"}`}>
        <HomeIcon className={large ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-bold ${large ? "text-base" : "text-sm"}`}>Dashboard</span>
        <span className="block truncate text-xs text-muted">
          {date ? `${date} · ${hello}` : hello}
        </span>
      </span>
    </Link>
  );
}
