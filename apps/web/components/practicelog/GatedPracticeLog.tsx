"use client";

import PracticeLog from "@/components/PracticeLog";
import ShedLogGate from "@/components/practicelog/ShedLogGate";

/** The Shed Log behind its sign-in gate — for a tiling pane, which renders tools directly. */
export default function GatedPracticeLog() {
  return (
    <ShedLogGate>
      <PracticeLog />
    </ShedLogGate>
  );
}
