import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { computeDiatonicChords } from './lib/theory'
import { romanToDegree } from './lib/presets'
import { exportProgressionAsMidi } from './lib/midi-export'
import { DEFAULT_INSTRUMENT, DEFAULT_PAD, DEFAULT_PLUCK } from './lib/instruments'
import { DEFAULT_ARP_PATTERN, DEFAULT_ARP_RATE } from './lib/arp-patterns'
import {
  DEFAULT_DRUM_PRESET, DEFAULT_VOLUMES, DRUM_VOICES, getDrumPattern,
} from './lib/drum-patterns'
import { useAudioEngine } from './hooks/useAudioEngine'

import TopBar from './components/TopBar'
import ArrangementStrip from './components/ArrangementStrip'
import HorizontalMixer from './components/HorizontalMixer'
import KeyDetector from './components/KeyDetector'
import DiatonicChordsPanel from './components/DiatonicChordsPanel'
import ProgressionBuilder from './components/ProgressionBuilder'
import PresetsPanel from './components/PresetsPanel'
import PianoKeyboard from './components/PianoKeyboard'
import LayersPanel from './components/LayersPanel'
import DrumSequencer from './components/DrumSequencer'
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
  const [activeSection, setActiveSection] = useState('verse')
  const [collabOpen, setCollabOpen] = useState(false)

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
  const [drumPattern, setDrumPattern]           = useState(() => getDrumPattern(DEFAULT_DRUM_PRESET))
  const [drumMutes, setDrumMutes]               = useState(() =>
    Object.fromEntries(DRUM_VOICES.map(v => [v, false]))
  )
  const [drumSolos, setDrumSolos]               = useState(() =>
    Object.fromEntries(DRUM_VOICES.map(v => [v, false]))
  )
  const [drumVolumes, setDrumVolumes]           = useState(() => ({ ...DEFAULT_VOLUMES }))

  // Visual playhead position for the drum grid. Driven by setInterval
  // during playback — close enough for the cell highlight; sample-accurate
  // audio timing remains in the Tone.Transport schedule.
  const [drumStep, setDrumStep] = useState(0)

  // ─── Progression ────────────────────────────────────────────────────
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

  // ─── Diatonic chords for current key/scale/complexity ──────────────
  const diatonicChords = useMemo(
    () => computeDiatonicChords(musicKey, scale, complexity),
    [musicKey, scale, complexity]
  )

  const shiftNotes = useCallback(
    (midiNotes) => midiNotes.map(n => n + octaveShift * 12),
    [octaveShift]
  )

  useEffect(() => {
    setProgression(prev => {
      if (prev.length === progressionSize) return prev
      const next = prev.slice(0, progressionSize)
      while (next.length < progressionSize) next.push(null)
      return next
    })
  }, [progressionSize])

  useEffect(() => {
    audio.stopPlayback()
  }, [
    musicKey, scale, complexity,
    bpm, barsPerChord, octaveShift,
    progression, progressionSize,
    chordsEnabled, padsEnabled, pluckEnabled, drumsEnabled,
    pluckPattern, pluckRate,
    drumPattern, drumMutes, drumSolos,
    audio.stopPlayback,
  ])

  // Drive the visual playhead at 16th-note resolution while playing.
  useEffect(() => {
    if (!audio.isPlaying) { setDrumStep(0); return }
    const stepMs = 60000 / bpm / 4
    const t = setInterval(() => setDrumStep(s => (s + 1) % 16), stepMs)
    return () => clearInterval(t)
  }, [audio.isPlaying, bpm])

  const layerConfig = useMemo(() => ({
    chords: { enabled: chordsEnabled },
    pads:   { enabled: padsEnabled },
    pluck:  { enabled: pluckEnabled, pattern: pluckPattern, rate: pluckRate },
    drums:  {
      enabled: drumsEnabled,
      pattern: drumPattern,
      mutes:   drumMutes,
      solos:   drumSolos,
      volumes: drumVolumes,
    },
  }), [
    chordsEnabled, padsEnabled, pluckEnabled, drumsEnabled,
    pluckPattern, pluckRate,
    drumPattern, drumMutes, drumSolos, drumVolumes,
  ])

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
    setProgression(prev => { const next = [...prev]; next[idx] = null; return next })
  }, [])

  const setChordAt = useCallback((idx, degree) => {
    setProgression(prev => { const next = [...prev]; next[idx] = degree; return next })
  }, [])

  const swapChords = useCallback((from, to) => {
    setProgression(prev => {
      const next = [...prev]
      const tmp = next[from]; next[from] = next[to]; next[to] = tmp
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

  // Currently playing chord — drives palette glow + piano keyboard.
  const playingChord = useMemo(() => {
    if (!audio.isPlaying || audio.currentlyPlayingIdx < 0) return null
    const d = progression[audio.currentlyPlayingIdx]
    return d != null ? diatonicChords[d] : null
  }, [audio.isPlaying, audio.currentlyPlayingIdx, progression, diatonicChords])

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <TopBar
        isPlaying={audio.isPlaying}
        onPlayToggle={handlePlayToggle}
        onStop={audio.stopPlayback}
        bpm={bpm}                       setBpm={setBpm}
        musicKey={musicKey}             scale={scale}
        barsPerChord={barsPerChord}     setBarsPerChord={setBarsPerChord}
        complexity={complexity}         setComplexity={setComplexity}
        octaveShift={octaveShift}       setOctaveShift={setOctaveShift}
        chordInstrument={chordInstrument}
        collabOpen={collabOpen}
        onToggleCollab={() => setCollabOpen(o => !o)}
        onExport={handleExport}
        onSave={() => showToast('Save coming soon — for now, Export gives you the MIDI')}
      />

      <ArrangementStrip active={activeSection} setActive={setActiveSection} />

      <div
        className="flex-1 overflow-y-auto"
        style={{ transition: 'padding-right .3s', paddingRight: collabOpen ? 360 : 0 }}
      >
        <div
          className="grid gap-3 px-3 sm:px-4 py-3 min-h-full"
          style={{ gridTemplateColumns: 'minmax(0,1fr)' }}
        >
          {/* Two-column on lg+, single column on smaller — mirrors design's 260px+fluid */}
          <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-3">
              <KeyDetector
                currentKey={musicKey}
                currentScale={scale}
                onPick={(key, sc) => {
                  setMusicKey(key); setScale(sc)
                  showToast(`Key set to ${key} ${sc}`)
                }}
              />
              <PresetsPanel
                scale={scale}
                diatonicChords={diatonicChords}
                onApply={applyPreset}
              />
            </div>

            <div className="space-y-3 min-w-0">
              <DiatonicChordsPanel
                chords={diatonicChords}
                musicKey={musicKey}
                scale={scale}
                complexity={complexity}
                playingDegree={playingChord?.degree ?? -1}
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

              <LayersPanel
                chordsEnabled={chordsEnabled}     setChordsEnabled={setChordsEnabled}
                chordInstrument={chordInstrument} setChordInstrument={setChordInstrument}
                padsEnabled={padsEnabled}         setPadsEnabled={setPadsEnabled}
                padInstrument={padInstrument}     setPadInstrument={setPadInstrument}
                pluckEnabled={pluckEnabled}       setPluckEnabled={setPluckEnabled}
                pluckInstrument={pluckInstrument} setPluckInstrument={setPluckInstrument}
                pluckPattern={pluckPattern}       setPluckPattern={setPluckPattern}
                pluckRate={pluckRate}             setPluckRate={setPluckRate}
              />

              <DrumSequencer
                pattern={drumPattern}     setPattern={setDrumPattern}
                mutes={drumMutes}         setMutes={setDrumMutes}
                solos={drumSolos}         setSolos={setDrumSolos}
                volumes={drumVolumes}     setVolumes={setDrumVolumes}
                preset={drumsPreset}      setPreset={setDrumsPreset}
                enabled={drumsEnabled}    setEnabled={setDrumsEnabled}
                isPlaying={audio.isPlaying}
                currentStep={drumStep}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ transition: 'padding-right .3s', paddingRight: collabOpen ? 360 : 0 }}>
        <HorizontalMixer
          isPlaying={audio.isPlaying}
          layers={{ chordsEnabled, padsEnabled, pluckEnabled, drumsEnabled }}
        />
        <PianoKeyboard
          activeMidiNotes={audio.activeMidiNotes}
          currentChordName={playingChord ? `${playingChord.name} ${playingChord.quality}` : null}
        />
      </div>

      <CollabPanelStub open={collabOpen} onClose={() => setCollabOpen(false)} />
      <Toast message={toast} />
    </div>
  )
}

/**
 * Visual-only collab panel — the design renders a full live-session UI
 * but the real-time backend (presence, voice chat, role assignment) is
 * deferred. This stub matches the slide-out look and shows mock collaborators.
 */
function CollabPanelStub({ open, onClose }) {
  const COLLAB = [
    { name: 'Arpit',   role: 'Drums',     color: '#ff6b9d', initials: 'AR' },
    { name: 'Riya',    role: 'Piano',     color: '#4ecdc4', initials: 'RI' },
    { name: 'Karan',   role: 'Guitar',    color: '#f5a524', initials: 'KA' },
    { name: 'Meera',   role: 'Bass',      color: '#a78bfa', initials: 'ME' },
    { name: 'Devansh', role: 'Mic',       color: '#7be0d8', initials: 'DE' },
  ]
  return (
    <div
      className="fixed top-0 right-0 h-full transition-all duration-300 z-40"
      style={{
        width: open ? 360 : 0,
        background: '#1d1d33',
        borderLeft: open ? '1px solid var(--line)' : 'none',
        boxShadow: open ? '-20px 0 60px rgba(0,0,0,.5)' : 'none',
        overflow: 'hidden',
      }}
    >
      <div className="w-[360px] h-full flex flex-col">
        <div
          className="flex items-center justify-between px-4 h-14 border-b shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-teal pulse-dot" />
            <span className="text-[13px] font-semibold">Live session</span>
            <span
              className="mono text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(78,205,196,.12)', color: '#4ecdc4' }}
            >MOCK</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#33334d]"
            aria-label="Close collab panel"
          >
            <span className="text-ink-secondary text-lg leading-none">×</span>
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <div className="text-[10px] mono mb-1.5" style={{ color: 'var(--text-3)' }}>SESSION URL</div>
            <div className="chip px-3 py-2 mono text-[11px] flex items-center justify-between">
              <span style={{ color: 'var(--text-2)' }}>chordflow.studio/s/—</span>
              <span style={{ color: '#4ecdc4' }}>Copy</span>
            </div>
            <div className="text-[10px] mt-2" style={{ color: 'var(--text-3)' }}>
              Real-time sync isn't wired up yet — this panel matches the design but
              isn't functional. Slice 5 work.
            </div>
          </div>
          <div>
            <div className="text-[10px] mono mb-2" style={{ color: 'var(--text-3)' }}>
              CONNECTED · 5 of 6 (mock)
            </div>
            <div className="space-y-1.5">
              {COLLAB.map(c => (
                <div key={c.name} className="flex items-center gap-2.5 p-2 rounded-md" style={{ background: '#262640' }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold mono"
                    style={{ background: c.color, color: '#1a1a2e' }}
                  >
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium">{c.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{c.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
