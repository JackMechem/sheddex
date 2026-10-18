"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { useState, type ReactNode } from "react";
import PromptDialog from "@/components/PromptDialog";

/**
 * Lesson notes as rich text, stored as Markdown (`@tiptap/markdown`): bold, italics, headings,
 * lists, checklists, quotes, code, links, dividers. Typing Markdown works as you'd expect (`# `,
 * `**bold**`, `- `, `[ ] `, `> `, three backticks, `---`), and there's a toolbar. Read-only
 * (`editable={false}`) for the student — the same rendering. Give it a `key` per note: the
 * content is only read when it mounts.
 */
export default function RichNote({
  markdown,
  editable,
  onChange,
  placeholder = "Write your lesson notes…",
}: {
  markdown: string;
  editable: boolean;
  onChange?: (markdown: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: { openOnClick: !editable, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Markdown,
    ],
    content: markdown,
    contentType: "markdown",
    editorProps: { attributes: { class: "rich-text outline-none" } },
    onUpdate: ({ editor }) => onChange?.(editor.getMarkdown()),
  });

  if (!editor) return <div className="rich-text min-h-40 text-muted">{markdown ? "Loading…" : ""}</div>;
  return (
    <div className="flex min-h-0 flex-col">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className={editable ? "min-h-[50vh] cursor-text" : ""} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("code"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-0.5 rounded-xl bg-surface/95 p-1 shadow-sm ring-1 ring-foreground/5 backdrop-blur">
      <Btn label="Bold (⌘B)" on={s.bold} onClick={() => chain().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn label="Italic (⌘I)" on={s.italic} onClick={() => chain().toggleItalic().run()}>
        <i className="font-serif">I</i>
      </Btn>
      <Btn label="Underline (⌘U)" on={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <u>U</u>
      </Btn>
      <Btn label="Strikethrough" on={s.strike} onClick={() => chain().toggleStrike().run()}>
        <s>S</s>
      </Btn>
      <Sep />
      <Btn label="Heading 1" on={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn label="Heading 2" on={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn label="Heading 3" on={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <Sep />
      <Btn label="Bulleted list" on={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <ListGlyph />
      </Btn>
      <Btn label="Numbered list" on={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        1.
      </Btn>
      <Btn label="Checklist" on={s.task} onClick={() => chain().toggleTaskList().run()}>
        ☑
      </Btn>
      <Btn label="Quote" on={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        ❝
      </Btn>
      <Btn label="Inline code" on={s.code} onClick={() => chain().toggleCode().run()}>
        <span className="font-mono text-xs">{"<>"}</span>
      </Btn>
      <Btn label="Code block" on={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <span className="font-mono text-xs">{"{ }"}</span>
      </Btn>
      <Btn label="Link" on={s.link} onClick={() => (s.link ? chain().unsetLink().run() : setLinking(true))}>
        🔗
      </Btn>
      <Btn label="Divider" onClick={() => chain().setHorizontalRule().run()}>
        —
      </Btn>
      <Sep />
      <Btn label="Undo (⌘Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        ↶
      </Btn>
      <Btn label="Redo (⇧⌘Z)" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        ↷
      </Btn>
      {linking && (
        <PromptDialog
          title="Add a link"
          initialValue="https://"
          placeholder="https://…"
          confirmLabel="Add link"
          onSubmit={(url) => {
            setLinking(false);
            const href = url.trim();
            if (!href || href === "https://") return;
            const withScheme = /^[a-z]+:\/\//i.test(href) || href.startsWith("mailto:") ? href : `https://${href}`;
            if (editor.state.selection.empty)
              chain()
                .insertContent({ type: "text", text: withScheme, marks: [{ type: "link", attrs: { href: withScheme } }] })
                .run();
            else chain().extendMarkRange("link").setLink({ href: withScheme }).run();
          }}
          onCancel={() => setLinking(false)}
        />
      )}
    </div>
  );
}

function Btn({ label, on = false, disabled = false, onClick, children }: { label: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-semibold transition-colors disabled:opacity-30 ${
        on ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-background"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-foreground/10" aria-hidden />;
}

function ListGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

/** A note's Markdown as plain text (for snippets in lists). */
export function markdownSnippet(md: string, length = 120): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~`]+/g, "")
    .replace(/^-{3,}$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length);
}
