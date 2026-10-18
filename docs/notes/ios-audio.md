<!-- Moved word for word from the old single PROJECT.md (lines 3667–3682) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### iPhone / iPad: sound plays with silent mode on (2026-10-17, web)

On iOS, Safari puts web audio in the "ambient" category, so the silent switch (or silent mode on
an iPad) muted every sound tool. `lib/iosAudio.ts` fixes it, and `AppChrome` installs it once for
every page, the landing page included. It does nothing off Apple touch devices.
- **Safari 16.4+:** `navigator.audioSession.type = "playback"`. While the mic is open it switches
  to "play-and-record", via `beginMicUse` / `endMicUse` in `startAudioInput` (tuner, listen modes,
  input test) and in the Recorder (`micInUse`).
- **Older iOS** (no Audio Session API): after the first tap, a quarter-second silent WAV (made in
  code) loops in an `<audio>` element, which moves the page to the playback category. It's paused
  when the tab is hidden and restarted on the next tap.
- `tsc`, `eslint`, `next build`. **Not tested on a real iPhone or iPad** (nothing here can run iOS
  Safari).
- Things to check on the device: sound with silent mode on, the mic tools still listening, and
  whether a "Now playing" entry shows up on older iOS (the silent loop).

