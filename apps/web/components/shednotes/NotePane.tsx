"use client";

import { useMutation } from "convex/react";
import type { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import type { Id } from "@jam-practice/convex/_generated/dataModel";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ChevronLeftIcon, ChevronRightIcon, DotsVerticalIcon, NoteIcon } from "@/components/tools";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import type { ShedNotesConfig } from "@/lib/shedNotesConfig";
import { type NoteMeta, errorText, useNote } from "@/lib/useShedNotes";
import { type NoteActions, runCommand } from "./commands";
import LinksPanel from "./LinksPanel";
import NoteEditor from "./NoteEditor";

const SAVE_LABEL = { saved: "Saved", saving: "Saving…", unsaved: "Editing", error: "Not saved" } as const;

/** Formatting buttons — for phones and anyone who'd rather click. */
const FORMAT: { label: string; title: string; command: string; className?: string }[] = [
  { label: "B", title: "Bold", command: "editor:toggle-bold", className: "font-extrabold" },
  { label: "I", title: "Italic", command: "editor:toggle-italic", className: "italic font-serif" },
  { label: "S", title: "Strikethrough", command: "editor:toggle-strikethrough", className: "line-through" },
  { label: "H1", title: "Heading 1", command: "editor:set-heading-1" },
  { label: "H2", title: "Heading 2", command: "editor:set-heading-2" },
  { label: "• List", title: "Bulleted list", command: "editor:toggle-bullet-list" },
  { label: "☐ Task", title: "Checklist item", command: "editor:toggle-checklist" },
  { label: "[[ ]]", title: "Link to a note", command: "editor:insert-wikilink" },
  { label: "Quote", title: "Quote", command: "editor:toggle-quote" },
];

export function VimSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title={on ? "Vim keys are on" : "Vim keys are off"}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${on ? "bg-accent/15 text-accent" : "bg-surface text-muted hover:text-foreground"}`}
    >
      <span className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? "bg-accent" : "bg-foreground/20"}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-background transition-[left] ${on ? "left-3" : "left-0.5"}`} />
      </span>
      Vim
    </button>
  );
}

/**
 * One open note: back/forward, its title (renaming it renames the links to it), the toolbar (live
 * preview or source, Vim, notation, links panel, ⋮), formatting buttons, the editor, and the
 * links panel beside it (below it on narrower screens).
 */
export default function NotePane({
  id,
  notes,
  config,
  actions,
  setConfig,
  focusTitle,
  onBackToList,
  canBack,
  canForward,
  onView,
  onNotice,
  onTag,
  onOpen,
}: {
  id: string;
  notes: NoteMeta[];
  config: ShedNotesConfig;
  actions: NoteActions;
  setConfig: (key: keyof ShedNotesConfig, value: boolean) => void;
  focusTitle: boolean;
  onBackToList: () => void;
  canBack: boolean;
  canForward: boolean;
  onView: (view: EditorView | null) => void;
  onNotice: (text: string) => void;
  onTag: (tag: string) => void;
  onOpen: (id: string) => void;
}) {
  const { note, setBody, flush, saveState, saveError } = useNote(id);
  const rename = useMutation(api.shedNotes.rename);
  const [draft, setDraft] = useState<string | null>(null);
  const [linksOpen, setLinksOpen] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const loaded = !!note;

  useEffect(() => {
    if (focusTitle && loaded) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [focusTitle, loaded]);

  const paneActions: NoteActions = useMemo(
    () => ({
      ...actions,
      save: flush,
      renameNote: () => {
        titleRef.current?.focus();
        titleRef.current?.select();
      },
    }),
    [actions, flush],
  );
  const titles = useMemo(() => notes.map((n) => ({ title: n.title, folder: n.folder })), [notes]);

  if (note === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }
  if (note === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm text-muted">This note isn&apos;t there any more.</p>
        <button type="button" onClick={onBackToList} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
          All notes
        </button>
      </div>
    );
  }

  async function commitTitle() {
    if (draft === null || !note) return;
    const next = draft.trim();
    setDraft(null);
    if (!next || next === note.title) return;
    try {
      await rename({ id: note.id as Id<"shedNotes">, title: next });
    } catch (e) {
      onNotice(errorText(e));
    }
  }

  function run(command: string) {
    runCommand(command, { view: viewRef.current, actions: paneActions });
  }

  function openMenu(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: r.right - 220,
      y: r.bottom + 4,
      items: [
        { label: "Command palette", onSelect: () => actions.openCommandPalette?.() },
        { label: "Open a note…", onSelect: () => actions.openQuickSwitcher?.() },
        { label: config.lineNumbers ? "Hide line numbers" : "Show line numbers", onSelect: () => setConfig("lineNumbers", !config.lineNumbers) },
        { label: "Rename", onSelect: () => paneActions.renameNote?.() },
        { label: "Move to folder", onSelect: () => actions.moveNote?.() },
        { label: "Settings file", onSelect: () => actions.openSettings?.() },
        { label: "Delete note", danger: true, onSelect: () => actions.deleteNote?.() },
      ],
    });
  }

  const iconBtn = "shrink-0 rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row xl:gap-6">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onBackToList} className="flex shrink-0 items-center gap-1 rounded-full bg-surface py-1.5 pl-2 pr-3 text-sm font-semibold hover:bg-surface-hover lg:hidden">
            <ChevronLeftIcon className="h-4 w-4" /> Notes
          </button>
          <button type="button" onClick={() => actions.goBack?.()} disabled={!canBack} aria-label="Back" className={`${iconBtn} hidden lg:block`}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => actions.goForward?.()} disabled={!canForward} aria-label="Forward" className={`${iconBtn} hidden lg:block`}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <span className="hidden truncate text-xs text-muted sm:inline">{note.folder ? `${note.folder.replace(/\//g, " / ")} /` : ""}</span>
          <span className="flex-1" />
          <span className={`hidden shrink-0 text-xs sm:inline ${saveState === "error" ? "font-semibold text-danger" : "text-muted"}`} title={saveError ?? undefined}>
            {SAVE_LABEL[saveState]}
          </span>
          <div className="flex shrink-0 rounded-full bg-surface p-0.5 text-xs font-semibold">
            {([true, false] as const).map((live) => (
              <button key={String(live)} type="button" onClick={() => setConfig("livePreview", live)} aria-pressed={config.livePreview === live} className={`rounded-full px-2.5 py-1 ${config.livePreview === live ? "bg-background text-foreground" : "text-muted hover:text-foreground"}`}>
                {live ? "Preview" : "Source"}
              </button>
            ))}
          </div>
          <VimSwitch on={config.vimMode} onChange={(on) => setConfig("vimMode", on)} />
          <button type="button" onClick={() => setLinksOpen((o) => !o)} aria-pressed={linksOpen} className={`hidden shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold xl:block ${linksOpen ? "bg-accent/15 text-accent" : "bg-surface text-muted hover:text-foreground"}`}>
            Links
          </button>
          <button type="button" onClick={openMenu} aria-label="Note options" className={iconBtn}>
            <DotsVerticalIcon className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={titleRef}
          value={draft ?? note.title}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitTitle();
              viewRef.current?.focus();
            } else if (e.key === "Escape") {
              setDraft(null);
              viewRef.current?.focus();
            }
          }}
          aria-label="Note title"
          className="w-full bg-transparent text-2xl font-extrabold tracking-tight outline-none sm:text-3xl"
          style={config.readableLineLength ? { maxWidth: "46rem", marginInline: "auto" } : undefined}
        />

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden" style={config.readableLineLength ? { maxWidth: "46rem", marginInline: "auto", width: "100%" } : undefined}>
          {FORMAT.map((f) => (
            <button key={f.command} type="button" title={f.title} aria-label={f.title} onMouseDown={(e) => e.preventDefault()} onClick={() => run(f.command)} className={`shrink-0 rounded-lg bg-surface px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover ${f.className ?? "font-semibold"}`}>
              {f.label}
            </button>
          ))}
          <button type="button" title="Write music notation" onMouseDown={(e) => e.preventDefault()} onClick={() => run("editor:insert-notation")} className="flex shrink-0 items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/25">
            <NoteIcon className="h-3.5 w-3.5" /> Notation
          </button>
        </div>

        <div className="relative min-h-[55vh] rounded-2xl lg:min-h-0 lg:flex-1">
          <NoteEditor
            key={id}
            initialText={note.body}
            config={config}
            notes={titles}
            actions={paneActions}
            onChange={setBody}
            onView={(v) => {
              viewRef.current = v;
              onView(v);
            }}
            autoFocus={!focusTitle}
            placeholder="Start writing. [[ links a note, # makes a heading, - [ ] a checkbox."
            className="h-full lg:absolute lg:inset-0"
          />
        </div>
      </div>

      <aside className={`shrink-0 border-t border-foreground/10 pt-4 xl:w-72 xl:overflow-y-auto xl:border-l xl:border-t-0 xl:pl-6 xl:pt-1 ${linksOpen ? "" : "xl:hidden"}`}>
        <LinksPanel note={note} body={note.body} notes={notes} onOpen={onOpen} onOpenTitle={(t) => actions.openNoteByTitle?.(t, { create: true })} onTag={onTag} />
      </aside>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
