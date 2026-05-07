/**
 * Pluck/Arp generator. Given a chord's MIDI notes, produces a sequence of
 * single-note hits across the chord's duration — one note per "step" at the
 * chosen rate (1/8 or 1/16).
 *
 * Returns: [{ midi, stepIdx, totalSteps }] where stepIdx is 0-indexed within
 * the chord's slot. The audio engine and MIDI export both consume this.
 */

export const ARP_PATTERNS = ['up', 'down', 'up-down', 'random', 'chord']
export const ARP_RATES    = ['1/8', '1/16']
export const DEFAULT_ARP_PATTERN = 'up'
export const DEFAULT_ARP_RATE    = '1/8'

function stepsPerBar(rate) {
  return rate === '1/16' ? 16 : 8
}

/**
 * Octave-spread voicing for the arp — one octave above the chord voicing
 * so it sits on top of the pad/chord layer without muddying.
 */
function voiceForArp(midiNotes) {
  return [...midiNotes].sort((a, b) => a - b).map(n => n + 12)
}

export function buildArpSequence(midiNotes, pattern, rate, barsPerChord) {
  if (!midiNotes || midiNotes.length === 0) return []
  const total = stepsPerBar(rate) * barsPerChord
  const notes = voiceForArp(midiNotes)

  let order
  if (pattern === 'up') {
    order = notes
  } else if (pattern === 'down') {
    order = [...notes].reverse()
  } else if (pattern === 'up-down') {
    // up then back down without repeating endpoints: [a,b,c,d] → [a,b,c,d,c,b]
    order = notes.length <= 2
      ? notes
      : [...notes, ...notes.slice(1, -1).reverse()]
  } else if (pattern === 'chord') {
    // play full chord on each step (rhythmic block-chord pluck)
    order = null
  } else {
    order = notes // random handled per-step below
  }

  const seq = []
  for (let s = 0; s < total; s++) {
    if (pattern === 'chord') {
      seq.push({ chord: notes, stepIdx: s, totalSteps: total })
    } else if (pattern === 'random') {
      const m = notes[Math.floor(Math.random() * notes.length)]
      seq.push({ midi: m, stepIdx: s, totalSteps: total })
    } else {
      const m = order[s % order.length]
      seq.push({ midi: m, stepIdx: s, totalSteps: total })
    }
  }
  return seq
}

export function arpStepDurationSec(rate, bpm) {
  const beatSec = 60 / bpm
  return rate === '1/16' ? beatSec / 4 : beatSec / 2
}
