import * as Tone from 'tone'

/**
 * Instrument presets.
 *   - kind: 'synth'   → instant, no network. `create()` returns a fresh PolySynth.
 *   - kind: 'sampler' → real samples from nbrosowsky/tonejs-instruments CDN.
 *                       First selection downloads a few MB; cached after.
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
  'Electric Piano': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.02, decay: 0.4, sustain: 0.5, release: 1.6 },
    }),
  },
  'Soft Pad': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.6, decay: 0.8, sustain: 0.9, release: 2.5 },
    }),
  },
  'Pluck': {
    kind: 'synth',
    create: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      envelope:   { attack: 0.005, decay: 0.6, sustain: 0.05, release: 0.8 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.4, decay: 0.01, sustain: 1, release: 0.5 },
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
