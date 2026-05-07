import * as Tone from 'tone'

/**
 * Instrument presets used by every melodic layer (chords, pads, pluck).
 *   - kind: 'synth'   → instant, no network. `create()` returns a fresh PolySynth.
 *   - kind: 'sampler' → real samples from nbrosowsky/tonejs-instruments CDN.
 *                       First selection downloads a few MB; cached after.
 *
 * Each layer (chords/pads/pluck) picks its own instrument by name.
 */

const NB_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples'

// Sample-filename convention: '#' becomes 's' (e.g. 'D#3' → 'Ds3.mp3').
function urlMap(notes) {
  const map = {}
  for (const n of notes) map[n] = n.replace('#', 's') + '.mp3'
  return map
}

// Sparse maps — Tone.Sampler interpolates between the nearest two samples.
const PIANO_NOTES   = ['A1','A2','A3','A4','A5','A6','C1','C2','C3','C4','C5','C6','D#2','D#3','D#4','D#5','F#2','F#3','F#4','F#5']
const GUITAR_NOTES  = ['E2','A2','D3','G3','B3','E4','A4','D4','G4','C4','C5']
const FLUTE_NOTES   = ['C4','E4','A4','C5','E5','A5','C6','E6','A6','C7']
const VIOLIN_NOTES  = ['G4','A4','C5','E5','G5','A5','C6','E6','G6','A6']
const HARP_NOTES    = ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5']

export const INSTRUMENTS = {
  // ─── Keys / leads ────────────────────────────────────────────────────
  'Electric Piano': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.02, decay: 0.4, sustain: 0.5, release: 1.6 },
    }),
  },
  'Bell': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 8,
      modulationIndex: 2,
      envelope:   { attack: 0.001, decay: 1.5, sustain: 0, release: 1.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
    }),
  },

  // ─── Pads (long attack, long release — backing layer) ──────────────
  'Soft Pad': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.6, decay: 0.8, sustain: 0.9, release: 2.5 },
    }),
  },
  'Warm Pad': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      envelope:   { attack: 1.2, decay: 0.6, sustain: 0.95, release: 3.2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 1.0, decay: 0.5, sustain: 1, release: 2.0 },
    }),
  },
  'Lush Strings': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 1.2,
      oscillator: { type: 'sawtooth' },
      envelope:   { attack: 0.8, decay: 0.5, sustain: 0.85, release: 2.8 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.6, decay: 0.4, sustain: 0.9, release: 2.0 },
    }),
  },

  // ─── Plucks / arps (short, percussive) ─────────────────────────────
  'Pluck': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      envelope:   { attack: 0.005, decay: 0.6, sustain: 0.05, release: 0.8 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.4, decay: 0.01, sustain: 1, release: 0.5 },
    }),
  },
  'Marimba Pluck': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 4,
      modulationIndex: 6,
      envelope:   { attack: 0.001, decay: 0.4, sustain: 0, release: 0.6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    }),
  },
  'Sine Bleep': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 },
    }),
  },

  // ─── Sample-based instruments ───────────────────────────────────────
  'Acoustic Piano': {
    kind: 'sampler',
    options: { urls: urlMap(PIANO_NOTES),  baseUrl: `${NB_BASE}/piano/`,            release: 1   },
  },
  'Guitar (Acoustic)': {
    kind: 'sampler',
    options: { urls: urlMap(GUITAR_NOTES), baseUrl: `${NB_BASE}/guitar-acoustic/`,  release: 1.5 },
  },
  'Flute': {
    kind: 'sampler',
    options: { urls: urlMap(FLUTE_NOTES),  baseUrl: `${NB_BASE}/flute/`,            release: 1   },
  },
  'Strings': {
    kind: 'sampler',
    options: { urls: urlMap(VIOLIN_NOTES), baseUrl: `${NB_BASE}/violin/`,           release: 2   },
  },
  'Harp': {
    kind: 'sampler',
    options: { urls: urlMap(HARP_NOTES),   baseUrl: `${NB_BASE}/harp/`,             release: 2   },
  },
}

export const INSTRUMENT_NAMES = Object.keys(INSTRUMENTS)
export const DEFAULT_INSTRUMENT = 'Electric Piano'

// Curated subsets so each layer's picker only shows sensible options.
export const PAD_INSTRUMENTS = ['Soft Pad', 'Warm Pad', 'Lush Strings', 'Strings', 'Flute']
export const PLUCK_INSTRUMENTS = ['Pluck', 'Marimba Pluck', 'Sine Bleep', 'Bell', 'Harp', 'Guitar (Acoustic)']
export const DEFAULT_PAD = 'Soft Pad'
export const DEFAULT_PLUCK = 'Pluck'

/**
 * Build the synth-based drum kit. No network — every voice is a Tone
 * primitive synth so the user can sketch beats with zero load time.
 *
 * Six voices: kick, snare, closed hi-hat, open hi-hat, clap, tom. Each
 * has its own gain so per-row volumes can be wired through later (Slice 4).
 *
 * `trigger(voice, time, velocity)` fires a voice at the scheduled
 * audio-clock time.
 */
export function createDrumKit() {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.5 },
  })
  kick.volume.value = -4

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
  })
  snare.volume.value = -10

  // Closed hi-hat: short metallic noise burst.
  const chh = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  })
  chh.frequency.value = 250
  chh.volume.value = -22

  // Open hi-hat: same metallic source, longer decay.
  const ohh = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.35, release: 0.2 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 3200,
    octaves: 1.5,
  })
  ohh.frequency.value = 220
  ohh.volume.value = -24

  // Clap: noise burst with a punchy short envelope.
  const clap = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
  })
  clap.volume.value = -12

  // Tom: lower-tuned membrane.
  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.5, sustain: 0.01, release: 0.6 },
  })
  tom.volume.value = -8

  const voices = { kick, snare, chh, ohh, clap, tom }

  return {
    voices,
    trigger(voice, time, velocity = 1) {
      try {
        const v = voices[voice]
        if (!v) return
        if (voice === 'kick')  v.triggerAttackRelease('C2',  '8n',  time, velocity)
        else if (voice === 'snare') v.triggerAttackRelease('16n', time, velocity)
        else if (voice === 'chh')   v.triggerAttackRelease('32n', time, velocity * 0.6)
        else if (voice === 'ohh')   v.triggerAttackRelease('16n', time, velocity * 0.55)
        else if (voice === 'clap')  v.triggerAttackRelease('16n', time, velocity * 0.85)
        else if (voice === 'tom')   v.triggerAttackRelease('A1',  '8n',  time, velocity)
      } catch { /* noop */ }
    },
    connect(node) {
      for (const v of Object.values(voices)) v.connect(node)
    },
    dispose() {
      for (const v of Object.values(voices)) {
        try { v.dispose() } catch { /* noop */ }
      }
    },
  }
}
