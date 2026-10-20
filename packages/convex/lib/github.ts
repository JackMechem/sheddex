/**
 * Tying feedback to work on GitHub: FB-<number> in a commit message or a pull request links it to
 * that feedback; "fixes FB-12" (also fix/fixed/closes/resolves) marks it done once it reaches main.
 */

export const REPO = "JackMechem/soniroll";
export const REPO_URL = `https://github.com/${REPO}`;

export type WorkLink = { kind: "commit" | "pr"; ref: string; url: string; title: string; merged?: boolean; at: number };

/** A commit hash or a GitHub commit / pull request link (or "#12" for a PR) → a link. */
export function parseWorkRef(input: string, title = ""): Omit<WorkLink, "at"> | null {
  const text = input.trim();
  let m = /github\.com\/([\w.-]+\/[\w.-]+)\/commit\/([0-9a-f]{7,40})/i.exec(text);
  if (m) return { kind: "commit", ref: m[2].slice(0, 7), url: `https://github.com/${m[1]}/commit/${m[2]}`, title };
  m = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/i.exec(text);
  if (m) return { kind: "pr", ref: `#${m[2]}`, url: `https://github.com/${m[1]}/pull/${m[2]}`, title };
  m = /^([0-9a-f]{7,40})$/i.exec(text);
  if (m) return { kind: "commit", ref: m[1].slice(0, 7), url: `${REPO_URL}/commit/${m[1]}`, title };
  m = /^#?(\d+)$/.exec(text);
  if (m) return { kind: "pr", ref: `#${m[1]}`, url: `${REPO_URL}/pull/${m[1]}`, title };
  return null;
}

/** The feedback numbers a text mentions, and the ones it says it fixes. */
export function feedbackRefs(text: string): { mentioned: number[]; fixes: number[] } {
  const mentioned = new Set<number>();
  const fixes = new Set<number>();
  for (const m of text.matchAll(/\bFB-?(\d{1,6})\b/gi)) mentioned.add(Number(m[1]));
  // "Fixes FB-3", "closes FB-3, FB-4 and FB-5"
  for (const m of text.matchAll(/\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\b:?\s+((?:FB-?\d{1,6}(?:\s*(?:,|and|&)\s*)?)+)/gi)) {
    for (const n of m[1].matchAll(/FB-?(\d{1,6})/gi)) fixes.add(Number(n[1]));
  }
  return { mentioned: [...mentioned], fixes: [...fixes] };
}

/** Constant-time check of GitHub's `X-Hub-Signature-256` (HMAC-SHA256 of the raw body). */
export async function validSignature(secret: string, body: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
