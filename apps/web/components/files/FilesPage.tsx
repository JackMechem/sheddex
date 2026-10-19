"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import Select from "@/components/Select";
import { FilePreviewDialog, FileRow, FileTypeIcon, UploadProgress, fileDetail, useFileActions, useFileUploader, type PreviewFile } from "@/components/files/FileParts";
import { EmptyState, Hero, HeroSearch, LibraryPage, LibraryTabs, Panel, Rows } from "@/components/library/ui";
import { SignInButtons } from "@/components/practicelog/ShedLogGate";
import { FileIcon, UploadIcon } from "@/components/tools";
import { type FileKind, type UserFile, FILE_KIND_LABEL, fileKind, filesApi, formatBytes } from "@/lib/files";
import { useTuneIndex } from "@/lib/recordings";

type Source = "file" | "recording" | "song" | "lesson" | "handin" | "profile";

const SOURCE_LABEL: Record<Source, string> = {
  file: "Uploads",
  recording: "Recordings",
  song: "Tune songs",
  lesson: "Lesson files",
  handin: "Hand-ins",
  profile: "Profile",
};

/** What a non-upload is, in a row's detail line. */
const SOURCE_DETAIL: Record<Source, string | null> = {
  file: null,
  recording: "Recording",
  song: "Song behind your takes",
  lesson: "Given to a student",
  handin: "Handed in",
  profile: null,
};

type SortBy = "new" | "name" | "size";

/**
 * `/files` — everything stored with your account, in one place: files you uploaded (on their own or
 * attached to tunes), recordings, tunes' songs, lesson files and hand-ins, profile images. Upload
 * (button or drop anywhere on the page), search, filter by where a file came from and what kind it
 * is, sort, and open anything in place. Your uploads can be renamed, attached to a tune or deleted
 * here; everything else links to where it's managed.
 */
export default function FilesPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const storage = useQuery(filesApi.storage, isAuthenticated ? {} : "skip");
  const files = useQuery(filesApi.list, isAuthenticated ? {} : "skip");
  const tunes = useTuneIndex();
  const tuneName = (id: string) => tunes.get(id)?.tune.name;
  const uploader = useFileUploader();
  const actions = useFileActions({ tuneName });

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | "all">("all");
  const [kind, setKind] = useState<FileKind | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("new");
  const [preview, setPreview] = useState<(PreviewFile & { href: string | null; source: Source; tuneId: string | null }) | null>(null);

  const filesById = useMemo(() => new Map((files ?? []).map((f) => [f._id as string, f])), [files]);
  const items = useMemo(() => storage?.items ?? [], [storage]);

  const counts = useMemo(() => {
    const bySource = new Map<string, number>();
    const byKind = new Map<string, number>();
    for (const item of items) {
      bySource.set(item.kind, (bySource.get(item.kind) ?? 0) + 1);
      const k = fileKind(item.mimeType, item.name);
      byKind.set(k, (byKind.get(k) ?? 0) + 1);
    }
    return { bySource, byKind };
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((item) => {
      if (source !== "all" && item.kind !== source) return false;
      if (kind !== "all" && fileKind(item.mimeType, item.name) !== kind) return false;
      if (!q) return true;
      const tune = item.tuneId ? (tuneName(item.tuneId) ?? "") : "";
      return [item.name, tune].some((t) => t.toLowerCase().includes(q));
    });
    if (sortBy === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "size") out.sort((a, b) => b.size - a.size);
    return out;
    // tuneName reads `tunes`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, source, kind, sortBy, tunes]);

  const used = storage?.used ?? 0;
  const quota = storage?.quota ?? 1;
  const pct = Math.min(100, (used / quota) * 100);

  return (
    <LibraryPage>
      <div {...(isAuthenticated ? uploader.drop : {})} className="flex flex-col gap-6">
        <Hero
          title="Files"
          icon={FileIcon}
          helpTopic="files"
          tabs={<LibraryTabs active="files" />}
          subtitle={
            storage ? `${items.length} item${items.length === 1 ? "" : "s"} · ${formatBytes(used)} of ${formatBytes(quota)} used` : "Everything stored with your account"
          }
          actions={
            isAuthenticated ? (
              <button
                type="button"
                onClick={uploader.pick}
                disabled={!!uploader.progress}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                <UploadIcon className="h-4 w-4" /> Upload
              </button>
            ) : undefined
          }
        >
          {isAuthenticated && <HeroSearch value={query} onChange={setQuery} placeholder="Search files and tunes" />}
        </Hero>

        {isLoading || (isAuthenticated && storage === undefined) ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-2xl bg-surface">
            <EmptyState
              icon={FileIcon}
              title="Keep your files with your account"
              body="Upload PDFs, lead sheets, images, audio and video — on their own or attached to a tune — and open them on any device."
              action={<SignInButtons />}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">Storage</span>
                <span className="tabular-nums text-muted">
                  {formatBytes(used)} of {formatBytes(quota)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div className={`h-full rounded-full ${pct > 90 ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
              </div>
              {used >= quota ? (
                <p className="text-sm text-danger">Your storage is full. Delete some files or recordings to upload more.</p>
              ) : (
                <p className="text-xs text-muted">
                  Every account has {formatBytes(quota)} for uploads, recordings, songs and lesson files. Drop files anywhere on this page to upload them.
                </p>
              )}
              <p className="text-xs text-muted">Need more room? Plans with more storage are coming.</p>
              <UploadProgress progress={uploader.progress} />
              {uploader.error && <p className="text-sm text-danger">{uploader.error}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <FilterChip active={source === "all"} onClick={() => setSource("all")} label="Everything" count={items.length} />
                {(Object.keys(SOURCE_LABEL) as Source[])
                  .filter((s) => counts.bySource.get(s))
                  .map((s) => (
                    <FilterChip key={s} active={source === s} onClick={() => setSource(s)} label={SOURCE_LABEL[s]} count={counts.bySource.get(s) ?? 0} />
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <FilterChip active={kind === "all"} onClick={() => setKind("all")} label="All types" small />
                {(Object.keys(FILE_KIND_LABEL) as FileKind[])
                  .filter((k) => counts.byKind.get(k))
                  .map((k) => (
                    <FilterChip key={k} active={kind === k} onClick={() => setKind(k)} label={k === "other" ? "Other" : `${FILE_KIND_LABEL[k]}s`} small />
                  ))}
                <div className="ml-auto">
                  <Select
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: "new", label: "Newest first" },
                      { value: "name", label: "Name" },
                      { value: "size", label: "Largest first" },
                    ]}
                    className="min-w-36"
                  />
                </div>
              </div>
            </div>

            <Panel title={source === "all" ? "Everything" : SOURCE_LABEL[source]} detail={`${shown.length}`} flush>
              {shown.length === 0 ? (
                items.length === 0 ? (
                  <EmptyState
                    icon={UploadIcon}
                    title="Nothing here yet"
                    body="Upload a PDF, a lead sheet, a photo of a chart, a recording — anything you want with your tunes."
                    action={
                      <button type="button" onClick={uploader.pick} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                        Upload files
                      </button>
                    }
                  />
                ) : (
                  <p className="px-4 pb-4 text-sm text-muted">Nothing matches.</p>
                )
              ) : (
                <Rows>
                  {shown.map((item) => {
                    const own = item.kind === "file" ? filesById.get(item.id) : undefined;
                    const tune = item.tuneId ? tuneName(item.tuneId) : null;
                    const extra = [SOURCE_DETAIL[item.kind as Source], tune ? `on ${tune}` : null].filter(Boolean).join(" · ");
                    return (
                      <FileRow
                        key={`${item.kind}:${item.id}`}
                        name={item.name}
                        mimeType={item.mimeType}
                        detail={fileDetail(item, extra || null)}
                        onOpen={() => (own ? actions.openFile(own as UserFile) : setPreview({ ...item, source: item.kind as Source }))}
                        onMenu={own ? (e) => actions.openMenu(own as UserFile, e) : undefined}
                        trailing={
                          !own && item.href ? (
                            <Link href={item.href} className="hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-accent hover:bg-background sm:block">
                              {item.kind === "profile" ? "Account" : item.kind === "recording" ? "Recording" : "Lesson"}
                            </Link>
                          ) : null
                        }
                      />
                    );
                  })}
                </Rows>
              )}
            </Panel>
          </>
        )}
      </div>
      {uploader.input}
      {actions.dialogs}
      {preview && (
        <FilePreviewDialog
          file={preview}
          onClose={() => setPreview(null)}
          actions={
            preview.href ? (
              <Link href={preview.href} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-3.5 text-sm font-semibold hover:bg-surface-hover">
                <FileTypeIcon kind={fileKind(preview.mimeType, preview.name)} size="sm" />
                {preview.source === "profile" ? "Change it in Account" : preview.source === "recording" ? "Open the recording" : "Open the lesson"}
              </Link>
            ) : preview.source === "song" && preview.tuneId ? (
              <Link href={`/tunes/tune?id=${encodeURIComponent(preview.tuneId)}`} className="inline-flex h-9 items-center rounded-full bg-background px-3.5 text-sm font-semibold hover:bg-surface-hover">
                Open {tuneName(preview.tuneId) ?? "the tune"}
              </Link>
            ) : null
          }
        />
      )}
    </LibraryPage>
  );
}

function FilterChip({ active, onClick, label, count, small = false }: { active: boolean; onClick: () => void; label: string; count?: number; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors ${small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
        active ? "bg-accent text-accent-foreground" : "bg-surface text-muted hover:text-foreground"
      }`}
    >
      {label}
      {count != null && <span className={`tabular-nums ${active ? "opacity-80" : "opacity-70"}`}>{count}</span>}
    </button>
  );
}
