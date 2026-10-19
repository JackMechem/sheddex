import { ImageResponse } from "next/og";
import { BADGE, NOTE, RING_ARC, VIEW_BOX, WORD_PATH } from "@/components/Logo";

/** The card shown when a soniroll link is shared (texts, social posts, chat apps). */
export const alt = "soniroll — free practice tools for musicians";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#72a3dc";
const TOOLS = ["Metronome", "Tuner", "Ear training", "Chord charts", "Jam practice", "Shed Log"];

export default function Image() {
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
          background: "linear-gradient(135deg, #10161e 0%, #151c25 55%, #22324a 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <svg width={700 * 0.62} height={200 * 0.62} viewBox={VIEW_BOX}>
          <circle cx="100" cy="100" r="72" fill="none" stroke="#f2f2f5" strokeWidth="22" opacity="0.14" />
          <path d={RING_ARC} fill="none" stroke={ACCENT} strokeWidth="22" strokeLinecap="round" />
          <circle cx={BADGE.cx} cy={BADGE.cy} r={BADGE.r} fill="#f2f2f5" />
          <path d={BADGE.tick} fill="none" stroke="#151c25" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx={NOTE.head.cx} cy={NOTE.head.cy} rx={NOTE.head.rx} ry={NOTE.head.ry} transform={`rotate(${NOTE.head.rotate} ${NOTE.head.cx} ${NOTE.head.cy})`} fill="#f2f2f5" />
          <path d={NOTE.stem} fill="none" stroke="#f2f2f5" strokeWidth="8" strokeLinecap="round" />
          <path d={WORD_PATH} fill="#f2f2f5" />
        </svg>
        <div style={{ marginTop: 36, fontSize: 52, fontWeight: 700, lineHeight: 1.15, maxWidth: 900 }}>Free practice tools for musicians.</div>
        <div style={{ marginTop: 14, fontSize: 30, color: "#a9b6c6" }}>No ads, no paywalls. Works in your browser.</div>
        <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
          {TOOLS.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", lineHeight: 1, padding: "14px 22px", borderRadius: 999, background: "rgba(114,163,220,0.16)", color: "#c9dcf2", fontSize: 24 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
