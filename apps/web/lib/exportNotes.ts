import { makeZip, readZip, safeName, type ZipEntry } from "./zip";

const ROOT = "soniroll notes";
/** Beside the notes in an export: each file's exact title, folder and look (file names can't hold
    every character a title can), so importing it puts everything back as it was. */
export const META_FILE = "soniroll-notes.json";

type View = { fullWidth?: boolean; font?: string };
export type ExportedNote = { title: string; folder: string; body: string; view?: View | null; createdAt?: number; updatedAt: number };
type Meta = { app: "soniroll"; kind: "shed-notes"; version: 1; exportedAt: string; folders: string[]; notes: { file: string; title: string; folder: string; view?: View; createdAt?: number; updatedAt?: number }[] };

/** Every note as a Markdown file in its folder (empty folders too), zipped. Names that would
    clash once made safe for a file system get " (2)", " (3)"… */
export function notesZip(data: { notes: ExportedNote[]; folders: string[] }): Blob {
  const dir = (folder: string) => [ROOT, ...folder.split("/").filter(Boolean).map(safeName)].join("/");
  const folders = new Set<string>();
  const addFolder = (folder: string) => {
    const parts = folder.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  };
  for (const f of data.folders) addFolder(f);
  for (const n of data.notes) addFolder(n.folder);

  const entries: ZipEntry[] = [{ path: `${ROOT}/` }, ...[...folders].sort().map((f) => ({ path: `${dir(f)}/` }))];
  const meta: Meta = { app: "soniroll", kind: "shed-notes", version: 1, exportedAt: new Date().toISOString(), folders: [...folders].sort(), notes: [] };
  const taken = new Set<string>();
  for (const n of [...data.notes].sort((a, b) => a.title.localeCompare(b.title))) {
    const base = `${dir(n.folder)}/${safeName(n.title)}`;
    let path = `${base}.md`;
    for (let i = 2; taken.has(path.toLowerCase()); i++) path = `${base} (${i}).md`;
    taken.add(path.toLowerCase());
    entries.push({ path, data: n.body, modified: new Date(n.updatedAt) });
    meta.notes.push({ file: path.slice(ROOT.length + 1), title: n.title, folder: n.folder, ...(n.view ? { view: n.view } : {}), createdAt: n.createdAt, updatedAt: n.updatedAt });
  }
  entries.push({ path: `${ROOT}/${META_FILE}`, data: JSON.stringify(meta, null, 2) });
  return makeZip(entries);
}

export function saveBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export type ImportNote = { title: string; folder: string; body: string; view?: View; createdAt?: number; updatedAt?: number };

const NOTE_FILE = /\.(md|markdown|txt)$/i;

/** Notes from files: an export's .zip, any .zip of Markdown, a picked folder, or loose .md files.
    With the export's metadata file, titles, folders and looks come back exactly; without it, the
    folders come from the paths and each title from its file name. Hidden folders (".obsidian")
    are skipped. */
export async function readNoteFiles(files: File[]): Promise<{ notes: ImportNote[]; folders: string[] }> {
  const dec = new TextDecoder();
  // Each .zip is read on its own; loose files (or a picked folder) together.
  const groups: { path: string; text: string }[][] = [];
  const loose: { path: string; text: string }[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const zipped = await readZip(await f.arrayBuffer());
      groups.push(zipped.filter((z) => NOTE_FILE.test(z.path) || z.path.endsWith(META_FILE)).map((z) => ({ path: z.path, text: dec.decode(z.data) })));
    } else loose.push({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, text: await f.text() });
  }
  if (loose.length) groups.push(loose);
  const notes: ImportNote[] = [];
  const folders = new Set<string>();
  for (const g of groups) {
    const r = readGroup(g);
    notes.push(...r.notes);
    r.folders.forEach((f) => folders.add(f));
  }
  return { notes, folders: [...folders] };
}

function readGroup(all: { path: string; text: string }[]): { notes: ImportNote[]; folders: string[] } {
  const entries = all.filter((e) => !e.path.split("/").some((p) => p.startsWith(".") || p === "__MACOSX"));

  // Paths below the folder everything shares ("soniroll notes/…" or the folder you picked).
  const split = entries.map((e) => e.path.split("/"));
  let common = 0;
  while (split.length && split.every((p) => p.length > common + 1 && p[common] === split[0][common])) common++;
  const rel = (path: string) => path.split("/").slice(common).join("/");

  const metaEntry = entries.find((e) => rel(e.path) === META_FILE);
  let meta: Meta | null = null;
  try {
    const parsed = metaEntry ? JSON.parse(metaEntry.text) : null;
    if (parsed?.kind === "shed-notes" && Array.isArray(parsed.notes)) meta = parsed;
  } catch {
    meta = null;
  }

  const byPath = new Map(entries.filter((e) => NOTE_FILE.test(e.path)).map((e) => [rel(e.path), e.text]));
  const notes: ImportNote[] = [];
  const used = new Set<string>();
  for (const m of meta?.notes ?? []) {
    const body = byPath.get(m.file);
    if (body === undefined || typeof m.title !== "string") continue;
    used.add(m.file);
    notes.push({ title: m.title, folder: typeof m.folder === "string" ? m.folder : "", body, view: m.view, createdAt: m.createdAt, updatedAt: m.updatedAt });
  }
  const folders = new Set<string>(Array.isArray(meta?.folders) ? meta.folders.filter((f) => typeof f === "string") : []);
  for (const [path, body] of byPath) {
    if (used.has(path)) continue;
    const parts = path.split("/");
    const name = parts.pop()!.replace(NOTE_FILE, "");
    const folder = parts.join("/");
    if (folder) folders.add(folder);
    notes.push({ title: name, folder, body });
  }
  return { notes, folders: [...folders] };
}
