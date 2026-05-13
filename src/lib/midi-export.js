import { Midi } from '@tonejs/midi'
import { buildArpSequence, arpStepDurationSec } from './arp-patterns'
import { buildBassSequence, bassStepDurationSec } from './bass-patterns'
import { GM_DRUM, DRUM_VOICES, DEFAULT_VOLUMES, isVoiceAudible } from './drum-patterns'

/**
 * Build a multi-track .mid file from the progression + enabled layers and
 * trigger a browser download. Each enabled layer becomes its own track so
 * FL Studio (or any DAW) can route them to separate channels with their
 * own VSTs.
 *
 * `progression` is an array of chord objects (with `.midiNotes`) or null
 * for empty slots — empty slots become rests of equal duration on every
 * pitched track.
 *
 * `layerConfig` mirrors the audio-engine config:
 *   chords: { enabled }
 *   pads:   { enabled }
 *   pluck:  { enabled, pattern, rate }
 *   drums:  { enabled, preset }
 */
/**
 * `sectionPlan` (optional): when present, the drum scheduler swaps
 * patterns at section boundaries instead of using the single
 * `layers.drums.pattern`. Same shape as the audio engine accepts:
 * `[{ drumPattern, startBar, endBar }]`. Used by song-mode export.
 */
export function exportProgressionAsMidi({ progression, bpm, barsPerChord, musicKey, scale, layerConfig, sectionPlan }) {
  const filled = progression.filter(Boolean)
  if (filled.length === 0) return false

  const cfg = layerConfig || {}
  const layers = {
    chords: { enabled: cfg.chords?.enabled !== false },
    pads:   { enabled: !!cfg.pads?.enabled },
    pluck:  { enabled: !!cfg.pluck?.enabled,  pattern: cfg.pluck?.pattern || 'up',  rate: cfg.pluck?.rate || '1/8' },
    bass:   { enabled: !!cfg.bass?.enabled,   mode:    cfg.bass?.mode    || 'Root + 5th' },
    drums:  {
      enabled: !!cfg.drums?.enabled,
      pattern: cfg.drums?.pattern,
      mutes:   cfg.drums?.mutes   || {},
      solos:   cfg.drums?.solos   || {},
      volumes: cfg.drums?.volumes || DEFAULT_VOLUMES,
      swing:   Math.max(0, Math.min(100, cfg.drums?.swing ?? 0)),
    },
  }

  // If nothing else is enabled at least keep chords on so the file isn't empty.
  if (!layers.chords.enabled && !layers.pads.enabled && !layers.pluck.enabled
      && !layers.bass.enabled && !layers.drums.enabled) {
    layers.chords.enabled = true
  }

  const midi = new Midi()
  midi.header.setTempo(bpm)

  const beatSec = 60 / bpm
  const barSec = beatSec * 4
  const chordDurationSec = barsPerChord * barSec
  const totalLoopSec = progression.length * chordDurationSec

  // ─── CHORDS track ───────────────────────────────────────────────────
  if (layers.chords.enabled) {
    const tr = midi.addTrack()
    tr.name = `Chords (${musicKey} ${scale})`
    let time = 0
    for (const chord of progression) {
      if (chord) {
        for (const note of chord.midiNotes) {
          tr.addNote({ midi: note, time, duration: chordDurationSec * 0.95, velocity: 0.7 })
        }
      }
      time += chordDurationSec
    }
  }

  // ─── PADS track (chord notes, full slot duration, softer velocity) ─
  if (layers.pads.enabled) {
    const tr = midi.addTrack()
    tr.name = 'Pads'
    let time = 0
    for (const chord of progression) {
      if (chord) {
        for (const note of chord.midiNotes) {
          tr.addNote({ midi: note, time, duration: chordDurationSec * 0.99, velocity: 0.55 })
        }
      }
      time += chordDurationSec
    }
  }

  // ─── PLUCK / ARP track ──────────────────────────────────────────────
  if (layers.pluck.enabled) {
    const tr = midi.addTrack()
    tr.name = `Pluck (${layers.pluck.pattern} ${layers.pluck.rate})`
    const stepSec = arpStepDurationSec(layers.pluck.rate, bpm)
    let baseTime = 0
    for (const chord of progression) {
      if (chord) {
        const seq = buildArpSequence(chord.midiNotes, layers.pluck.pattern, layers.pluck.rate, barsPerChord)
        for (const ev of seq) {
          const t = baseTime + ev.stepIdx * stepSec
          if (ev.chord) {
            for (const m of ev.chord) {
              tr.addNote({ midi: m, time: t, duration: stepSec * 0.9, velocity: 0.6 })
            }
          } else {
            tr.addNote({ midi: ev.midi, time: t, duration: stepSec * 0.9, velocity: 0.7 })
          }
        }
      }
      baseTime += chordDurationSec
    }
  }

  // ─── BASS track ─────────────────────────────────────────────────────
  if (layers.bass.enabled) {
    const tr = midi.addTrack()
    tr.name = `Bass (${layers.bass.mode})`
    const stepSec = bassStepDurationSec(bpm)
    let baseTime = 0
    for (const chord of progression) {
      if (chord) {
        const seq = buildBassSequence(chord.midiNotes, layers.bass.mode, barsPerChord)
        for (const ev of seq) {
          tr.addNote({
            midi: ev.midi,
            time: baseTime + ev.stepIdx * stepSec,
            duration: stepSec * 0.92,
            velocity: 0.5 + (ev.heightHint || 0.7) * 0.4,
          })
        }
      }
      baseTime += chordDurationSec
    }
  }

  // ─── DRUMS track (GM channel 10, 6 voices) ─────────────────────────
  // Two paths: a single drum pattern repeating across the loop
  // (section mode) or a per-section plan that swaps patterns at section
  // boundaries (song mode). Both apply the same swing.
  if (layers.drums.enabled) {
    const tr = midi.addTrack()
    tr.name = 'Drums'
    tr.channel = 9 // GM percussion (display channel 10, zero-indexed = 9)
    const { mutes, solos, volumes } = layers.drums
    const sixteenthSec = beatSec / 4
    const totalBars = Math.round(totalLoopSec / barSec)
    const swingDelay = (sixteenthSec / 2) * (layers.drums.swing / 100)

    const writeBars = (pattern, startBar, endBar) => {
      if (!pattern) return
      for (let bar = startBar; bar < endBar; bar++) {
        for (let step = 0; step < 16; step++) {
          const t = bar * barSec + step * sixteenthSec + (step % 2 === 1 ? swingDelay : 0)
          for (const voice of DRUM_VOICES) {
            const row = pattern[voice]
            if (!row || !row[step]) continue
            if (!isVoiceAudible(voice, mutes, solos)) continue
            const vol = (volumes[voice] ?? 70) / 99
            const accent = voice === 'kick' || voice === 'snare' ? 1.0 : voice === 'clap' ? 0.95 : 0.8
            tr.addNote({
              midi: GM_DRUM[voice],
              time: t,
              duration: sixteenthSec * 0.5,
              velocity: Math.max(0.2, Math.min(1.0, vol * accent)),
            })
          }
        }
      }
    }

    if (sectionPlan && sectionPlan.length > 0) {
      for (const plan of sectionPlan) writeBars(plan.drumPattern, plan.startBar, plan.endBar)
    } else if (layers.drums.pattern) {
      writeBars(layers.drums.pattern, 0, totalBars)
    }
  }

  // ─── Download ───────────────────────────────────────────────────────
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
