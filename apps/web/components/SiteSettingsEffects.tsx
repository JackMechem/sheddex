"use client";

import { useEffect } from "react";
import { setCelebrationEffects } from "@/components/practicelog/Celebrations";
import { DISPLAY_DEFAULTS, DISPLAY_KEY, applyDisplay } from "@/lib/display";
import { cachedSiteSettings, useSiteSettings } from "@/lib/siteSettings";
import { snapshotOf, subscribeTo } from "@/lib/usePersistedSettings";
import { setClock24 } from "@jam-practice/core/practiceLog";

// The last settings this browser saw, before anything renders (times are only drawn in the browser).
const cached = cachedSiteSettings();
if (cached) {
  setClock24(cached.clock === "24");
  setCelebrationEffects(cached.celebrations);
}

/** Applies the settings that live outside React: the clock, confetti, text size and motion. */
export default function SiteSettingsEffects() {
  const [site, , ready] = useSiteSettings();
  // Only once the real values are in: until then the cached copy above is already in effect.
  useEffect(() => {
    if (!ready) return;
    setClock24(site.clock === "24");
    setCelebrationEffects(site.celebrations);
    document.documentElement.classList.toggle("no-confetti", !site.celebrations);
  }, [ready, site.clock, site.celebrations]);
  // Text size and motion are painted by `DISPLAY_INIT_SCRIPT`; this follows later changes.
  useEffect(() => {
    const unsubscribe = subscribeTo(DISPLAY_KEY, () => applyDisplay(snapshotOf(DISPLAY_KEY, DISPLAY_DEFAULTS)));
    return () => {
      unsubscribe();
    };
  }, []);
  return null;
}
