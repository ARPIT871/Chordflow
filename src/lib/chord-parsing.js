/**
 * Parse a chord name string ("Cm7", "F#sus4", "Bbmaj7", "B°") into a
 * chord object compatible with the rest of the app — same shape as
 * what `chord-detection.js` and `theory.js` produce, marked
 * `source: 'Custom'` so it routes through the inline-slot path.
 *
 * Used to turn LLM chord suggestions ("Cm7") into something the
 * progression builder, audio engine, and MIDI export all understand.
 */

const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Order matters — more specific matches must come before their prefixes
// (e.g. "maj7" before "maj"/"M", "m7" before "m", "dim7" before "dim").
const SUFFIX_PATTERNS = [
  { test: /^(maj7|M7|Δ7|△7)/i,   type: 'maj7' },
  { test: /^(min7|m7|-7)/,        type: 'm7'   },
  { test: /^sus2/i,               type: 'sus2' },
  { test: /^(sus4|sus)/i,         type: 'sus4' },
  { test: /^(dim7|°7|o7)/i,       type: 'dim7' },
  { test: /^(dim|°|o(?![a-z]))/i, type: 'dim'  },
  { test: /^(aug|\+)/i,           type: 'aug'  },
  { test: /^7/,                   type: '7'    },
  { test: /^(maj|M(?![a-z]))/,    type: ''     },  // explicit major
  { test: /^(min|m(?![a-z]))/,    type: 'm'    },
  { test: /^/,                    type: ''     },  // default: major
]

const TYPE_INTERVALS = {
  '':     [0, 4, 7],
  'm':    [0, 3, 7],
  '7':    [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'm7':   [0, 3, 7, 10],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  'dim':  [0, 3, 6],
  'dim7': [0, 3, 6, 9],
  'aug':  [0, 4, 8],
}

const TYPE_LABELS = {
  '':     'M',     'm':    'm',     '7':   '7',
  'maj7': 'maj7',  'm7':   'm7',
  'sus2': 'sus2',  'sus4': 'sus4',
  'dim':  'dim',   'dim7': 'dim7',  'aug': 'aug',
}

function parseRoot(s) {
  const c = s[0]?.toUpperCase()
  if (!(c in ROOTS)) return null
  let pitch = ROOTS[c]
  let i = 1
  // Accept Unicode and ASCII accidentals — flat then sharp.
  if (s[i] === '#' || s[i] === '♯') { pitch = (pitch + 1) % 12; i++ }
  else if (s[i] === 'b' || s[i] === '♭') { pitch = (pitch + 11) % 12; i++ }
  return { pitch, rest: s.slice(i) }
}

function parseSuffix(rest) {
  for (const { test, type } of SUFFIX_PATTERNS) {
    if (test.test(rest)) return type
  }
  return ''
}

// Build a sensible voicing: root in C3..B3, upper voices stacked above C4.
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
 * Parse a chord name into a chord object. Returns null if the name
 * can't be recognised. Caller should fall back gracefully (e.g. skip
 * the suggestion).
 */
export function parseChordName(name) {
  if (!name || typeof name !== 'string') return null
  const cleaned = name.trim().replace(/\s+/g, '')
  const rooted = parseRoot(cleaned)
  if (!rooted) return null
  const type = parseSuffix(rooted.rest)
  const intervals = TYPE_INTERVALS[type] || [0, 4, 7]
  const rootName = KEY_NAMES[rooted.pitch]
  return {
    name: name.trim(),
    roman: name.trim(),         // placeholder — could derive from key if known
    quality: TYPE_LABELS[type] || 'M',
    noteSymbols: intervals.map(iv => KEY_NAMES[(rooted.pitch + iv + 12) % 12]),
    midiNotes: buildVoicing(rooted.pitch, intervals),
    rootClass: rooted.pitch,
    source: 'Custom',
  }
}
