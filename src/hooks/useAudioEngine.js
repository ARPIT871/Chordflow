import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { midiToToneName } from '../lib/theory'
import { INSTRUMENTS, DEFAULT_INSTRUMENT, createDrumKit } from '../lib/instruments'
import { buildArpSequence, arpStepDurationSec } from '../lib/arp-patterns'
import { buildBassSequence, bassStepDurationSec } from '../lib/bass-patterns'
import { DRUM_VOICES, isVoiceAudible } from '../lib/drum-patterns'

/**
 * Multi-layer audio engine. Owns the Tone.js lifecycle for five parallel
 * layers (chords, pads, pluck, bass, drums) plus a global master.
 *
 * Audio graph:
 *
 *   chordSynth ─┐
 *   padSynth   ─┤
 *   pluckSynth ─┼─→ {layer Gain → Meter} ─→ reverb ─→ masterGain ─→ masterMeter ─→ destination
 *   bassSynth  ─┤
 *   drumKit    ─┘
 *
 * Each layer has its own Gain + Meter so the mixer UI can read peak
 * levels and drive volume / mute / solo per channel.
 *
 * Browsers require AudioContext to start on a user gesture, so the audio
 * graph is lazily created on the first preview/play call.
 */
const CHANNELS = ['chords', 'pads', 'pluck', 'bass', 'drums', 'audio']

export function useAudioEngine({
  chordInstrument = DEFAULT_INSTRUMENT,
  padInstrument   = 'Soft Pad',
  pluckInstrument = 'Pluck',
  bassInstrument  = 'Sub Bass',
} = {}) {
  const [audioStarted, setAudioStarted] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [instrumentLoading, setInstrumentLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentlyPlayingIdx, setCurrentlyPlayingIdx] = useState(-1)
  const [activeMidiNotes, setActiveMidiNotes] = useState([])

  // Synth refs (one per melodic layer + a drum kit + an audio sample player).
  const chordSynthRef = useRef(null)
  const padSynthRef   = useRef(null)
  const pluckSynthRef = useRef(null)
  const bassSynthRef  = useRef(null)
  const drumKitRef    = useRef(null)
  const audioPlayerRef = useRef(null)

  // FX + per-channel gain/meter + master.
  const reverbRef       = useRef(null)
  const masterGainRef   = useRef(null)
  const masterMeterRef  = useRef(null)
  const channelGainsRef = useRef({})  // { chords: Tone.Gain, pads, pluck, bass, drums }
  const channelMetersRef = useRef({}) // { chords: Tone.Meter, ... }

  // Mixer state stored in refs so updates don't cascade re-renders for the
  // audio graph; the UI reads them directly via getter functions.
  const channelVolumesRef = useRef({ chords: 78, pads: 46, pluck: 60, bass: 72, drums: 84, audio: 80, master: 88 })
  const channelMutesRef   = useRef({ chords: false, pads: false, pluck: false, bass: false, drums: false, audio: false })
  const channelSolosRef   = useRef({ chords: false, pads: false, pluck: false, bass: false, drums: false, audio: false })

  // Per-voice drum volumes (0..99). Captured in a ref so the playback
  // schedule callbacks can read live values — lets the user drag a row's
  // volume slider mid-loop and hear it change on the next hit without a
  // playback restart.
  const drumVolumesRef = useRef({})

  const previewTimeoutRef = useRef(null)
  const previewTokenRef = useRef(0)

  // ─── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => () => {
    try { Tone.Transport.stop(); Tone.Transport.cancel() } catch { /* noop */ }
    for (const r of [chordSynthRef, padSynthRef, pluckSynthRef, bassSynthRef]) {
      try { r.current?.releaseAll(); r.current?.dispose() } catch { /* noop */ }
    }
    try { drumKitRef.current?.dispose() } catch { /* noop */ }
    try { audioPlayerRef.current?.stop(); audioPlayerRef.current?.dispose() } catch { /* noop */ }
    for (const g of Object.values(channelGainsRef.current))  { try { g.dispose() } catch {} }
    for (const m of Object.values(channelMetersRef.current)) { try { m.dispose() } catch {} }
    try { masterGainRef.current?.dispose() } catch { /* noop */ }
    try { masterMeterRef.current?.dispose() } catch { /* noop */ }
    try { reverbRef.current?.dispose() } catch { /* noop */ }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
  }, [])

  // ─── Build a Tone instrument by preset name ────────────────────────
  const buildInstrument = useCallback(async (name, defaultVolumeDb = -10) => {
    const def = INSTRUMENTS[name] || INSTRUMENTS[DEFAULT_INSTRUMENT]
    if (def.kind === 'synth') {
      const synth = def.create()
      synth.volume.value = defaultVolumeDb
      synth.__loadedName = name
      return synth
    }
    setInstrumentLoading(true)
    try {
      const sampler = await new Promise((resolve, reject) => {
        const s = new Tone.Sampler({
          ...def.options,
          onload:  () => resolve(s),
          onerror: (e) => reject(e),
        })
      })
      sampler.volume.value = defaultVolumeDb + 2
      sampler.__loadedName = name
      return sampler
    } finally {
      setInstrumentLoading(false)
    }
  }, [])

  // ─── Compute the effective gain for a channel given mute/solo state ─
  // - Solo overrides mute when ANY channel is soloed: only soloed channels
  //   are audible, everything else is forced down.
  // - When no solos are on, mute toggles silence the channel.
  // - Volume slider 0–100 maps to -∞..+0 dB (linear in dB roughly:
  //   100 → 0 dB, 50 → -12 dB, 0 → -∞).
  const recomputeChannelGains = useCallback(() => {
    const anySolo = CHANNELS.some(ch => channelSolosRef.current[ch])
    for (const ch of CHANNELS) {
      const node = channelGainsRef.current[ch]
      if (!node) continue
      const muted = channelMutesRef.current[ch]
      const soloed = channelSolosRef.current[ch]
      const audible = anySolo ? soloed : !muted
      if (!audible) {
        node.gain.rampTo(0, 0.05)
        continue
      }
      const vol = channelVolumesRef.current[ch] ?? 80
      // 0..100 → 0..1 linear amplitude; 80 ≈ unity-ish for our setup.
      const linear = Math.max(0, Math.min(1, vol / 100))
      node.gain.rampTo(linear, 0.05)
    }
    if (masterGainRef.current) {
      const vol = channelVolumesRef.current.master ?? 88
      masterGainRef.current.gain.rampTo(Math.max(0, Math.min(1, vol / 100)), 0.05)
    }
  }, [])

  // ─── Boot AudioContext + master FX + initial chord synth ───────────
  const ensureStarted = useCallback(async () => {
    try {
      if (Tone.context.state !== 'running') await Tone.start()

      if (!masterGainRef.current) {
        masterGainRef.current = new Tone.Gain(0.88)
        masterMeterRef.current = new Tone.Meter({ smoothing: 0.85 })
        masterGainRef.current.chain(masterMeterRef.current, Tone.Destination)
      }
      if (!reverbRef.current) {
        const reverb = new Tone.Reverb({ decay: 2, wet: 0.25 })
        if (reverb.generate) {
          try { await reverb.generate() } catch { /* impulse generation can be skipped */ }
        }
        reverb.connect(masterGainRef.current)
        reverbRef.current = reverb
      }
      // Per-channel gain + meter. Synth layers route through reverb;
      // the audio sample channel bypasses reverb (don't add synth-style
      // verb to recorded vocals or imported clips).
      for (const ch of CHANNELS) {
        if (channelGainsRef.current[ch]) continue
        const gain = new Tone.Gain((channelVolumesRef.current[ch] ?? 80) / 100)
        const meter = new Tone.Meter({ smoothing: 0.85 })
        if (ch === 'audio') {
          gain.chain(meter, masterGainRef.current)
        } else {
          gain.chain(meter, reverbRef.current)
        }
        channelGainsRef.current[ch] = gain
        channelMetersRef.current[ch] = meter
      }

      if (!chordSynthRef.current) {
        const inst = await buildInstrument(chordInstrument, -10)
        inst.connect(channelGainsRef.current.chords)
        chordSynthRef.current = inst
      }

      recomputeChannelGains()
      setAudioStarted(true)
      return true
    } catch (e) {
      setAudioError(e.message || String(e))
      return false
    }
  }, [buildInstrument, chordInstrument, recomputeChannelGains])

  // ─── Per-layer hot-swap when instrument prop changes ───────────────
  const swapInstrument = useCallback(async (ref, instrumentName, channelKey, volumeDb) => {
    if (!audioStarted || !ref.current) return null
    if (ref.current.__loadedName === instrumentName) return null
    try { ref.current?.releaseAll() } catch { /* noop */ }
    let next
    try {
      next = await buildInstrument(instrumentName, volumeDb)
    } catch (e) {
      setAudioError(`Failed to load ${instrumentName}: ${e.message || e}`)
      return null
    }
    next.connect(channelGainsRef.current[channelKey])
    const old = ref.current
    ref.current = next
    try { old?.dispose() } catch { /* noop */ }
    return next
  }, [audioStarted, buildInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(chordSynthRef, chordInstrument, 'chords', -10).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [chordInstrument, swapInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(padSynthRef, padInstrument, 'pads', -16).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [padInstrument, swapInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(pluckSynthRef, pluckInstrument, 'pluck', -12).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [pluckInstrument, swapInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(bassSynthRef, bassInstrument, 'bass', -10).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [bassInstrument, swapInstrument])

  // Lazily build a layer synth on first use.
  const ensureLayer = useCallback(async (ref, name, channelKey, volumeDb) => {
    if (ref.current) return ref.current
    const inst = await buildInstrument(name, volumeDb)
    inst.connect(channelGainsRef.current[channelKey])
    ref.current = inst
    return inst
  }, [buildInstrument])

  const ensureDrumKit = useCallback(() => {
    if (drumKitRef.current) return drumKitRef.current
    const kit = createDrumKit()
    kit.connect(channelGainsRef.current.drums)
    drumKitRef.current = kit
    return kit
  }, [])

  // ─── Audio sample player (uploads + recordings) ────────────────────
  // Load a URL (object URL from a File or a Blob from MediaRecorder) into
  // a Tone.Player, replacing any previous one. Resolves once the audio has
  // decoded so callers can show a "ready" state.
  const loadAudioFromUrl = useCallback(async (url, { loop = false } = {}) => {
    const ok = await ensureStarted()
    if (!ok) throw new Error('Audio context not running')

    // Dispose previous player first.
    try { audioPlayerRef.current?.stop(); audioPlayerRef.current?.dispose() } catch { /* noop */ }
    audioPlayerRef.current = null

    const player = await new Promise((resolve, reject) => {
      const p = new Tone.Player({
        url,
        loop,
        onload:  () => resolve(p),
        onerror: (e) => reject(e),
      })
    })
    player.connect(channelGainsRef.current.audio)
    audioPlayerRef.current = player
    return player
  }, [ensureStarted])

  const clearAudio = useCallback(() => {
    try { audioPlayerRef.current?.stop(); audioPlayerRef.current?.dispose() } catch { /* noop */ }
    audioPlayerRef.current = null
  }, [])

  const setAudioLoop = useCallback((loop) => {
    if (audioPlayerRef.current) audioPlayerRef.current.loop = !!loop
  }, [])

  const audioBufferDuration = useCallback(() => {
    return audioPlayerRef.current?.buffer?.duration ?? 0
  }, [])

  // ─── Preview a single chord ────────────────────────────────────────
  const previewChord = useCallback(async (midiNotes) => {
    const ok = await ensureStarted()
    if (!ok || !chordSynthRef.current) return
    const noteNames = midiNotes.map(midiToToneName)
    try { chordSynthRef.current.releaseAll() } catch { /* noop */ }
    chordSynthRef.current.triggerAttackRelease(noteNames, 1.4)
    setActiveMidiNotes(midiNotes)

    const token = ++previewTokenRef.current
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      if (previewTokenRef.current === token) setActiveMidiNotes([])
    }, 1400)
  }, [ensureStarted])

  /**
   * Loop the progression with all enabled layers playing in sync.
   *
   * `chordsWithSlot` = ordered list of { midiNotes, slotIdx }.
   *
   * `layerConfig`:
   *   chords: { enabled }
   *   pads:   { enabled }
   *   pluck:  { enabled, pattern, rate }
   *   bass:   { enabled, mode }
   *   drums:  { enabled, pattern, mutes, solos }
   */
  const startPlayback = useCallback(async (chordsWithSlot, { bpm, barsPerChord, layerConfig }) => {
    if (!chordsWithSlot.length) return false
    const ok = await ensureStarted()
    if (!ok) return false

    const cfg = layerConfig || {}
    const layers = {
      chords: { enabled: cfg.chords?.enabled !== false },
      pads:   { enabled: !!cfg.pads?.enabled },
      pluck:  { enabled: !!cfg.pluck?.enabled,  pattern: cfg.pluck?.pattern || 'up',  rate: cfg.pluck?.rate || '1/8' },
      bass:   { enabled: !!cfg.bass?.enabled,   mode:    cfg.bass?.mode    || 'Root + 5th' },
      audio:  { enabled: !!cfg.audio?.enabled,  loop:    !!cfg.audio?.loop },
      drums:  {
        enabled: !!cfg.drums?.enabled,
        pattern: cfg.drums?.pattern,
        mutes:   cfg.drums?.mutes   || {},
        solos:   cfg.drums?.solos   || {},
        volumes: cfg.drums?.volumes || {},
      },
    }

    if (layers.pads.enabled)  await ensureLayer(padSynthRef,   padInstrument,   'pads',  -16)
    if (layers.pluck.enabled) await ensureLayer(pluckSynthRef, pluckInstrument, 'pluck', -12)
    if (layers.bass.enabled)  await ensureLayer(bassSynthRef,  bassInstrument,  'bass',  -10)
    if (layers.drums.enabled) ensureDrumKit()

    Tone.Transport.cancel()
    Tone.Transport.stop()
    Tone.Transport.position = 0
    Tone.Transport.bpm.value = bpm

    const beatSec = 60 / bpm
    const barSec = beatSec * 4
    const chordDurationSec = barsPerChord * barSec
    const totalLoopSec = chordsWithSlot.length * chordDurationSec

    chordsWithSlot.forEach(({ midiNotes, slotIdx }, seqIdx) => {
      const startOffset = seqIdx * chordDurationSec
      Tone.Transport.scheduleRepeat((time) => {
        const noteNames = midiNotes.map(midiToToneName)

        // CHORDS
        if (layers.chords.enabled && chordSynthRef.current) {
          chordSynthRef.current.triggerAttackRelease(noteNames, chordDurationSec * 0.92, time)
        }
        // PADS
        if (layers.pads.enabled && padSynthRef.current) {
          padSynthRef.current.triggerAttackRelease(noteNames, chordDurationSec * 0.98, time, 0.7)
        }
        // PLUCK
        if (layers.pluck.enabled && pluckSynthRef.current) {
          const seq = buildArpSequence(midiNotes, layers.pluck.pattern, layers.pluck.rate, barsPerChord)
          const stepSec = arpStepDurationSec(layers.pluck.rate, bpm)
          for (const ev of seq) {
            const evTime = time + ev.stepIdx * stepSec
            if (ev.chord) {
              const names = ev.chord.map(midiToToneName)
              pluckSynthRef.current.triggerAttackRelease(names, stepSec * 0.85, evTime, 0.6)
            } else {
              pluckSynthRef.current.triggerAttackRelease(midiToToneName(ev.midi), stepSec * 0.85, evTime, 0.7)
            }
          }
        }
        // BASS
        if (layers.bass.enabled && bassSynthRef.current) {
          const seq = buildBassSequence(midiNotes, layers.bass.mode, barsPerChord)
          const stepSec = bassStepDurationSec(bpm)
          for (const ev of seq) {
            const evTime = time + ev.stepIdx * stepSec
            bassSynthRef.current.triggerAttackRelease(midiToToneName(ev.midi), stepSec * 0.92, evTime, 0.85)
          }
        }

        // UI highlight
        Tone.Draw.schedule(() => {
          setCurrentlyPlayingIdx(slotIdx)
          setActiveMidiNotes(midiNotes)
        }, time)
      }, totalLoopSec, startOffset)
    })

    // Drums: schedule one bar repeating across the whole loop. Per-row
    // velocities are read from `drumVolumesRef` inside the callback so
    // dragging a slider mid-loop changes the next hit's loudness without
    // a playback restart.
    drumVolumesRef.current = { ...(layers.drums.volumes || {}) }
    if (layers.drums.enabled && layers.drums.pattern && drumKitRef.current) {
      const pattern = layers.drums.pattern
      const mutes = layers.drums.mutes
      const solos = layers.drums.solos
      const sixteenthSec = beatSec / 4
      const totalBars = Math.round(totalLoopSec / barSec)

      for (let bar = 0; bar < totalBars; bar++) {
        for (let step = 0; step < 16; step++) {
          for (const voice of DRUM_VOICES) {
            const row = pattern[voice]
            if (!row || !row[step]) continue
            if (!isVoiceAudible(voice, mutes, solos)) continue
            const offset = bar * barSec + step * sixteenthSec
            Tone.Transport.scheduleRepeat((time) => {
              const vol = drumVolumesRef.current[voice] ?? 70
              const velocity = Math.max(0.05, Math.min(1, vol / 99))
              drumKitRef.current?.trigger(voice, time, velocity)
            }, totalLoopSec, offset)
          }
        }
      }
    }

    // ─── Audio sample: start at Transport time 0 if loaded + enabled ─
    if (layers.audio.enabled && audioPlayerRef.current?.loaded) {
      try {
        audioPlayerRef.current.loop = layers.audio.loop
        audioPlayerRef.current.stop() // reset position
        audioPlayerRef.current.start(Tone.now())
      } catch { /* noop */ }
    }

    Tone.Transport.start()
    setIsPlaying(true)
    return true
  }, [ensureStarted, ensureLayer, ensureDrumKit, padInstrument, pluckInstrument, bassInstrument])

  const stopPlayback = useCallback(() => {
    try {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      chordSynthRef.current?.releaseAll()
      padSynthRef.current?.releaseAll()
      pluckSynthRef.current?.releaseAll()
      bassSynthRef.current?.releaseAll()
      audioPlayerRef.current?.stop()
    } catch { /* noop */ }
    setIsPlaying(false)
    setCurrentlyPlayingIdx(-1)
    setActiveMidiNotes([])
  }, [])

  // ─── Mixer API ─────────────────────────────────────────────────────
  // The HorizontalMixer drives volume / mute / solo through these and
  // polls getChannelLevel() at animation-frame rate for meter updates.
  const setChannelVolume = useCallback((channelId, vol /* 0..100 */) => {
    channelVolumesRef.current[channelId] = vol
    recomputeChannelGains()
  }, [recomputeChannelGains])

  const setChannelMuted = useCallback((channelId, muted) => {
    channelMutesRef.current[channelId] = !!muted
    recomputeChannelGains()
  }, [recomputeChannelGains])

  const setChannelSoloed = useCallback((channelId, soloed) => {
    channelSolosRef.current[channelId] = !!soloed
    recomputeChannelGains()
  }, [recomputeChannelGains])

  // Live update of per-row drum velocities — read by the schedule callbacks
  // on each hit so users can drag sliders during playback without restarting.
  const setDrumVolumes = useCallback((volumes) => {
    drumVolumesRef.current = { ...drumVolumesRef.current, ...volumes }
  }, [])

  // Returns linear 0..1 from the meter. Tone.Meter reports dBFS by default,
  // so we convert and clamp to a usable range for the UI bar.
  const getChannelLevel = useCallback((channelId) => {
    const m = channelId === 'master'
      ? masterMeterRef.current
      : channelMetersRef.current[channelId]
    if (!m) return 0
    let v = m.getValue()
    if (Array.isArray(v)) v = Math.max(...v)
    if (!Number.isFinite(v)) return 0
    // Map -60 dBFS..0 dBFS → 0..1
    return Math.max(0, Math.min(1, (v + 60) / 60))
  }, [])

  return {
    audioStarted,
    audioError,
    instrumentLoading,
    isPlaying,
    currentlyPlayingIdx,
    activeMidiNotes,
    ensureStarted,
    previewChord,
    startPlayback,
    stopPlayback,

    // Mixer
    setChannelVolume,
    setChannelMuted,
    setChannelSoloed,
    getChannelLevel,
    setDrumVolumes,

    // Audio sample player
    loadAudioFromUrl,
    clearAudio,
    setAudioLoop,
    audioBufferDuration,
    channelVolumes: channelVolumesRef.current,
    channelMutes:   channelMutesRef.current,
    channelSolos:   channelSolosRef.current,
  }
}
