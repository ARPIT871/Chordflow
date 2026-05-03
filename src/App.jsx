import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Disc3, Volume2 } from 'lucide-react'

import { computeDiatonicChords, midiToToneName } from './lib/theory'
import { romanToDegree } from './lib/presets'
import { exportProgressionAsMidi } from './lib/midi-export'
import { DEFAULT_INSTRUMENT } from './lib/instruments'
import { useAudioEngine } from './hooks/useAudioEngine'

import ControlsBar from './components/ControlsBar'
import DiatonicChordsPanel from './components/DiatonicChordsPanel'
import ProgressionBuilder from './components/ProgressionBuilder'
import PresetsPanel from './components/PresetsPanel'
import PianoKeyboard from './components/PianoKeyboard'
import Toast from './components/Toast'

const DEFAULT_PROGRESSION_SIZE = 4

export default function App() {
  // ─── User settings ──────────────────────────────────────────────────
  const [musicKey, setMusicKey] = useState('C')
  const [scale, setScale] = useState('Natural Minor')
  const [bpm, setBpm] = useState(86)
  const [barsPerChord, setBarsPerChord] = useState(2)
  const [complexity, setComplexity] = useState('Triads')
  const [octaveShift, setOctaveShift] = useState(0)
  const [instrument, setInstrument] = useState(DEFAULT_INSTRUMENT)

  // ─── Progression (stores scale-degree indices, derives chord at render) ─
  const [progressionSize, setProgressionSize] = useState(DEFAULT_PROGRESSION_SIZE)
  const [progression, setProgression] = useState(() => Array(DEFAULT_PROGRESSION_SIZE).fill(null))

  // ─── Toast ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2200)
  }, [])
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }, [])

  // ─── Audio ──────────────────────────────────────────────────────────
  const audio = useAudioEngine(instrument)

  // ─── Derived: 7 diatonic chords for current key/scale/complexity ───
  const diatonicChords = useMemo(
    () => computeDiatonicChords(musicKey, scale, complexity),
    [musicKey, scale, complexity]
  )

  // Apply user's octave shift to a chord's MIDI notes.
  // Display (note names, roman numerals) is octave-agnostic so it stays unchanged.
  const shiftNotes = useCallback(
    (midiNotes) => midiNotes.map(n => n + octaveShift * 12),
    [octaveShift]
  )

  // Resize progression array when slot count changes
  useEffect(() => {
    setProgression(prev => {
      if (prev.length === progressionSize) return prev
      const next = prev.slice(0, progressionSize)
      while (next.length < progressionSize) next.push(null)
      return next
    })
  }, [progressionSize])

  // Stop playback on theory change so the user doesn't hear the wrong chords
  useEffect(() => {
    audio.stopPlayback()
  }, [musicKey, scale, complexity, audio.stopPlayback])

  // ─── Progression mutations ─────────────────────────────────────────
  const addChordDegree = useCallback((degree) => {
    setProgression(prev => {
      const next = [...prev]
      const emptyIdx = next.findIndex(d => d === null)
      if (emptyIdx === -1) {
        // Full — shift left, append
        for (let i = 0; i < next.length - 1; i++) next[i] = next[i + 1]
        next[next.length - 1] = degree
      } else {
        next[emptyIdx] = degree
      }
      return next
    })
  }, [])

  const removeChordAt = useCallback((idx) => {
    setProgression(prev => {
      const next = [...prev]
      next[idx] = null
      return next
    })
  }, [])

  const setChordAt = useCallback((idx, degree) => {
    setProgression(prev => {
      const next = [...prev]
      next[idx] = degree
      return next
    })
  }, [])

  const swapChords = useCallback((from, to) => {
    setProgression(prev => {
      const next = [...prev]
      const tmp = next[from]
      next[from] = next[to]
      next[to] = tmp
      return next
    })
  }, [])

  const clearProgression = useCallback(() => {
    setProgression(Array(progressionSize).fill(null))
  }, [progressionSize])

  const applyPreset = useCallback((preset) => {
    const next = Array(progressionSize).fill(null)
    preset.romans.forEach((roman, i) => {
      if (i >= progressionSize) return
      next[i] = romanToDegree(roman)
    })
    setProgression(next)
  }, [progressionSize])

  // ─── Playback / export / clipboard ─────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    if (audio.isPlaying) { audio.stopPlayback(); return }

    const chordsWithSlot = progression
      .map((degree, slotIdx) =>
        degree !== null && degree !== undefined
          ? { midiNotes: shiftNotes(diatonicChords[degree].midiNotes), slotIdx }
          : null
      )
      .filter(Boolean)

    if (chordsWithSlot.length === 0) {
      showToast('Add chords to your progression first')
      return
    }
    audio.startPlayback(chordsWithSlot, { bpm, barsPerChord })
  }, [audio, progression, diatonicChords, shiftNotes, bpm, barsPerChord, showToast])

  const handleExport = useCallback(() => {
    const progChords = progression.map(d => {
      if (d === null || d === undefined) return null
      const c = diatonicChords[d]
      return { ...c, midiNotes: shiftNotes(c.midiNotes) }
    })
    const ok = exportProgressionAsMidi({
      progression: progChords, bpm, barsPerChord, musicKey, scale,
    })
    showToast(ok ? 'MIDI file downloaded' : 'Add chords to export')
  }, [progression, diatonicChords, shiftNotes, bpm, barsPerChord, musicKey, scale, showToast])

  const handleCopy = useCallback(() => {
    const text = progression
      .map(d => (d !== null && d !== undefined ? diatonicChords[d].name : null))
      .filter(Boolean)
      .join(' → ')
    if (!text) { showToast('Nothing to copy'); return }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => showToast(`Copied: ${text}`))
        .catch(() => showToast('Copy failed'))
    } else {
      showToast('Clipboard not available')
    }
  }, [progression, diatonicChords, showToast])

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      <header className="border-b border-white/10 bg-[#15152a]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-accent-pink to-accent-teal">
              <Disc3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ChordFlow</h1>
              <p className="text-xs text-ink-secondary">Find the progression. Hum the melody. Export to FL.</p>
            </div>
          </div>
          <AudioStatus audio={audio} />
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <ControlsBar
          musicKey={musicKey}     setMusicKey={setMusicKey}
          scale={scale}           setScale={setScale}
          bpm={bpm}               setBpm={setBpm}
          barsPerChord={barsPerChord} setBarsPerChord={setBarsPerChord}
          complexity={complexity} setComplexity={setComplexity}
          octaveShift={octaveShift} setOctaveShift={setOctaveShift}
          instrument={instrument} setInstrument={setInstrument}
          instrumentLoading={audio.instrumentLoading}
          onGenerate={() => {
            audio.ensureStarted()
            showToast('Diatonic chords ready — pick a preset or build your own')
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <DiatonicChordsPanel
            chords={diatonicChords}
            musicKey={musicKey}
            scale={scale}
            onPreview={(chord) => audio.previewChord(shiftNotes(chord.midiNotes))}
            onAdd={(chord) => addChordDegree(chord.degree)}
          />
          <ProgressionBuilder
            progression={progression}
            progressionSize={progressionSize}
            setProgressionSize={setProgressionSize}
            diatonicChords={diatonicChords}
            currentlyPlayingIdx={audio.currentlyPlayingIdx}
            isPlaying={audio.isPlaying}
            bpm={bpm}
            barsPerChord={barsPerChord}
            onPlayToggle={handlePlayToggle}
            onExport={handleExport}
            onCopy={handleCopy}
            onClear={clearProgression}
            onRemove={removeChordAt}
            onSwap={swapChords}
            onSetSlot={setChordAt}
          />
          <PresetsPanel
            scale={scale}
            diatonicChords={diatonicChords}
            onApply={applyPreset}
          />
        </div>

        <section className="mt-6 gradient-border rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Live Notes
            </h2>
            {audio.activeMidiNotes.length > 0 && (
              <span className="text-xs text-accent-pink font-mono">
                {audio.activeMidiNotes.map(midiToToneName).join(' · ')}
              </span>
            )}
          </div>
          <PianoKeyboard activeMidiNotes={audio.activeMidiNotes} />
        </section>
      </main>

      <Toast message={toast} />
    </div>
  )
}

function AudioStatus({ audio }) {
  if (audio.audioError) {
    return <span className="text-xs text-amber-400">Audio: {audio.audioError}</span>
  }
  if (!audio.audioStarted) {
    return <span className="text-xs text-ink-secondary">Click any chord to enable sound</span>
  }
  return (
    <span className="text-xs text-teal-300 flex items-center gap-1.5">
      <Volume2 className="w-3.5 h-3.5" /> Audio ready
    </span>
  )
}
