/**
 * iPhone / iPad Safari treats web audio like a game's sound effects (the "ambient" audio
 * category), so the silent switch — or silent mode in Control Center on an iPad — mutes every tool
 * that makes sound. This puts the page in the "playback" category instead, the way a music app
 * plays, so sound comes through regardless:
 *
 * - Safari 16.4+ has the Audio Session API: `navigator.audioSession.type = "playback"`. While a
 *   microphone tool is listening it's switched to "play-and-record" (Safari won't capture in
 *   plain "playback"), then back (`beginMicUse` / `endMicUse`).
 * - Older iOS has no API, but a page that's playing an HTML `<audio>` element is moved to the
 *   playback category, Web Audio included. So after the first tap we loop a short silent clip
 *   (paused while the tab is hidden, restarted on the next tap).
 *
 * Does nothing anywhere else.
 */

type AudioSessionLike = { type: string };

function audioSession(): AudioSessionLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
}

/** iPhone, iPad, iPod — including iPads that report themselves as a Mac. */
function isAppleTouch(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

let installed = false;
let micUsers = 0;
let silentEl: HTMLAudioElement | null = null;

function applySession() {
  const s = audioSession();
  if (!s) return;
  try {
    s.type = micUsers > 0 ? "play-and-record" : "playback";
  } catch {
    // Older builds can refuse a type; nothing else to do.
  }
}

/** A quarter second of silence as a WAV (8 kHz, mono, 16-bit). */
function silentWavUrl(): string {
  const samples = 2000;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function playSilentLoop() {
  if (audioSession()) return; // the API does the job; no need for the trick
  if (!silentEl) {
    silentEl = document.createElement("audio");
    silentEl.src = silentWavUrl();
    silentEl.loop = true;
    silentEl.preload = "auto";
    silentEl.setAttribute("playsinline", "");
    silentEl.setAttribute("x-webkit-airplay", "deny");
    (silentEl as HTMLAudioElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
  }
  if (silentEl.paused) void silentEl.play().catch(() => {});
}

const GESTURES = ["pointerdown", "touchend", "keydown"] as const;

function onGesture() {
  applySession();
  playSilentLoop();
  for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
}

function waitForGesture() {
  for (const g of GESTURES) window.addEventListener(g, onGesture, { capture: true, passive: true });
}

/** Call once on the client (the app shell does). */
export function installIosAudio() {
  if (installed || typeof window === "undefined" || !isAppleTouch()) return;
  installed = true;
  applySession();
  waitForGesture();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") silentEl?.pause();
    else {
      applySession();
      waitForGesture();
    }
  });
}

/** Before opening the microphone: Safari needs "play-and-record" to capture. */
export function beginMicUse() {
  micUsers++;
  applySession();
}

/** After closing the microphone. */
export function endMicUse() {
  micUsers = Math.max(0, micUsers - 1);
  applySession();
}
