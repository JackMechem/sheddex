"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import type { Id } from "@jam-practice/convex/_generated/dataModel";
import { DEFAULT_CONFIG, DEFAULT_CONFIG_TEXT, type ShedNotesConfig, parseConfig, setConfigValue } from "./shedNotesConfig";
import { useSyncedSettings } from "./useSyncedSettings";

export type NoteMeta = {
  id: string;
  title: string;
  folder: string;
  links: string[];
  tags: string[];
  snippet: string;
  createdAt: number;
  updatedAt: number;
};

/** Every note's title, folder, links and snippet. Undefined while loading. */
export function useNoteList(): NoteMeta[] | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.shedNotes.list, isAuthenticated ? {} : "skip");
}

const SETTINGS_KEY = "jam-practice-shed-notes";
const SETTINGS_DEFAULTS = { configText: DEFAULT_CONFIG_TEXT, goodText: DEFAULT_CONFIG_TEXT };

/** The settings file: its text (exactly as typed), the settings in use (from the last version that
    parsed — kept beside it, so a half-typed file never switches vim off under your fingers), what's
    wrong with it, and a way to flip one setting (the toolbar's switches). */
export function useNotesConfig() {
  const [settings, update, ready] = useSyncedSettings(SETTINGS_KEY, SETTINGS_DEFAULTS);
  const text = settings.configText;
  const current = useMemo(() => parseConfig(text), [text]);
  const good = useMemo(() => parseConfig(settings.goodText).config ?? DEFAULT_CONFIG, [settings.goodText]);
  const setText = useCallback(
    (configText: string) => update(parseConfig(configText).config ? { configText, goodText: configText } : { configText }),
    [update],
  );
  /** False when the file doesn't parse (nothing is changed then). */
  const setValue = useCallback(
    (key: keyof ShedNotesConfig, value: unknown) => {
      const next = setConfigValue(text, key, value);
      if (next === null) return false;
      update({ configText: next, goodText: next });
      return true;
    },
    [text, update],
  );
  return { text, setText, setValue, ready, config: current.config ?? good, errors: current.errors, broken: !current.config };
}

export type SaveState = "saved" | "saving" | "unsaved" | "error";

/** One note, with an autosaving `setBody` (a second after typing stops, and on leaving). */
export function useNote(id: string | null) {
  const { isAuthenticated } = useConvexAuth();
  const note = useQuery(api.shedNotes.get, isAuthenticated && id ? { id } : "skip");
  const saveMut = useMutation(api.shedNotes.save);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ id: string; body: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setState("saving");
    saveMut({ id: p.id as Id<"shedNotes">, body: p.body })
      .then(() => {
        setState(pending.current ? "unsaved" : "saved");
        setError(null);
      })
      .catch((e: Error) => {
        setState("error");
        setError(errorText(e));
      });
  }, [saveMut]);

  const setBody = useCallback(
    (body: string) => {
      if (!id) return;
      pending.current = { id, body };
      setState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800);
    },
    [id, flush],
  );

  // Save what's typed when switching notes or leaving the page.
  useEffect(() => {
    const onLeave = () => flush();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      flush();
    };
  }, [id, flush]);

  useEffect(() => {
    if (state !== "unsaved" && state !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => {
      flush();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state, flush]);

  return { note, setBody, flush, saveState: state, saveError: error };
}

/** Pulls a friendly message out of a Convex error. */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^[\s\S]*?Uncaught Error:\s*/, "").split("\n")[0].trim() || "Something went wrong.";
}
