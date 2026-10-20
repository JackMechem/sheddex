import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { HighlightStyle } from "@codemirror/language";
import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** The editor's look, all from the theme's tokens so it follows every preset, light and dark. */
export const editorTheme = EditorView.theme({
  "&": { color: "var(--foreground)", backgroundColor: "transparent", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.65", overflow: "auto" },
  ".cm-content": { padding: "12px 0 40vh", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 4px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--accent) 28%, transparent) !important",
  },
  ".cm-fat-cursor": { background: "color-mix(in oklab, var(--accent) 70%, transparent) !important", color: "var(--accent-foreground) !important" },
  "&:not(.cm-focused) .cm-fat-cursor": { background: "none !important", outline: "1px solid var(--accent) !important" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "color-mix(in oklab, var(--muted) 70%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted)" },
  ".cm-panels": { backgroundColor: "var(--surface)", color: "var(--foreground)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)" },
  ".cm-vim-panel": { padding: "4px 10px", fontFamily: "var(--font-mono, ui-monospace), monospace", fontSize: "13px", minHeight: "1.6em" },
  ".cm-vim-panel input": { color: "var(--foreground)", background: "transparent", outline: "none" },
  ".cm-search": { padding: "6px 10px", fontSize: "13px" },
  ".cm-search input, .cm-search button": { borderRadius: "8px" },
  ".cm-textfield": { backgroundColor: "var(--background)", border: "1px solid color-mix(in oklab, var(--foreground) 15%, transparent)", color: "var(--foreground)", padding: "2px 6px" },
  ".cm-button": { backgroundImage: "none", backgroundColor: "var(--background)", border: "1px solid color-mix(in oklab, var(--foreground) 15%, transparent)", color: "var(--foreground)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in oklab, var(--accent) 22%, transparent)" },
  ".cm-searchMatch-selected": { backgroundColor: "color-mix(in oklab, var(--accent) 45%, transparent)" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", color: "var(--foreground)", border: "1px solid color-mix(in oklab, var(--foreground) 12%, transparent)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px rgb(0 0 0 / 0.18)" },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "inherit", maxHeight: "16rem" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "4px 10px !important" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "color-mix(in oklab, var(--accent) 20%, transparent)", color: "var(--foreground)" },
  ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", marginLeft: "8px" },
  ".cm-completionIcon": { display: "none" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--danger)" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--danger)" },

  // Live preview
  ".cm-h": { fontWeight: "800", lineHeight: "1.3" },
  ".cm-h1": { fontSize: "1.75em", paddingTop: "0.4em" },
  ".cm-h2": { fontSize: "1.45em", paddingTop: "0.35em" },
  ".cm-h3": { fontSize: "1.25em", paddingTop: "0.3em" },
  ".cm-h4": { fontSize: "1.1em" },
  ".cm-h5, .cm-h6": { fontSize: "1em", color: "var(--muted)" },
  ".cm-quote": { borderLeft: "3px solid var(--accent)", paddingLeft: "14px !important", color: "var(--muted)" },
  ".cm-codeblock": { backgroundColor: "var(--background)", fontFamily: "var(--font-mono, ui-monospace), monospace", fontSize: "0.9em", padding: "0 12px !important" },
  ".cm-bullet": { color: "var(--accent)", fontWeight: "800", display: "inline-block", width: "0.9em" },
  ".cm-task-box": { width: "1em", height: "1em", verticalAlign: "-0.15em", marginRight: "0.4em", accentColor: "var(--accent)", cursor: "pointer" },
  ".cm-task-done": { color: "var(--muted)", textDecoration: "line-through" },
  ".cm-rule": { display: "inline-block", width: "100%", height: "0", borderTop: "2px solid color-mix(in oklab, var(--foreground) 15%, transparent)", verticalAlign: "middle" },
  ".cm-wikilink": { color: "var(--accent)", cursor: "pointer", textDecoration: "none" },
  ".cm-wikilink:hover": { textDecoration: "underline" },
  ".cm-wikilink-missing": { opacity: "0.65" },
  ".cm-md-link": { color: "var(--accent)", cursor: "pointer", textDecoration: "underline", textDecorationColor: "color-mix(in oklab, var(--accent) 45%, transparent)" },
  ".cm-inline-code": { backgroundColor: "color-mix(in oklab, var(--foreground) 8%, transparent)", borderRadius: "4px", padding: "0 3px" },
  ".cm-highlight": { backgroundColor: "color-mix(in oklab, var(--accent) 25%, transparent)", borderRadius: "3px" },
  ".cm-tag": { color: "var(--accent)", backgroundColor: "color-mix(in oklab, var(--accent) 12%, transparent)", borderRadius: "999px", padding: "0 6px" },
  ".cm-abc": { position: "relative", margin: "6px 0", padding: "10px 12px", borderRadius: "14px", backgroundColor: "var(--background)", color: "var(--foreground)", cursor: "text" },
  ".cm-abc-editing": { marginTop: "2px", border: "1px dashed color-mix(in oklab, var(--accent) 50%, transparent)" },
  ".cm-abc-paper svg": { maxWidth: "100%" },
  ".cm-abc-empty, .cm-abc-warning": { margin: "0", fontSize: "12px", color: "var(--muted)" },
  ".cm-abc-edit": { position: "absolute", top: "8px", right: "8px", fontSize: "12px", fontWeight: "600", padding: "2px 10px", borderRadius: "999px", backgroundColor: "var(--surface)", color: "var(--foreground)", opacity: "0", transition: "opacity 120ms" },
  ".cm-abc:hover .cm-abc-edit, .cm-abc-editing .cm-abc-edit, .cm-abc-edit:focus-visible": { opacity: "1" },
});

/** Markdown (and JSON, for the settings file) colours. Marks are muted; content keeps its weight. */
export const highlightStyle = HighlightStyle.define([
  { tag: t.heading, fontWeight: "800" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: "var(--muted)" },
  { tag: t.link, color: "var(--accent)" },
  { tag: t.url, color: "var(--muted)" },
  { tag: t.monospace, fontFamily: "var(--font-mono, ui-monospace), monospace", fontSize: "0.9em" },
  { tag: t.quote, color: "var(--muted)" },
  { tag: t.propertyName, color: "var(--accent)" },
  { tag: t.string, color: "var(--foreground)" },
  { tag: [t.number, t.bool, t.null], color: "color-mix(in oklab, var(--accent) 60%, var(--foreground))" },
  { tag: [t.brace, t.squareBracket, t.separator, t.punctuation], color: "var(--muted)" },
]);

export type NoteTitle = { title: string; folder: string };
export const noteTitlesFacet = Facet.define<NoteTitle[], NoteTitle[]>({ combine: (v) => v[0] ?? [] });

/** Typing `[[` suggests your notes' titles; picking one closes the link. */
export function wikilinkCompletion(ctx: CompletionContext): CompletionResult | null {
  const m = ctx.matchBefore(/\[\[[^[\]\n|#]*$/);
  if (!m) return null;
  const from = m.from + 2;
  const closed = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2) === "]]";
  const notes = ctx.state.facet(noteTitlesFacet);
  return {
    from,
    validFor: /^[^[\]\n|#]*$/,
    options: notes.map((n) => ({
      label: n.title,
      detail: n.folder || undefined,
      apply: (view: EditorView, _c: unknown, f: number, to: number) => {
        view.dispatch({
          changes: { from: f, to: closed ? to + 2 : to, insert: `${n.title}]]` },
          selection: { anchor: f + n.title.length + 2 },
          userEvent: "input.complete",
        });
      },
    })),
  };
}
