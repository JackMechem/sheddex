"use client";

import { useMutation, useQuery } from "convex/react";
import { useDeferredValue, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@jam-practice/convex/_generated/api";
import type { Id } from "@jam-practice/convex/_generated/dataModel";
import LoadingSpinner from "@/components/LoadingSpinner";
import Select from "@/components/Select";
import { CheckIcon, CloseIcon, LinkIcon } from "@/components/tools";
import UserAvatar from "@/components/UserAvatar";
import { errorText } from "@/lib/useShedNotes";

type Role = "read" | "write";
type LinkAccess = "off" | "invited" | "anyone";

const ROLES: { value: Role; label: string }[] = [
  { value: "read", label: "Can view" },
  { value: "write", label: "Can edit" },
];

const LINK: { value: LinkAccess; label: string }[] = [
  { value: "off", label: "No link" },
  { value: "invited", label: "Only people added here" },
  { value: "anyone", label: "Anyone with the link can view" },
];

/** The address a note's link opens (`app/note/[token]`). */
export const noteLinkUrl = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/note/${token}`;

/**
 * Share one note: add people by username (public profiles are suggested while typing; a private
 * account works by typing its exact username), give each "Can view" or "Can edit", and set the
 * note's link — off, only the people added, or anyone with it (view only).
 */
export default function ShareDialog({ noteId, title, onClose }: { noteId: string; title: string; onClose: () => void }) {
  const id = noteId as Id<"shedNotes">;
  const sharing = useQuery(api.shedNoteShares.sharing, { noteId: id });
  const shareWith = useMutation(api.shedNoteShares.shareWith);
  const setRole = useMutation(api.shedNoteShares.setRole);
  const unshare = useMutation(api.shedNoteShares.unshare);
  const setLink = useMutation(api.shedNoteShares.setLink);
  const [name, setName] = useState("");
  const [role, setNewRole] = useState<Role>("read");
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const typed = useDeferredValue(name.trim().replace(/^@/, ""));
  const suggestions = useQuery(api.shedNoteShares.suggest, typed ? { q: typed } : "skip");
  const already = new Set((sharing?.people ?? []).map((p) => p.username));
  const shown = (suggestions ?? []).filter((s) => !already.has(s.username)).slice(0, 6);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [status]);

  async function add(username: string) {
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setBusy(true);
    setError(null);
    try {
      const added = await shareWith({ noteId: id, username: u, role });
      setName("");
      setActive(-1);
      setStatus(`Shared with @${added}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(noteLinkUrl(token));
      setStatus("Link copied");
    } catch {
      setError("Couldn't copy — select the link and copy it.");
    }
  }

  const access: LinkAccess = sharing?.link?.access ?? "off";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-overlay sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Share ${title}`}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-xl sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Share a note</h2>
            <p className="truncate text-sm text-muted">{title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="share-username" className="text-xs font-semibold text-muted">
            Add people by username
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                id="share-username"
                value={name}
                autoComplete="off"
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  setActive(-1);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && shown.length) {
                    e.preventDefault();
                    setActive((a) => Math.min(shown.length - 1, a + 1));
                  } else if (e.key === "ArrowUp" && shown.length) {
                    e.preventDefault();
                    setActive((a) => Math.max(-1, a - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    void add(active >= 0 && shown[active] ? shown[active].username! : name);
                  }
                }}
                placeholder="@username"
                className="h-10 w-full rounded-xl bg-background px-3 text-sm outline-none ring-accent focus:ring-2"
              />
              {name.trim() && shown.length > 0 && (
                <ul role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col gap-0.5 rounded-xl bg-surface p-1 shadow-lg ring-1 ring-foreground/10">
                  {shown.map((s, i) => (
                    <li key={s.username} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => void add(s.username!)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === active ? "bg-accent/15" : "hover:bg-surface-hover"}`}
                      >
                        <UserAvatar url={s.avatarUrl} size="sm" />
                        <span className="truncate font-semibold">@{s.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Select value={role} options={ROLES} onChange={setNewRole} className="w-32 shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-xs text-muted">Private accounts aren&apos;t suggested — type their exact username.</p>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void add(name)}
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
            >
              {busy ? <LoadingSpinner size="sm" inline label="Sharing" /> : "Share"}
            </button>
          </div>
        </div>

        {sharing === undefined ? (
          <LoadingSpinner />
        ) : (
          <>
            {sharing && sharing.people.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-muted">Shared with</p>
                <ul className="flex flex-col gap-1">
                  {sharing.people.map((p) => {
                    const label = p.username ? `@${p.username}` : p.name ?? "Someone";
                    return (
                      <li key={p.userId} className="flex items-center gap-2 rounded-xl bg-background px-2 py-1.5">
                        <UserAvatar url={p.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
                        <Select value={p.role} options={ROLES} onChange={(r) => void setRole({ noteId: id, userId: p.userId, role: r }).catch((e) => setError(errorText(e)))} className="w-32 shrink-0" />
                        <button
                          type="button"
                          onClick={() => void unshare({ noteId: id, userId: p.userId }).catch((e) => setError(errorText(e)))}
                          aria-label={`Stop sharing with ${label}`}
                          title="Stop sharing with them"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-danger"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
              <p className="text-xs font-semibold text-muted">Link</p>
              <Select
                value={access}
                options={LINK}
                onChange={(a) => {
                  setError(null);
                  void setLink({ noteId: id, access: a })
                    .then((token) => {
                      // Turning the link on copies it, ready to send.
                      if (token && access === "off") void copy(token);
                    })
                    .catch((e) => setError(errorText(e)));
                }}
              />
              <p className="text-xs text-muted">
                {access === "off"
                  ? "Only the people above can open this note, from their Shed Notes."
                  : access === "invited"
                    ? "The link opens the note for you and the people above, signed in. Anyone else is asked to sign in, or told it isn't shared with them."
                    : "Anyone with the link can read the note, no account needed. Only the people above can edit it."}
              </p>
              {sharing?.link && (
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <LinkIcon className="h-4 w-4 shrink-0 text-muted" />
                    <input readOnly value={noteLinkUrl(sharing.link.token)} onFocus={(e) => e.target.select()} aria-label="The note's link" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </div>
                  <button type="button" onClick={() => void copy(sharing.link!.token)} className="inline-flex h-9 shrink-0 items-center rounded-full bg-background px-4 text-sm font-semibold hover:bg-surface-hover">
                    Copy
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {status && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-accent">
            <CheckIcon className="h-4 w-4" /> {status}
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
