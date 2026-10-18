"use client";

import { useQuery } from "convex/react";
import { api } from "@jam-practice/convex/_generated/api";

/** The site's mayday switches (`site.status`), or undefined while loading. */
export function useSiteStatus() {
  return useQuery(api.site.status, {});
}
