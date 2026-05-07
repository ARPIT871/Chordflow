import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Disc3, Volume2 } from 'lucide-react'

import { computeDiatonicChords, midiToToneName } from './lib/theory'
import { romanToDegree } from './lib/presets'
import { exportProgressionAsMidi } from './lib/midi-export'
import { DEFAULT_INSTRUMENT, DEFAULT_PAD, DEFAULT_PLUCK } from './lib/instruments'
import { DEFAULT_ARP_PATTERN, DEFAULT_ARP_RATE } from './lib/arp-patterns'
import { DEFAULT_DRUM_PRESET } from './lib/drum-patterns'
import { useAudioEngine } from './hooks/useAudioEngine'

import ControlsBar from './components/ControlsBar'
import KeyDetector from './components/KeyDetector'
import DiatonicChordsPanel from './components/DiatonicChordsPanel'
import ProgressionBuilder from './components/ProgressionBuilder'
import PresetsPanel from './components/PresetsPanel'
import PianoKeyboard from './components/PianoKeyboard'
import LayersPanel from './components/LayersPanel'
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

  // ─── Layers (chords + pads + pluck + drums) ────────────────────────
  const [chordsEnabled, setChordsEnabled]       = useState(true)
  const [chordInstrument, setChordInstrument]   = useState(DEFAULT_INSTRUMENT)
  const [padsEnabled, setPadsEnabled]           = useState(false)
  const [padInstrument, setPadInstrument]       = useState(DEFAULT_PAD)
  const [pluckEnabled, setPluckEnabled]         = useState(false)
  const [pluckInstrument, setPluckInstrument]   = useState(DEFAULT_PLUCK)
  const [pluckPattern, setPluckPattern]         = useState(DEFAULT_ARP_PATTERN)
  const [pluckRate, setPluckRate]               = useState(DEFAULT_ARP_RATE)
  const [drumsEnabled, setDrumsEnabled]         = useState(false)
  const [drumsPreset, setDrumsPreset]           = useState(DEFAULT_DRUM_PRESET)

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
  const audio = useAudioEngine({ chordInstrument, padInstrument, pluckInstrument })

  // ─── Derived: 7 diatonic chords for current key/scale/complexity ───
  const diatonicChords = useMemo(
    () => computeDiatonicChords(musicKey, scale, complexity),
    [musicKey, scale, complexity]
  )

  // Apply user's octave shift to a chord's MIDI notes.
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

  // Stop playback whenever ANY heard-output setting changes. The user just
  // clicks Play again to hear the new settings — same flow as a DAW.
  // Instrument names are excluded because useAudioEngine handles hot-swap;
  // toggles + drum/arp params force a stop because their schedules are
  // baked into the Transport at startPlayback time.
  useEffect(() => {
    audio.stopPlayback()
  }, [
    musicKey, scale, complexity,
    bpm, barsPerChord, octaveShift,
    progression, progressionSize,
    chordsEnabled, padsEnabled, pluckEnabled, drumsEnabled,
    pluckPattern, pluckRate, drumsPreset,
    audio.stopPlayback,
  ])

  const layerConfig = useMemo(() => ({
    chords: { enabled: chordsEnabled },
    pads:   { enabled: padsEnabled },
    pluck:  { enabled: pluckEnabled, pattern: pluckPattern, rate: pluckRate },
    drums:  { enabled: drumsEnabled, preset: drumsPreset },
  }), [chordsEnabled, padsEnabled, pluckEnabled, drumsEnabled, pluckPattern, pluckRate, drumsPreset])

  // ─── Progression mutations ─────────────────────────────────────────
  const addChordDegree = useCallback((degree) => {
    setProgression(prev => {
      const next = [...prev]
      const emptyIdx = next.findIndex(d => d === null)
      if (emptyIdx === -1) {
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
    audio.startPlayback(chordsWithSlot, { bpm, barsPerChord, layerConfig })
  }, [audio, progression, diatonicChords, shiftNotes, bpm, barsPerChord, layerConfig, showToast])

  const handleExport = useCallback(() => {
    const progChords = progression.map(d => {
      if (d === null || d === undefined) return null
      const c = diatonicChords[d]
      return { ...c, midiNotes: shiftNotes(c.midiNotes) }
    })
    const ok = exportProgressionAsMidi({
      progression: progChords, bpm, barsPerChord, musicKey, scale, layerConfig,
    })
    showToast(ok ? 'Multi-track MIDI downloaded' : 'Add chords to export')
  }, [progression, diatonicChords, shiftNotes, bpm, barsPerChord, musicKey, scale, layerConfig, showToast])

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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-accent-pink to-accent-teal shrink-0">
              <Disc3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">ChordFlow</h1>
              <p className="text-[10px] sm:text-xs text-ink-secondary truncate">
                Sketch the song. Export to FL.
              </p>
            </div>
          </div>
          <AudioStatus audio={audio} />
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-28 sm:pb-6">
        <KeyDetector
          currentKey={musicKey}
          currentScale={scale}
          onPick={(key, sc) => {
            setMusicKey(key)
            setScale(sc)
            showToast(`Key set to ${key} ${sc}`)
          }}
        />

        <ControlsBar
          musicKey={musicKey}     setMusicKey={setMusicKey}
          scale={scale}           setScale={setScale}
          bpm={bpm}               setBpm={setBpm}
          barsPerChord={barsPerChord} setBarsPerChord={setBarsPerChord}
          complexity={complexity} setComplexity={setComplexity}
          octaveShift={octaveShift} setOctaveShift={setOctaveShift}
          onGenerate={() => {
            audio.ensureStarted()
            showToast('Diatonic chords ready — pick a preset or build your own')
          }}
        />

        <LayersPanel
          chordsEnabled={chordsEnabled}     setChordsEnabled={setChordsEnabled}
          chordInstrument={chordInstrument} setChordInstrument={setChordInstrument}
          padsEnabled={padsEnabled}         setPadsEnabled={setPadsEnabled}
          padInstrument={padInstrument}     setPadInstrument={setPadInstrument}
          pluckEnabled={pluckEnabled}       setPluckEnabled={setPluckEnabled}
          pluckInstrument={pluckInstrument} setPluckInstrument={setPluckInstrument}
          pluckPattern={pluckPattern}       setPluckPattern={setPluckPattern}
          pluckRate={pluckRate}             setPluckRate={setPluckRate}
          drumsEnabled={drumsEnabled}       setDrumsEnabled={setDrumsEnabled}
          drumsPreset={drumsPreset}         setDrumsPreset={setDrumsPreset}
          instrumentLoading={audio.instrumentLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
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

        <section className="gradient-border rounded-2xl p-4 sm:p-5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Live Notes
            </h2>
            {audio.activeMidiNotes.length > 0 && (
              <span className="text-[10px] sm:text-xs text-accent-pink font-mono truncate ml-2">
                {audio.activeMidiNotes.map(midiToToneName).join(' · ')}
              </span>
            )}
          </div>
          <PianoKeyboard activeMidiNotes={audio.activeMidiNotes} />
        </section>
      </main>

      {/* Sticky mobile play bar — keeps Play within thumb reach on phones. */}
      <MobilePlayBar
        isPlaying={audio.isPlaying}
        onPlayToggle={handlePlayToggle}
        onExport={handleExport}
      />

      <Toast message={toast} />
    </div>
  )
}

function AudioStatus({ audio }) {
  if (audio.audioError) {
    return <span className="text-[10px] sm:text-xs text-amber-400 truncate">Audio: {audio.audioError}</span>
  }
  if (!audio.audioStarted) {
    return <span className="text-[10px] sm:text-xs text-ink-secondary text-right truncate">Tap any chord to enable sound</span>
  }
  return (
    <span className="text-[10px] sm:text-xs text-teal-300 flex items-center gap-1 sm:gap-1.5 shrink-0">
      <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Audio ready
    </span>
  )
}

function MobilePlayBar({ isPlaying, onPlayToggle, onExport }) {
  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#15152a]/95 backdrop-blur-md border-t border-white/10 px-3 py-3 flex gap-2">
      <button
        onClick={onPlayToggle}
        className={
          'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-white shadow-lg ' +
          (isPlaying
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : 'bg-gradient-to-br from-accent-teal to-teal-200')
        }
      >
        {isPlaying ? '■ Stop' : '▶ Play'}
      </button>
      <button
        onClick={onExport}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium bg-card text-white border border-white/10"
      >
        ↓ MIDI
      </button>
    </div>
  )
}
