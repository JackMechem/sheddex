import { startCompletion } from "@codemirror/autocomplete";
import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { WIKILINK_RE, parseLinkInner } from "@jam-practice/core/shedNotes";
import type { ShedNotesConfig } from "@/lib/shedNotesConfig";
import { type Block, findBlocks, scoreIdOf } from "./livePreview";
import { NEW_TABLE } from "./tables";

/**
 * Every command Shed Notes can run, by id — the same ids work in the settings file's
 * `keybindings`, in `vim.exCommands`, and in the command palette. Editor commands need the editor;
 * app commands call back into the page (`NoteActions`), and a command whose action isn't there (a
 * note opened in a dialog has no note list) just doesn't show or run.
 */

export type NoteActions = {
  newNote?: () => void;
  openQuickSwitcher?: () => void;
  /** The search menu (titles and text of every note). */
  openSearch?: () => void;
  toggleNoteList?: () => void;
  /** This note: full width, or the readable column. */
  toggleFullWidth?: () => void;
  toggleLinksPanel?: () => void;
  openCommandPalette?: () => void;
  /** Makes a note with this title in the current note's folder, staying where you are (the
      "Create" choice when linking a note that doesn't exist yet). */
  createLinkedNote?: (title: string) => Promise<void>;
  /** Opens (or, with `create`, makes) the note with this title. */
  openNoteByTitle?: (title: string, opts?: { create?: boolean; newTab?: boolean }) => void;
  /** Opens a page of the site ("/tunes") — in place, through the app's router. */
  openPath?: (path: string) => void;
  /** The notation editor on a Score Writer score (`null`: a new one); `onDone` gets its id once
      it's saved. */
  openScore?: (scoreId: string | null, onDone: (scoreId: string) => void) => void;
  setConfig?: (key: keyof ShedNotesConfig, value: boolean) => void;
  config?: () => ShedNotesConfig;
  openSettings?: () => void;
  closeNote?: () => void;
  renameNote?: () => void;
  deleteNote?: () => void;
  moveNote?: () => void;
  /** Who can see this note, and its link. */
  shareNote?: () => void;
  /** This note as a PDF (the print dialog). */
  exportPdf?: () => void;
  /** Every note as Markdown files, in a .zip. */
  exportAll?: () => void;
  /** Notes from a .zip, a folder or .md files. */
  importNotes?: () => void;
  /** Your templates (for the `[[` suggestions). */
  templates?: () => { id: string; name: string }[];
  /** A new note from a template (`null`: pick one): asks for its blanks, makes the note, then
      `onCreated` gets its title — without it, a link to it goes in at the cursor. */
  newFromTemplate?: (templateId: string | null, onCreated?: (title: string) => void) => void;
  /** Replaces this note with a template (pick one; warns if the note has anything in it). */
  applyTemplate?: (templateId?: string) => void;
  openTemplates?: () => void;
  goBack?: () => void;
  goForward?: () => void;
  /** The editor's text is saved now (vim's :w). */
  save?: () => void;
};

export type CommandContext = { view: EditorView | null; actions: NoteActions };

export type Command = {
  id: string;
  name: string;
  /** Needs the editor (else needs the named action). */
  editor?: boolean;
  needs?: keyof NoteActions;
  run: (ctx: CommandContext, arg?: string) => boolean;
};

// ---------------------------------------------------------------- text helpers

/** Wraps each selection in `mark` (or unwraps it if it's already wrapped). */
function toggleWrap(view: EditorView, mark: string): boolean {
  const { state } = view;
  const n = mark.length;
  view.dispatch(
    state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - n, range.from);
      const after = state.sliceDoc(range.to, range.to + n);
      if (before === mark && after === mark) {
        return {
          changes: [
            { from: range.from - n, to: range.from },
            { from: range.to, to: range.to + n },
          ],
          range: EditorSelection.range(range.from - n, range.to - n),
        };
      }
      const text = state.sliceDoc(range.from, range.to);
      if (text.length >= 2 * n && text.startsWith(mark) && text.endsWith(mark)) {
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(n, -n) },
          range: EditorSelection.range(range.from, range.to - 2 * n),
        };
      }
      return {
        changes: [
          { from: range.from, insert: mark },
          { from: range.to, insert: mark },
        ],
        range: EditorSelection.range(range.from + n, range.to + n),
      };
    }),
    { userEvent: "input.format" },
  );
  view.focus();
  return true;
}

/** Applies `fn` to the start of every line the selection touches. */
function mapLines(view: EditorView, fn: (line: string) => string): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to; ) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        const next = fn(line.text);
        if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next });
      }
      pos = line.to + 1;
    }
  }
  view.dispatch({ changes, userEvent: "input.format" });
  view.focus();
  return true;
}

const LIST_PREFIX = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;

function setHeading(view: EditorView, level: number): boolean {
  return mapLines(view, (text) => {
    const m = /^(#{1,6})\s+/.exec(text);
    const rest = m ? text.slice(m[0].length) : text;
    if (m && m[1].length === level) return rest;
    return level ? `${"#".repeat(level)} ${rest}` : rest;
  });
}

function toggleChecklist(view: EditorView): boolean {
  return mapLines(view, (text) => {
    const m = /^(\s*)[-*+]\s+\[([ xX])\]\s+/.exec(text);
    if (m) return `${m[1]}- [${m[2] === " " ? "x" : " "}] ${text.slice(m[0].length)}`;
    const p = LIST_PREFIX.exec(text)!;
    return `${p[1]}- [ ] ${text.slice(p[0].length)}`;
  });
}

function toggleListPrefix(view: EditorView, kind: "bullet" | "number" | "quote"): boolean {
  return mapLines(view, (text) => {
    if (kind === "quote") return /^>\s?/.test(text) ? text.replace(/^>\s?/, "") : `> ${text}`;
    const p = LIST_PREFIX.exec(text)!;
    const has = kind === "bullet" ? /^\s*[-*+]\s+(?!\[)/.test(text) : /^\s*\d+[.)]\s+/.test(text);
    return has ? p[1] + text.slice(p[0].length) : `${p[1]}${kind === "bullet" ? "- " : "1. "}${text.slice(p[0].length)}`;
  });
}

/** The `[[link]]` or `[text](url)` under the cursor. */
export function linkAt(view: EditorView, pos: number): { kind: "wiki"; target: string } | { kind: "url"; url: string } | null {
  const line = view.state.doc.lineAt(pos);
  const at = pos - line.from;
  for (const m of line.text.matchAll(WIKILINK_RE)) {
    const from = m.index ?? 0;
    if (at >= from && at <= from + m[0].length) {
      const { target } = parseLinkInner(m[1]);
      return target ? { kind: "wiki", target } : null;
    }
  }
  for (const m of line.text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)|https?:\/\/[^\s)>\]]+|www\.[^\s)>\]]+/g)) {
    const from = m.index ?? 0;
    if (at >= from && at <= from + m[0].length) return { kind: "url", url: m[1] ?? m[0] };
  }
  return null;
}

export function openUrl(url: string, actions: NoteActions = {}) {
  if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
  else if (url.startsWith("/")) (actions.openPath ?? ((p: string) => window.location.assign(p)))(url);
}

/** The notation block (```score or ```abc) the cursor is in. */
export function notationBlockAt(view: EditorView, pos: number): Block | null {
  return findBlocks(view.state).find((b) => pos >= b.from && pos <= b.to) ?? null;
}

/** Puts a ```score block for `scoreId` on its own lines at the cursor. */
export function insertScore(view: EditorView, scoreId: string) {
  const block = "```score\n" + scoreId + "\n```";
  const at = view.state.selection.main.head;
  const line = view.state.doc.lineAt(at);
  const pre = line.text.trim() ? "\n\n" : line.number > 1 && view.state.doc.line(line.number - 1).text.trim() ? "\n" : "";
  const insertAt = line.text.trim() ? line.to : line.from;
  const text = pre + block + "\n";
  view.dispatch({ changes: { from: insertAt, insert: text }, selection: { anchor: insertAt + text.length }, userEvent: "input" });
  view.focus();
}

// ---------------------------------------------------------------- the list

const ed = (fn: (view: EditorView, arg?: string) => boolean) => (ctx: CommandContext, arg?: string) => (ctx.view ? fn(ctx.view, arg) : false);
const act = (key: keyof NoteActions, fn: (a: NoteActions, arg?: string) => void) => (ctx: CommandContext, arg?: string) => {
  if (!ctx.actions[key]) return false;
  fn(ctx.actions, arg);
  return true;
};
const toggle = (key: "vimMode" | "livePreview" | "lineNumbers" | "readableLineLength" | "spellcheck" | "wordCompletion") =>
  act("setConfig", (a) => a.setConfig!(key, !a.config!()[key]));

export const COMMANDS: Command[] = [
  { id: "app:command-palette", name: "Open the command palette", needs: "openCommandPalette", run: act("openCommandPalette", (a) => a.openCommandPalette!()) },
  { id: "app:quick-switcher", name: "Open a note (quick switcher)", needs: "openQuickSwitcher", run: act("openQuickSwitcher", (a) => a.openQuickSwitcher!()) },
  { id: "app:search", name: "Search every note", needs: "openSearch", run: act("openSearch", (a) => a.openSearch!()) },
  { id: "app:open-settings", name: "Open the settings file", needs: "openSettings", run: act("openSettings", (a) => a.openSettings!()) },
  { id: "app:go-back", name: "Go back", needs: "goBack", run: act("goBack", (a) => a.goBack!()) },
  { id: "app:go-forward", name: "Go forward", needs: "goForward", run: act("goForward", (a) => a.goForward!()) },
  { id: "note:new", name: "New note", needs: "newNote", run: act("newNote", (a) => a.newNote!()) },
  { id: "note:rename", name: "Rename this note", needs: "renameNote", run: act("renameNote", (a) => a.renameNote!()) },
  { id: "note:move", name: "Move this note to a folder", needs: "moveNote", run: act("moveNote", (a) => a.moveNote!()) },
  { id: "note:delete", name: "Delete this note", needs: "deleteNote", run: act("deleteNote", (a) => a.deleteNote!()) },
  { id: "note:share", name: "Share this note", needs: "shareNote", run: act("shareNote", (a) => a.shareNote!()) },
  { id: "note:export-pdf", name: "Export this note as a PDF", needs: "exportPdf", run: act("exportPdf", (a) => a.exportPdf!()) },
  { id: "app:export-all", name: "Export every note as Markdown (.zip)", needs: "exportAll", run: act("exportAll", (a) => a.exportAll!()) },
  { id: "app:import", name: "Import notes (a .zip, a folder or Markdown files)", needs: "importNotes", run: act("importNotes", (a) => a.importNotes!()) },
  { id: "note:new-from-template", name: "New note from a template (and link it here)", needs: "newFromTemplate", run: act("newFromTemplate", (a) => a.newFromTemplate!(null)) },
  { id: "note:apply-template", name: "Apply a template to this note (or change it)", needs: "applyTemplate", run: act("applyTemplate", (a) => a.applyTemplate!()) },
  { id: "app:open-templates", name: "Open templates", needs: "openTemplates", run: act("openTemplates", (a) => a.openTemplates!()) },
  { id: "note:close", name: "Close this note", needs: "closeNote", run: act("closeNote", (a) => a.closeNote!()) },
  { id: "note:save", name: "Save now", needs: "save", run: act("save", (a) => a.save!()) },
  { id: "view:toggle-vim", name: "Turn vim mode on or off", needs: "setConfig", run: toggle("vimMode") },
  { id: "view:toggle-live-preview", name: "Switch between live preview and source", needs: "setConfig", run: toggle("livePreview") },
  { id: "view:toggle-full-width", name: "Full width for this note", needs: "toggleFullWidth", run: act("toggleFullWidth", (a) => a.toggleFullWidth!()) },
  { id: "view:toggle-note-list", name: "Show or hide the note list", needs: "toggleNoteList", run: act("toggleNoteList", (a) => a.toggleNoteList!()) },
  { id: "view:toggle-links-panel", name: "Move the links panel beside or under the note", needs: "toggleLinksPanel", run: act("toggleLinksPanel", (a) => a.toggleLinksPanel!()) },
  { id: "view:toggle-line-numbers", name: "Show or hide line numbers", needs: "setConfig", run: toggle("lineNumbers") },
  { id: "view:toggle-readable-width", name: "Readable line length (the default for every note)", needs: "setConfig", run: toggle("readableLineLength") },
  { id: "view:toggle-spellcheck", name: "Turn spellcheck on or off", needs: "setConfig", run: toggle("spellcheck") },
  { id: "view:toggle-word-completion", name: "Turn word suggestions on or off", needs: "setConfig", run: toggle("wordCompletion") },
  { id: "editor:toggle-bold", name: "Bold", editor: true, run: ed((v) => toggleWrap(v, "**")) },
  { id: "editor:toggle-italic", name: "Italic", editor: true, run: ed((v) => toggleWrap(v, "*")) },
  { id: "editor:toggle-strikethrough", name: "Strikethrough", editor: true, run: ed((v) => toggleWrap(v, "~~")) },
  { id: "editor:toggle-highlight", name: "Highlight", editor: true, run: ed((v) => toggleWrap(v, "==")) },
  { id: "editor:toggle-code", name: "Inline code", editor: true, run: ed((v) => toggleWrap(v, "`")) },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `editor:set-heading-${n}`, name: `Heading ${n}`, editor: true, run: ed((v) => setHeading(v, n)) })),
  { id: "editor:remove-heading", name: "Remove heading", editor: true, run: ed((v) => setHeading(v, 0)) },
  { id: "editor:toggle-checklist", name: "Checklist item (tick it off)", editor: true, run: ed(toggleChecklist) },
  { id: "editor:toggle-bullet-list", name: "Bulleted list", editor: true, run: ed((v) => toggleListPrefix(v, "bullet")) },
  { id: "editor:toggle-numbered-list", name: "Numbered list", editor: true, run: ed((v) => toggleListPrefix(v, "number")) },
  { id: "editor:toggle-quote", name: "Quote", editor: true, run: ed((v) => toggleListPrefix(v, "quote")) },
  {
    id: "editor:insert-wikilink",
    name: "Link to a note",
    editor: true,
    run: ed((v) => {
      const r = v.state.selection.main;
      const text = v.state.sliceDoc(r.from, r.to);
      v.dispatch({ changes: { from: r.from, to: r.to, insert: `[[${text}]]` }, selection: { anchor: r.from + 2 + text.length }, userEvent: "input" });
      v.focus();
      if (!text) startCompletion(v);
      return true;
    }),
  },
  {
    id: "editor:insert-table",
    name: "Insert a table",
    editor: true,
    run: ed((v) => {
      const line = v.state.doc.lineAt(v.state.selection.main.head);
      const pre = line.text.trim() ? "\n\n" : line.number > 1 && v.state.doc.line(line.number - 1).text.trim() ? "\n" : "";
      const at = line.text.trim() ? line.to : line.from;
      // The cursor lands on the first header cell's text, selected, ready to type over.
      const first = at + pre.length + 2;
      v.dispatch({ changes: { from: at, insert: `${pre}${NEW_TABLE}\n` }, selection: { anchor: first, head: first + "Column 1".length }, userEvent: "input" });
      v.focus();
      return true;
    }),
  },
  {
    id: "editor:insert-horizontal-rule",
    name: "Divider line",
    editor: true,
    run: ed((v) => {
      const line = v.state.doc.lineAt(v.state.selection.main.head);
      const insert = line.text.trim() ? "\n\n---\n" : "---\n";
      v.dispatch({ changes: { from: line.text.trim() ? line.to : line.from, insert }, userEvent: "input" });
      return true;
    }),
  },
  {
    id: "editor:insert-notation",
    name: "Write music notation",
    editor: true,
    needs: "openScore",
    run: (ctx) => {
      const view = ctx.view;
      if (!view || !ctx.actions.openScore) return false;
      const block = notationBlockAt(view, view.state.selection.main.head);
      if (block?.kind === "score") ctx.actions.openScore(scoreIdOf(block.body), () => {});
      else ctx.actions.openScore(null, (id) => insertScore(view, id));
      return true;
    },
  },
  {
    id: "editor:follow-link",
    name: "Open the link under the cursor",
    editor: true,
    run: (ctx) => {
      const view = ctx.view;
      if (!view) return false;
      const link = linkAt(view, view.state.selection.main.head);
      if (!link) return false;
      if (link.kind === "url") openUrl(link.url, ctx.actions);
      else ctx.actions.openNoteByTitle?.(link.target, { create: true });
      return true;
    },
  },
];

export const COMMAND_BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));

/** Runs a command by id. False when there's no such command or it can't run here. */
export function runCommand(id: string, ctx: CommandContext, arg?: string): boolean {
  const cmd = COMMAND_BY_ID.get(id);
  if (!cmd) return false;
  return cmd.run(ctx, arg);
}

/** Commands that can run in this context (for the palette). */
export function availableCommands(ctx: CommandContext): Command[] {
  return COMMANDS.filter((c) => (!c.editor || ctx.view) && (!c.needs || ctx.actions[c.needs]));
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const KEY_NAMES: Record<string, string> = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Enter: "↵", Backspace: "⌫", Escape: "Esc", " ": "Space" };

/** A key as it reads on this computer: "⌘⇧F" on a Mac, "Ctrl+Shift+F" elsewhere. */
export function keyLabel(key: string): string {
  const parts = key.split(/-(?!$)/);
  const last = parts.pop()!;
  const mods = parts.map((m) => {
    const k = m.toLowerCase();
    if (k === "mod") return IS_MAC ? "⌘" : "Ctrl";
    if (k === "ctrl" || k === "c") return IS_MAC ? "⌃" : "Ctrl";
    if (k === "meta" || k === "cmd" || k === "m") return IS_MAC ? "⌘" : "Meta";
    if (k === "alt" || k === "a") return IS_MAC ? "⌥" : "Alt";
    if (k === "shift" || k === "s") return IS_MAC ? "⇧" : "Shift";
    return m;
  });
  const main = KEY_NAMES[last] ?? (last.length === 1 ? last.toUpperCase() : last);
  return IS_MAC ? [...mods, main].join("") : [...mods, main].join("+");
}

/** The keys a command has in these settings, as labels ("" when none). */
export function keysFor(id: string, bindings: { key: string; command: string }[]): string {
  return bindings.filter((b) => b.command === id).map((b) => keyLabel(b.key)).join(" or ");
}
