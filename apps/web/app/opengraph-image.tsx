import { ImageResponse } from "next/og";
import { STICK_A, STICK_B, TEXT_PATH, TICKS, VIEW_BOX } from "@/components/Logo";

/** The card shown when a sheddex link is shared (texts, social posts, chat apps). */
export const alt = "sheddex — free practice tools for musicians";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#818cf8";
const TOOLS = ["Metronome", "Tuner", "Ear training", "Chord charts", "Jam practice", "Shed Log"];

export default function Image() {
  const stroke = (d: string, w: number, i: number) => <path key={i} d={d} stroke={ACCENT} strokeWidth={w} strokeLinecap="round" fill="none" />;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "linear-gradient(135deg, #0b0b12 0%, #141428 55%, #241a4a 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <svg width={274.5 * 2.6} height={49.5 * 2.6} viewBox={VIEW_BOX}>
          <path d={TEXT_PATH} fill="#f2f2f5" />
          {TICKS.map(([d, w], i) => stroke(d, w, i))}
          {[STICK_A, STICK_B].map((s, j) => (
            <g key={j}>
              {s.strokes.map(([d, w], i) => stroke(d, w, i))}
              <ellipse cx={s.dot[0]} cy={s.dot[1]} rx={s.dot[2]} ry={s.dot[3]} fill={ACCENT} />
            </g>
          ))}
        </svg>
        <div style={{ marginTop: 36, fontSize: 52, fontWeight: 700, lineHeight: 1.15, maxWidth: 900 }}>Free practice tools for musicians.</div>
        <div style={{ marginTop: 14, fontSize: 30, color: "#a5a5b8" }}>No ads, no paywalls. Works in your browser.</div>
        <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
          {TOOLS.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", lineHeight: 1, padding: "14px 22px", borderRadius: 999, background: "rgba(129,140,248,0.16)", color: "#c7cbff", fontSize: 24 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
