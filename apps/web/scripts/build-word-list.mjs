// Builds public/shed-notes/words-en.txt, the dictionary behind Shed Notes' word suggestions:
// common English words from SCOWL (via the wordlist-english package, levels 10–35, American and
// shared spellings) plus music words, most common first, one per line. Run from apps/web:
//   npm pack wordlist-english && tar xzf wordlist-english-*.tgz
//   node scripts/build-word-list.mjs package
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the unpacked wordlist-english folder.");

// Words musicians write in practice notes that SCOWL's common levels lack or rank low. They come
// right after the most common English words.
const MUSIC = `arpeggio arpeggios arpeggiated syncopation syncopated metronome metronomes tempo tempos
legato staccato crescendo decrescendo diminuendo fortissimo pianissimo mezzo forte dynamics
articulation articulations ostinato glissando vibrato tremolo pizzicato arco fermata coda segno
ritardando accelerando rubato cadence cadences cadenza dominant subdominant tonic mixolydian dorian
phrygian lydian locrian aeolian ionian pentatonic chromatic diatonic enharmonic modulation
reharmonization voicing voicings inversion inversions comping bebop improvisation improvise
improvising transcription transcriptions transcribe transcribing paradiddle paradiddles flam flams
rudiment rudiments sticking stickings polyrhythm polyrhythms hemiola swing groove grooves backbeat
downbeat downbeats upbeat upbeats offbeat offbeats subdivision subdivisions triplet triplets
sixteenth sixteenths quintuplet semitone semitones interval intervals octave octaves accidental
accidentals ledger clef clefs treble staff measure measures bridge chorus verse intro outro
turnaround turnarounds setlist setlists etude etudes scales modes fingering fingerings embouchure
intonation tuning tuner timbre harmonic harmonics harmony harmonies melody melodies melodic
counterpoint altered diminished augmented seventh sevenths ninth ninths eleventh thirteenth tritone
upright bassline basslines drummer pianist guitarist bassist saxophone trumpet trombone clarinet
vocalist ensemble rehearsal rehearse gig gigs repertoire sightreading transpose transposed
chord chords progression progressions lick licks solo solos soloing riff riffs fill fills hi-hat
snare kick cymbal cymbals ride crash tom toms brushes mallets keyboard piano guitar bass drums`
  .split(/\s+/)
  .filter(Boolean);

const load = (variety, level) => JSON.parse(readFileSync(join(dir, `${variety}-words-${level}.json`), "utf8"));
const tiers = [];
for (const level of [10, 20, 35]) tiers.push([...load("english", level), ...load("american", level)]);
tiers.splice(1, 0, MUSIC);

const all = new Set(tiers.flat());
// A plural or -ed/-ing/-ly form of a word that's also in the list comes after the plain words of
// its tier ("scale" before "scales"), shorter words first within each.
const inflected = (w) =>
  [/s$/, /es$/, /ed$/, /d$/, /ing$/, /ly$/].some((re) => re.test(w) && all.has(w.replace(re, ""))) ||
  (/ing$/.test(w) && all.has(w.replace(/ing$/, "e")));

const seen = new Set();
const out = [];
for (const tier of tiers) {
  const words = [...new Set(tier)].filter((w) => /^[a-z][a-z'-]*[a-z]$/.test(w) && w.length >= 3 && !seen.has(w));
  words.sort((a, b) => Number(inflected(a)) - Number(inflected(b)) || a.length - b.length || a.localeCompare(b));
  for (const w of words) {
    seen.add(w);
    out.push(w);
  }
}

const notice = readFileSync(join(dir, "Copyright"), "utf8").split("\n").slice(0, 13);
const header = [
  "# soniroll Shed Notes word suggestions: most common first, one word per line.",
  "# Built by apps/web/scripts/build-word-list.mjs from SCOWL (wordlist-english, levels 10-35),",
  "# plus music words. SCOWL's copyright and permission notice:",
  ...notice.map((l) => `# ${l}`.trimEnd()),
];
writeFileSync("public/shed-notes/words-en.txt", [...header, ...out].join("\n") + "\n");
console.log(`${out.length} words`);
