"use client";

import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic, linter } from "@codemirror/lint";
import { search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, drawSelection, keymap, lineNumbers, placeholder as placeholderExt } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { useEffect, useId, useRef } from "react";
import { titleKey } from "@jam-practice/core/shedNotes";
import type { ShedNotesConfig } from "@/lib/shedNotesConfig";
import { type NoteActions, runCommand } from "./commands";
import { type NoteTitle, editorTheme, highlightStyle, noteTitlesFacet, wikilinkCompletion } from "./editorSetup";
import { actionsFacet, liveFacet, livePreview, titlesFacet } from "./livePreview";
import ScoreEmbeds from "./ScoreEmbeds";
import { ownerFacet } from "./embedStore";
import { applyVimConfig, registerVimEditor } from "./vimSetup";

/**
 * The Shed Notes editor (CodeMirror 6, the editor Obsidian is built on): markdown with live
 * preview, `[[` suggestions, notation blocks, search (Ctrl/⌘-F), and vim when the settings file
 * turns it on. `language="json"` is the settings file itself. The text is only read when it
 * mounts — give it a `key` per note.
 */
export default function NoteEditor({
  initialText,
  language = "markdown",
  config,
  notes = [],
  actions,
  onChange,
  onView,
  autoFocus = false,
  placeholder = "",
  lint,
  className = "",
}: {
  initialText: string;
  language?: "markdown" | "json";
  config: ShedNotesConfig;
  notes?: NoteTitle[];
  actions: NoteActions;
  onChange: (text: string) => void;
  onView?: (view: EditorView | null) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** Extra problems to underline (the settings file's). */
  lint?: (text: string) => Diagnostic[];
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const owner = useId();
  const viewRef = useRef<EditorView | null>(null);
  const actionsRef = useRef(actions);
  const onChangeRef = useRef(onChange);
  const lintRef = useRef(lint);
  const compartments = useRef<Record<"vim" | "keys" | "live" | "gutter" | "look" | "attrs" | "notes", Compartment> | null>(null);

  useEffect(() => {
    actionsRef.current = actions;
    onChangeRef.current = onChange;
    lintRef.current = lint;
  });

  // Create once; settings changes reconfigure below.
  useEffect(() => {
    if (!host.current) return;
    const c = {
      vim: new Compartment(),
      keys: new Compartment(),
      live: new Compartment(),
      gutter: new Compartment(),
      look: new Compartment(),
      attrs: new Compartment(),
      notes: new Compartment(),
    };
    compartments.current = c;
    const getActions = () => actionsRef.current;
    const lang =
      language === "json"
        ? [json(), linter((view) => [...jsonParseLinter()(view), ...(lintRef.current?.(view.state.doc.toString()) ?? [])], { delay: 300 })]
        : [markdown({ base: markdownLanguage }), livePreview, autocompletion({ override: [wikilinkCompletion], icons: false }), actionsFacet.of(getActions), ownerFacet.of(owner)];
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          // Your keybindings first and highest, so they win over vim's own keys (like Obsidian).
          c.keys.of([]),
          c.vim.of([]),
          history(),
          drawSelection(),
          closeBrackets(),
          search({ top: true }),
          EditorView.lineWrapping,
          editorTheme,
          syntaxHighlighting(highlightStyle),
          placeholderExt(placeholder),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...completionKeymap, indentWithTab]),
          c.live.of([]),
          c.gutter.of([]),
          c.look.of([]),
          c.attrs.of([]),
          c.notes.of([]),
          ...lang,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    registerVimEditor(view, getActions);
    onView?.(view);
    if (autoFocus) view.focus();
    return () => {
      onView?.(null);
      view.destroy();
      viewRef.current = null;
    };
    // Mount once per note (the parent keys it); the text and settings flow in through refs and
    // the compartments below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settings → compartments.
  useEffect(() => {
    const view = viewRef.current;
    const c = compartments.current;
    if (!view || !c) return;
    applyVimConfig(config);
    const keys = config.keybindings.map((b) => ({
      key: b.key,
      preventDefault: true,
      run: (v: EditorView) => runCommand(b.command, { view: v, actions: actionsRef.current }),
    }));
    view.dispatch({
      effects: [
        c.vim.reconfigure(config.vimMode ? vim({ status: true }) : []),
        c.keys.reconfigure(Prec.highest(keymap.of(keys))),
        c.live.reconfigure(liveFacet.of(language === "markdown" && config.livePreview)),
        c.gutter.reconfigure(config.lineNumbers || language === "json" ? lineNumbers() : []),
        c.look.reconfigure(
          EditorView.theme({
            ".cm-content": {
              fontSize: `${config.fontSize}px`,
              ...(config.readableLineLength && language === "markdown" ? { maxWidth: "46rem", marginInline: "auto", width: "100%" } : {}),
              ...(language === "json" ? { fontFamily: "var(--font-mono, ui-monospace), monospace", fontSize: `${Math.max(12, config.fontSize - 3)}px` } : {}),
            },
          }),
        ),
        c.attrs.reconfigure(
          EditorView.contentAttributes.of({
            spellcheck: config.spellcheck && language === "markdown" ? "true" : "false",
            autocorrect: language === "markdown" ? "on" : "off",
            autocapitalize: language === "markdown" ? "sentences" : "off",
          }),
        ),
      ],
    });
  }, [config, language]);

  // The note list → link colours and `[[` suggestions.
  useEffect(() => {
    const view = viewRef.current;
    const c = compartments.current;
    if (!view || !c || language !== "markdown") return;
    view.dispatch({ effects: c.notes.reconfigure([noteTitlesFacet.of(notes), titlesFacet.of(new Set(notes.map((n) => titleKey(n.title))))]) });
  }, [notes, language]);

  return (
    <>
      <div ref={host} className={`min-h-0 ${className}`} />
      {language === "markdown" && <ScoreEmbeds owner={owner} />}
    </>
  );
}
