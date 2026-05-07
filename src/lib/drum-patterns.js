/**
 * Drum patterns for the editable drum grid. Each pattern is a 16-step
 * single-bar grid (1/16 resolution) across six voices: kick, snare,
 * closed hi-hat, open hi-hat, clap, tom. Patterns repeat every bar.
 *
 * Each voice maps to a General MIDI percussion note (channel 10 in the
 * .mid export) so any FL Studio drum plugin will pick them up correctly.
 */

export const DRUM_VOICES = ['kick', 'snare', 'chh', 'ohh', 'clap', 'tom']

export const DRUM_VOICE_LABELS = {
  kick:  'Kick',
  snare: 'Snare',
  chh:   'Closed Hat',
  ohh:   'Open Hat',
  clap:  'Clap',
  tom:   'Tom',
}

// Color class used by the cell renderer (matches `.cell.on-{color}` in CSS).
export const DRUM_VOICE_COLOR = {
  kick:  'on-pink',
  snare: 'on-teal',
  chh:   'on-amber',
  ohh:   'on-amber',
  clap:  'on-violet',
  tom:   'on-violet-d',
}

// General MIDI percussion notes (channel 10 / display channel 10).
export const GM_DRUM = {
  kick:  36, // Acoustic Bass Drum
  snare: 38, // Acoustic Snare
  chh:   42, // Closed Hi-Hat
  ohh:   46, // Open Hi-Hat
  clap:  39, // Hand Clap
  tom:   45, // Low Tom
}

// Default per-voice volumes (0–99 in the UI; we treat them as a percentage
// for both note-velocity scaling in MIDI export and gain in the audio
// engine once the mixer is wired up).
export const DEFAULT_VOLUMES = {
  kick: 88, snare: 75, chh: 62, ohh: 48, clap: 70, tom: 55,
}

// ─── Pattern presets ───────────────────────────────────────────────────
const empty = () => ({
  kick:  Array(16).fill(0),
  snare: Array(16).fill(0),
  chh:   Array(16).fill(0),
  ohh:   Array(16).fill(0),
  clap:  Array(16).fill(0),
  tom:   Array(16).fill(0),
})

export const DRUM_PRESETS = {
  'Boom Bap': {
    description: 'Hip-hop classic — dusty kick on 1 + 7 + 11, snare on 2 & 4',
    pattern: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      chh:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      ohh:   [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
      tom:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,1],
    },
  },
  'Trap': {
    description: 'Sparse kick, hard snare on 3, fast hat with 1/32 rolls',
    pattern: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      chh:   [1,0,1,1, 1,0,1,0, 1,1,1,0, 1,0,1,1],
      ohh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      clap:  [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      tom:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,1,0],
    },
  },
  'Lo-Fi': {
    description: 'Laid-back kick, soft snare on 2 & 4, swung hats',
    pattern: {
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      chh:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1],
      ohh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      tom:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },
  },
  'Bollywood Dhol': {
    description: 'Dhol-style 8-on-the-floor with tom punctuation',
    pattern: {
      kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      chh:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      ohh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      tom:   [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,1,1],
    },
  },
  'Four-on-Floor': {
    description: 'House — 4-on-the-floor with off-beat hats',
    pattern: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      chh:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      ohh:   [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      tom:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },
  },
  'Half-Time': {
    description: 'Half-time hip-hop — snare lands on beat 3 only',
    pattern: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      chh:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      ohh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
      clap:  [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      tom:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
    },
  },
}

export const DRUM_PRESET_NAMES = Object.keys(DRUM_PRESETS)
export const DEFAULT_DRUM_PRESET = 'Boom Bap'

export function getDrumPattern(presetName) {
  return DRUM_PRESETS[presetName]?.pattern || empty()
}

export function emptyDrumPattern() {
  return empty()
}

/**
 * Decide whether a given voice should produce sound on this step given
 * mutes + solos. If any solo is on, only soloed voices play.
 */
export function isVoiceAudible(voice, mutes, solos) {
  if (mutes[voice]) return false
  const anySolo = Object.values(solos).some(Boolean)
  if (anySolo && !solos[voice]) return false
  return true
}
