"use client";

import { useEffect, useRef, useState } from "react";
import Select from "@/components/Select";
import { CloseIcon, HelpIcon } from "@/components/tools";
import { renderNotation } from "./livePreview";

/**
 * Making notation for a note: a title, key, time signature and clef, the music itself in ABC
 * (typed, or built by clicking notes, lengths, accidentals, rests and bars), and the notation
 * drawn live underneath. Saves an ABC tune, which the note shows as notation (a ```abc block).
 */

const KEYS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Am", "Em", "Bm", "F#m", "C#m", "G#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"];
const METERS = ["4/4", "3/4", "2/4", "6/8", "12/8", "5/4", "7/8", "C", "C|"];
const CLEFS = ["treble", "bass", "alto", "tenor"] as const;
type Clef = (typeof CLEFS)[number];

/** Lengths with L:1/8 (the default unit here). */
const LENGTHS = [
  { abc: "/2", label: "16th" },
  { abc: "", label: "8th" },
  { abc: "2", label: "Quarter" },
  { abc: "3", label: "Dotted quarter" },
  { abc: "4", label: "Half" },
  { abc: "6", label: "Dotted half" },
  { abc: "8", label: "Whole" },
];
const OCTAVES = [
  { id: "low", label: "Low", notes: ["C,", "D,", "E,", "F,", "G,", "A,", "B,"] },
  { id: "mid", label: "Middle", notes: ["C", "D", "E", "F", "G", "A", "B"] },
  { id: "high", label: "High", notes: ["c", "d", "e", "f", "g", "a", "b"] },
  { id: "top", label: "Top", notes: ["c'", "d'", "e'", "f'", "g'", "a'", "b'"] },
] as const;
const ACCIDENTALS = [
  { abc: "", label: "None" },
  { abc: "^", label: "♯" },
  { abc: "_", label: "♭" },
  { abc: "=", label: "♮" },
];

const TEMPLATES: { label: string; key: string; meter: string; body: string }[] = [
  { label: "C major scale", key: "C", meter: "4/4", body: "C D E F G A B c | c B A G F E D C |]" },
  { label: "ii–V–I line", key: "C", meter: "4/4", body: '"Dm7" d2 fe dcBA | "G7" =B2 d2 f2 _a2 | "Cmaj7" g8 |]' },
  { label: "Chords only", key: "C", meter: "4/4", body: '"Cmaj7" [CEGB]8 | "A7" [A,^CEG]8 | "Dm7" [DFAc]8 | "G7" [G,B,DF]8 |]' },
];

type Parsed = { title: string; key: string; meter: string; clef: Clef; tempo: string; unit: string; body: string };

function parse(abc: string | null): Parsed {
  const out: Parsed = { title: "", key: "C", meter: "4/4", clef: "treble", tempo: "", unit: "1/8", body: "" };
  if (!abc) return out;
  const body: string[] = [];
  let inHeader = true;
  for (const line of abc.split("\n")) {
    const m = inHeader ? /^([A-Za-z]):\s*(.*)$/.exec(line) : null;
    if (!m) {
      inHeader = false;
      body.push(line);
      continue;
    }
    const [, field, value] = m;
    if (field === "T") out.title = value;
    else if (field === "M") out.meter = value || "4/4";
    else if (field === "L") out.unit = value || "1/8";
    else if (field === "Q") out.tempo = value.replace(/^1\/4=/, "");
    else if (field === "K") {
      const clef = /clef=(\w+)/.exec(value)?.[1] as Clef | undefined;
      if (clef && CLEFS.includes(clef)) out.clef = clef;
      out.key = value.replace(/clef=\w+/, "").trim() || "C";
      inHeader = false;
    } else if (field !== "X") body.push(line);
  }
  out.body = body.join("\n").replace(/^\n+|\n+$/g, "");
  return out;
}

function compose(p: Parsed): string {
  return [
    "X:1",
    p.title.trim() && `T:${p.title.trim()}`,
    `M:${p.meter}`,
    `L:${p.unit}`,
    /^\d+$/.test(p.tempo.trim()) && `Q:1/4=${p.tempo.trim()}`,
    `K:${p.key}${p.clef !== "treble" ? ` clef=${p.clef}` : ""}`,
    p.body,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function NotationDialog({ initial, onDone, onCancel }: { initial: string | null; onDone: (abc: string) => void; onCancel: () => void }) {
  const [p, setP] = useState<Parsed>(() => parse(initial));
  const [length, setLength] = useState("");
  const [octave, setOctave] = useState<(typeof OCTAVES)[number]["id"]>(() => (parse(initial).clef === "bass" ? "low" : "mid"));
  const [accidental, setAccidental] = useState("");
  const [chord, setChord] = useState("");
  const [help, setHelp] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const abc = compose(p);
  const set = (patch: Partial<Parsed>) => setP((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (preview.current) renderNotation(preview.current, p.body.trim() ? abc : "");
  }, [abc, p.body]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  /** Types `text` at the cursor (keeping the text box's own undo). */
  function put(text: string) {
    const el = area.current;
    if (!el) return;
    el.focus();
    if (!document.execCommand("insertText", false, text)) {
      const { selectionStart: s, selectionEnd: e, value } = el;
      const next = value.slice(0, s) + text + value.slice(e);
      set({ body: next });
      requestAnimationFrame(() => el.setSelectionRange(s + text.length, s + text.length));
    }
  }

  const notes = OCTAVES.find((o) => o.id === octave)!.notes;
  const pill = (on: boolean) => `rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${on ? "bg-accent text-accent-foreground" : "bg-background hover:bg-surface-hover"}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-overlay sm:items-center sm:p-4" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-label="Music notation"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-surface text-foreground shadow-2xl shadow-black/20 sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-5 pb-2 pt-4">
          <h2 className="flex-1 text-lg font-bold">Music notation</h2>
          <button type="button" onClick={() => setHelp((h) => !h)} aria-pressed={help} aria-label="How to write notation" className={`rounded-full p-1.5 ${help ? "bg-accent/15 text-accent" : "text-muted hover:bg-background hover:text-foreground"}`}>
            <HelpIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground">
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-4">
          {help && (
            <div className="rounded-xl bg-background p-3 text-xs leading-relaxed text-muted">
              Notation is written in ABC. Letters are notes (<code>C D E</code> middle octave, <code>c d e</code> an octave up, <code>C,</code> down, <code>c&apos;</code> up two).
              A number after a note makes it longer (<code>C2</code> = a quarter, <code>C/2</code> = a 16th); <code>^</code> sharp, <code>_</code> flat, <code>=</code> natural;
              <code> z</code> a rest; <code>|</code> a bar line, <code>|:</code> and <code>:|</code> repeats, <code>|]</code> the end. <code>[CEG]</code> is a chord,
              <code> &quot;Dm7&quot;</code> a chord symbol above the next note, <code>(3abc</code> a triplet, <code>-</code> a tie. Notes written together are beamed; a space breaks the beam.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Title</span>
              <input value={p.title} onChange={(e) => set({ title: e.target.value })} placeholder="Optional" className="rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Key</span>
              <Select value={KEYS.includes(p.key) ? p.key : "C"} options={KEYS.map((k) => ({ value: k, label: k.replace("b", "♭").replace("#", "♯").replace(/m$/, " minor") }))} onChange={(key) => set({ key })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Time</span>
              <Select value={METERS.includes(p.meter) ? p.meter : "4/4"} options={METERS.map((m) => ({ value: m, label: m === "C" ? "Common (C)" : m === "C|" ? "Cut (¢)" : m }))} onChange={(meter) => set({ meter })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Clef</span>
              <Select
                value={p.clef}
                options={CLEFS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))}
                onChange={(clef) => {
                  set({ clef });
                  if (clef === "bass" && octave === "mid") setOctave("low");
                }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-background/60 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-full shrink-0 text-xs font-semibold text-muted sm:w-16">Length</span>
              {LENGTHS.map((l) => (
                <button key={l.label} type="button" onClick={() => setLength(l.abc)} className={pill(length === l.abc)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-full shrink-0 text-xs font-semibold text-muted sm:w-16">Octave</span>
              {OCTAVES.map((o) => (
                <button key={o.id} type="button" onClick={() => setOctave(o.id)} className={pill(octave === o.id)}>
                  {o.label}
                </button>
              ))}
              <span className="mx-1 hidden h-4 w-px bg-foreground/10 sm:block" />
              <span className="w-full text-xs font-semibold text-muted sm:hidden">Accidental</span>
              {ACCIDENTALS.map((a) => (
                <button key={a.label} type="button" onClick={() => setAccidental(a.abc)} className={pill(accidental === a.abc)} aria-label={a.abc ? `Accidental ${a.label}` : "No accidental"}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-full shrink-0 text-xs font-semibold text-muted sm:w-16">Add</span>
              {notes.map((n) => (
                <button key={n} type="button" onClick={() => put(`${accidental}${n}${length}`)} className="min-w-9 rounded-lg bg-surface px-2 py-1.5 text-sm font-bold hover:bg-surface-hover">
                  {n[0].toUpperCase()}
                </button>
              ))}
              <button type="button" onClick={() => put(`z${length}`)} className="rounded-lg bg-surface px-2.5 py-1.5 text-sm font-semibold hover:bg-surface-hover">
                Rest
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="hidden w-16 shrink-0 sm:block" />
              {[
                [" | ", "Bar"],
                [" |: ", "Repeat start"],
                [" :| ", "Repeat end"],
                [" |]", "End"],
                ["(3", "Triplet"],
                ["-", "Tie"],
                [" ", "Break beam"],
                ["\n", "New line"],
              ].map(([text, label]) => (
                <button key={label} type="button" onClick={() => put(text)} className="rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-hover">
                  {label}
                </button>
              ))}
              <span className="flex items-center gap-1 rounded-lg bg-surface py-0.5 pl-2 pr-0.5">
                <input
                  value={chord}
                  onChange={(e) => setChord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chord.trim()) {
                      e.preventDefault();
                      put(`"${chord.trim()}"`);
                      setChord("");
                    }
                  }}
                  placeholder="Chord, e.g. Dm7"
                  aria-label="Chord symbol"
                  className="w-28 bg-transparent text-xs outline-none"
                />
                <button
                  type="button"
                  disabled={!chord.trim()}
                  onClick={() => {
                    put(`"${chord.trim()}"`);
                    setChord("");
                  }}
                  className="rounded-md bg-background px-2 py-1 text-xs font-semibold hover:bg-surface-hover disabled:opacity-50"
                >
                  Add
                </button>
              </span>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted">
              <span className="flex-1">The music (ABC)</span>
              {!p.body.trim() && (
                <span className="flex flex-wrap gap-1">
                  {TEMPLATES.map((t) => (
                    <button key={t.label} type="button" onClick={() => set({ key: t.key, meter: t.meter, body: t.body })} className="rounded-full bg-background px-2 py-0.5 font-semibold text-foreground hover:bg-surface-hover">
                      {t.label}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <textarea
              ref={area}
              value={p.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={4}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="C D E F | G2 G2 |]"
              className="resize-y rounded-xl bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          <div ref={preview} className="cm-abc-dialog min-h-24 rounded-xl bg-background p-3 text-foreground" aria-label="Preview" />
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-foreground/10 px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover">
            Cancel
          </button>
          <button type="button" onClick={() => onDone(abc)} disabled={!p.body.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50">
            {initial ? "Save notation" : "Add to note"}
          </button>
        </footer>
      </div>
    </div>
  );
}
