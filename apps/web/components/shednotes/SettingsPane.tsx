"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { DEFAULT_CONFIG_TEXT, type ShedNotesConfig } from "@/lib/shedNotesConfig";
import { COMMANDS, COMMAND_BY_ID, type NoteActions } from "./commands";
import NoteEditor from "./NoteEditor";
import { applyVimConfig } from "./vimSetup";

const OPTIONS: [keyof ShedNotesConfig, string][] = [
  ["vimMode", "true turns on vim keys in every note (also the Vim switch above a note)."],
  ["livePreview", "true hides markdown marks where the cursor isn't and shows notation; false is plain source."],
  ["lineNumbers", "Line numbers down the side."],
  ["readableLineLength", "Keeps lines to a comfortable width on a wide screen."],
  ["fontSize", "The text size in notes, 10 to 32."],
  ["spellcheck", "The browser's spellcheck underline."],
  ["keybindings", 'A list of { "key": "Mod-b", "command": "editor:toggle-bold" }. Mod is Ctrl (⌘ on a Mac); also Shift-, Alt-, Ctrl-, Meta-. Leave a key out to unbind it.'],
  ["vim", 'leader: what <leader> is in mappings. mappings: vimrc lines (map, nmap, imap, vmap, noremap, nnoremap, inoremap, vnoremap, unmap). exCommands: { "name": "command id" } adds :name.'],
];

/**
 * The settings file, edited as a file: JSON in the same editor as the notes (with vim, if it's
 * on), problems listed above it, and a reference of every setting and command id below. Changes
 * apply as you type, once the file is valid JSON.
 */
export default function SettingsPane({
  text,
  setText,
  config,
  errors,
  broken,
  actions,
}: {
  text: string;
  setText: (text: string) => void;
  config: ShedNotesConfig;
  errors: string[];
  broken: boolean;
  actions: NoteActions;
}) {
  const [version, setVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [reference, setReference] = useState(false);
  const unknown = config.keybindings.filter((b) => !COMMAND_BY_ID.has(b.command)).map((b) => `"${b.key}" runs "${b.command}", which isn't a Shed Notes command.`);
  const vimProblems = broken ? [] : applyVimConfig(config);
  const problems = [...errors, ...unknown, ...vimProblems];
  const keyFor = (id: string) => config.keybindings.filter((b) => b.command === id).map((b) => b.key).join(", ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold">shed-notes.json</h2>
          <p className="text-xs text-muted">Shed Notes&apos; settings: keys, vim mappings and commands, and how notes look. Saved to your account.</p>
        </div>
        <button type="button" onClick={() => setReference((r) => !r)} aria-pressed={reference} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${reference ? "bg-accent/15 text-accent" : "bg-surface hover:bg-surface-hover"}`}>
          Reference
        </button>
        <button type="button" onClick={() => setResetting(true)} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover">
          Reset to defaults
        </button>
      </div>

      {problems.length > 0 && (
        <ul className={`flex flex-col gap-1 rounded-xl px-3 py-2 text-xs ${broken ? "bg-danger/10 text-danger" : "bg-surface text-muted"}`}>
          {broken && <li className="font-semibold">This isn&apos;t valid JSON yet, so the last good settings are still in use.</li>}
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {reference && (
        <div className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-3 text-xs">
          <div className="flex flex-col gap-1.5">
            <h3 className="font-semibold text-muted">Settings</h3>
            {OPTIONS.map(([k, d]) => (
              <p key={k}>
                <code className="font-semibold text-accent">{k}</code> <span className="text-muted">— {d}</span>
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="font-semibold text-muted">Vim</h3>
            <p className="text-muted">
              Built in: <code>:w</code> saves now, <code>:q</code> closes the note, <code>:e Title</code> opens a note (making it if it&apos;s new), <code>:new</code> makes one, <code>:cmd id</code> runs any command below. Mappings can call your own commands: <code>nnoremap &lt;leader&gt;n :notation&lt;CR&gt;</code>.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-muted">Commands</h3>
            <table className="w-full border-separate border-spacing-y-0.5">
              <tbody>
                {COMMANDS.map((c) => (
                  <tr key={c.id}>
                    <td className="pr-3 align-top">
                      <code className="text-accent">{c.id}</code>
                    </td>
                    <td className="pr-3 align-top text-muted">{c.name}</td>
                    <td className="whitespace-nowrap text-right align-top font-mono text-muted">{keyFor(c.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="min-h-[60vh] overflow-hidden rounded-2xl bg-surface lg:min-h-0 lg:flex-1">
        <NoteEditor key={version} initialText={text} language="json" config={config} actions={actions} onChange={setText} className="h-full" />
      </div>

      {resetting && (
        <ConfirmDialog
          title="Reset the settings file?"
          message="Your keybindings, vim mappings and other settings go back to how they started."
          confirmLabel="Reset"
          onConfirm={() => {
            setText(DEFAULT_CONFIG_TEXT);
            setVersion((v) => v + 1);
            setResetting(false);
          }}
          onCancel={() => setResetting(false)}
        />
      )}
    </div>
  );
}
