"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import { drainUsage, setUsageBlocked, setUsageListener, trackView, trackVisit } from "@/lib/usage";
import { useSiteStatus } from "@/lib/useSiteStatus";

/** Sends the anonymous usage counts (`lib/usage.ts`) a few seconds after something happens, every 30 seconds, and when the tab is hidden. */
export default function UsageTracker() {
  const track = useMutation(api.usage.track);
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const site = useSiteStatus();
  const ready = !isLoading && site !== undefined;
  const staff = !!site?.staff;

  useEffect(() => {
    setUsageBlocked(!ready || staff);
  }, [ready, staff]);

  useEffect(() => {
    if (!ready || staff) return;
    trackVisit(isAuthenticated);
  }, [ready, staff, isAuthenticated]);

  useEffect(() => {
    if (!ready || staff) return;
    trackView(pathname);
  }, [pathname, ready, staff]);

  useEffect(() => {
    const send = () => {
      const events = drainUsage();
      if (events.length) void track({ events }).catch(() => {});
    };
    // Send ~5 s after something happens (short visits still count), and every 30 s as a backstop.
    let soon: ReturnType<typeof setTimeout> | null = null;
    setUsageListener(() => {
      soon ??= setTimeout(() => {
        soon = null;
        send();
      }, 5000);
    });
    const id = setInterval(send, 30000);
    const onHide = () => document.visibilityState === "hidden" && send();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => {
      setUsageListener(null);
      if (soon) clearTimeout(soon);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
    };
  }, [track]);

  return null;
}
