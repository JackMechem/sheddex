/**
 * What a student can hand in for an assignment, and which kinds of file a teacher can ask for —
 * shared by the backend (which checks uploads) and the site (the file picker's `accept`).
 */

export type SubmitConfig = {
  /** Hand in a file (or a few). */
  file: boolean;
  /** Type an answer. */
  text: boolean;
  /** Paste a link (a video, a recording, a doc). */
  link: boolean;
  /** Which kinds of file (`FILE_KINDS` ids; empty or "any" = any file). */
  fileKinds: string[];
  /** Extra extensions the teacher typed (".band", ".logicx"). */
  extensions: string[];
};

export type FileKind = { id: string; label: string; mimes: string[]; extensions: string[] };

export const FILE_KINDS: FileKind[] = [
  { id: "audio", label: "Audio", mimes: ["audio/"], extensions: [".mp3", ".m4a", ".wav", ".aif", ".aiff", ".flac", ".ogg", ".opus", ".aac", ".caf"] },
  { id: "video", label: "Video", mimes: ["video/"], extensions: [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"] },
  { id: "pdf", label: "PDF", mimes: ["application/pdf"], extensions: [".pdf"] },
  { id: "image", label: "Images", mimes: ["image/"], extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"] },
  {
    id: "notation",
    label: "Notation & MIDI",
    mimes: ["audio/midi", "audio/x-midi", "application/vnd.recordare.musicxml"],
    extensions: [".musicxml", ".mxl", ".xml", ".mscz", ".mscx", ".sib", ".musx", ".mus", ".dorico", ".mid", ".midi", ".gp", ".gpx", ".gp5"],
  },
  {
    id: "document",
    label: "Documents",
    mimes: ["text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/rtf"],
    extensions: [".doc", ".docx", ".odt", ".rtf", ".txt", ".md", ".pages"],
  },
  { id: "any", label: "Any file", mimes: [], extensions: [] },
];

export const MAX_SUBMIT_FILES = 5;
export const MAX_SUBMIT_MB = 100;
export const MAX_SUBMIT_LINKS = 5;

const EXT = /^\.[a-z0-9]{1,12}$/;

export function cleanExtension(raw: string): string | null {
  const e = raw
    .trim()
    .toLowerCase()
    .replace(/^\*?\.?/, ".");
  return EXT.test(e) ? e : null;
}

/** Checks over a config from the client; `null` when nothing can be handed in. */
export function cleanSubmitConfig(raw: unknown): SubmitConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SubmitConfig>;
  const known = new Set(FILE_KINDS.map((k) => k.id));
  const config: SubmitConfig = {
    file: !!r.file,
    text: !!r.text,
    link: !!r.link,
    fileKinds: Array.isArray(r.fileKinds) ? [...new Set(r.fileKinds.filter((k) => typeof k === "string" && known.has(k)))] : [],
    extensions: Array.isArray(r.extensions)
      ? [...new Set(r.extensions.map((e) => (typeof e === "string" ? cleanExtension(e) : null)).filter((e): e is string => !!e))].slice(0, 20)
      : [],
  };
  return config.file || config.text || config.link ? config : null;
}

const anyFile = (c: SubmitConfig) => (c.fileKinds.length === 0 && c.extensions.length === 0) || c.fileKinds.includes("any");

/** The file picker's `accept` attribute ("" = anything). */
export function acceptAttr(c: SubmitConfig): string {
  if (anyFile(c)) return "";
  const parts: string[] = [];
  for (const k of FILE_KINDS) if (c.fileKinds.includes(k.id)) parts.push(...k.mimes.map((m) => (m.endsWith("/") ? `${m}*` : m)), ...k.extensions);
  parts.push(...c.extensions);
  return [...new Set(parts)].join(",");
}

/** Whether a file (by name and MIME type) is one the teacher asked for. */
export function fileAllowed(c: SubmitConfig, name: string, mime: string): boolean {
  if (anyFile(c)) return true;
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if (c.extensions.includes(ext)) return true;
  return FILE_KINDS.some(
    (k) => c.fileKinds.includes(k.id) && (k.extensions.includes(ext) || (!!mime && k.mimes.some((m) => (m.endsWith("/") ? mime.startsWith(m) : mime === m)))),
  );
}

/** "Audio or PDF" / "any file". */
export function describeFiles(c: SubmitConfig): string {
  if (anyFile(c)) return "any file";
  const names = [...FILE_KINDS.filter((k) => c.fileKinds.includes(k.id)).map((k) => k.label.toLowerCase()), ...c.extensions];
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/** "a file (audio), text or a link". */
export function describeSubmit(c: SubmitConfig): string {
  const parts = [...(c.file ? [`a file (${describeFiles(c)})`] : []), ...(c.text ? ["text"] : []), ...(c.link ? ["a link"] : [])];
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} or ${parts.at(-1)}`;
}

export function cleanLink(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- features

/** The parts of Lessons a teacher can switch on or off. Off hides them (nothing is deleted). */
export type LessonFeatures = { scheduling: boolean; notes: boolean; files: boolean; charts: boolean; assignments: boolean; routines: boolean };

export const DEFAULT_FEATURES: LessonFeatures = { scheduling: true, notes: true, files: true, charts: true, assignments: true, routines: true };

export const FEATURE_INFO: { id: keyof LessonFeatures; label: string; text: string }[] = [
  { id: "assignments", label: "Assignments", text: "Work with a due date; students hand in files, text or links, and you give feedback." },
  { id: "notes", label: "Lesson notes", text: "Rich-text notes inside each lesson." },
  { id: "routines", label: "Shed Log routines", text: "Practice routines that go straight into their Shed Log, with a day-by-day report." },
  { id: "files", label: "Files", text: "PDFs, images and audio for your students." },
  { id: "charts", label: "Chord charts", text: "Copies of your chord charts they can save." },
  { id: "scheduling", label: "Lesson booking", text: "Offer times by email, take requests from your teaching hours, calendar invites." },
];

export function cleanFeatures(raw: unknown): LessonFeatures {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LessonFeatures>;
  const out = { ...DEFAULT_FEATURES };
  for (const k of Object.keys(DEFAULT_FEATURES) as (keyof LessonFeatures)[]) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  return out;
}

/** The lesson item kind each feature covers. */
export const FEATURE_OF_KIND: Record<string, keyof LessonFeatures> = { note: "notes", file: "files", chart: "charts", assignment: "assignments", routine: "routines" };
