"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { filesApi, formatBytes } from "@/lib/files";

/** Storage used, as a stat pill like the Shed Log's: a ring and "20 MB / 100 MB". It sits beside
    the Library title (signed in only) and opens Files. */
export default function StoragePill() {
  const { isAuthenticated } = useConvexAuth();
  const storage = useQuery(filesApi.storage, isAuthenticated ? {} : "skip");
  if (!isAuthenticated || !storage) return null;
  const { used, quota } = storage;
  const frac = Math.min(1, used / Math.max(1, quota));
  const full = used >= quota;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <Link
      href="/files"
      title={`Every account has ${formatBytes(quota)} for uploads, recordings, songs and lesson files. Plans with more storage are coming.`}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface pl-1.5 pr-3.5 transition-colors hover:bg-surface-hover sm:h-12 sm:gap-2.5 sm:pr-4"
    >
      <span className="relative h-8 w-8 sm:h-9 sm:w-9">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-background" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            stroke={frac > 0.9 ? "var(--danger)" : "var(--accent)"}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(frac, used ? 0.02 : 0))}
            style={{ transition: "stroke-dashoffset 0.8s" }}
          />
        </svg>
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="whitespace-nowrap text-base font-extrabold tabular-nums">
          {formatBytes(used)}
          <span className="hidden text-xs font-bold text-muted sm:inline"> / {formatBytes(quota)}</span>
        </span>
        <span className={`whitespace-nowrap text-[11px] font-semibold ${full ? "text-danger" : "text-muted"}`}>
          {full ? "storage full" : <><span className="sm:hidden">of {formatBytes(quota)}</span><span className="hidden sm:inline">storage</span></>}
        </span>
      </span>
    </Link>
  );
}
