"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import type { Row } from "@jam-practice/convex/inbox";

/**
 * The admin inbox, read through `inbox.list` (an action, because on dev and previews it reaches
 * production's shared inbox over HTTP) — so it isn't live: it refreshes every 15 seconds and right
 * after each change. One copy for the whole admin page (Overview and Inbox share it).
 */

export type InboxRow = Row;
type Change = Parameters<ReturnType<typeof useAction<typeof api.inbox.apply>>>[0]["op"];

let state: { rows: Row[] | undefined; shared: boolean; error: string | null } = { rows: undefined, shared: false, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<typeof state>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^[\s\S]*?Uncaught Error:\s*/, "").split("\n")[0];

export function useInbox() {
  const listAction = useAction(api.inbox.list);
  const applyAction = useAction(api.inbox.apply);
  const issueAction = useAction(api.inbox.createIssue);
  const moveAction = useAction(api.inbox.moveToShared);
  const snap = useSyncExternalStore(subscribe, () => state, () => state);

  const refresh = useCallback(async () => {
    try {
      const { rows, shared } = await listAction({});
      set({ rows, shared, error: null });
      // Feedback from before IDs existed gets them the first time the inbox opens.
      if (rows.some((r) => r.number === null && r.kind !== "report")) {
        await applyAction({ op: { op: "number" }, where: shared ? "shared" : "here" });
        const again = await listAction({});
        set({ rows: again.rows });
      }
    } catch (e) {
      set({ error: errorText(e) });
    }
  }, [listAction, applyAction]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  /** A change to one feedback; shown straight away where it can be, then confirmed. */
  const change = useCallback(
    async (row: Row, op: Change) => {
      if (state.rows && "id" in op) {
        if (op.op === "delete") set({ rows: state.rows.filter((r) => r.id !== row.id) });
        else if (op.op === "status") set({ rows: state.rows.map((r) => (r.id === row.id ? { ...r, status: op.status } : r)) });
      }
      try {
        await applyAction({ op, where: row.where });
      } finally {
        await refresh();
      }
    },
    [applyAction, refresh],
  );

  const createIssue = useCallback(
    async (row: Row, includeScreenshot: boolean) => {
      try {
        return await issueAction({ id: row.id, where: row.where, includeScreenshot });
      } finally {
        await refresh();
      }
    },
    [issueAction, refresh],
  );

  const moveToShared = useCallback(
    async (row: Row) => {
      try {
        await moveAction({ id: row.id });
      } finally {
        await refresh();
      }
    },
    [moveAction, refresh],
  );

  return { moveToShared, rows: snap.rows, shared: snap.shared, error: snap.error, refresh, change, createIssue, errorText };
}
