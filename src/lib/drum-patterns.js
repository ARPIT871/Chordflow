/**
 * Drum patterns for the Drums layer. Each pattern is a single-bar 16-step grid
 * (1/16 resolution). Cells = 1 hit, 0 = silence. Patterns repeat every bar.
 *
 * Three voices: kick, snare, hat. Mapped to General MIDI percussion notes
 * (channel 10 in the .mid export) so any FL Studio drum plugin will pick them up.
 */

export const DRUM_PRESETS = {
  'Pop': {
    description: '4-on-floor kick, backbeat snare, steady 8th-note hats',
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  'House': {
    description: 'Four-on-the-floor with off-beat hats',
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
  },
  'Lo-Fi': {
    description: 'Laid-back kick, soft snare on 2 & 4, swung hats',
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1],
  },
  'Trap': {
    description: 'Sparse kick, snare on 3, fast hi-hat with rolls',
    kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,1, 1,0,1,0, 1,1,1,0, 1,0,1,1],
  },
  'Cinematic': {
    description: 'Sparse — kick on 1 & 3, snare swell on 4',
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  },
  'Half-Time': {
    description: 'Hip-hop feel — snare on beat 3 only',
    kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
}

export const DRUM_PRESET_NAMES = Object.keys(DRUM_PRESETS)
export const DEFAULT_DRUM_PRESET = 'Pop'

// General MIDI percussion notes (channel 10).
export const GM_DRUM = {
  kick:  36, // Acoustic Bass Drum
  snare: 38, // Acoustic Snare
  hat:   42, // Closed Hi-Hat
}

export const DRUM_VOICES = ['kick', 'snare', 'hat']
