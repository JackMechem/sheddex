"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CHANGELOG_SEEN_KEY, RELEASES } from "@/lib/changelog";

const SEEN_EVENT = "soniroll:changelog-seen";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(SEEN_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(SEEN_EVENT, cb);
  };
}

function seen(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_SEEN_KEY);
  } catch {
    return null;
  }
}

/** True when there's a version on /changelog this device hasn't looked at yet. Someone new isn't
    nagged: their first visit quietly counts the current version as seen. */
export function useChangelogUnseen(): boolean {
  const latest = RELEASES[0]?.version ?? "";
  const value = useSyncExternalStore(subscribe, seen, () => latest);
  useEffect(() => {
    try {
      if (latest && localStorage.getItem(CHANGELOG_SEEN_KEY) === null) {
        localStorage.setItem(CHANGELOG_SEEN_KEY, latest);
        window.dispatchEvent(new Event(SEEN_EVENT));
      }
    } catch {}
  }, [latest]);
  return value !== null && value !== latest;
}
