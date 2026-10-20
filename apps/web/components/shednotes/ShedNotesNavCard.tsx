"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import Link from "next/link";
import { DocumentIcon } from "@/components/tools";
import { useNoteList } from "@/lib/useShedNotes";

/** Shed Notes' place in the sidebar, under the Shed Log: how many notes, and the last one you
    edited. Collapsed, just the icon. */
export default function ShedNotesNavCard({ active, collapsed, large, onNavigate }: { active: boolean; collapsed?: boolean; large?: boolean; onNavigate?: () => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const notes = useNoteList();
  const signedOut = !isLoading && !isAuthenticated;
  const last = notes?.reduce<(typeof notes)[number] | null>((best, n) => (!best || n.updatedAt > best.updatedAt ? n : best), null);

  if (collapsed) {
    return (
      <Link href="/shed-notes" onClick={onNavigate} title="Shed Notes" className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-accent/15 text-accent" : "text-foreground hover:bg-surface-hover"}`}>
        <DocumentIcon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href="/shed-notes"
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-colors ${active ? "border-accent/30 bg-accent/15" : "border-transparent bg-accent/[0.07] hover:bg-accent/15"}`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent ${large ? "h-10 w-10" : "h-7 w-7"}`}>
        <DocumentIcon className={large ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-bold ${large ? "text-base" : "text-sm"}`}>Shed Notes</span>
        <span className="block truncate text-xs text-muted">
          {signedOut ? "Sign in to start yours" : notes === undefined ? " " : last ? last.title : "Write your first note"}
        </span>
      </span>
      {notes !== undefined && notes.length > 0 && <span className="shrink-0 rounded-full bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted">{notes.length}</span>}
    </Link>
  );
}
