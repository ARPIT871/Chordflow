/**
 * Pure music theory: scales, chord construction, note naming.
 * No React, no audio — easy to unit-test in isolation.
 */

export const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const NOTE_NAMES_FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
export const NOTE_NAMES_TONE  = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const KEY_LABELS = {
  'C':  'C',     'C#': 'C♯ / D♭', 'D':  'D',     'D#': 'D♯ / E♭',
  'E':  'E',     'F':  'F',       'F#': 'F♯ / G♭', 'G': 'G',
  'G#': 'G♯ / A♭', 'A':  'A',     'A#': 'A♯ / B♭', 'B': 'B',
}

// Conventional key signatures:
//   Major-like keys that use flats: F, B♭, E♭, A♭, D♭ (the dropdown's A#, D#, G#, C#)
//   Minor-like keys that use flats: C, D, F, G, B♭, E♭ (the dropdown's A#, D#)
// Everything else gets sharp spelling. C minor as "C-E♭-G" instead of "C-D♯-G".
const FLAT_KEYS_MAJOR_LIKE = new Set(['F', 'A#', 'D#', 'G#', 'C#'])
const FLAT_KEYS_MINOR_LIKE = new Set(['C', 'D', 'F', 'G', 'A#', 'D#'])

export const SCALES = {
  'Major':          [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor':  [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor':  [0, 2, 3, 5, 7, 9, 11],
  'Dorian':         [0, 2, 3, 5, 7, 9, 10],
  'Phrygian':       [0, 1, 3, 5, 7, 8, 10],
  'Lydian':         [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian':     [0, 2, 4, 5, 7, 9, 10],
}

export const SCALE_NAMES = Object.keys(SCALES)
export const MINOR_FLAVORS = new Set(['Natural Minor', 'Harmonic Minor', 'Melodic Minor', 'Dorian', 'Phrygian'])

const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
export { ROMAN_BASE }

export function getKeyClass(key) {
  return KEYS.indexOf(key)
}

export function shouldUseFlats(key, scaleName) {
  if (MINOR_FLAVORS.has(scaleName)) return FLAT_KEYS_MINOR_LIKE.has(key)
  return FLAT_KEYS_MAJOR_LIKE.has(key)
}

export function noteClassDisplay(noteClass, useFlats) {
  const c = ((noteClass % 12) + 12) % 12
  return useFlats ? NOTE_NAMES_FLAT[c] : NOTE_NAMES_SHARP[c]
}

function getScaleDegreeAtIdx(scale, idx) {
  const len = scale.length
  return scale[idx % len] + Math.floor(idx / len) * 12
}

function getDiatonicIntervals(scale, degree, complexity) {
  const root = getScaleDegreeAtIdx(scale, degree)
  const intervals = [
    0,
    getScaleDegreeAtIdx(scale, degree + 2) - root,
    getScaleDegreeAtIdx(scale, degree + 4) - root,
  ]
  if (complexity === '7th' || complexity === 'Extended') {
    intervals.push(getScaleDegreeAtIdx(scale, degree + 6) - root)
  }
  if (complexity === 'Extended') {
    intervals.push(getScaleDegreeAtIdx(scale, degree + 8) - root)
  }
  return intervals
}

function triadQualityFromIntervals(third, fifth) {
  if (third === 4 && fifth === 7) return 'M'
  if (third === 3 && fifth === 7) return 'm'
  if (third === 3 && fifth === 6) return 'd'
  if (third === 4 && fifth === 8) return 'A'
  return 'M'
}

function getRomanNumeral(degree, quality) {
  const r = ROMAN_BASE[degree]
  if (quality === 'A') return r + '+'
  if (quality === 'M') return r
  if (quality === 'm') return r.toLowerCase()
  if (quality === 'd') return r.toLowerCase() + '°'
  return r
}

function getChordName(rootClass, useFlats, intervals, complexity) {
  const rootName = noteClassDisplay(rootClass, useFlats)
  const quality = triadQualityFromIntervals(intervals[1], intervals[2])

  if (complexity === 'Triads') {
    if (quality === 'M') return rootName
    if (quality === 'm') return rootName + 'm'
    if (quality === 'd') return rootName + '°'
    if (quality === 'A') return rootName + '+'
  }

  const seventh = intervals[3]
  let suffix = '7'
  if      (quality === 'M' && seventh === 11) suffix = 'maj7'
  else if (quality === 'M' && seventh === 10) suffix = '7'
  else if (quality === 'm' && seventh === 10) suffix = 'm7'
  else if (quality === 'm' && seventh === 11) suffix = 'm(maj7)'
  else if (quality === 'd' && seventh === 10) suffix = 'm7♭5'
  else if (quality === 'd' && seventh ===  9) suffix = '°7'
  else if (quality === 'A' && seventh === 11) suffix = '+maj7'
  else if (quality === 'A' && seventh === 10) suffix = '+7'

  if (complexity === 'Extended') {
    const map = {
      'maj7':    'maj9',
      'm7':      'm9',
      '7':       '9',
      'm(maj7)': 'm(maj9)',
      'm7♭5':    'm9♭5',
      '°7':      '°9',
      '+maj7':   '+maj9',
      '+7':      '+9',
    }
    suffix = map[suffix] || suffix
  }

  return rootName + suffix
}

function getNoteSymbols(rootClass, useFlats, intervals) {
  return intervals.map(i => noteClassDisplay((rootClass + i) % 12, useFlats))
}

/**
 * Voicing: root in C3 area, upper voices stacked from C4 upward
 * so each successive note sits above the previous one.
 */
function buildChordMidi(rootClass, intervals) {
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

export function midiToToneName(midi) {
  const noteClass = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return NOTE_NAMES_TONE[noteClass] + octave
}

/**
 * Returns the 7 diatonic chords for the given key + scale + complexity.
 * Each chord exposes both display data (roman, name, noteSymbols) and
 * playable data (midiNotes).
 */
export function computeDiatonicChords(key, scaleName, complexity) {
  const rootClass = getKeyClass(key)
  const scale = SCALES[scaleName]
  const useFlats = shouldUseFlats(key, scaleName)

  return [0, 1, 2, 3, 4, 5, 6].map(degree => {
    const intervals = getDiatonicIntervals(scale, degree, complexity)
    const chordRootInterval = getScaleDegreeAtIdx(scale, degree) % 12
    const chordRootClass = (rootClass + chordRootInterval + 12) % 12
    const quality = triadQualityFromIntervals(intervals[1], intervals[2])

    return {
      degree,
      quality,
      roman:        getRomanNumeral(degree, quality),
      name:         getChordName(chordRootClass, useFlats, intervals, complexity),
      noteSymbols:  getNoteSymbols(chordRootClass, useFlats, intervals),
      midiNotes:    buildChordMidi(chordRootClass, intervals),
      rootClass:    chordRootClass,
    }
  })
}

/* ─── Borrowed / Modal chord sources ─────────────────────────────── */

/**
 * Borrowed chords: the diatonic chords from the *parallel mode*. So a C
 * major project gets the diatonic chords of C natural minor (Cm, D°, E♭,
 * Fm, Gm, A♭, B♭), and vice versa. These are the "color chords" pop
 * songs use to add minor-key bittersweetness to a major progression
 * (e.g. the iv chord in "Creep") or major brightness to a minor one.
 */
export function computeBorrowedChords(key, scaleName, complexity) {
  const parallel = MINOR_FLAVORS.has(scaleName) ? 'Major' : 'Natural Minor'
  return computeDiatonicChords(key, parallel, complexity)
}

/**
 * Modal chords: the diatonic chords from a single complementary mode
 * with the same root. For major-flavoured keys we surface Mixolydian
 * (the "rock"/Beatles/Led Zep mode — same as major but with a flat 7).
 * For minor-flavoured keys we surface Dorian (the brighter minor with a
 * raised 6 — think "Scarborough Fair", "So What").
 */
export function computeModalChords(key, scaleName, complexity) {
  const mode = MINOR_FLAVORS.has(scaleName) ? 'Dorian' : 'Mixolydian'
  return computeDiatonicChords(key, mode, complexity)
}

/** Helpful label for the mode shown in the Modal tab. */
export function modalScaleNameFor(scaleName) {
  return MINOR_FLAVORS.has(scaleName) ? 'Dorian' : 'Mixolydian'
}

/** Helpful label for the borrowed source. */
export function borrowedScaleNameFor(scaleName) {
  return MINOR_FLAVORS.has(scaleName) ? 'Major' : 'Natural Minor'
}
