import { DEFAULT_TONE_ID } from "@/lib/tones";

/** The Practice Timer's sound settings (synced) — shared with the Shed Log, whose routines run
    on the same timer and so ring the same way. */
export const SOUND_SETTINGS_KEY = "practice-timer-sound-settings";
export const DEFAULT_SOUND_SETTINGS = {
  soundEnabled: true,
  toneId: DEFAULT_TONE_ID,
  alarmMode: false,
  fullScreenAlert: false,
};
