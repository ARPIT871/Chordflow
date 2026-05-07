import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  computeDiatonicChords, computeBorrowedChords, computeModalChords,
  modalScaleNameFor, borrowedScaleNameFor,
} from './lib/theory'
import { romanToDegree } from './lib/presets'
import { exportProgressionAsMidi } from './lib/midi-export'
import { DEFAULT_INSTRUMENT, DEFAULT_PAD, DEFAULT_PLUCK, DEFAULT_BASS } from './lib/instruments'
import { DEFAULT_ARP_PATTERN, DEFAULT_ARP_RATE } from './lib/arp-patterns'
import { DEFAULT_BASS_MODE } from './lib/bass-patterns'
import {
  DEFAULT_DRUM_PRESET, DEFAULT_VOLUMES, DRUM_VOICES, getDrumPattern,
} from './lib/drum-patterns'
import { useAudioEngine } from './hooks/useAudioEngine'
import {
  serializeProject, saveDraft, loadDraft,
  listProjects, loadProject, saveProject, deleteProject,
  downloadProjectFile, readProjectFile,
} from './lib/projects'
import { renderAllStems, downloadStems } from './lib/render-stem'

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
import AudioLayer from './components/AudioLayer'
import ProjectMenu from './components/ProjectMenu'
import ExportMenu from './components/ExportMenu'
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
  const [bassEnabled, setBassEnabled]           = useState(false)
  const [bassInstrument, setBassInstrument]     = useState(DEFAULT_BASS)
  const [bassMode, setBassMode]                 = useState(DEFAULT_BASS_MODE)
  const [drumsEnabled, setDrumsEnabled]         = useState(false)
  const [drumsPreset, setDrumsPreset]           = useState(DEFAULT_DRUM_PRESET)

  // Audio (uploads / mic recordings) — toggle, loop, real-time mute.
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [audioLoop, setAudioLoop] = useState(false)

  // ─── Mixer state ────────────────────────────────────────────────────
  // Volumes, mutes, and solos for every channel are owned here so the
  // layer panel speaker icons and the mixer M / S buttons stay in sync
  // (they're two UIs for the same underlying state). Save/load also picks
  // these up automatically. A useEffect below pushes any change to the
  // audio engine which drives the gain nodes.
  const [channelVolumes, setChannelVolumes] = useState({
    chords: 88, drums: 92, bass: 85, pads: 68, pluck: 78, audio: 88, master: 95,
  })
  const [channelMutes, setChannelMutes] = useState({
    chords: false, drums: false, bass: false, pads: false, pluck: false, audio: false,
  })
  const [channelSolos, setChannelSolos] = useState({
    chords: false, drums: false, bass: false, pads: false, pluck: false, audio: false,
  })
  const toggleChannelMute = useCallback((ch) => {
    setChannelMutes(prev => ({ ...prev, [ch]: !prev[ch] }))
  }, [])
  const toggleChannelSolo = useCallback((ch) => {
    setChannelSolos(prev => ({ ...prev, [ch]: !prev[ch] }))
  }, [])
  const setChannelVolume = useCallback((ch, v) => {
    setChannelVolumes(prev => ({ ...prev, [ch]: v }))
  }, [])
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

  // ─── Project (save/load) ────────────────────────────────────────────
  const [projectId, setProjectId] = useState(null)
  const [projectName, setProjectName] = useState('Untitled')
  const [recentProjects, setRecentProjects] = useState(() => listProjects())
  // Tracks whether the current state has been written to a NAMED project
  // (separate from the draft). Used for the "Save"/"Saved" pill label.
  const [hasUnsavedNamed, setHasUnsavedNamed] = useState(true)
  const restoredRef = useRef(false) // guard against the initial-mount auto-save

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
  const audio = useAudioEngine({ chordInstrument, padInstrument, pluckInstrument, bassInstrument })

  // ─── Chord sources (Diatonic / Borrowed / Modal) ───────────────────
  // Each source is a 7-chord array. Slots in the progression reference a
  // chord by `{source, degree}` so changing the key transposes everything
  // including borrowed/modal additions.
  const diatonicChords = useMemo(
    () => computeDiatonicChords(musicKey, scale, complexity).map(c => ({ ...c, source: 'Diatonic' })),
    [musicKey, scale, complexity]
  )
  const borrowedChords = useMemo(
    () => computeBorrowedChords(musicKey, scale, complexity).map(c => ({ ...c, source: 'Borrowed' })),
    [musicKey, scale, complexity]
  )
  const modalChords = useMemo(
    () => computeModalChords(musicKey, scale, complexity).map(c => ({ ...c, source: 'Modal' })),
    [musicKey, scale, complexity]
  )
  const chordsBySource = useMemo(() => ({
    Diatonic: diatonicChords,
    Borrowed: borrowedChords,
    Modal:    modalChords,
  }), [diatonicChords, borrowedChords, modalChords])

  // Which palette tab is active (purely a UI hint — doesn't affect playback).
  const [chordSource, setChordSource] = useState('Diatonic')

  /**
   * Resolve a progression slot ({source, degree} or null or legacy raw
   * number from old saves) to a chord object. Falls back to Diatonic if
   * the source is missing.
   */
  const resolveSlot = useCallback((slot) => {
    if (slot == null) return null
    if (typeof slot === 'number') return diatonicChords[slot] || null
    const list = chordsBySource[slot.source] || diatonicChords
    return list[slot.degree] || null
  }, [diatonicChords, chordsBySource])

  const resolvedProgression = useMemo(
    () => progression.map(resolveSlot),
    [progression, resolveSlot]
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
    chordsEnabled, padsEnabled, pluckEnabled, bassEnabled, drumsEnabled, audioEnabled,
    pluckPattern, pluckRate, bassMode,
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

  // Push mixer state to the audio engine. One effect per concern keeps
  // the change set tight so e.g. dragging a fader doesn't re-issue mute
  // commands.
  useEffect(() => {
    if (!audio.setChannelVolume) return
    for (const ch of Object.keys(channelVolumes)) {
      audio.setChannelVolume(ch, channelVolumes[ch])
    }
  }, [channelVolumes, audio.audioStarted, audio.setChannelVolume])
  useEffect(() => {
    if (!audio.setChannelMuted) return
    for (const ch of Object.keys(channelMutes)) {
      audio.setChannelMuted(ch, channelMutes[ch])
    }
  }, [channelMutes, audio.audioStarted, audio.setChannelMuted])
  useEffect(() => {
    if (!audio.setChannelSoloed) return
    for (const ch of Object.keys(channelSolos)) {
      audio.setChannelSoloed(ch, channelSolos[ch])
    }
  }, [channelSolos, audio.audioStarted, audio.setChannelSoloed])

  // Push per-row drum volumes to the engine so dragging a row's slider
  // during playback re-velocities the next hit without a restart.
  useEffect(() => {
    audio.setDrumVolumes?.(drumVolumes)
  }, [drumVolumes, audio.setDrumVolumes])

  // ─── Project state apply (used by Load / restore) ──────────────────
  // Walks the saved state and pushes each field through the corresponding
  // setter. Missing fields fall back to the current value so older saves
  // load gracefully when we add new fields later.
  const applyProjectState = useCallback((p) => {
    if (!p?.state) return
    const s = p.state
    if (s.musicKey != null)        setMusicKey(s.musicKey)
    if (s.scale != null)           setScale(s.scale)
    if (s.bpm != null)             setBpm(s.bpm)
    if (s.barsPerChord != null)    setBarsPerChord(s.barsPerChord)
    if (s.complexity != null)      setComplexity(s.complexity)
    if (s.octaveShift != null)     setOctaveShift(s.octaveShift)
    if (s.activeSection != null)   setActiveSection(s.activeSection)
    if (Array.isArray(s.progression)) {
      setProgressionSize(s.progressionSize ?? s.progression.length)
      // Normalize old saves: bare numbers were diatonic-degree references.
      setProgression(s.progression.map(slot => {
        if (slot == null) return null
        if (typeof slot === 'number') return { source: 'Diatonic', degree: slot }
        return slot
      }))
    }
    if (s.chordsEnabled != null)   setChordsEnabled(s.chordsEnabled)
    if (s.chordInstrument)         setChordInstrument(s.chordInstrument)
    if (s.bassEnabled != null)     setBassEnabled(s.bassEnabled)
    if (s.bassInstrument)          setBassInstrument(s.bassInstrument)
    if (s.bassMode)                setBassMode(s.bassMode)
    if (s.padsEnabled != null)     setPadsEnabled(s.padsEnabled)
    if (s.padInstrument)           setPadInstrument(s.padInstrument)
    if (s.pluckEnabled != null)    setPluckEnabled(s.pluckEnabled)
    if (s.pluckInstrument)         setPluckInstrument(s.pluckInstrument)
    if (s.pluckPattern)            setPluckPattern(s.pluckPattern)
    if (s.pluckRate)               setPluckRate(s.pluckRate)
    if (s.drumsEnabled != null)    setDrumsEnabled(s.drumsEnabled)
    if (s.drumsPreset)             setDrumsPreset(s.drumsPreset)
    if (s.drumPattern)             setDrumPattern(s.drumPattern)
    if (s.drumMutes)               setDrumMutes(s.drumMutes)
    if (s.drumSolos)               setDrumSolos(s.drumSolos)
    if (s.drumVolumes)             setDrumVolumes(s.drumVolumes)
    if (s.audioEnabled != null)    setAudioEnabled(s.audioEnabled)
    if (s.audioLoop != null)       setAudioLoop(s.audioLoop)
    if (s.layerMutes)              setChannelMutes(prev => ({ ...prev, ...s.layerMutes }))
    if (s.channelVolumes)          setChannelVolumes(prev => ({ ...prev, ...s.channelVolumes }))
    if (p.id)                      setProjectId(p.id)
    if (p.name)                    setProjectName(p.name)
    setHasUnsavedNamed(false)
    audio.stopPlayback()
  }, [audio])

  // Restore the working draft on first mount. Effect runs once.
  useEffect(() => {
    const draft = loadDraft()
    if (draft) applyProjectState(draft)
    restoredRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save the working draft (debounced) on any state change.
  useEffect(() => {
    if (!restoredRef.current) return
    const t = setTimeout(() => {
      const project = serializeProject({
        id: projectId, name: projectName,
        musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
        activeSection,
        progression, progressionSize,
        chordsEnabled, chordInstrument,
        bassEnabled, bassInstrument, bassMode,
        padsEnabled, padInstrument,
        pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
        drumsEnabled, drumsPreset, drumPattern, drumMutes, drumSolos, drumVolumes,
        audioEnabled, audioLoop,
        layerMutes: channelMutes,
        channelVolumes,
      })
      saveDraft(project)
    }, 500)
    return () => clearTimeout(t)
  }, [
    projectId, projectName,
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    activeSection,
    progression, progressionSize,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumPattern, drumMutes, drumSolos, drumVolumes,
    audioEnabled, audioLoop,
    channelMutes, channelVolumes,
  ])

  // Mark "unsaved named" whenever state moves after a save/load (so the
  // Save button can flip from "Saved" to "Save").
  useEffect(() => {
    if (restoredRef.current) setHasUnsavedNamed(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    progression, progressionSize,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumPattern, drumMutes, drumSolos, drumVolumes,
    channelVolumes, channelMutes,
  ])

  const layerConfig = useMemo(() => ({
    chords: { enabled: chordsEnabled },
    pads:   { enabled: padsEnabled },
    pluck:  { enabled: pluckEnabled, pattern: pluckPattern, rate: pluckRate },
    bass:   { enabled: bassEnabled, mode: bassMode },
    audio:  { enabled: audioEnabled, loop: audioLoop },
    drums:  {
      enabled: drumsEnabled,
      pattern: drumPattern,
      mutes:   drumMutes,
      solos:   drumSolos,
      volumes: drumVolumes,
    },
  }), [
    chordsEnabled, padsEnabled, pluckEnabled, bassEnabled, drumsEnabled, audioEnabled, audioLoop,
    pluckPattern, pluckRate, bassMode,
    drumPattern, drumMutes, drumSolos, drumVolumes,
  ])

  // ─── Progression mutations ─────────────────────────────────────────
  // Slot is `{source, degree}` (or null). `chordOrSlot` may be a chord
  // object (which has those fields) or a raw number from legacy callers.
  const toSlot = (chordOrSlot) => {
    if (chordOrSlot == null) return null
    if (typeof chordOrSlot === 'number') return { source: 'Diatonic', degree: chordOrSlot }
    return { source: chordOrSlot.source || 'Diatonic', degree: chordOrSlot.degree }
  }

  const addChord = useCallback((chordOrSlot) => {
    const slot = toSlot(chordOrSlot)
    setProgression(prev => {
      const next = [...prev]
      const emptyIdx = next.findIndex(d => d == null)
      if (emptyIdx === -1) {
        for (let i = 0; i < next.length - 1; i++) next[i] = next[i + 1]
        next[next.length - 1] = slot
      } else {
        next[emptyIdx] = slot
      }
      return next
    })
  }, [])

  const removeChordAt = useCallback((idx) => {
    setProgression(prev => { const next = [...prev]; next[idx] = null; return next })
  }, [])

  const setChordAt = useCallback((idx, chordOrSlot) => {
    const slot = toSlot(chordOrSlot)
    setProgression(prev => { const next = [...prev]; next[idx] = slot; return next })
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
      next[i] = { source: 'Diatonic', degree: romanToDegree(roman) }
    })
    setProgression(next)
  }, [progressionSize])

  // ─── Playback / export / clipboard ─────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    if (audio.isPlaying) { audio.stopPlayback(); return }

    const chordsWithSlot = progression
      .map((slot, slotIdx) => {
        const c = resolveSlot(slot)
        return c ? { midiNotes: shiftNotes(c.midiNotes), slotIdx } : null
      })
      .filter(Boolean)

    if (chordsWithSlot.length === 0) {
      showToast('Add chords to your progression first')
      return
    }
    audio.startPlayback(chordsWithSlot, { bpm, barsPerChord, layerConfig })
  }, [audio, progression, resolveSlot, shiftNotes, bpm, barsPerChord, layerConfig, showToast])

  const handleExport = useCallback(() => {
    const progChords = progression.map(slot => {
      const c = resolveSlot(slot)
      return c ? { ...c, midiNotes: shiftNotes(c.midiNotes) } : null
    })
    const ok = exportProgressionAsMidi({
      progression: progChords, bpm, barsPerChord, musicKey, scale, layerConfig,
    })
    showToast(ok ? 'Multi-track MIDI downloaded' : 'Add chords to export')
  }, [progression, resolveSlot, shiftNotes, bpm, barsPerChord, musicKey, scale, layerConfig, showToast])

  // ─── Stem export (offline render per layer → WAVs) ─────────────────
  const [isRendering, setIsRendering] = useState(false)
  const handleExportStems = useCallback(async () => {
    const progChords = progression.map(slot => {
      const c = resolveSlot(slot)
      return c ? { ...c, midiNotes: shiftNotes(c.midiNotes) } : null
    })
    const filled = progChords.filter(Boolean)
    if (filled.length === 0) { showToast('Add chords to export'); return }

    setIsRendering(true)
    audio.stopPlayback()
    showToast('Rendering stems… this takes a few seconds')
    try {
      const stems = await renderAllStems({
        chords: progChords,
        bpm, barsPerChord,
        layers: {
          chords: { enabled: chordsEnabled, instrument: chordInstrument },
          pads:   { enabled: padsEnabled,   instrument: padInstrument   },
          pluck:  { enabled: pluckEnabled,  instrument: pluckInstrument, pattern: pluckPattern, rate: pluckRate },
          bass:   { enabled: bassEnabled,   instrument: bassInstrument,  mode: bassMode },
          drums:  { enabled: drumsEnabled, pattern: drumPattern, mutes: drumMutes, solos: drumSolos, volumes: drumVolumes },
          audio:  { enabled: audioEnabled,  loop: audioLoop },
        },
        audioBuffer: audio.getAudioBuffer?.(),
      })
      if (stems.length === 0) {
        showToast('Nothing to render — enable at least one layer')
      } else {
        downloadStems(stems, projectName)
        showToast(`Downloaded ${stems.length} stem${stems.length > 1 ? 's' : ''}`)
      }
    } catch (e) {
      showToast(e?.message || 'Stem render failed')
    } finally {
      setIsRendering(false)
    }
  }, [
    audio, progression, resolveSlot, shiftNotes, bpm, barsPerChord,
    chordsEnabled, chordInstrument,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    bassEnabled, bassInstrument, bassMode,
    drumsEnabled, drumPattern, drumMutes, drumSolos, drumVolumes,
    audioEnabled, audioLoop,
    projectName, showToast,
  ])

  // ─── Project menu actions ──────────────────────────────────────────
  const buildSnapshot = useCallback((overrides = {}) => serializeProject({
    id: projectId, name: projectName,
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    activeSection,
    progression, progressionSize,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumPattern, drumMutes, drumSolos, drumVolumes,
    audioEnabled, audioLoop,
    layerMutes: channelMutes,
    channelVolumes,
    ...overrides,
  }), [
    projectId, projectName,
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    activeSection,
    progression, progressionSize,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumPattern, drumMutes, drumSolos, drumVolumes,
    audioEnabled, audioLoop,
    channelMutes, channelVolumes,
  ])

  const handleSave = useCallback(() => {
    try {
      const id = saveProject(buildSnapshot())
      setProjectId(id)
      setRecentProjects(listProjects())
      setHasUnsavedNamed(false)
      showToast(`Saved "${projectName}"`)
    } catch (e) {
      showToast(e.message || 'Could not save')
    }
  }, [buildSnapshot, projectName, showToast])

  const handleSaveAsNew = useCallback(() => {
    const name = window.prompt('Project name', projectName === 'Untitled' ? '' : `${projectName} copy`) || projectName
    try {
      // Strip the existing id so saveProject mints a fresh one.
      const id = saveProject(buildSnapshot({ id: undefined, name }))
      setProjectId(id)
      setProjectName(name)
      setRecentProjects(listProjects())
      setHasUnsavedNamed(false)
      showToast(`Saved as "${name}"`)
    } catch (e) {
      showToast(e.message || 'Could not save')
    }
  }, [buildSnapshot, projectName, showToast])

  const handleLoadProject = useCallback((id) => {
    const p = loadProject(id)
    if (!p) { showToast('Project not found'); return }
    applyProjectState(p)
    showToast(`Loaded "${p.name}"`)
  }, [applyProjectState, showToast])

  const handleDeleteProject = useCallback((id) => {
    deleteProject(id)
    setRecentProjects(listProjects())
    if (id === projectId) {
      setProjectId(null)
      setHasUnsavedNamed(true)
    }
  }, [projectId])

  const handleNewProject = useCallback(() => {
    setProjectId(null)
    setProjectName('Untitled')
    setMusicKey('C'); setScale('Natural Minor')
    setBpm(86); setBarsPerChord(2); setComplexity('Triads'); setOctaveShift(0)
    setActiveSection('verse')
    setProgressionSize(DEFAULT_PROGRESSION_SIZE)
    setProgression(Array(DEFAULT_PROGRESSION_SIZE).fill(null))
    setChordsEnabled(true); setChordInstrument(DEFAULT_INSTRUMENT)
    setBassEnabled(false); setBassInstrument(DEFAULT_BASS); setBassMode(DEFAULT_BASS_MODE)
    setPadsEnabled(false); setPadInstrument(DEFAULT_PAD)
    setPluckEnabled(false); setPluckInstrument(DEFAULT_PLUCK)
    setPluckPattern(DEFAULT_ARP_PATTERN); setPluckRate(DEFAULT_ARP_RATE)
    setDrumsEnabled(false); setDrumsPreset(DEFAULT_DRUM_PRESET)
    setDrumPattern(getDrumPattern(DEFAULT_DRUM_PRESET))
    setDrumMutes(Object.fromEntries(DRUM_VOICES.map(v => [v, false])))
    setDrumSolos(Object.fromEntries(DRUM_VOICES.map(v => [v, false])))
    setDrumVolumes({ ...DEFAULT_VOLUMES })
    setAudioEnabled(true); setAudioLoop(false)
    setChannelMutes({ chords: false, drums: false, bass: false, pads: false, pluck: false, audio: false })
    setChannelSolos({ chords: false, drums: false, bass: false, pads: false, pluck: false, audio: false })
    setChannelVolumes({ chords: 88, drums: 92, bass: 85, pads: 68, pluck: 78, audio: 88, master: 95 })
    setHasUnsavedNamed(true)
    audio.stopPlayback()
    showToast('New project')
  }, [audio, showToast])

  const handleDownload = useCallback(() => {
    downloadProjectFile(buildSnapshot())
    showToast(`Downloaded "${projectName}.chordflow.json"`)
  }, [buildSnapshot, projectName, showToast])

  const handleOpenFile = useCallback(async (file) => {
    try {
      const project = await readProjectFile(file)
      applyProjectState(project)
      showToast(`Loaded "${project.name || 'project'}" from file`)
    } catch (e) {
      showToast(e.message || 'Could not open file')
    }
  }, [applyProjectState, showToast])

  const handleCopy = useCallback(() => {
    const text = progression
      .map(slot => resolveSlot(slot)?.name)
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
  }, [progression, resolveSlot, showToast])

  // Currently playing chord — drives palette glow + piano keyboard.
  const playingChord = useMemo(() => {
    if (!audio.isPlaying || audio.currentlyPlayingIdx < 0) return null
    return resolveSlot(progression[audio.currentlyPlayingIdx])
  }, [audio.isPlaying, audio.currentlyPlayingIdx, progression, resolveSlot])

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <TopBar
        isPlaying={audio.isPlaying}
        onPlayToggle={handlePlayToggle}
        onStop={audio.stopPlayback}
        bpm={bpm}                       setBpm={setBpm}
        musicKey={musicKey}             setMusicKey={setMusicKey}
        scale={scale}                   setScale={setScale}
        barsPerChord={barsPerChord}     setBarsPerChord={setBarsPerChord}
        complexity={complexity}         setComplexity={setComplexity}
        octaveShift={octaveShift}       setOctaveShift={setOctaveShift}
        chordInstrument={chordInstrument}
        collabOpen={collabOpen}
        onToggleCollab={() => setCollabOpen(o => !o)}
        exportMenu={(
          <ExportMenu
            onExportMidi={handleExport}
            onExportStems={handleExportStems}
            isRendering={isRendering}
          />
        )}
        projectMenu={(
          <ProjectMenu
            projectName={projectName}
            onRenameProject={setProjectName}
            onSave={handleSave}
            onSaveAsNew={handleSaveAsNew}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onNewProject={handleNewProject}
            onDownload={handleDownload}
            onOpenFile={handleOpenFile}
            recentProjects={recentProjects}
            hasUnsavedChanges={hasUnsavedNamed}
          />
        )}
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
                chordsBySource={chordsBySource}
                activeSource={chordSource}
                onChangeSource={setChordSource}
                musicKey={musicKey}
                scale={scale}
                complexity={complexity}
                playingChord={playingChord}
                onPreview={(chord) => audio.previewChord(shiftNotes(chord.midiNotes))}
                onAdd={(chord) => addChord(chord)}
              />

              <ProgressionBuilder
                progression={resolvedProgression}
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
                bassEnabled={bassEnabled}         setBassEnabled={setBassEnabled}
                bassInstrument={bassInstrument}   setBassInstrument={setBassInstrument}
                bassMode={bassMode}               setBassMode={setBassMode}
                padsEnabled={padsEnabled}         setPadsEnabled={setPadsEnabled}
                padInstrument={padInstrument}     setPadInstrument={setPadInstrument}
                pluckEnabled={pluckEnabled}       setPluckEnabled={setPluckEnabled}
                pluckInstrument={pluckInstrument} setPluckInstrument={setPluckInstrument}
                pluckPattern={pluckPattern}       setPluckPattern={setPluckPattern}
                pluckRate={pluckRate}             setPluckRate={setPluckRate}
                layerMutes={channelMutes}         toggleLayerMute={toggleChannelMute}
              />

              <DrumSequencer
                pattern={drumPattern}     setPattern={setDrumPattern}
                mutes={drumMutes}         setMutes={setDrumMutes}
                solos={drumSolos}         setSolos={setDrumSolos}
                volumes={drumVolumes}     setVolumes={setDrumVolumes}
                preset={drumsPreset}      setPreset={setDrumsPreset}
                enabled={drumsEnabled}    setEnabled={setDrumsEnabled}
                muted={channelMutes.drums}  onToggleMute={() => toggleChannelMute('drums')}
                isPlaying={audio.isPlaying}
                currentStep={drumStep}
              />

              <AudioLayer
                audio={audio}
                enabled={audioEnabled}    setEnabled={setAudioEnabled}
                loop={audioLoop}          setLoop={setAudioLoop}
                muted={channelMutes.audio}
                onToggleMute={() => toggleChannelMute('audio')}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ transition: 'padding-right .3s', paddingRight: collabOpen ? 360 : 0 }}>
        <HorizontalMixer
          audio={audio}
          isPlaying={audio.isPlaying}
          layers={{ chordsEnabled, padsEnabled, pluckEnabled, bassEnabled, drumsEnabled, audioEnabled }}
          volumes={channelVolumes}
          mutes={channelMutes}
          solos={channelSolos}
          onVolumeChange={setChannelVolume}
          onMuteToggle={toggleChannelMute}
          onSoloToggle={toggleChannelSolo}
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
