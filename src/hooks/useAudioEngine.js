import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { midiToToneName } from '../lib/theory'
import { INSTRUMENTS, DEFAULT_INSTRUMENT } from '../lib/instruments'

/**
 * Owns the Tone.js lifecycle: instrument (PolySynth or Sampler) + Reverb,
 * Transport scheduling, and the small slice of UI state the audio loop
 * drives (playing-slot index, currently sounding MIDI notes).
 *
 * Browsers require AudioContext to start on a user gesture, so the audio
 * graph is lazily created on the first preview/play call.
 *
 * Pass `instrumentName` to switch timbre. Sample-based instruments load
 * a few MB of mp3s the first time they're picked; `instrumentLoading`
 * reflects that.
 */
export function useAudioEngine(instrumentName = DEFAULT_INSTRUMENT) {
  const [audioStarted, setAudioStarted] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [instrumentLoading, setInstrumentLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentlyPlayingIdx, setCurrentlyPlayingIdx] = useState(-1)
  const [activeMidiNotes, setActiveMidiNotes] = useState([])

  const synthRef = useRef(null)
  const reverbRef = useRef(null)
  const previewTimeoutRef = useRef(null)
  const previewTokenRef = useRef(0)

  // ─── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => () => {
    try { Tone.Transport.stop(); Tone.Transport.cancel() } catch { /* noop */ }
    try { synthRef.current?.releaseAll(); synthRef.current?.dispose() } catch { /* noop */ }
    try { reverbRef.current?.dispose() } catch { /* noop */ }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
  }, [])

  // ─── Build the Tone instrument for the current name ────────────────
  const buildInstrument = useCallback(async (name) => {
    const def = INSTRUMENTS[name] || INSTRUMENTS[DEFAULT_INSTRUMENT]

    if (def.kind === 'synth') {
      const synth = def.create()
      synth.volume.value = -10
      return synth
    }

    // sampler — wait for samples to load before returning
    setInstrumentLoading(true)
    try {
      const sampler = await new Promise((resolve, reject) => {
        const s = new Tone.Sampler({
          ...def.options,
          onload:  () => resolve(s),
          onerror: (e) => reject(e),
        })
      })
      sampler.volume.value = -8
      return sampler
    } finally {
      setInstrumentLoading(false)
    }
  }, [])

  // ─── Boot AudioContext + reverb on first user gesture ──────────────
  const ensureStarted = useCallback(async () => {
    try {
      if (Tone.context.state !== 'running') await Tone.start()
      if (!reverbRef.current) {
        const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).toDestination()
        if (reverb.generate) {
          try { await reverb.generate() } catch { /* impulse generation can be skipped */ }
        }
        reverbRef.current = reverb
      }
      if (!synthRef.current) {
        const inst = await buildInstrument(instrumentName)
        inst.connect(reverbRef.current)
        synthRef.current = inst
      }
      setAudioStarted(true)
      return true
    } catch (e) {
      setAudioError(e.message || String(e))
      return false
    }
  }, [buildInstrument, instrumentName])

  // ─── Hot-swap instrument when `instrumentName` changes ─────────────
  useEffect(() => {
    if (!audioStarted || !reverbRef.current) return
    let cancelled = false

    ;(async () => {
      // Stop anything currently sounding so the swap is clean
      try {
        Tone.Transport.stop()
        Tone.Transport.cancel()
        synthRef.current?.releaseAll()
      } catch { /* noop */ }
      setIsPlaying(false)
      setCurrentlyPlayingIdx(-1)
      setActiveMidiNotes([])

      let next
      try {
        next = await buildInstrument(instrumentName)
      } catch (e) {
        if (!cancelled) setAudioError(`Failed to load ${instrumentName}: ${e.message || e}`)
        return
      }
      if (cancelled) { try { next.dispose() } catch {} ; return }

      next.connect(reverbRef.current)
      const old = synthRef.current
      synthRef.current = next
      try { old?.dispose() } catch { /* noop */ }
    })()

    return () => { cancelled = true }
  }, [instrumentName, audioStarted, buildInstrument])

  // ─── Preview a single chord (clicked from a chord card) ────────────
  const previewChord = useCallback(async (midiNotes) => {
    const ok = await ensureStarted()
    if (!ok || !synthRef.current) return
    const noteNames = midiNotes.map(midiToToneName)
    try { synthRef.current.releaseAll() } catch { /* noop */ }
    synthRef.current.triggerAttackRelease(noteNames, 1.4)
    setActiveMidiNotes(midiNotes)

    const token = ++previewTokenRef.current
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      if (previewTokenRef.current === token) setActiveMidiNotes([])
    }, 1400)
  }, [ensureStarted])

  /**
   * `chordsWithSlot` = ordered list of { midiNotes, slotIdx } —
   * slotIdx lets the UI highlight the right slot in the original progression.
   */
  const startPlayback = useCallback(async (chordsWithSlot, { bpm, barsPerChord }) => {
    if (!chordsWithSlot.length) return false
    const ok = await ensureStarted()
    if (!ok) return false

    Tone.Transport.cancel()
    Tone.Transport.stop()
    Tone.Transport.position = 0
    Tone.Transport.bpm.value = bpm

    const chordDurationSec = barsPerChord * 4 * (60 / bpm)
    const totalLoopSec = chordsWithSlot.length * chordDurationSec

    chordsWithSlot.forEach(({ midiNotes, slotIdx }, seqIdx) => {
      const startOffset = seqIdx * chordDurationSec
      Tone.Transport.scheduleRepeat((time) => {
        const noteNames = midiNotes.map(midiToToneName)
        synthRef.current?.triggerAttackRelease(noteNames, chordDurationSec * 0.92, time)
        Tone.Draw.schedule(() => {
          setCurrentlyPlayingIdx(slotIdx)
          setActiveMidiNotes(midiNotes)
        }, time)
      }, totalLoopSec, startOffset)
    })

    Tone.Transport.start()
    setIsPlaying(true)
    return true
  }, [ensureStarted])

  const stopPlayback = useCallback(() => {
    try {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      synthRef.current?.releaseAll()
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
