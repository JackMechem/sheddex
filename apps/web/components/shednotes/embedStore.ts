import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useSyncExternalStore } from "react";

/**
 * Scores and files shown inside a note. CodeMirror widgets live outside React, but a score or a
 * file needs React (and the app's Convex connection), so each widget only registers its empty DOM
 * node here, and the editor component that owns that view renders into it through a portal.
 */

/** Which editor component a view belongs to (so each renders only its own scores). */
export const ownerFacet = Facet.define<string, string>({ combine: (v) => v[0] ?? "" });

/** `id` is a score's id, or a file's ref (what follows `file:`). A file can have a width (`|300`). */
export type Embed = { el: HTMLElement; kind: "score" | "file"; id: string; view: EditorView; owner: string; key: number; name?: string; width?: number };

let embeds: Embed[] = [];
let nextKey = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function addEmbed(e: Omit<Embed, "key">) {
  embeds = [...embeds, { ...e, key: nextKey++ }];
  emit();
}

export function removeEmbed(el: HTMLElement) {
  if (!embeds.some((e) => e.el === el)) return;
  embeds = embeds.filter((e) => e.el !== el);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Every embed on the page (filter by `owner` for one editor's). */
export function useEmbeds(): Embed[] {
  return useSyncExternalStore(subscribe, () => embeds, () => embeds);
}
