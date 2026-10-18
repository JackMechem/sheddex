"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@jam-practice/convex/_generated/api";

/** Whether the signed-in account is the site admin (checked on the server — `admin.amIAdmin`). */
export function useIsAdmin(): boolean {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.admin.amIAdmin, isAuthenticated ? {} : "skip") === true;
}
