"use client";

import type { EditorView } from "@codemirror/view";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import type { Id } from "@jam-practice/convex/_generated/dataModel";
import { titleKey } from "@jam-practice/core/shedNotes";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import PromptDialog from "@/components/PromptDialog";
import { DocumentIcon, DownloadIcon, GearIcon, PlusIcon, SearchIcon } from "@/components/tools";
import { notesZip, saveBlob } from "@/lib/exportNotes";
import type { ShedNotesConfig } from "@/lib/shedNotesConfig";
import { usePersistedSettings } from "@/lib/usePersistedSettings";
import { type NoteMeta, errorText, useNoteList, useNotesConfig } from "@/lib/useShedNotes";
import { type NoteActions, availableCommands, keyLabel, runCommand } from "./commands";
import ScoreDialog from "@/components/notation/ScoreDialog";
import NoteList from "./NoteList";
import NotePane from "./NotePane";
import NoteSearch from "./NoteSearch";
import Palette, { type PaletteItem } from "./Palette";
import SettingsPane from "./SettingsPane";
import ShareDialog from "./ShareDialog";
import NotePrint from "./NotePrint";
import ImportDialog from "./ImportDialog";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import { getFont } from "@/lib/fonts";

export const SETTINGS_ID = "settings";

/** Which side panels are folded away (this device). */
const VIEW_KEY = "jam-practice-shed-notes-view";
const VIEW_DEFAULTS = { listHidden: false, linksHidden: false };

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Whether a keydown matches a CodeMirror-style key name ("Mod-Shift-p"). */
export function matchesKey(e: KeyboardEvent, name: string): boolean {
  const parts = name.split(/-(?!$)/);
  const key = parts.pop()!.toLowerCase();
  const want = { ctrl: false, meta: false, alt: false, shift: false };
  for (const p of parts) {
    const m = p.toLowerCase();
    if (m === "mod") want[isMac() ? "meta" : "ctrl"] = true;
    else if (m === "ctrl" || m === "c") want.ctrl = true;
    else if (m === "meta" || m === "cmd" || m === "m") want.meta = true;
    else if (m === "alt" || m === "a") want.alt = true;
    else if (m === "shift" || m === "s") want.shift = true;
  }
  const pressed = e.key === " " ? "space" : e.key.toLowerCase();
  const code = e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : e.code.startsWith("Digit") ? e.code.slice(5) : "";
  return (pressed === key || code === key) && e.ctrlKey === want.ctrl && e.metaKey === want.meta && e.altKey === want.alt && e.shiftKey === want.shift;
}

/** Keeps the address bar on the open note without Next's router (that would remount the page). */
function syncUrl(id: string | null) {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/shed-notes")) return;
  const href = id ? `/shed-notes?id=${encodeURIComponent(id)}` : "/shed-notes";
  if (window.location.pathname + window.location.search !== href) window.history.replaceState(window.history.state, "", href);
}

type Prompt =
  | { kind: "move"; note: NoteMeta }
  | { kind: "rename"; note: NoteMeta }
  | { kind: "new-folder"; parent: string }
  | { kind: "rename-folder"; path: string }
  | { kind: "move-folder"; path: string };

const leafOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

/**
 * Shed Notes: markdown notes like Obsidian — a list of notes in folders on the left, the open note
 * in the middle, its links on the right. `[[Title]]` links notes (with backlinks), notes can hold
 * music notation, and the settings file sets keys, vim mappings and commands.
 */
export default function ShedNotes({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const notes = useNoteList();
  const cfg = useNotesConfig();
  const createMut = useMutation(api.shedNotes.create);
  const removeMut = useMutation(api.shedNotes.remove);
  const moveMut = useMutation(api.shedNotes.move);
  const renameMut = useMutation(api.shedNotes.rename);
  const renameFolderMut = useMutation(api.shedNotes.renameFolder);
  const createFolderMut = useMutation(api.shedNotes.createFolder);
  const deleteFolderMut = useMutation(api.shedNotes.deleteFolder);
  const folderList = useQuery(api.shedNotes.folders);
  const sharedWithMe = useQuery(api.shedNoteShares.sharedWithMe);
  const leaveMut = useMutation(api.shedNoteShares.leave);
  const convex = useConvex();
  const [sharing, setSharing] = useState<NoteMeta | null>(null);
  const [importing, setImporting] = useState(false);
  const [moreMenu, setMoreMenu] = useState<MenuState | null>(null);
  const [printing, setPrinting] = useState<{ id: string; text: string | null } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  const [current, setCurrent] = useState<string | null>(initialId || null);
  const [back, setBack] = useState<string[]>([]);
  const [forward, setForward] = useState<string[]>([]);
  const [focusTitleFor, setFocusTitleFor] = useState<string | null>(null);
  const [palette, setPalette] = useState<{ mode: "commands" | "notes"; items: PaletteItem[] } | null>(null);
  const [notation, setNotation] = useState<{ scoreId: string | null; onDone: (scoreId: string) => void } | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<NoteMeta | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [listQuery, setListQuery] = useState<{ q: string; n: number } | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [{ listHidden, linksHidden }, setPanels] = usePersistedSettings(VIEW_KEY, VIEW_DEFAULTS);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const open = useCallback(
    (id: string | null, opts: { focusTitle?: boolean } = {}) => {
      if (id === current) return;
      if (current) setBack((b) => [...b.slice(-49), current]);
      setForward([]);
      setCurrent(id);
      setFocusTitleFor(opts.focusTitle ? id : null);
      syncUrl(id);
    },
    [current],
  );

  const createNote = useCallback(
    async (title?: string, folder = "") => {
      try {
        const made = await createMut({ title, folder });
        open(made.id, { focusTitle: !title });
        return made.id;
      } catch (e) {
        setNotice(errorText(e));
        return null;
      }
    },
    [createMut, open],
  );

  const noteItems = useCallback(
    (): PaletteItem[] => [...(notes ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).map((n) => ({ id: n.id, label: n.title, detail: n.folder || undefined })),
    [notes],
  );
  // Read when the palette opens (not while rendering), so which commands show depends on whether
  // a note's editor is open right then.
  const commandItemsRef = useRef<() => PaletteItem[]>(() => []);
  const commandItems = useCallback(() => commandItemsRef.current(), []);

  const byKey = useMemo(() => new Map((notes ?? []).map((n) => [titleKey(n.title), n])), [notes]);
  const currentMeta = notes?.find((n) => n.id === current) ?? null;

  const exportAll = useCallback(async () => {
    setNotice("Getting your notes ready…");
    try {
      const data = await convex.query(api.shedNoteShares.exportAll, {});
      if (!data) return;
      saveBlob(notesZip(data), `soniroll notes ${new Date().toISOString().slice(0, 10)}.zip`);
      setNotice(`${data.notes.length} ${data.notes.length === 1 ? "note" : "notes"} exported`);
    } catch (e) {
      setNotice(errorText(e));
    }
  }, [convex]);

  const setConfig = useCallback(
    (key: keyof ShedNotesConfig, value: boolean) => {
      if (!cfg.setValue(key, value)) setNotice("Fix the settings file first — it isn't valid JSON right now.");
    },
    [cfg],
  );

  const actions: NoteActions = useMemo(
    () => ({
      newNote: () => void createNote(),
      openQuickSwitcher: () => setPalette({ mode: "notes", items: noteItems() }),
      openSearch: () => setSearching(true),
      toggleNoteList: () => setPanels({ listHidden: !listHidden }),
      toggleLinksPanel: () => setPanels({ linksHidden: !linksHidden }),
      openCommandPalette: () => setPalette({ mode: "commands", items: commandItems() }),
      openNoteByTitle: (title, o) => {
        const hit = byKey.get(titleKey(title));
        if (hit) open(hit.id);
        // A link to a note that doesn't exist yet: made in the current note's folder.
        else if (o?.create) void createNote(title, currentMeta?.folder ?? "");
      },
      createLinkedNote: async (title) => {
        try {
          await createMut({ title, folder: currentMeta?.folder ?? "" });
        } catch (e) {
          setNotice(errorText(e));
        }
      },
      openScore: (scoreId, onDone) => setNotation({ scoreId, onDone }),
      openPath: (path) => router.push(path),
      setConfig: (key, value) => setConfig(key, value),
      config: () => cfg.config,
      openSettings: () => open(SETTINGS_ID),
      closeNote: () => open(back.length ? back[back.length - 1] : null),
      deleteNote: () => currentMeta && setDeleting(currentMeta),
      moveNote: () => currentMeta && setPrompt({ kind: "move", note: currentMeta }),
      // Only your own notes (a note shared with you isn't in your list).
      shareNote: () => currentMeta && setSharing(currentMeta),
      // What's in the editor right now (even the last second of typing).
      exportPdf: () => current && current !== SETTINGS_ID && setPrinting({ id: current, text: viewRef.current?.state.doc.toString() ?? null }),
      exportAll: () => void exportAll(),
      importNotes: () => setImporting(true),
      goBack: () => {
        if (!back.length) return;
        const prev = back[back.length - 1];
        setBack((b) => b.slice(0, -1));
        if (current) setForward((f) => [current, ...f]);
        setCurrent(prev);
        setFocusTitleFor(null);
        syncUrl(prev);
      },
      goForward: () => {
        if (!forward.length) return;
        const next = forward[0];
        setForward((f) => f.slice(1));
        if (current) setBack((b) => [...b, current]);
        setCurrent(next);
        setFocusTitleFor(null);
        syncUrl(next);
      },
    }),
    [createNote, createMut, byKey, open, setConfig, cfg.config, back, forward, current, currentMeta, noteItems, commandItems, router, setPanels, listHidden, linksHidden, exportAll],
  );
  useEffect(() => {
    commandItemsRef.current = () =>
      availableCommands({ view: viewRef.current, actions }).map((c) => ({ id: c.id, label: c.name, detail: c.id, hint: (() => {
        const key = cfg.config.keybindings.find((b) => b.command === c.id)?.key;
        return key ? keyLabel(key) : undefined;
      })() }));
  }, [actions, cfg.config.keybindings]);

  // "/" outside a note (and any text box) opens the search menu — instead of the site's tool
  // search, which is still in the sidebar. Caught early, before the site's own "/" handler.
  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (palette || notation || prompt || deleting || searching || sharing || printing || importing) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], .cm-editor")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setSearching(true);
    };
    window.addEventListener("keydown", onSlash, true);
    return () => window.removeEventListener("keydown", onSlash, true);
  }, [palette, notation, prompt, deleting, searching, sharing, printing, importing]);

  // App keys (the palette, the switcher, new note) work outside the editor too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (palette || notation || prompt || deleting || searching || sharing || printing || importing) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest(".cm-editor")) return;
      for (const b of cfg.config.keybindings) {
        if (!b.command.startsWith("app:") && !b.command.startsWith("note:") && !b.command.startsWith("view:")) continue;
        if (matchesKey(e, b.key) && runCommand(b.command, { view: viewRef.current, actions })) {
          e.preventDefault();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg.config.keybindings, actions, palette, notation, prompt, deleting, searching, sharing, printing, importing]);

  const listActions = useMemo(
    () => ({
      open: (id: string) => open(id),
      newNote: (folder: string) => void createNote(undefined, folder),
      newFolder: (parent: string) => setPrompt({ kind: "new-folder", parent }),
      rename: (note: NoteMeta) => setPrompt({ kind: "rename", note }),
      move: (note: NoteMeta) => setPrompt({ kind: "move", note }),
      remove: (note: NoteMeta) => setDeleting(note),
      renameFolder: (path: string) => setPrompt({ kind: "rename-folder", path }),
      moveFolderPrompt: (path: string) => setPrompt({ kind: "move-folder", path }),
      deleteFolder: (path: string) => setDeletingFolder(path),
      moveNoteTo: (id: string, folder: string) => void moveMut({ id: id as Id<"shedNotes">, folder }).catch((e) => setNotice(errorText(e))),
      share: (note: NoteMeta) => setSharing(note),
      leave: (id: string) => {
        if (current === id) open(null);
        void leaveMut({ noteId: id as Id<"shedNotes"> }).catch((e) => setNotice(errorText(e)));
      },
      moveFolderTo: (path: string, parent: string) =>
        void renameFolderMut({ from: path, to: parent ? `${parent}/${leafOf(path)}` : leafOf(path) }).catch((e) => setNotice(errorText(e))),
    }),
    [open, createNote, moveMut, renameFolderMut, leaveMut, current],
  );

  async function submitPrompt(value: string) {
    const p = prompt;
    setPrompt(null);
    if (!p) return;
    try {
      if (p.kind === "move") await moveMut({ id: p.note.id as Id<"shedNotes">, folder: value });
      else if (p.kind === "rename") await renameMut({ id: p.note.id as Id<"shedNotes">, title: value });
      // A new folder is just a folder (it can stay empty).
      else if (p.kind === "new-folder") await createFolderMut({ path: p.parent ? `${p.parent}/${value}` : value });
      // Renaming keeps it where it is; Move takes the folder to put it in.
      else if (p.kind === "rename-folder") {
        const parent = parentOf(p.path);
        await renameFolderMut({ from: p.path, to: parent ? `${parent}/${value}` : value });
      } else await renameFolderMut({ from: p.path, to: value ? `${value}/${leafOf(p.path)}` : leafOf(p.path) });
    } catch (e) {
      setNotice(errorText(e));
    }
  }

  if (notes === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:h-full lg:flex-row lg:gap-6 lg:px-6 lg:pb-4 lg:pt-6">
      <aside className={`min-h-0 flex-col gap-3 lg:w-72 lg:shrink-0 ${current ? "hidden" : "flex"} ${current && listHidden ? "" : "lg:flex"}`}>
        <div className="flex items-center gap-2">
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <DocumentIcon className="h-6 w-6 shrink-0 text-accent sm:h-7 sm:w-7" /> <span className="truncate">Shed Notes</span>
          </h1>
          <button type="button" onClick={() => setSearching(true)} aria-label="Search notes" title={`Search notes (/ or ${keyLabel("Mod-Shift-f")})`} className="shrink-0 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground">
            <SearchIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setMoreMenu({
                x: Math.max(8, r.right - 240),
                y: r.bottom + 4,
                items: [
                  { label: "Export all as Markdown (.zip)", onSelect: () => void exportAll() },
                  { label: "Import notes…", onSelect: () => setImporting(true) },
                ],
              });
            }}
            aria-label="Export or import notes"
            title="Export or import notes"
            className="shrink-0 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground"
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => open(SETTINGS_ID)} aria-label="Settings file" title="Settings file" className={`shrink-0 rounded-full p-2 ${current === SETTINGS_ID ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}>
            <GearIcon className="h-4 w-4" />
          </button>
        </div>
        <NoteList key={listQuery?.n ?? 0} notes={notes} folders={folderList ?? []} shared={sharedWithMe ?? []} currentId={current} actions={listActions} initialQuery={listQuery?.q} />
      </aside>

      <section className={`min-h-0 min-w-0 flex-1 flex-col ${current ? "flex" : "hidden lg:flex"}`}>
        {current === SETTINGS_ID ? (
          <>
            <button type="button" onClick={() => open(null)} className="mb-3 self-start rounded-full bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-hover lg:hidden">
              ‹ Notes
            </button>
            <SettingsPane text={cfg.text} setText={cfg.setText} config={cfg.config} errors={cfg.errors} broken={cfg.broken} actions={actions} />
          </>
        ) : current ? (
          <NotePane
            key={current}
            id={current}
            notes={notes}
            config={cfg.config}
            actions={actions}
            setConfig={setConfig}
            focusTitle={focusTitleFor === current}
            onBackToList={() => open(null)}
            canBack={back.length > 0}
            canForward={forward.length > 0}
            onView={(v) => {
              viewRef.current = v;
            }}
            onNotice={setNotice}
            onTag={(tag) => setListQuery((q) => ({ q: `#${tag}`, n: (q?.n ?? 0) + 1 }))}
            onOpen={(id) => open(id)}
            listOpen={!listHidden}
            onToggleList={() => setPanels({ listHidden: !listHidden })}
            linksOpen={!linksHidden}
            onToggleLinks={() => setPanels({ linksHidden: !linksHidden })}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-foreground/10 p-10 text-center">
            <DocumentIcon className="h-10 w-10 text-accent" />
            <div>
              <p className="text-lg font-bold">{notes.length ? "Pick a note, or start a new one" : "Your first note"}</p>
              <p className="mt-1 max-w-sm text-sm text-muted">Notes are markdown. Link them with [[Title]], write notation, and attach them to your routines and tunes.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => void createNote()} className="flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                <PlusIcon className="h-4 w-4" /> New note
              </button>
              {notes.length > 0 && (
                <button type="button" onClick={() => setPalette({ mode: "notes", items: noteItems() })} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
                  Open a note
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {palette && (
        <Palette
          placeholder={palette.mode === "commands" ? "Type a command" : "Find or make a note"}
          items={palette.items}
          onClose={() => {
            setPalette(null);
            viewRef.current?.focus();
          }}
          onPick={(item) => {
            setPalette(null);
            if (palette.mode === "commands") {
              requestAnimationFrame(() => runCommand(item.id, { view: viewRef.current, actions }));
            } else open(item.id);
          }}
          onCreate={
            palette.mode === "notes"
              ? (title) => {
                  setPalette(null);
                  void createNote(title);
                }
              : undefined
          }
        />
      )}
      {searching && (
        <NoteSearch
          notes={notes}
          onOpen={(id) => {
            setSearching(false);
            open(id);
          }}
          onClose={() => {
            setSearching(false);
            viewRef.current?.focus();
          }}
        />
      )}
      {notation && (
        <ScoreDialog
            scoreId={notation.scoreId}
            onClose={() => {
              setNotation(null);
              viewRef.current?.focus();
            }}
            onDone={(id) => notation.onDone(id)}
          />
      )}
      {prompt && (
        <PromptDialog
          title={
            prompt.kind === "move"
              ? "Move to folder"
              : prompt.kind === "rename"
                ? "Rename note"
                : prompt.kind === "new-folder"
                  ? prompt.parent
                    ? `New folder in ${leafOf(prompt.parent)}`
                    : "New folder"
                  : prompt.kind === "move-folder"
                    ? `Move "${leafOf(prompt.path)}" into…`
                    : "Rename folder"
          }
          initialValue={
            prompt.kind === "move" ? prompt.note.folder : prompt.kind === "rename" ? prompt.note.title : prompt.kind === "rename-folder" ? leafOf(prompt.path) : prompt.kind === "move-folder" ? parentOf(prompt.path) : ""
          }
          placeholder={prompt.kind === "move" || prompt.kind === "move-folder" ? "Folder (blank for the top level), e.g. Scales/Major" : prompt.kind === "new-folder" ? "Folder name" : undefined}
          confirmLabel={prompt.kind === "move" || prompt.kind === "move-folder" ? "Move" : prompt.kind === "new-folder" ? "Make folder" : "Rename"}
          allowEmpty={prompt.kind === "move" || prompt.kind === "move-folder"}
          onSubmit={(v) => void submitPrompt(v)}
          onCancel={() => setPrompt(null)}
        />
      )}
      {moreMenu && <ContextMenu menu={moreMenu} onClose={() => setMoreMenu(null)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={setNotice} />}
      {printing && <PrintNote id={printing.id} text={printing.text} onClose={() => setPrinting(null)} />}
      {sharing && <ShareDialog noteId={sharing.id} title={sharing.title} onClose={() => setSharing(null)} />}
      {deletingFolder !== null && (
        <ConfirmDialog
          title={`Delete the folder "${leafOf(deletingFolder)}"?`}
          message={`What's in it (notes and folders) moves up to ${parentOf(deletingFolder) ? `"${leafOf(parentOf(deletingFolder))}"` : "the top level"}. No notes are deleted.`}
          confirmLabel="Delete folder"
          onConfirm={() => {
            const path = deletingFolder;
            setDeletingFolder(null);
            deleteFolderMut({ path }).catch((e) => setNotice(errorText(e)));
          }}
          onCancel={() => setDeletingFolder(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.title}"?`}
          message="The note goes for good. Links to it in other notes stay, and make a new note if you open them."
          confirmLabel="Delete"
          onConfirm={() => {
            const note = deleting;
            setDeleting(null);
            if (current === note.id) open(back.length ? back[back.length - 1] : null);
            removeMut({ id: note.id as Id<"shedNotes"> }).catch((e) => setNotice(errorText(e)));
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {notice}
        </div>
      )}
    </main>
  );
}

/** Export as PDF for one of your notes (or one shared with you). */
function PrintNote({ id, text, onClose }: { id: string; text: string | null; onClose: () => void }) {
  const note = useQuery(api.shedNotes.get, { id });
  if (!note) return null;
  return (
    <NotePrint
      title={note.title}
      body={text ?? note.body}
      context={note.role === "owner" ? undefined : { noteId: id }}
      fontFamily={note.view?.font ? getFont(note.view.font).stack : undefined}
      onClose={onClose}
    />
  );
}
