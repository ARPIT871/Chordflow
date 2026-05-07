/**
 * Bass-line generator. Given a chord's MIDI notes (root, third, fifth, …),
 * produces a sequence of monophonic bass notes for the chord's slot
 * duration. Each event is a { midi, stepIdx, totalSteps, kind } where
 * `kind` is the scale-degree label used by the visualizer (R / 3 / 5 / ♭7).
 *
 * Bass voicing always sits at C2 octave or below — rooted, low, glue.
 */

export const BASS_MODES = ['Root', 'Root + 5th', 'Walking', 'Custom']
export const DEFAULT_BASS_MODE = 'Root + 5th'

// Drop chord notes down two octaves so the bass sits below the chord block.
const BASS_OFFSET = -24

function root(midiNotes) {
  return Math.min(...midiNotes) + BASS_OFFSET
}

// Chord tones picked by interval position, robust to triad/seventh/extended:
// index 0 = root, 1 = third, 2 = fifth, 3 = seventh.
function chordTone(midiNotes, idx) {
  const sorted = [...midiNotes].sort((a, b) => a - b)
  const note = sorted[Math.min(idx, sorted.length - 1)]
  return note + BASS_OFFSET
}

/**
 * Each bass step is an 8th note. One slot = 8 events per bar × barsPerChord.
 * Sparse modes (Root only) emit fewer events but still use the same step
 * index space so the bass aligns with the rest of the song's grid.
 */
export function buildBassSequence(midiNotes, mode, barsPerChord) {
  if (!midiNotes || midiNotes.length === 0) return []
  const stepsPerBar = 8                     // 8th-note resolution
  const total = stepsPerBar * barsPerChord
  const seq = []

  if (mode === 'Root') {
    // Single sustained root on beat 1 of each bar.
    for (let bar = 0; bar < barsPerChord; bar++) {
      seq.push({ midi: root(midiNotes), stepIdx: bar * stepsPerBar, totalSteps: total, kind: 'R', heightHint: 0.95 })
    }
  } else if (mode === 'Root + 5th') {
    // Root on 1, ghost root on 2&, fifth on 3, ghost fifth on 4&. Per bar.
    for (let bar = 0; bar < barsPerChord; bar++) {
      const base = bar * stepsPerBar
      seq.push({ midi: root(midiNotes),         stepIdx: base + 0, totalSteps: total, kind: 'R', heightHint: 0.95 })
      seq.push({ midi: root(midiNotes),         stepIdx: base + 2, totalSteps: total, kind: 'R', heightHint: 0.7  })
      seq.push({ midi: chordTone(midiNotes, 2), stepIdx: base + 4, totalSteps: total, kind: '5', heightHint: 0.85 })
      seq.push({ midi: chordTone(midiNotes, 2), stepIdx: base + 6, totalSteps: total, kind: '5', heightHint: 0.65 })
    }
  } else if (mode === 'Walking') {
    // Quarter-note line: 1 = root, 2 = third, 3 = fifth, 4 = ♭7 (or 5 again).
    for (let bar = 0; bar < barsPerChord; bar++) {
      const base = bar * stepsPerBar
      seq.push({ midi: root(midiNotes),         stepIdx: base + 0, totalSteps: total, kind: 'R',  heightHint: 0.95 })
      seq.push({ midi: chordTone(midiNotes, 1), stepIdx: base + 2, totalSteps: total, kind: '3',  heightHint: 0.7  })
      seq.push({ midi: chordTone(midiNotes, 2), stepIdx: base + 4, totalSteps: total, kind: '5',  heightHint: 0.85 })
      seq.push({
        midi: chordTone(midiNotes, 3),
        stepIdx: base + 6, totalSteps: total,
        kind: midiNotes.length >= 4 ? '♭7' : '5',
        heightHint: 0.7,
      })
    }
  } else {
    // Custom: simple syncopated pattern (root on 1 + 3+ + 5).
    for (let bar = 0; bar < barsPerChord; bar++) {
      const base = bar * stepsPerBar
      ;[0, 3, 5].forEach((s, i) => {
        seq.push({
          midi: root(midiNotes),
          stepIdx: base + s,
          totalSteps: total,
          kind: '·',
          heightHint: 0.55 + (i * 0.15),
        })
      })
    }
  }
  return seq
}

export function bassStepDurationSec(bpm) {
  return 60 / bpm / 2 // 8th-note step
}
