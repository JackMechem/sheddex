"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { LANDING_PATH } from "@/lib/landing";
import { installIosAudio } from "@/lib/iosAudio";

/** Shows the app's chrome (sidebar, ⌘K palette, timer badge, tool dock) and `AppShell` around
    every page except the landing page, a standalone marketing site with its own nav. The body
    itself never scrolls (see `app/layout.tsx`), so the landing page gets its own scroll box. */
export default function AppChrome({ chrome, children }: { chrome: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  // iPhone / iPad: play sound even with the silent switch or silent mode on.
  useEffect(() => installIosAudio(), []);
  // Standalone pages: the landing page and the forgot-password page.
  const landing = pathname === LANDING_PATH || pathname === "/reset-password";
  if (landing) {
    return <div className="h-dvh w-full overflow-y-auto overflow-x-hidden">{children}</div>;
  }
  return (
    <>
      {chrome}
      <AppShell>{children}</AppShell>
    </>
  );
}
