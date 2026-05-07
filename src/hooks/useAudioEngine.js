import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { midiToToneName } from '../lib/theory'
import { INSTRUMENTS, DEFAULT_INSTRUMENT, createDrumKit } from '../lib/instruments'
import { buildArpSequence, arpStepDurationSec } from '../lib/arp-patterns'
import { DRUM_VOICES, isVoiceAudible } from '../lib/drum-patterns'

/**
 * Multi-layer audio engine. Owns the Tone.js lifecycle for four parallel
 * layers: chords, pads, pluck, drums. Each melodic layer keeps its own
 * Synth/Sampler instance so the user can A/B sounds; drums use a synth-only
 * kit for zero-load groove sketching.
 *
 * Browsers require AudioContext to start on a user gesture, so the audio
 * graph is lazily created on the first preview/play call.
 *
 * Hook input — instrument names per layer (sample-based ones download a
 * few MB the first time they're picked; `instrumentLoading` reflects that
 * across all layers).
 */
export function useAudioEngine({
  chordInstrument = DEFAULT_INSTRUMENT,
  padInstrument = 'Soft Pad',
  pluckInstrument = 'Pluck',
} = {}) {
  const [audioStarted, setAudioStarted] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [instrumentLoading, setInstrumentLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentlyPlayingIdx, setCurrentlyPlayingIdx] = useState(-1)
  const [activeMidiNotes, setActiveMidiNotes] = useState([])

  // One Tone instrument per melodic layer + a drum kit.
  const chordSynthRef = useRef(null)
  const padSynthRef   = useRef(null)
  const pluckSynthRef = useRef(null)
  const drumKitRef    = useRef(null)
  const reverbRef     = useRef(null)

  const previewTimeoutRef = useRef(null)
  const previewTokenRef = useRef(0)

  // ─── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => () => {
    try { Tone.Transport.stop(); Tone.Transport.cancel() } catch { /* noop */ }
    try { chordSynthRef.current?.releaseAll(); chordSynthRef.current?.dispose() } catch { /* noop */ }
    try { padSynthRef.current?.releaseAll();   padSynthRef.current?.dispose()   } catch { /* noop */ }
    try { pluckSynthRef.current?.releaseAll(); pluckSynthRef.current?.dispose() } catch { /* noop */ }
    try { drumKitRef.current?.dispose() } catch { /* noop */ }
    try { reverbRef.current?.dispose() } catch { /* noop */ }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
  }, [])

  // ─── Build a Tone instrument by preset name ────────────────────────
  // Tags the instance with `__loadedName` so swap effects can skip no-op
  // rebuilds when their dep changes (e.g. audioStarted flipping true after
  // ensureStarted has already built the chord synth).
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
      sampler.volume.value = defaultVolumeDb + 2 // samplers tend to be quieter
      sampler.__loadedName = name
      return sampler
    } finally {
      setInstrumentLoading(false)
    }
  }, [])

  // ─── Boot AudioContext + master FX + initial chord synth ───────────
  const ensureStarted = useCallback(async () => {
    try {
      if (Tone.context.state !== 'running') await Tone.start()
      if (!reverbRef.current) {
        const reverb = new Tone.Reverb({ decay: 2, wet: 0.25 }).toDestination()
        if (reverb.generate) {
          try { await reverb.generate() } catch { /* impulse generation can be skipped */ }
        }
        reverbRef.current = reverb
      }
      if (!chordSynthRef.current) {
        const inst = await buildInstrument(chordInstrument, -10)
        inst.connect(reverbRef.current)
        chordSynthRef.current = inst
      }
      setAudioStarted(true)
      return true
    } catch (e) {
      setAudioError(e.message || String(e))
      return false
    }
  }, [buildInstrument, chordInstrument])

  // ─── Per-layer hot-swap when instrument prop changes ───────────────
  // Pads/Pluck synths are built lazily (only after they've been used at
  // least once) so we don't waste a node on disabled layers. Only swap
  // if the layer has already been instantiated; otherwise its first use
  // in startPlayback will build it fresh with the latest name.
  const swapInstrument = useCallback(async (ref, instrumentName, volumeDb) => {
    if (!audioStarted || !reverbRef.current || !ref.current) return null
    if (ref.current.__loadedName === instrumentName) return null // no-op
    try { ref.current?.releaseAll() } catch { /* noop */ }
    let next
    try {
      next = await buildInstrument(instrumentName, volumeDb)
    } catch (e) {
      setAudioError(`Failed to load ${instrumentName}: ${e.message || e}`)
      return null
    }
    next.connect(reverbRef.current)
    const old = ref.current
    ref.current = next
    try { old?.dispose() } catch { /* noop */ }
    return next
  }, [audioStarted, buildInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(chordSynthRef, chordInstrument, -10).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [chordInstrument, swapInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(padSynthRef, padInstrument, -16).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [padInstrument, swapInstrument])

  useEffect(() => {
    let cancelled = false
    swapInstrument(pluckSynthRef, pluckInstrument, -12).then(next => {
      if (cancelled && next) { try { next.dispose() } catch {} }
    })
    return () => { cancelled = true }
  }, [pluckInstrument, swapInstrument])

  // Lazily build a layer if it isn't built yet (called from startPlayback).
  const ensureLayer = useCallback(async (ref, name, volumeDb) => {
    if (ref.current) return ref.current
    const inst = await buildInstrument(name, volumeDb)
    inst.connect(reverbRef.current)
    ref.current = inst
    return inst
  }, [buildInstrument])

  const ensureDrumKit = useCallback(() => {
    if (drumKitRef.current) return drumKitRef.current
    const kit = createDrumKit()
    kit.connect(reverbRef.current)
    drumKitRef.current = kit
    return kit
  }, [])

  // ─── Preview a single chord (clicked from a chord card) ────────────
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
   * `chordsWithSlot` = ordered list of { midiNotes, slotIdx } —
   * slotIdx lets the UI highlight the right slot in the original progression.
   *
   * `layerConfig` = per-layer toggles & params:
   *   chords: { enabled }
   *   pads:   { enabled }
   *   pluck:  { enabled, pattern, rate }     // rate in '1/8' | '1/16'
   *   drums:  { enabled, preset }            // preset key in DRUM_PRESETS
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
      drums:  {
        enabled: !!cfg.drums?.enabled,
        pattern: cfg.drums?.pattern,                  // 6×16 grid object
        mutes:   cfg.drums?.mutes  || {},
        solos:   cfg.drums?.solos  || {},
      },
    }

    // Lazily build any layers we'll actually use.
    if (layers.pads.enabled)  await ensureLayer(padSynthRef,   padInstrument,   -16)
    if (layers.pluck.enabled) await ensureLayer(pluckSynthRef, pluckInstrument, -12)
    if (layers.drums.enabled) ensureDrumKit()

    Tone.Transport.cancel()
    Tone.Transport.stop()
    Tone.Transport.position = 0
    Tone.Transport.bpm.value = bpm

    const beatSec = 60 / bpm
    const barSec = beatSec * 4
    const chordDurationSec = barsPerChord * barSec
    const totalLoopSec = chordsWithSlot.length * chordDurationSec

    // ─── Per-chord scheduling: chords / pads / pluck ─────────────────
    chordsWithSlot.forEach(({ midiNotes, slotIdx }, seqIdx) => {
      const startOffset = seqIdx * chordDurationSec

      Tone.Transport.scheduleRepeat((time) => {
        const noteNames = midiNotes.map(midiToToneName)

        // CHORDS — full chord block hit per slot
        if (layers.chords.enabled && chordSynthRef.current) {
          chordSynthRef.current.triggerAttackRelease(noteNames, chordDurationSec * 0.92, time)
        }

        // PADS — sustained backing chord per slot, slightly softer
        if (layers.pads.enabled && padSynthRef.current) {
          padSynthRef.current.triggerAttackRelease(noteNames, chordDurationSec * 0.98, time, 0.7)
        }

        // PLUCK — arpeggio across the chord's duration
        if (layers.pluck.enabled && pluckSynthRef.current) {
          const seq = buildArpSequence(midiNotes, layers.pluck.pattern, layers.pluck.rate, barsPerChord)
          const stepSec = arpStepDurationSec(layers.pluck.rate, bpm)
          for (const ev of seq) {
            const evTime = time + ev.stepIdx * stepSec
            if (ev.chord) {
              const names = ev.chord.map(midiToToneName)
              pluckSynthRef.current.triggerAttackRelease(names, stepSec * 0.85, evTime, 0.6)
            } else {
              const name = midiToToneName(ev.midi)
              pluckSynthRef.current.triggerAttackRelease(name, stepSec * 0.85, evTime, 0.7)
            }
          }
        }

        // UI highlight (chord-slot + chord notes)
        Tone.Draw.schedule(() => {
          setCurrentlyPlayingIdx(slotIdx)
          setActiveMidiNotes(midiNotes)
        }, time)
      }, totalLoopSec, startOffset)
    })

    // ─── Drums: schedule one bar repeating across the whole loop ─────
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
              drumKitRef.current?.trigger(voice, time)
            }, totalLoopSec, offset)
          }
        }
      }
    }

    Tone.Transport.start()
    setIsPlaying(true)
    return true
  }, [ensureStarted, ensureLayer, ensureDrumKit, padInstrument, pluckInstrument])

  const stopPlayback = useCallback(() => {
    try {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      chordSynthRef.current?.releaseAll()
      padSynthRef.current?.releaseAll()
      pluckSynthRef.current?.releaseAll()
    } catch { /* noop */ }
    setIsPlaying(false)
    setCurrentlyPlayingIdx(-1)
    setActiveMidiNotes([])
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
  }
}
