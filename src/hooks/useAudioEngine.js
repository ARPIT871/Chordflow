import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { midiToToneName } from '../lib/theory'

/**
 * Owns the Tone.js lifecycle: PolySynth + Reverb, Transport scheduling,
 * and the small amount of UI state that the audio loop drives
 * (which slot is currently playing, which MIDI notes are sounding).
 *
 * Browsers require AudioContext to start on a user gesture, so the synth
 * is lazily created on the first play/preview call.
 */
export function useAudioEngine() {
  const [audioStarted, setAudioStarted] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentlyPlayingIdx, setCurrentlyPlayingIdx] = useState(-1)
  const [activeMidiNotes, setActiveMidiNotes] = useState([])

  const synthRef = useRef(null)
  const reverbRef = useRef(null)
  const previewTimeoutRef = useRef(null)
  const previewTokenRef = useRef(0)

  useEffect(() => () => {
    try { Tone.Transport.stop(); Tone.Transport.cancel() } catch { /* noop */ }
    try { synthRef.current?.releaseAll(); synthRef.current?.dispose() } catch { /* noop */ }
    try { reverbRef.current?.dispose() } catch { /* noop */ }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
  }, [])

  const ensureStarted = useCallback(async () => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start()
      }
      if (!synthRef.current) {
        const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).toDestination()
        if (reverb.generate) {
          try { await reverb.generate() } catch { /* impulse generation can be skipped */ }
        }
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 1.6 },
        }).connect(reverb)
        synth.volume.value = -10
        synthRef.current = synth
        reverbRef.current = reverb
      }
      setAudioStarted(true)
      return true
    } catch (e) {
      setAudioError(e.message || String(e))
      return false
    }
  }, [])

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
      // Only clear if no newer preview/playback overrode us.
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
        synthRef.current.triggerAttackRelease(noteNames, chordDurationSec * 0.92, time)
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
    isPlaying,
    currentlyPlayingIdx,
    activeMidiNotes,
    ensureStarted,
    previewChord,
    startPlayback,
    stopPlayback,
  }
}
