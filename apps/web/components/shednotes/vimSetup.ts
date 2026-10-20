import { Vim, getCM } from "@replit/codemirror-vim";
import { Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type ShedNotesConfig, parseVimrcLine } from "@/lib/shedNotesConfig";
import { COMMAND_BY_ID, type NoteActions, runCommand } from "./commands";

/**
 * Vim's mappings and `:` commands are global (one vim for every editor on the page), so they're
 * set here from the settings file — cleared and re-applied whenever it changes — and the `:`
 * commands find the editor they were typed in through `cm.cm6`. Built in: `:w` saves, `:q`
 * closes the note, `:e <title>` opens (or makes) a note, `:new [title]` makes one, and `:cmd <id>`
 * runs any Shed Notes command. The settings file can add its own.
 */

const actionsOf = new WeakMap<EditorView, () => NoteActions>();

/** Called by each editor so `:` commands typed in it reach its page. */
export function registerVimEditor(view: EditorView, actions: () => NoteActions) {
  actionsOf.set(view, actions);
}

type CM = { cm6: EditorView };
const ctxOf = (cm: CM) => ({ view: cm.cm6, actions: actionsOf.get(cm.cm6)?.() ?? {} });

let builtinsDefined = false;
let lastApplied = "";
let lastErrors: string[] = [];

function defineBuiltins() {
  if (builtinsDefined) return;
  builtinsDefined = true;
  Vim.defineEx("write", "w", (cm: CM) => {
    runCommand("note:save", ctxOf(cm));
  });
  Vim.defineEx("quit", "q", (cm: CM) => {
    runCommand("note:close", ctxOf(cm));
  });
  Vim.defineEx("wq", "wq", (cm: CM) => {
    runCommand("note:save", ctxOf(cm));
    runCommand("note:close", ctxOf(cm));
  });
  Vim.defineEx("edit", "e", (cm: CM, params: { argString?: string }) => {
    const title = params.argString?.trim();
    const ctx = ctxOf(cm);
    if (title) ctx.actions.openNoteByTitle?.(title, { create: true });
    else ctx.actions.openQuickSwitcher?.();
  });
  Vim.defineEx("new", "new", (cm: CM, params: { argString?: string }) => {
    const title = params.argString?.trim();
    const ctx = ctxOf(cm);
    if (title) ctx.actions.openNoteByTitle?.(title, { create: true });
    else ctx.actions.newNote?.();
  });
  Vim.defineEx("cmd", "cmd", (cm: CM, params: ExParams) => runById(cm, params.argString?.trim() ?? "", params));
  // Any command by its id, straight after the colon: `:app:search`, `:note:share`. Vim reads the
  // part before the second colon as the command's name, so each id's prefix is a command of its
  // own that runs `prefix` + the rest.
  for (const prefix of COMMAND_PREFIXES)
    Vim.defineEx(prefix, prefix, (cm: CM, params: ExParams) => runById(cm, `${prefix}${params.argString?.trim() ?? ""}`, params));
}

/** The parts before the colon in command ids ("app" in "app:search"). */
const COMMAND_PREFIXES = [...new Set([...COMMAND_BY_ID.keys()].map((id) => id.split(":")[0]))];

type ExParams = { argString?: string; line?: number };
type Pos = { line: number; ch: number };
type VimCM = CM & {
  state: { vim?: { lastSelection?: { anchorMark: { find(): Pos | undefined }; headMark: { find(): Pos | undefined }; visualLine?: boolean } } };
  setSelection(anchor: Pos, head: Pos): void;
  getLine(n: number): string;
};

/** Runs a Shed Notes command by id ("app:search", or "note:open Title" with an argument). From
    visual mode (`:'<,'>…`), vim has already dropped the selection, so it's put back first —
    "make bold" then works on what was selected. */
function runById(cm: CM, text: string, params: ExParams = {}) {
  const sel = (cm as VimCM).state.vim?.lastSelection;
  if (params.line !== undefined && sel) {
    const a = sel.anchorMark.find();
    const h = sel.headMark.find();
    if (a && h) {
      const [from, to] = a.line < h.line || (a.line === h.line && a.ch <= h.ch) ? [a, h] : [h, a];
      // Vim's selections include the last character (or, linewise, whole lines).
      if (sel.visualLine) (cm as VimCM).setSelection({ line: from.line, ch: 0 }, { line: to.line, ch: (cm as VimCM).getLine(to.line).length });
      else (cm as VimCM).setSelection(from, { line: to.line, ch: Math.min(to.ch + 1, (cm as VimCM).getLine(to.line).length) });
    }
  }
  const [id, ...rest] = text.split(/\s+/);
  if (!runCommand(id, ctxOf(cm), rest.join(" ") || undefined)) cm.cm6.dom.dispatchEvent(new CustomEvent("shednotes-message", { bubbles: true, detail: `No command "${id}" here.` }));
}

/** Applies the settings file's vim part. Returns problems to show beside the file. */
export function applyVimConfig(config: ShedNotesConfig): string[] {
  defineBuiltins();
  const key = JSON.stringify(config.vim);
  if (key === lastApplied) return lastErrors;
  lastApplied = key;
  Vim.mapclear();
  heldMappings = [];
  const errors: string[] = [];
  for (const line of config.vim.mappings) {
    const parsed = parseVimrcLine(line, config.vim.leader);
    if (!parsed) continue;
    try {
      if (parsed.kind === "error") continue;
      if (parsed.kind === "unmap") Vim.unmap(parsed.lhs, parsed.mode as string);
      else if (parsed.noremap) Vim.noremap(parsed.lhs, parsed.rhs, parsed.mode as string);
      else Vim.map(parsed.lhs, parsed.rhs, parsed.mode as string);
      const keys = parsed.kind === "map" ? (parsed.lhs.match(KEY_TOKEN) ?? []) : [];
      if (parsed.kind === "map" && parsed.mode !== "insert" && keys.length > 1) heldMappings.push({ lhs: parsed.lhs, keys, mode: parsed.mode });
    } catch (e) {
      errors.push(`"${line}": ${(e as Error).message}`);
    }
  }
  for (const [name, id] of Object.entries(config.vim.exCommands)) {
    if (!/^[a-zA-Z][\w-]*$/.test(name)) {
      errors.push(`Vim command name "${name}" should be letters (and digits) only.`);
      continue;
    }
    Vim.defineEx(name, name, (cm: CM, params: { argString?: string }) => {
      runCommand(id, ctxOf(cm), params.argString?.trim() || undefined);
    });
  }
  lastErrors = [...errors, ...vimErrors(config)];
  return lastErrors;
}

function vimErrors(config: ShedNotesConfig): string[] {
  const out: string[] = [];
  for (const [name, id] of Object.entries(config.vim.exCommands)) if (!COMMAND_BY_ID.has(id)) out.push(`Vim command ":${name}" runs "${id}", which isn't a Shed Notes command.`);
  for (const line of config.vim.mappings) {
    const p = parseVimrcLine(line, config.vim.leader);
    if (p?.kind === "error") out.push(p.message);
  }
  return [...new Set(out)];
}

// ---------------------------------------------------------------- waiting for the rest of a mapping

/*
 * Vim waits after the first key of a mapping like `<leader>ff` to see what comes next. The vim
 * library doesn't when that first key already does something on its own (Space moves right, `,`
 * repeats a search) — it runs it at once, so the mapping could never be typed. So for normal- and
 * visual-mode mappings longer than one key, Shed Notes holds the keys itself: while what's typed
 * is the start of a mapping, keys are held (up to a second, like vim's timeoutlen); when it's a
 * whole mapping, the mapping runs; otherwise the held keys go to vim as if just typed.
 */

const KEY_TOKEN = /<(?:[CSMA]-)*\w+>|./gi;
const WAIT_MS = 1000;
let heldMappings: { lhs: string; keys: string[]; mode: "normal" | "visual" | undefined }[] = [];

type VimState = { insertMode?: boolean; visualMode?: boolean; inputState?: { keyBuffer: string[]; operator?: string | null } };
type HeldCM = { state: { vim?: VimState } };
const VimApi = Vim as unknown as {
  vimKeyFromEvent: (e: KeyboardEvent, vim: VimState) => string | undefined;
  handleKey: (cm: HeldCM, key: string, origin?: string) => unknown;
};

const sameKey = (a: string, b: string) => a === b || (a.length > 1 && a.toLowerCase() === b.toLowerCase());

/** One editor's held keys. */
class Held {
  keys: string[] = [];
  timer: ReturnType<typeof setTimeout> | null = null;
  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.keys = [];
  }
  /** Gives the held keys to vim one by one, as if typed now. */
  flush(cm: HeldCM) {
    const keys = this.keys;
    this.clear();
    for (const k of keys) VimApi.handleKey(cm, k, "user");
  }
}
const heldOf = new WeakMap<EditorView, Held>();

export const vimMappingWait = Prec.highest(
  EditorView.domEventHandlers({
    keydown(e, view) {
      const held = heldOf.get(view) ?? new Held();
      heldOf.set(view, held);
      const cm = getCM(view) as HeldCM | null;
      const vim = cm?.state.vim;
      if (!cm || !vim || vim.insertMode || !heldMappings.length) {
        held.clear();
        return false;
      }
      // Halfway through something of vim's own (a count, an operator): leave it to vim.
      if (!held.keys.length && (vim.inputState?.keyBuffer.length || vim.inputState?.operator)) return false;
      const key = VimApi.vimKeyFromEvent(e, vim);
      if (!key) return false; // a modifier on its own
      const mode = vim.visualMode ? "visual" : "normal";
      const typed = [...held.keys, key];
      const fits = heldMappings.filter((m) => (!m.mode || m.mode === mode) && m.keys.length >= typed.length && typed.every((k, i) => sameKey(k, m.keys[i])));
      if (!fits.length) {
        if (!held.keys.length) return false;
        held.flush(cm);
        // This key wasn't part of a mapping after all: let vim have it, after the held ones.
        VimApi.handleKey(cm, key, "user");
        e.preventDefault();
        return true;
      }
      e.preventDefault();
      const whole = fits.find((m) => m.keys.length === typed.length);
      if (whole && !fits.some((m) => m.keys.length > typed.length)) {
        held.clear();
        VimApi.handleKey(cm, whole.lhs, "user");
        return true;
      }
      held.clear();
      held.keys = typed;
      held.timer = setTimeout(() => {
        if (whole) {
          held.clear();
          VimApi.handleKey(cm, whole.lhs, "user");
        } else held.flush(cm);
      }, WAIT_MS);
      return true;
    },
  }),
);
