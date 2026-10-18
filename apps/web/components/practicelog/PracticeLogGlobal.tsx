"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import Celebrations, { SHARE_PROGRESS_EVENT, useCelebrations } from "@/components/practicelog/Celebrations";
import { ProgressShareDialog } from "@/components/practicelog/Sharing";
import type { ProgressCardKind } from "@/lib/practiceLog";
import { useToolTimeTracker } from "@/lib/toolTime";
import { usePracticeLog } from "@/lib/usePracticeLog";

/**
 * The Shed Log's app-wide part, mounted once around every page (`AppShell`): it takes in the
 * Practice Timer's steps and the time spent in tools (`useToolTimeTracker`) as they happen,
 * celebrates wherever you are (a check-off note, confetti when the daily goal is hit or a streak
 * is kept), and opens "Share your progress" from a milestone toast on any page.
 */
export default function PracticeLogGlobal() {
  // The Shed Log is for account holders: nothing is timed, logged or celebrated signed out.
  const { isAuthenticated } = useConvexAuth();
  const { data, ready: loaded, syncAssigned } = usePracticeLog({ drainTimer: true });
  const ready = loaded && isAuthenticated;
  // Routines your teachers assigned (Lessons) come into your Shed Log, and stay in step.
  const teachers = useQuery(api.lessons.myTeachers, isAuthenticated ? {} : "skip");
  useEffect(() => {
    if (!ready || teachers === undefined) return;
    syncAssigned(
      teachers.flatMap((t) =>
        t.items.filter((i) => i.kind === "routine" && i.routine).map((i) => ({ itemId: i.id, teacher: t.teacher.name, version: i.updatedAt, routine: i.routine! })),
      ),
    );
  }, [ready, teachers, syncAssigned]);
  useCelebrations(data, ready);
  useToolTimeTracker(ready && data.prefs.trackTools !== false);
  const [sharing, setSharing] = useState<{ kind: ProgressCardKind; date?: string; celebrate?: boolean } | null>(null);
  useEffect(() => {
    // The detail is a card kind, or `{ kind: "day", date }` for a day's report.
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail as ProgressCardKind | { kind: ProgressCardKind; date?: string; celebrate?: boolean } | undefined;
      setSharing(typeof d === "object" && d ? d : { kind: d ?? "streak" });
    };
    window.addEventListener(SHARE_PROGRESS_EVENT, open);
    return () => window.removeEventListener(SHARE_PROGRESS_EVENT, open);
  }, []);
  return (
    <>
      <Celebrations />
      {sharing && <ProgressShareDialog data={data} initialKind={sharing.kind} initialDate={sharing.date} celebrate={sharing.celebrate} onClose={() => setSharing(null)} />}
    </>
  );
}
