"use client";

import type { EditorView } from "@codemirror/view";
import { useMemo, useRef, useState } from "react";
import ScoreDialog from "@/components/notation/ScoreDialog";
import { type NoteActions, runCommand } from "@/components/shednotes/commands";
import NoteEditor from "@/components/shednotes/NoteEditor";
import { FORMAT, VimSwitch } from "@/components/shednotes/NotePane";
import { NoteIcon } from "@/components/tools";
import { useNotesConfig } from "@/lib/useShedNotes";

const noop = () => {};

/**
 * Lesson notes in the Shed Notes editor: markdown with live preview, vim (from your Shed Notes
 * settings) and notation (the teacher's Score Writer scores, which the student can see through
 * the lesson). The teacher writes; the student reads the same view. Give it a `key` per note: the
 * text is only read when it mounts.
 */
export default function LessonNoteEditor({
  lessonId,
  markdown,
  editable,
  onChange,
  placeholder,
}: {
  lessonId: string;
  markdown: string;
  editable: boolean;
  onChange?: (markdown: string) => void;
  placeholder?: string;
}) {
  const cfg = useNotesConfig();
  const { config: settings, setValue } = cfg;
  const viewRef = useRef<EditorView | null>(null);
  const [notation, setNotation] = useState<{ scoreId: string | null; onDone: (id: string) => void } | null>(null);
  // The editor reads its actions through a ref, so a new object each render is fine.
  const actions: NoteActions = {
    openScore: (scoreId, onDone) => setNotation({ scoreId, onDone }),
    setConfig: (key, value) => void setValue(key, value),
    config: () => settings,
  };
  const config = useMemo(() => ({ ...settings, readableLineLength: false }), [settings]);
  const run = (command: string) => runCommand(command, { view: viewRef.current, actions });

  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1 bg-background px-1 py-1.5">
          {FORMAT.map((f) => (
            <button key={f.command} type="button" title={f.title} aria-label={f.title} onMouseDown={(e) => e.preventDefault()} onClick={() => run(f.command)} className={`shrink-0 rounded-lg bg-surface px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover ${f.className ?? "font-semibold"}`}>
              {f.label}
            </button>
          ))}
          <button type="button" title="Write music notation" onMouseDown={(e) => e.preventDefault()} onClick={() => run("editor:insert-notation")} className="flex shrink-0 items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/25">
            <NoteIcon className="h-3.5 w-3.5" /> Notation
          </button>
          <span className="flex-1" />
          <VimSwitch on={settings.vimMode} onChange={(on) => void setValue("vimMode", on)} />
        </div>
      )}
      <NoteEditor
        initialText={markdown}
        readOnly={!editable}
        lessonId={lessonId}
        config={config}
        actions={actions}
        onChange={onChange ?? noop}
        onView={(v) => {
          viewRef.current = v;
        }}
        placeholder={editable ? placeholder : ""}
        bottomSpace="3rem"
        className="min-h-[50vh]"
      />
      {notation && (
        <ScoreDialog
          scoreId={notation.scoreId}
          onClose={() => {
            setNotation(null);
            viewRef.current?.focus();
          }}
          onDone={(id) => notation.onDone(id)}
        />
      )}
    </div>
  );
}
