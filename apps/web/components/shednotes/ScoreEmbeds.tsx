"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { EditorView } from "@codemirror/view";
import Score from "@/components/notation/Score";
import { ScoreIcon } from "@/components/tools";
import { useScore } from "@/lib/useScores";
import { actionsFacet } from "./livePreview";
import { useEmbeds } from "./embedStore";

const noop = () => {};

/** Renders the scores in one editor's ```score blocks into their widgets (see `embedStore`). */
export default function ScoreEmbeds({ owner }: { owner: string }) {
  const embeds = useEmbeds().filter((e) => e.owner === owner);
  return <>{embeds.map((e) => createPortal(<ScoreEmbed scoreId={e.scoreId} view={e.view} />, e.el, e.key))}</>;
}

/** A score in a note: its title, Edit (the notation editor) and the score itself, read-only. */
function ScoreEmbed({ scoreId, view }: { scoreId: string; view: EditorView }) {
  const score = useScore(scoreId || null);
  const box = useRef<HTMLDivElement>(null);

  // The score draws after CodeMirror measured the widget — tell it the height changed.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => view.requestMeasure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const edit = () => view.state.facet(actionsFacet)().openScore?.(scoreId, noop);

  return (
    <div ref={box} className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <ScoreIcon className="h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-semibold">{score ? score.title : score === null ? "Score not found" : "Loading…"}</span>
        {score && (
          <>
            <button type="button" onClick={edit} className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold hover:bg-surface-hover">
              Edit
            </button>
            <Link href={`/score-writer?id=${encodeURIComponent(scoreId)}`} className="hidden rounded-full px-2.5 py-0.5 text-xs font-semibold text-muted hover:bg-surface hover:text-foreground sm:inline">
              Open in Score Writer
            </Link>
          </>
        )}
      </div>
      {score === null ? (
        <p className="text-xs text-muted">This score was deleted from Score Writer.</p>
      ) : score ? (
        <div onDoubleClick={edit}>
          <Score transcription={score} cursor={null} playing={null} mode="select" onSelect={noop} onAdd={noop} onReplace={noop} onChordClick={noop} />
        </div>
      ) : (
        <div className="h-36" />
      )}
    </div>
  );
}
