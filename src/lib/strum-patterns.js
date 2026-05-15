/**
 * Guitar strum patterns. Each pattern is a 16-step grid (one per 16th
 * note inside a single bar). Each cell is one of:
 *   - 'D' — down-stroke (low pitches first, climbing up)
 *   - 'U' — up-stroke   (high pitches first, descending)
 *   - '-' — rest
 *
 * The audio engine and MIDI export both take this raw 16-char string
 * and unfold it into a strum sequence: each non-rest step triggers the
 * current chord's notes one at a time with a small `stringDelaySec`
 * between them — that's what makes a strum sound like a real strum
 * instead of a stab.
 *
 * For the export side, the tiny per-note offsets land on MIDI as notes
 * with slightly staggered start times. FL Studio (or any DAW) plays
 * them back with the strum timing intact.
 */

export const STRUM_PATTERN_LEN = 16

// 'D' down · 'U' up · '-' rest. Read left → right across 16th-note grid:
//   1  e  &  a  2  e  &  a  3  e  &  a  4  e  &  a
export const STRUM_PRESETS = {
  'Folk':       { label: 'Folk',         dirs: 'D-DUDU-D-DUDU-D' },
  'Country':    { label: 'Country',      dirs: 'D-D-DUDUD-D-DUDU' },
  'Pop Ballad': { label: 'Pop Ballad',   dirs: 'D---DU-UD---DU-U' },
  'Rock':       { label: 'Rock',         dirs: 'D-D-D-D-D-D-D-D-' },
  'Reggae':     { label: 'Reggae',       dirs: '--U---U---U---U-' },
  'Bossa':      { label: 'Bossa Nova',   dirs: 'D--U-D--UD--U-D-' },
  'Latin':      { label: 'Latin',        dirs: 'D-DU-UDUD-DU-UDU' },
  'Half-Time':  { label: 'Half-Time',    dirs: 'D-------D-------' },
  'Eighths':    { label: 'Steady 8ths',  dirs: 'D-U-D-U-D-U-D-U-' },
  'Open':       { label: 'Open',         dirs: '----------------' },
}

export const STRUM_PRESET_NAMES = Object.keys(STRUM_PRESETS)
export const DEFAULT_STRUM_PRESET = 'Folk'
export const DEFAULT_STRING_DELAY_MS = 14   // average between-strings delay for a real-feeling strum

/** Always returns a 16-char pattern string. Truncates / pads if needed. */
export function getStrumPattern(presetName) {
  const p = STRUM_PRESETS[presetName]?.dirs || STRUM_PRESETS[DEFAULT_STRUM_PRESET].dirs
  if (p.length === STRUM_PATTERN_LEN) return p
  return (p + '-'.repeat(STRUM_PATTERN_LEN)).slice(0, STRUM_PATTERN_LEN)
}

export function emptyStrumPattern() {
  return '-'.repeat(STRUM_PATTERN_LEN)
}

/**
 * Toggle a step through the cycle  - → D → U → -. Used by the UI's
 * click-to-cycle interaction.
 */
export function cycleStrumStep(pattern, idx) {
  if (idx < 0 || idx >= pattern.length) return pattern
  const cur = pattern[idx]
  const next = cur === '-' ? 'D' : cur === 'D' ? 'U' : '-'
  return pattern.slice(0, idx) + next + pattern.slice(idx + 1)
}

/**
 * Returns an ordered list of strum events for a single chord-slot.
 *
 *   midiNotes        — the chord's note list, any order
 *   pattern          — 16-char D/U/- string (auto-repeats if barsPerChord > 1)
 *   barsPerChord     — how many bars the chord plays for
 *   stringDelaySec   — gap between successive strings within one strum
 *
 * Each event has:
 *   stepIdx          — 0..(16*barsPerChord-1) — for visual playhead use
 *   direction        — 'D' or 'U'
 *   notes            — [{ midi, offsetSec, velocity }] sorted in stroke order
 *
 * `offsetSec` is RELATIVE TO THE STEP'S START TIME (not the slot start).
 * The caller adds step-start to get the absolute time. Velocity is lower
 * for up-strokes — that's how guitar feels in real life.
 */
export function buildStrumSequence(midiNotes, pattern, barsPerChord, stringDelaySec) {
  if (!midiNotes || midiNotes.length === 0) return []
  const sorted = [...midiNotes].sort((a, b) => a - b)
  const totalSteps = STRUM_PATTERN_LEN * barsPerChord
  const events = []
  for (let s = 0; s < totalSteps; s++) {
    const dir = pattern[s % STRUM_PATTERN_LEN]
    if (dir !== 'D' && dir !== 'U') continue
    const order = dir === 'D' ? sorted : [...sorted].reverse()
    const velocity = dir === 'D' ? 0.85 : 0.62
    events.push({
      stepIdx: s,
      direction: dir,
      notes: order.map((midi, i) => ({
        midi,
        offsetSec: i * stringDelaySec,
        velocity,
      })),
    })
  }
  return events
}

/**
 * One strum step covers a 16th note. Returns the step duration in seconds
 * given BPM. Used by the engine to compute step starts.
 */
export function strumStepDurationSec(bpm) {
  return (60 / bpm) / 4
}
