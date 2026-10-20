"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import type { Id } from "@jam-practice/convex/_generated/dataModel";
import { cleanScore, emptyMeasure, emptyTranscription, newId, type Transcription } from "./bassTranscription";

// Score Writer's scores. Signed in they're in the account (`convex/scores.ts`, one row each);
// signed out they're kept in this browser only, same shape, so the tool works either way.

export type ScoreMeta = { id: string; title: string; measureCount: number; createdAt: number; updatedAt: number };

type LocalScore = { id: string; data: Transcription; createdAt: number; updatedAt: number };
type LocalStore = { scores: LocalScore[] };

const LOCAL_KEY = "jam-practice-scores";
const LOCAL_DEFAULTS: LocalStore = { scores: [] };

let localCache: LocalStore | null = null;
const listeners = new Set<() => void>();
function readLocal(): LocalStore {
  if (localCache) return localCache;
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LocalStore>) : null;
    localCache = { scores: Array.isArray(parsed?.scores) ? parsed.scores : [] };
  } catch {
    localCache = LOCAL_DEFAULTS;
  }
  return localCache;
}
function updateLocal(change: (s: LocalStore) => LocalStore) {
  localCache = change(readLocal());
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(localCache));
  } catch {
    // Full or blocked storage: keep it in memory for this tab.
  }
  for (const fn of listeners) fn();
}
function useLocal(): LocalStore {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    readLocal,
    () => LOCAL_DEFAULTS,
  );
}

/** A blank score: treble clef, 4/4, eight bars. */
export function newScore(title = "Untitled score"): Transcription {
  return { ...emptyTranscription(title), clef: "treble", measures: Array.from({ length: 8 }, () => emptyMeasure()) };
}

/** Deep-copies through JSON and cleans it, so what's saved is always a valid score. */
const plain = (t: Transcription): Transcription => cleanScore(JSON.parse(JSON.stringify(t)));

/** The list of scores (newest first). Undefined while loading. */
export function useScoreList(): ScoreMeta[] | undefined {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const local = useLocal();
  const remote = useQuery(api.scores.list, isAuthenticated ? {} : "skip");
  const localList = useMemo(
    () => [...local.scores].sort((a, b) => b.updatedAt - a.updatedAt).map((s) => ({ id: s.id, title: s.data.title, measureCount: s.data.measures.length, createdAt: s.createdAt, updatedAt: s.updatedAt })),
    [local],
  );
  if (isLoading) return undefined;
  return isAuthenticated ? remote : localList;
}

/** One score's music. Undefined while loading, null when it's gone. */
export function useScore(id: string | null): Transcription | null | undefined {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const local = useLocal();
  const remote = useQuery(api.scores.get, isAuthenticated && id ? { id } : "skip");
  const data = remote?.data;
  const fromRemote = useMemo(() => (data ? cleanScore(data) : null), [data]);
  if (!id) return null;
  if (isLoading) return undefined;
  if (isAuthenticated) return remote === undefined ? undefined : fromRemote;
  return local.scores.find((s) => s.id === id)?.data ?? null;
}

/** Make, save and delete scores (account or browser, whichever is in use). */
export function useScoreActions() {
  const { isAuthenticated } = useConvexAuth();
  const createRemote = useMutation(api.scores.create);
  const saveRemote = useMutation(api.scores.save);
  const removeRemote = useMutation(api.scores.remove);

  const create = useCallback(
    async (data: Transcription): Promise<string> => {
      if (isAuthenticated) return createRemote({ data: plain(data) });
      const id = newId();
      const now = Date.now();
      updateLocal((s) => ({ scores: [...s.scores, { id, data: plain(data), createdAt: now, updatedAt: now }] }));
      return id;
    },
    [isAuthenticated, createRemote],
  );
  const save = useCallback(
    async (id: string, data: Transcription) => {
      if (isAuthenticated) {
        await saveRemote({ id: id as Id<"scores">, data: plain(data) });
        return;
      }
      updateLocal((s) => ({ scores: s.scores.map((x) => (x.id === id ? { ...x, data: plain(data), updatedAt: Date.now() } : x)) }));
    },
    [isAuthenticated, saveRemote],
  );
  const remove = useCallback(
    async (id: string) => {
      if (isAuthenticated) {
        await removeRemote({ id: id as Id<"scores"> });
        return;
      }
      updateLocal((s) => ({ scores: s.scores.filter((x) => x.id !== id) }));
    },
    [isAuthenticated, removeRemote],
  );
  return { create, save, remove, signedIn: isAuthenticated };
}
