"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import PromptDialog from "@/components/PromptDialog";
import { MenuButton, menuPosition } from "@/components/library/shared";
import { TuneSelectDialog } from "@/components/recordings/RecordingParts";
import { tint } from "@/components/library/ui";
import { CloseIcon, DocumentIcon, DownloadIcon, FileIcon, ImageIcon, LinkIcon, MicIcon, NoteIcon, PencilIcon, SearchIcon, TrashIcon, UploadIcon, VideoIcon } from "@/components/tools";
import {
  type FileKind,
  type UserFile,
  FILE_KIND_LABEL,
  canPreview,
  errorText,
  fileKind,
  filesApi,
  formatBytes,
  formatFileDate,
  uploadFile,
} from "@/lib/files";

// ---------------------------------------------------------------- icons

const KIND_COLOR: Record<FileKind, string> = {
  pdf: "var(--cat-0, var(--accent))",
  image: "var(--cat-1, var(--accent))",
  audio: "var(--cat-2, var(--accent))",
  video: "var(--cat-3, var(--accent))",
  notation: "var(--cat-4, var(--accent))",
  document: "var(--cat-5, var(--accent))",
  other: "var(--muted)",
};

const KIND_ICON: Record<FileKind, React.ComponentType<{ className?: string }>> = {
  pdf: DocumentIcon,
  image: ImageIcon,
  audio: MicIcon,
  video: VideoIcon,
  notation: NoteIcon,
  document: DocumentIcon,
  other: FileIcon,
};

/** A file's type as a small coloured tile. */
export function FileTypeIcon({ kind, size = "md" }: { kind: FileKind; size?: "sm" | "md" | "lg" }) {
  const Icon = KIND_ICON[kind];
  const color = KIND_COLOR[kind];
  const dims = size === "lg" ? "h-14 w-14 rounded-2xl" : size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center ${dims}`} style={{ background: tint(color, 16), color }} aria-hidden>
      <Icon className={size === "lg" ? "h-7 w-7" : "h-4 w-4"} />
    </span>
  );
}

// ---------------------------------------------------------------- rows

/** One file in a list: type icon, name, a detail line, and an optional ⋮ menu. Clicking opens it. */
export function FileRow({
  name,
  mimeType,
  detail,
  onOpen,
  onMenu,
  trailing,
}: {
  name: string;
  mimeType: string;
  detail: string;
  onOpen: () => void;
  onMenu?: (e: React.MouseEvent) => void;
  trailing?: ReactNode;
}) {
  const kind = fileKind(mimeType, name);
  return (
    <div className="group flex items-center gap-1 rounded-xl hover:bg-surface-hover">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left">
        <FileTypeIcon kind={kind} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
      </button>
      {trailing}
      {onMenu && <MenuButton label={`Options for ${name}`} onClick={onMenu} />}
    </div>
  );
}

/** "PDF · 2.4 MB · Oct 8". */
export function fileDetail(file: { name: string; mimeType: string; size: number; createdAt: number }, extra?: string | null) {
  return [FILE_KIND_LABEL[fileKind(file.mimeType, file.name)], formatBytes(file.size), formatFileDate(file.createdAt), extra].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------- preview

export type PreviewFile = { name: string; mimeType: string; size: number; createdAt: number; url: string | null };

/** A file opened full size: the PDF, image, audio or video itself, or a download for anything the
    browser can't show. `actions` adds buttons (rename, delete, …) for your own files. */
export function FilePreviewDialog({ file, actions, onClose }: { file: PreviewFile; actions?: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const kind = fileKind(file.mimeType, file.name);
  const url = file.url;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-overlay p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={file.name}
        className="flex w-full max-w-5xl flex-col overflow-hidden bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-foreground/[0.06] px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-3">
          <FileTypeIcon kind={kind} size="sm" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-bold">{file.name}</h2>
            <p className="truncate text-xs text-muted">{fileDetail(file)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background">
          {!url ? (
            <p className="p-8 text-sm text-muted">This file isn&apos;t available.</p>
          ) : kind === "pdf" ? (
            <iframe src={url} title={file.name} className="h-full min-h-[60vh] w-full border-0" />
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.name} className="max-h-full max-w-full object-contain p-2" />
          ) : kind === "audio" ? (
            <div className="flex w-full max-w-lg flex-col items-center gap-4 p-8">
              <FileTypeIcon kind="audio" size="lg" />
              <audio controls autoPlay src={url} className="w-full" />
            </div>
          ) : kind === "video" ? (
            <video controls autoPlay src={url} className="max-h-full max-w-full" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <FileTypeIcon kind={kind} size="lg" />
              <p className="text-sm text-muted">This kind of file can&apos;t be shown here — download it to open it.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-foreground/[0.06] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-3">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" download={file.name} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              <DownloadIcon className="h-4 w-4" />
              {canPreview(kind) ? "Open in a new tab" : "Download"}
            </a>
          )}
          {actions}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const actionBtn = "inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-3.5 text-sm font-semibold hover:bg-surface-hover";

// ---------------------------------------------------------------- uploading

/**
 * Uploading one or more files to the account, optionally attached to a tune: `pick()` opens the
 * file chooser, `drop` props make an element a drop target, and `input` must be rendered.
 */
export function useFileUploader(tuneId?: string) {
  const generateUploadUrl = useMutation(filesApi.generateUploadUrl);
  const create = useMutation(filesApi.create);
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const uploadAll = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setError(null);
      setProgress({ done: 0, total: files.length });
      const failures: string[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          await uploadFile(files[i], () => generateUploadUrl(), (args) => create(args), tuneId);
        } catch (e) {
          failures.push(errorText(e, `Couldn't upload "${files[i].name}".`));
          // Out of room: the rest won't fit either.
          if (/room|full|paused/i.test(failures[failures.length - 1])) break;
        }
        setProgress({ done: i + 1, total: files.length });
      }
      setProgress(null);
      if (failures.length) setError(failures.join(" "));
    },
    [create, generateUploadUrl, tuneId],
  );

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        void uploadAll(files);
      }}
    />
  );

  const drop = {
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setDragging(false);
      void uploadAll(Array.from(e.dataTransfer.files));
    },
  };

  return { pick: () => inputRef.current?.click(), input, drop, dragging, progress, error, clearError: () => setError(null) };
}

/** "Uploading 2 of 5…" while files go up. */
export function UploadProgress({ progress }: { progress: { done: number; total: number } | null }) {
  if (!progress) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <LoadingSpinner size="sm" inline label="Uploading" />
      Uploading {progress.total > 1 ? `${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ""}…
    </div>
  );
}

// ---------------------------------------------------------------- managing your own files

/**
 * The ⋮ menu, preview and dialogs for your own files: open, rename, attach to a tune (or another
 * tune), detach, delete. `tuneNames` shows which tune a file is on; `hereTuneId` (on a tune's page)
 * offers "Remove from this tune" instead of "Change tune".
 */
export function useFileActions({ tuneName, hereTuneId }: { tuneName: (tuneId: string) => string | undefined; hereTuneId?: string }) {
  const update = useMutation(filesApi.update);
  const remove = useMutation(filesApi.remove);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [open, setOpen] = useState<UserFile | null>(null);
  const [renaming, setRenaming] = useState<UserFile | null>(null);
  const [linking, setLinking] = useState<UserFile | null>(null);
  const [deleting, setDeleting] = useState<UserFile | null>(null);

  function items(file: UserFile) {
    const onTune = file.tuneId ? tuneName(file.tuneId) : undefined;
    return [
      { label: "Open", onSelect: () => setOpen(file), icon: <FileIcon className="h-4 w-4" /> },
      { label: "Rename", onSelect: () => setRenaming(file), icon: <PencilIcon className="h-4 w-4" /> },
      ...(hereTuneId && file.tuneId === hereTuneId
        ? [{ label: "Remove from this tune", onSelect: () => void update({ id: file._id, tuneId: null }), icon: <LinkIcon className="h-4 w-4" /> }]
        : [
            { label: file.tuneId ? "Move to another tune" : "Attach to a tune", onSelect: () => setLinking(file), icon: <LinkIcon className="h-4 w-4" /> },
            ...(file.tuneId ? [{ label: `Detach from ${onTune ?? "its tune"}`, onSelect: () => void update({ id: file._id, tuneId: null }) }] : []),
          ]),
      { label: "Delete", onSelect: () => setDeleting(file), danger: true, icon: <TrashIcon className="h-4 w-4" /> },
    ];
  }

  const openMenu = (file: UserFile, e: React.MouseEvent) => setMenu({ ...menuPosition(e), items: items(file) });

  const stacked = (
    <>
      {renaming && (
        <PromptDialog
          title="Rename file"
          initialValue={renaming.name}
          confirmLabel="Rename"
          onSubmit={(name) => {
            void update({ id: renaming._id, name });
            if (open?._id === renaming._id) setOpen({ ...open, name: name.trim() || open.name });
            setRenaming(null);
          }}
          onCancel={() => setRenaming(null)}
        />
      )}
      {linking && (
        <TuneSelectDialog
          onPick={(tuneId) => {
            void update({ id: linking._id, tuneId });
            if (open?._id === linking._id) setOpen({ ...open, tuneId });
            setLinking(null);
          }}
          onClose={() => setLinking(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          message="The file is deleted from your account for good. If the tune it's on is shared, it disappears from the link too."
          confirmLabel="Delete"
          onConfirm={() => {
            void remove({ id: deleting._id });
            if (open?._id === deleting._id) setOpen(null);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );

  const dialogs = (
    <>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {open && (
        <FilePreviewDialog
          file={open}
          onClose={() => setOpen(null)}
          actions={
            <>
              <button type="button" className={actionBtn} onClick={() => setRenaming(open)}>
                <PencilIcon className="h-4 w-4" /> Rename
              </button>
              <button type="button" className={actionBtn} onClick={() => setLinking(open)}>
                <LinkIcon className="h-4 w-4" /> {open.tuneId ? `On ${tuneName(open.tuneId) ?? "a tune"}` : "Attach to a tune"}
              </button>
              <button type="button" className={`${actionBtn} ml-auto text-danger`} onClick={() => setDeleting(open)}>
                <TrashIcon className="h-4 w-4" /> Delete
              </button>
            </>
          }
        />
      )}
      {/* Above the preview, which they can be opened from. */}
      {(renaming || linking || deleting) && createPortal(<div className="relative z-[80]">{stacked}</div>, document.body)}
    </>
  );

  return { openMenu, openFile: setOpen, dialogs };
}

// ---------------------------------------------------------------- picking files already uploaded

/** Pick files you've already uploaded to attach to a tune. Ones on this tune aren't offered; ones
    on another tune say so (attaching moves them). */
export function FileSelectDialog({
  excludeTuneId,
  tuneName,
  onPick,
  onClose,
}: {
  excludeTuneId: string;
  tuneName: (tuneId: string) => string | undefined;
  onPick: (file: UserFile) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const files = useQuery(filesApi.list, {});
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (files ?? []).filter((f) => f.tuneId !== excludeTuneId && (!q || f.name.toLowerCase().includes(q)));
  }, [files, excludeTuneId, query]);
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-overlay p-4 pt-[10vh]" onClick={onClose}>
      <div role="dialog" aria-label="Add from your files" className="flex max-h-[75vh] w-full max-w-lg flex-col gap-3 rounded-2xl bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your files" className="min-w-0 flex-1 bg-transparent outline-none" />
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {files === undefined ? (
            <div className="flex justify-center p-4">
              <LoadingSpinner />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted">{query ? "No files match." : "No other files to add. Upload one instead."}</p>
          ) : (
            rows.map((f) => {
              const other = f.tuneId ? tuneName(f.tuneId) : null;
              return (
                <FileRow key={f._id} name={f.name} mimeType={f.mimeType} detail={fileDetail(f, other ? `on ${other}` : null)} onOpen={() => onPick(f)} />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- a tune's files

/** A tune page's Files: what's attached (open in place), Upload (or drop files here), and "Add
    from my files". */
export function TuneFiles({ tuneId, tuneName }: { tuneId: string; tuneName: (tuneId: string) => string | undefined }) {
  const { isAuthenticated } = useConvexAuth();
  const files = useQuery(filesApi.listForTune, isAuthenticated ? { tuneId } : "skip");
  const update = useMutation(filesApi.update);
  const uploader = useFileUploader(tuneId);
  const actions = useFileActions({ tuneName, hereTuneId: tuneId });
  const [adding, setAdding] = useState(false);

  return (
    <section
      {...(isAuthenticated ? uploader.drop : {})}
      className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:p-5 ${uploader.dragging ? "ring-2 ring-accent" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Files</h2>
        {files && files.length > 0 && <span className="text-sm tabular-nums text-muted">{files.length}</span>}
        {isAuthenticated && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={uploader.pick} disabled={!!uploader.progress} className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm font-medium hover:bg-surface-hover disabled:opacity-50">
              <UploadIcon className="h-4 w-4" /> Upload
            </button>
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm font-medium hover:bg-surface-hover">
              <LinkIcon className="h-4 w-4" /> From my files
            </button>
          </div>
        )}
      </div>
      {!isAuthenticated ? (
        <p className="text-sm text-muted">Sign in to attach files to this tune — PDFs, lead sheets, images, audio, video.</p>
      ) : files === undefined ? (
        <LoadingSpinner />
      ) : files.length === 0 && !uploader.progress ? (
        <button
          type="button"
          onClick={uploader.pick}
          className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-foreground/10 px-4 py-6 text-center text-sm text-muted hover:border-accent/50 hover:text-foreground"
        >
          <UploadIcon className="h-5 w-5" />
          Drop files here, or click to upload a PDF, image, recording or any other file.
        </button>
      ) : (
        <div className="flex flex-col">
          {files.map((f) => (
            <FileRow key={f._id} name={f.name} mimeType={f.mimeType} detail={fileDetail(f)} onOpen={() => actions.openFile(f)} onMenu={(e) => actions.openMenu(f, e)} />
          ))}
        </div>
      )}
      <UploadProgress progress={uploader.progress} />
      {uploader.error && <p className="text-sm text-danger">{uploader.error}</p>}
      {uploader.input}
      {actions.dialogs}
      {adding && (
        <FileSelectDialog
          excludeTuneId={tuneId}
          tuneName={tuneName}
          onPick={(f) => {
            setAdding(false);
            void update({ id: f._id, tuneId });
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}
