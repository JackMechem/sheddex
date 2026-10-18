import type { CSSProperties } from "react";

/**
 * Built-in profile banners — pure CSS (gradients and small inline SVG patterns), so they cost
 * nothing to load and look sharp at any size. A profile stores one of these ids
 * (`profiles.bannerPreset`) or an uploaded image instead (`bannerStorageId`). An unknown or
 * missing id falls back to `DEFAULT_BANNER`.
 */

export type BannerPreset = { id: string; label: string; style: CSSProperties };

const svg = (body: string, w: number, h: number) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

const DOTS = "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 1.5px)";
const STAFF = svg(
  Array.from({ length: 5 }, (_, i) => `<line x1='0' x2='240' y1='${14 + i * 9}' y2='${14 + i * 9}' stroke='white' stroke-opacity='0.28' stroke-width='1.2'/>`).join(""),
  240,
  90,
);
const KEYS = svg(
  [0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x='${i * 22}' y='0' width='21' height='120' fill='white' fill-opacity='0.16'/>`).join("") +
    [1, 2, 4, 5, 6].map((i) => `<rect x='${i * 22 - 7}' y='0' width='13' height='72' fill='black' fill-opacity='0.35'/>`).join(""),
  154,
  120,
);
const WAVE = svg(
  [12, 26, 18, 34, 22, 40, 16, 30, 24, 10, 28, 20].map((h, i) => `<rect x='${i * 10 + 2}' y='${30 - h / 2}' width='5' height='${h}' rx='2.5' fill='white' fill-opacity='0.3'/>`).join(""),
  120,
  60,
);
const STRIPES = "repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0 14px, transparent 14px 28px)";

export const BANNERS: BannerPreset[] = [
  {
    id: "aurora",
    label: "Aurora",
    style: { backgroundImage: `${DOTS}, linear-gradient(135deg, color-mix(in srgb, var(--accent) 55%, transparent), rgba(217,70,239,0.32), rgba(251,191,36,0.38))`, backgroundSize: "22px 22px, auto" },
  },
  { id: "sunset", label: "Sunset", style: { backgroundImage: "linear-gradient(135deg, #f97316, #ec4899 55%, #8b5cf6)" } },
  { id: "ocean", label: "Ocean", style: { backgroundImage: `${WAVE}, linear-gradient(135deg, #0ea5e9, #6366f1)`, backgroundSize: "120px 60px, auto" } },
  { id: "forest", label: "Forest", style: { backgroundImage: "linear-gradient(135deg, #064e3b, #059669 55%, #a3e635)" } },
  { id: "midnight", label: "Midnight", style: { backgroundImage: `${DOTS}, linear-gradient(160deg, #020617, #1e1b4b 60%, #4c1d95)`, backgroundSize: "26px 26px, auto" } },
  { id: "ember", label: "Ember", style: { backgroundImage: "linear-gradient(135deg, #450a0a, #b91c1c 50%, #f59e0b)" } },
  { id: "mint", label: "Mint", style: { backgroundImage: "linear-gradient(135deg, #a7f3d0, #67e8f9 60%, #c4b5fd)" } },
  { id: "staff", label: "Staff paper", style: { backgroundImage: `${STAFF}, linear-gradient(135deg, #1e293b, #334155)`, backgroundSize: "240px 90px, auto" } },
  { id: "keys", label: "Keys", style: { backgroundImage: `${KEYS}, linear-gradient(135deg, #312e81, #7c3aed)`, backgroundSize: "154px 120px, auto" } },
  { id: "vinyl", label: "Vinyl", style: { backgroundImage: "repeating-radial-gradient(circle at 80% 50%, #18181b 0 3px, #27272a 3px 5px), linear-gradient(#18181b, #18181b)" } },
  { id: "stripes", label: "Stripes", style: { backgroundImage: `${STRIPES}, linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #ec4899))` } },
  { id: "sand", label: "Sand", style: { backgroundImage: "linear-gradient(135deg, #fde68a, #fdba74 50%, #fca5a5)" } },
];

export const DEFAULT_BANNER = "aurora";

export function bannerPreset(id: string | null | undefined): BannerPreset {
  return BANNERS.find((b) => b.id === id) ?? BANNERS[0];
}

/** What the backend returns for a profile's banner. */
export type BannerValue = { url: string } | { preset: string } | null | undefined;
