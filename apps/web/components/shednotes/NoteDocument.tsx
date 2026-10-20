"use client";

import { useQuery } from "convex/react";
import { Marked, type Tokens } from "marked";
import { useEffect, useMemo, useRef } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import { parseLinkInner } from "@jam-practice/core/shedNotes";
import Score from "@/components/notation/Score";
import { ScoreIcon } from "@/components/tools";
import { cleanScore } from "@/lib/bassTranscription";
import { loadAbcjs, renderNotation, scoreIdOf } from "./livePreview";
import type { ScoreContext } from "./ScoreEmbeds";

/**
 * A note drawn as a page, not an editor — for printing (Export as PDF) and for a note opened from
 * its link. CodeMirror only draws the lines on screen, so a long note wouldn't print whole.
 * Markdown (with tables and checkboxes), [[links]] as pills, ==highlights==, and the notation
 * blocks as music. Any HTML typed in a note is shown as text, and links only go to web pages.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Only web, mail and site links are kept; anything else (javascript:, data:) becomes "#". */
function safeHref(href: string) {
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h) || /^\/(?!\/)/.test(h) || h.startsWith("#")) return h;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(h) && !h.startsWith("//")) return `https://${h}`;
  return "#";
}

const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return esc(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const h = safeHref(href);
      const external = /^https?:/i.test(h);
      return `<a href="${esc(h)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      if (!/^https:/i.test(href.trim())) return esc(text);
      return `<img src="${esc(href.trim())}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ""} />`;
    },
  },
  extensions: [
    {
      name: "wikilink",
      level: "inline",
      start: (src: string) => src.indexOf("[["),
      tokenizer(src: string) {
        const m = /^\[\[([^[\]\n]+?)\]\]/.exec(src);
        if (m) return { type: "wikilink", raw: m[0], inner: m[1] };
      },
      renderer(token) {
        const { target, heading, alias } = parseLinkInner((token as unknown as { inner: string }).inner);
        return `<span class="note-doc-wikilink">${esc(alias ?? (heading ? `${target} › ${heading}` : target))}</span>`;
      },
    },
    {
      name: "highlight",
      level: "inline",
      start: (src: string) => src.indexOf("=="),
      tokenizer(src: string) {
        const m = /^==(?=\S)([^\n]*?\S)==/.exec(src);
        if (m) return { type: "highlight", raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline((token as Tokens.Generic).tokens ?? [])}</mark>`;
      },
    },
  ],
});

type Part = { kind: "md"; text: string } | { kind: "score"; id: string } | { kind: "abc"; abc: string };

/** The note's text, split around its notation blocks (the same fences the editor draws). */
export function splitNote(body: string): Part[] {
  const lines = body.split("\n");
  const parts: Part[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) parts.push({ kind: "md", text: buf.join("\n") });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const fence = /^(```|~~~)\s*(\S*)/.exec(lines[i]);
    const kind = fence ? (/^score$/i.test(fence[2]) ? "score" : /^(abc|music)$/i.test(fence[2]) ? "abc" : null) : null;
    if (!fence || !kind) {
      buf.push(lines[i]);
      // Skip over other code blocks whole, so a fence inside them isn't read as notation.
      if (fence) {
        const close = new RegExp(`^${fence[1]}\\s*$`);
        for (i++; i < lines.length; i++) {
          buf.push(lines[i]);
          if (close.test(lines[i])) break;
        }
      }
      continue;
    }
    const close = new RegExp(`^${fence[1]}\\s*$`);
    let end = i + 1;
    while (end < lines.length && !close.test(lines[end])) end++;
    if (end >= lines.length) {
      buf.push(lines[i]);
      continue;
    }
    flush();
    const inner = lines.slice(i + 1, end).join("\n");
    parts.push(kind === "score" ? { kind: "score", id: scoreIdOf(inner) } : { kind: "abc", abc: inner });
    i = end;
  }
  flush();
  return parts;
}

const noop = () => {};

function ScoreBlock({ id, context }: { id: string; context?: ScoreContext }) {
  const row = useQuery(api.scores.get, id ? { id, ...(context ?? {}) } : "skip");
  const data = row?.data;
  const score = useMemo(() => (data ? cleanScore(data) : row === null ? null : undefined), [data, row]);
  return (
    <figure className="note-doc-score" data-ready={score !== undefined ? "" : undefined}>
      <figcaption className="flex items-center gap-2 text-sm font-semibold">
        <ScoreIcon className="h-4 w-4 shrink-0 text-accent" />
        {score ? score.title : score === null ? "Score not found" : "Loading…"}
      </figcaption>
      {score && <Score transcription={score} cursor={null} playing={null} mode="select" onSelect={noop} onAdd={noop} onReplace={noop} onChordClick={noop} />}
    </figure>
  );
}

function AbcBlock({ abc }: { abc: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    void loadAbcjs().then(() => {
      if (live && el.current) {
        renderNotation(el.current, abc);
        el.current.dataset.ready = "";
      }
    });
    return () => {
      live = false;
    };
  }, [abc]);
  return <div ref={el} className="note-doc-abc" />;
}

export default function NoteDocument({ body, context, fontFamily, className = "" }: { body: string; context?: ScoreContext; fontFamily?: string; className?: string }) {
  const parts = useMemo(() => splitNote(body).map((p) => (p.kind === "md" ? { ...p, html: md.parse(p.text, { async: false }) as string } : p)), [body]);
  return (
    <div className={`note-doc ${className}`} style={fontFamily ? { fontFamily } : undefined}>
      {parts.map((p, i) =>
        p.kind === "md" ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: (p as { html: string }).html }} />
        ) : p.kind === "score" ? (
          <ScoreBlock key={i} id={p.id} context={context} />
        ) : (
          <AbcBlock key={i} abc={p.abc} />
        ),
      )}
    </div>
  );
}

/** How many notation blocks a note has (the print page waits for them to draw). */
export const notationCount = (body: string) => splitNote(body).filter((p) => p.kind !== "md").length;
