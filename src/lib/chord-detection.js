/**
 * Chord detection by template matching against a global chromagram.
 *
 * The chromagram (12-bin pitch-class energy distribution) for the whole
 * clip is fed in. For every (root × chord-type) candidate we build a
 * binary template, take the cosine similarity, weight by chord-type
 * commonness, and rank. Returns the top N candidates with confidence
 * scores normalized to 0–100.
 *
 * Accuracy is best on single-instrument or harmonically clear audio
 * (solo piano, simple guitar strumming). Vocal-heavy mixes work OK
 * because the chromagram still captures the harmonic backing — but the
 * top result might be the song's *most common* chord rather than a
 * specific moment's chord.
 *
 * Chord types covered:
 *   - Major / minor triads
 *   - Dominant 7 / Major 7 / Minor 7
 *   - Sus2 / Sus4
 *   - Diminished triad
 *   - Augmented triad
 */

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Chord type weights bias more-common chord types up slightly so the
// ranking doesn't favor exotic chords that happen to score well by
// containing common notes (e.g. dim chords match a lot of leading-tone
// energy and would otherwise rank too high).
const TYPES = [
  { suffix: '',     label: 'M',      intervals: [0, 4, 7],      weight: 1.00 },
  { suffix: 'm',    label: 'm',      intervals: [0, 3, 7],      weight: 1.00 },
  { suffix: '7',    label: '7',      intervals: [0, 4, 7, 10],  weight: 0.85 },
  { suffix: 'maj7', label: 'maj7',   intervals: [0, 4, 7, 11],  weight: 0.80 },
  { suffix: 'm7',   label: 'm7',     intervals: [0, 3, 7, 10],  weight: 0.85 },
  { suffix: 'sus4', label: 'sus4',   intervals: [0, 5, 7],      weight: 0.60 },
  { suffix: 'sus2', label: 'sus2',   intervals: [0, 2, 7],      weight: 0.55 },
  { suffix: '°',    label: 'dim',    intervals: [0, 3, 6],      weight: 0.50 },
  { suffix: '+',    label: 'aug',    intervals: [0, 4, 8],      weight: 0.45 },
]

function templateFor(intervals, root) {
  const t = new Float32Array(12)
  for (const i of intervals) t[(root + i + 12) % 12] = 1
  return t
}

function cosineScore(chroma, template) {
  let dot = 0, normC = 0, normT = 0
  for (let i = 0; i < 12; i++) {
    dot += chroma[i] * template[i]
    normC += chroma[i] * chroma[i]
    normT += template[i] * template[i]
  }
  const denom = Math.sqrt(normC * normT)
  return denom === 0 ? 0 : dot / denom
}

// Build a sensible voicing: root in C3..B3, upper voices stack above C4.
// Mirrors the diatonic-chord voicing in theory.js so detected chords
// blend with the rest of the app.
function buildVoicing(rootClass, intervals) {
  const rootMidi = 48 + rootClass
  const upper = []
  let prev = 59
  for (let i = 1; i < intervals.length; i++) {
    let n = 60 + ((rootClass + intervals[i]) % 12)
    while (n <= prev) n += 12
    upper.push(n)
    prev = n
  }
  return [rootMidi, ...upper]
}

/**
 * Returns ranked chord candidates: [{ name, suffix, quality, midiNotes,
 * noteSymbols, score, confidence, source: 'Custom' }] sorted by score
 * descending. `limit` caps the list (default 12).
 */
export function detectChords(chroma, { limit = 12 } = {}) {
  if (!chroma || chroma.length !== 12) return []
  const all = []
  for (const type of TYPES) {
    for (let root = 0; root < 12; root++) {
      const template = templateFor(type.intervals, root)
      const score = cosineScore(chroma, template) * type.weight
      const rootName = KEY_NAMES[root]
      all.push({
        name: rootName + type.suffix,
        roman: rootName + type.suffix,  // placeholder — could be smarter w/ key
        suffix: type.suffix,
        quality: type.label,
        noteSymbols: type.intervals.map(i => KEY_NAMES[(root + i + 12) % 12]),
        midiNotes: buildVoicing(root, type.intervals),
        score,
        rootClass: root,
        source: 'Custom',
      })
    }
  }
  all.sort((a, b) => b.score - a.score)

  // Confidence: top 0..N candidates get 100..40-ish so the UI can read
  // dominance at a glance. Lower-ranked candidates compress toward 0.
  const top = all[0]?.score ?? 0
  const bottom = all[all.length - 1]?.score ?? 0
  const range = top - bottom || 1
  for (const r of all) {
    r.confidence = Math.round(((r.score - bottom) / range) * 100)
  }
  return all.slice(0, limit)
}
