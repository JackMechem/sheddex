"use client";

import { useQuery } from "convex/react";
import { useDeferredValue, useMemo, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import { ChevronRightIcon, DocumentIcon, DotsVerticalIcon, PlusIcon, SearchIcon } from "@/components/tools";
import type { NoteMeta } from "@/lib/useShedNotes";

type Folder = { name: string; path: string; folders: Folder[]; notes: NoteMeta[] };

function buildTree(notes: NoteMeta[]): Folder {
  const root: Folder = { name: "", path: "", folders: [], notes: [] };
  for (const n of notes) {
    let at = root;
    if (n.folder) {
      for (const part of n.folder.split("/")) {
        const path = at.path ? `${at.path}/${part}` : part;
        let next = at.folders.find((f) => f.name === part);
        if (!next) {
          next = { name: part, path, folders: [], notes: [] };
          at.folders.push(next);
        }
        at = next;
      }
    }
    at.notes.push(n);
  }
  const sort = (f: Folder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name));
    f.notes.sort((a, b) => a.title.localeCompare(b.title));
    f.folders.forEach(sort);
  };
  sort(root);
  return root;
}

const count = (f: Folder): number => f.notes.length + f.folders.reduce((s, c) => s + count(c), 0);

export type NoteListActions = {
  open: (id: string) => void;
  newNote: (folder: string) => void;
  newFolder: (parent: string) => void;
  rename: (note: NoteMeta) => void;
  move: (note: NoteMeta) => void;
  remove: (note: NoteMeta) => void;
  renameFolder: (path: string) => void;
};

/** The notes, as folders (A–Z) or most recently edited first, with a search box that matches
    titles, folders and #tags right away and the notes' text from the server. */
export default function NoteList({ notes, currentId, actions, initialQuery = "" }: { notes: NoteMeta[]; currentId: string | null; actions: NoteListActions; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [sort, setSort] = useState<"folders" | "recent">("folders");
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const query = q.trim().toLowerCase();
  const deferred = useDeferredValue(query);
  const textHits = useQuery(api.shedNotes.search, deferred.length >= 2 && !deferred.startsWith("#") ? { q: deferred } : "skip");

  const tree = useMemo(() => buildTree(notes), [notes]);
  const recent = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);
  const titleHits = useMemo(() => {
    if (!query) return [];
    if (query.startsWith("#")) {
      const tag = query.slice(1);
      return notes.filter((n) => n.tags.some((t) => t === tag || t.startsWith(`${tag}/`)));
    }
    return notes.filter((n) => n.title.toLowerCase().includes(query) || n.folder.toLowerCase().includes(query));
  }, [notes, query]);
  const titleIds = new Set(titleHits.map((n) => n.id));
  const bodyHits = (textHits ?? []).filter((h) => !titleIds.has(h.id));

  function noteMenu(e: React.MouseEvent, n: NoteMeta) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Open", onSelect: () => actions.open(n.id) },
        { label: "Rename", onSelect: () => actions.rename(n) },
        { label: "Move to folder", onSelect: () => actions.move(n) },
        { label: "Delete", danger: true, onSelect: () => actions.remove(n) },
      ],
    });
  }
  function folderMenu(e: React.MouseEvent, path: string) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "New note here", onSelect: () => actions.newNote(path) },
        { label: "New folder inside", onSelect: () => actions.newFolder(path) },
        { label: "Rename folder", onSelect: () => actions.renameFolder(path) },
      ],
    });
  }

  const noteRow = (n: NoteMeta, depth: number, detail?: string) => (
    <li key={n.id}>
      <div
        className={`group flex items-center rounded-lg ${n.id === currentId ? "bg-accent/15 text-foreground" : "hover:bg-surface-hover"}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onContextMenu={(e) => noteMenu(e, n)}
      >
        <button type="button" onClick={() => actions.open(n.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
          <DocumentIcon className={`h-3.5 w-3.5 shrink-0 ${n.id === currentId ? "text-accent" : "text-muted"}`} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${n.id === currentId ? "font-semibold" : ""}`}>{n.title}</span>
            {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
          </span>
        </button>
        <button type="button" onClick={(e) => noteMenu(e, n)} aria-label={`Options for ${n.title}`} className="mr-1 shrink-0 rounded-md p-1 text-muted opacity-100 hover:bg-background hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100">
          <DotsVerticalIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );

  const folderRows = (f: Folder, depth: number): React.ReactNode[] =>
    f.folders.map((c) => {
      const isClosed = closed.has(c.path);
      return (
        <li key={`folder:${c.path}`}>
          <div className="group flex items-center rounded-lg hover:bg-surface-hover" style={{ paddingLeft: 2 + depth * 14 }} onContextMenu={(e) => folderMenu(e, c.path)}>
            <button
              type="button"
              aria-expanded={!isClosed}
              onClick={() =>
                setClosed((s) => {
                  const next = new Set(s);
                  if (next.has(c.path)) next.delete(c.path);
                  else next.add(c.path);
                  return next;
                })
              }
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
            >
              <ChevronRightIcon className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isClosed ? "" : "rotate-90"}`} />
              <span className="truncate text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-muted">{count(c)}</span>
            </button>
            <button type="button" onClick={(e) => folderMenu(e, c.path)} aria-label={`Options for folder ${c.name}`} className="mr-1 shrink-0 rounded-md p-1 text-muted hover:bg-background hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100">
              <DotsVerticalIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {!isClosed && <ul>{[...folderRows(c, depth + 1), ...c.notes.map((n) => noteRow(n, depth + 1))]}</ul>}
        </li>
      );
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-3 py-1.5 focus-within:ring-2 focus-within:ring-accent">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes or #tags" aria-label="Search notes" className="min-w-0 flex-1 bg-transparent text-base outline-none lg:text-sm" />
        </label>
        <button type="button" onClick={() => actions.newNote("")} className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
          <PlusIcon className="h-4 w-4" /> New
        </button>
      </div>
      {!query && (
        <div className="flex items-center gap-1 text-xs">
          {(["folders", "recent"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSort(s)} className={`rounded-full px-2.5 py-1 font-semibold ${sort === s ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>
              {s === "folders" ? "Folders" : "Recent"}
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={() => actions.newFolder("")} className="rounded-full px-2.5 py-1 font-semibold text-muted hover:text-foreground">
            New folder
          </button>
        </div>
      )}
      <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {query ? (
          <>
            {titleHits.map((n) => noteRow(n, 0, n.folder || undefined))}
            {bodyHits.length > 0 && <li className="px-2 pb-1 pt-3 text-xs font-semibold text-muted">In the text</li>}
            {bodyHits.map((h) => {
              const meta = notes.find((n) => n.id === h.id);
              return meta ? noteRow(meta, 0, h.snippet) : null;
            })}
            {titleHits.length === 0 && bodyHits.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">{textHits === undefined && deferred.length >= 2 && !deferred.startsWith("#") ? "Searching…" : "No notes match."}</li>}
          </>
        ) : sort === "recent" ? (
          recent.map((n) => noteRow(n, 0, n.folder || undefined))
        ) : (
          [...folderRows(tree, 0), ...tree.notes.map((n) => noteRow(n, 0))]
        )}
        {!query && notes.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">No notes yet. Make one with New.</li>}
      </ul>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
