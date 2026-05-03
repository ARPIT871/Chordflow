import { Midi } from '@tonejs/midi'

/**
 * Build a .mid file from a progression and trigger a browser download.
 * `progression` is an array of chord objects (with `.midiNotes`) or null
 * for empty slots — empty slots become rests of equal duration.
 */
export function exportProgressionAsMidi({ progression, bpm, barsPerChord, musicKey, scale }) {
  const filled = progression.filter(Boolean)
  if (filled.length === 0) return false

  const midi = new Midi()
  midi.header.setTempo(bpm)

  const track = midi.addTrack()
  track.name = `ChordFlow ${musicKey} ${scale}`

  const chordDurationSec = barsPerChord * 4 * (60 / bpm)
  let time = 0
  for (const chord of progression) {
    if (chord) {
      for (const note of chord.midiNotes) {
        track.addNote({
          midi: note,
          time,
          duration: chordDurationSec * 0.95,
          velocity: 0.7,
        })
      }
    }
    time += chordDurationSec
  }

  const blob = new Blob([midi.toArray()], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeKey = musicKey.replace('#', 'sharp')
  const safeScale = scale.replace(/\s+/g, '')
  a.download = `ChordFlow_${safeKey}${safeScale}_${bpm}bpm.mid`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
