"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SAVE_LABEL, useAutosave } from "@/components/bassgenius/TranscriptionEditor";
import ScoreEditor from "@/components/notation/ScoreEditor";
import { CloseIcon } from "@/components/tools";
import type { Transcription } from "@/lib/bassTranscription";
import { newScore, useScore, useScoreActions } from "@/lib/useScores";

/**
 * The notation editor in a dialog, on a Score Writer score — how notation is written from Shed
 * Notes. `scoreId` null starts a new score, which is only made once something's written; `onDone`
 * gets its id when the dialog closes.
 */
export default function ScoreDialog({ scoreId, onDone, onClose }: { scoreId: string | null; onDone: (scoreId: string) => void; onClose: () => void }) {
  const loaded = useScore(scoreId);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay sm:items-center sm:p-4">
      <div role="dialog" aria-label="Music notation" className="flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-background text-foreground shadow-2xl shadow-black/25 sm:h-[90vh] sm:rounded-2xl">
        {scoreId && loaded === undefined ? (
          <div className="flex flex-1 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : scoreId && loaded === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted">This score was deleted.</p>
            <button type="button" onClick={onClose} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
              Close
            </button>
          </div>
        ) : (
          <Editing scoreId={scoreId} start={loaded ?? null} onDone={onDone} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function Editing({ scoreId, start, onDone, onClose }: { scoreId: string | null; start: Transcription | null; onDone: (id: string) => void; onClose: () => void }) {
  const [initial] = useState(() => start ?? newScore());
  const { create, save } = useScoreActions();
  const idRef = useRef<string | null>(scoreId);
  const [id, setId] = useState<string | null>(scoreId);
  const creating = useRef<Promise<string> | null>(null);
  const { change, flush, saveState } = useAutosave(async (t: Transcription) => {
    if (idRef.current) return save(idRef.current, t);
    // A new score: made on the first save (later saves wait for it).
    creating.current ??= create(t).then((made) => {
      idRef.current = made;
      setId(made);
      return made;
    });
    const made = await creating.current;
    if (made) await save(made, t);
  });

  const finish = async () => {
    flush();
    const made = idRef.current ?? (creating.current ? await creating.current : null);
    if (made) onDone(made);
    onClose();
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape is the editor's own (back to Select); Ctrl/⌘-Enter closes.
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void finishRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
      <ScoreEditor
        initial={initial}
        onChange={change}
        staffControls
        autoFocus
        header={(t, setMeta) => (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={t.title}
              onChange={(e) => setMeta({ title: e.target.value })}
              aria-label="Title"
              className="min-w-0 flex-1 rounded-lg bg-transparent text-xl font-extrabold tracking-tight outline-none ring-accent focus:ring-2 sm:text-2xl"
            />
            <span className="text-xs text-muted" aria-live="polite">
              {id || saveState !== "saved" ? SAVE_LABEL[saveState] : "Not saved yet"}
            </span>
            {id && (
              <Link href={`/score-writer?id=${encodeURIComponent(id)}`} onClick={() => flush()} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-hover">
                Open in Score Writer
              </Link>
            )}
            <button type="button" onClick={() => void finish()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover" title="Done (Ctrl/⌘-Enter)">
              {scoreId ? "Done" : "Add to note"}
            </button>
            <button type="button" onClick={() => void finish()} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      />
    </div>
  );
}
