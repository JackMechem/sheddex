import { Vim } from "@replit/codemirror-vim";
import type { EditorView } from "@codemirror/view";
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
  Vim.defineEx("cmd", "cmd", (cm: CM, params: { argString?: string }) => {
    const id = params.argString?.trim() ?? "";
    if (!runCommand(id, ctxOf(cm))) cm.cm6.dom.dispatchEvent(new CustomEvent("shednotes-message", { bubbles: true, detail: `No command "${id}" here.` }));
  });
}

/** Applies the settings file's vim part. Returns problems to show beside the file. */
export function applyVimConfig(config: ShedNotesConfig): string[] {
  defineBuiltins();
  const key = JSON.stringify(config.vim);
  if (key === lastApplied) return lastErrors;
  lastApplied = key;
  Vim.mapclear();
  const errors: string[] = [];
  for (const line of config.vim.mappings) {
    const parsed = parseVimrcLine(line, config.vim.leader);
    if (!parsed) continue;
    try {
      if (parsed.kind === "error") continue;
      if (parsed.kind === "unmap") Vim.unmap(parsed.lhs, parsed.mode as string);
      else if (parsed.noremap) Vim.noremap(parsed.lhs, parsed.rhs, parsed.mode as string);
      else Vim.map(parsed.lhs, parsed.rhs, parsed.mode as string);
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
