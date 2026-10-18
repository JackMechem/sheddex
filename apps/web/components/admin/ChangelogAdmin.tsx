"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ChangeText, KIND_STYLE, KindIcon } from "@/components/changelog/ChangelogPage";
import { ChevronLeftIcon, CloseIcon, PlusIcon } from "@/components/tools";
import {
  CHANGE_KINDS,
  type Change,
  type ChangeKind,
  RELEASES,
  type Release,
  formatReleaseDate,
  mergeReleases,
  releaseAnchor,
  releaseKey,
  type ShownRelease,
} from "@/lib/changelog";

/**
 * Admin → Changelog. Releases are written in the code (apps/web/lib/changelog.ts) whenever the
 * version goes up; here an admin fixes any of them. A fix replaces that version's entry on
 * /changelog and is never overwritten by later changes to the code.
 */
export default function ChangelogAdmin() {
  const edits = useQuery(api.changelog.edits);
  const releases = useMemo(() => mergeReleases(RELEASES, edits), [edits]);
  const [open, setOpen] = useState<string | null>(null);

  if (edits === undefined) return <LoadingSpinner />;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface p-5">
        <h2 className="text-lg font-bold">Changelog</h2>
        <p className="mt-1 text-sm text-muted">
          Each version&apos;s entry is written when the version goes up. Fix anything here: your version replaces that entry on{" "}
          <Link href="/changelog" className="font-semibold text-accent hover:underline">
            What&apos;s new
          </Link>{" "}
          and later updates never overwrite it. &ldquo;Revert&rdquo; goes back to the original.
        </p>
      </div>
      {releases.map((r) =>
        open === r.version ? (
          <ReleaseEditor key={r.version} release={r} onClose={() => setOpen(null)} />
        ) : (
          <div key={r.version} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4">
            <span className="rounded-full bg-background px-2.5 py-0.5 text-sm font-bold tabular-nums">v{r.version}</span>
            <div className="min-w-0 flex-1">
              <p className={`truncate font-semibold ${r.hidden ? "text-muted line-through" : ""}`}>{r.title}</p>
              <p className="text-xs text-muted">
                {formatReleaseDate(r.date)} · {r.changes.length} {r.changes.length === 1 ? "change" : "changes"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {r.edited && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">Edited</span>}
              {r.hidden && <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted">Hidden</span>}
              {r.originalChanged && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-300">Updated since your edit</span>
              )}
            </div>
            <Link href={`/changelog#${releaseAnchor(r.version)}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-background hover:text-foreground">
              View
            </Link>
            <button type="button" onClick={() => setOpen(r.version)} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              Edit
            </button>
          </div>
        ),
      )}
    </div>
  );
}

function errorText(e: unknown): string {
  if (e instanceof ConvexError && typeof e.data === "string") return e.data;
  return "Couldn't save that. Try again.";
}

function ReleaseEditor({ release, onClose }: { release: ShownRelease; onClose: () => void }) {
  const save = useMutation(api.changelog.saveEdit);
  const revert = useMutation(api.changelog.revertEdit);
  const [draft, setDraft] = useState<Release>({
    version: release.version,
    date: release.date,
    title: release.title,
    summary: release.summary ?? "",
    changes: release.changes.map((c) => ({ ...c })),
  });
  const [hidden, setHidden] = useState(release.hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const setChange = (i: number, c: Partial<Change>) => setDraft((d) => ({ ...d, changes: d.changes.map((x, j) => (j === i ? { ...x, ...c } : x)) }));
  const move = (i: number, by: number) =>
    setDraft((d) => {
      const changes = [...d.changes];
      const j = i + by;
      if (j < 0 || j >= changes.length) return d;
      [changes[i], changes[j]] = [changes[j], changes[i]];
      return { ...d, changes };
    });

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await save({ version: release.version, release: draft, hidden, base: releaseKey(release.original) });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-2 ring-accent/40">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-background px-2.5 py-0.5 text-sm font-bold tabular-nums">v{release.version}</span>
        <h3 className="flex-1 font-bold">Edit this version</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {release.originalChanged && (
        <div className="flex flex-col gap-2 rounded-xl bg-amber-500/10 p-3 text-sm">
          <p>This version&apos;s entry was updated after you edited it. The site still shows your edit.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowOriginal((v) => !v)} className="rounded-full bg-background px-3 py-1 text-xs font-semibold hover:bg-surface-hover">
              {showOriginal ? "Hide the update" : "See the update"}
            </button>
          </div>
          {showOriginal && <Preview release={release.original} />}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Date
          <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Title
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Summary <span className="font-normal text-muted">(optional, one or two sentences)</span>
        <textarea rows={2} value={draft.summary ?? ""} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} className={`${input} resize-y`} />
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">
          Changes <span className="font-normal text-muted">— **text** for bold</span>
        </p>
        {draft.changes.map((c, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl bg-background p-2.5 sm:flex-row sm:items-start">
            <div className="flex shrink-0 gap-1">
              {CHANGE_KINDS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setChange(i, { kind })}
                  aria-pressed={c.kind === kind}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${c.kind === kind ? KIND_STYLE[kind].chip : "text-muted hover:text-foreground"}`}
                >
                  <KindIcon kind={kind} className="h-3 w-3" /> {label}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={c.text}
              onChange={(e) => setChange(i, { text: e.target.value })}
              aria-label={`Change ${i + 1}`}
              className="min-h-[3.25rem] min-w-0 flex-1 resize-y rounded-lg bg-surface px-2.5 py-1.5 text-sm outline-none [field-sizing:content] focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="flex shrink-0 gap-0.5 self-end sm:self-start">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground disabled:opacity-30">
                <ChevronLeftIcon className="h-4 w-4 rotate-90" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === draft.changes.length - 1} aria-label="Move down" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground disabled:opacity-30">
                <ChevronLeftIcon className="h-4 w-4 -rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, changes: d.changes.filter((_, j) => j !== i) }))}
                aria-label="Remove this change"
                className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-rose-500"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, changes: [...d.changes, { kind: "improved" as ChangeKind, text: "" }] }))}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-hover py-2 text-sm font-semibold text-muted hover:border-accent hover:text-foreground"
        >
          <PlusIcon className="h-4 w-4" /> Add a change
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        Hide this version on What&apos;s new
      </label>

      <details className="rounded-xl bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold">Preview</summary>
        <div className="mt-3">
          <Preview release={draft} />
        </div>
      </details>

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {release.edited && (
          <button type="button" onClick={() => setConfirmRevert(true)} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-background hover:text-foreground">
            Revert to original
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-background hover:text-foreground">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={busy} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {confirmRevert && (
        <ConfirmDialog
          title="Revert to the original?"
          message={`Your edits to v${release.version} are dropped and the original entry shows again.`}
          confirmLabel="Revert"
          onConfirm={async () => {
            await revert({ version: release.version });
            setConfirmRevert(false);
            onClose();
          }}
          onCancel={() => setConfirmRevert(false)}
        />
      )}
    </div>
  );
}

/** A release the way /changelog shows it, smaller. */
function Preview({ release: r }: { release: Release }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-muted">{formatReleaseDate(r.date)}</p>
      <p className="text-lg font-extrabold">{r.title || "Untitled"}</p>
      {r.summary && <p className="text-muted">{r.summary}</p>}
      {CHANGE_KINDS.map(({ kind }) => {
        const items = r.changes.filter((c) => c.kind === kind && c.text.trim());
        if (!items.length) return null;
        return (
          <div key={kind} className="flex flex-col gap-1">
            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${KIND_STYLE[kind].chip}`}>
              <KindIcon kind={kind} className="h-3 w-3" /> {KIND_STYLE[kind].label}
            </span>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {items.map((c, i) => (
                <li key={i}>
                  <ChangeText text={c.text} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
