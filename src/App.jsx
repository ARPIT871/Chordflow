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
  DEFAULT_DRUM_PRESET, DEFAULT_VOLUMES, DRUM_VOICES, getDrumPattern, emptyDrumPattern,
} from './lib/drum-patterns'
import { useAudioEngine } from './hooks/useAudioEngine'
import {
  serializeProject, saveDraft, loadDraft,
  listProjects, loadProject, saveProject, deleteProject,
  downloadProjectFile, readProjectFile,
} from './lib/projects'
import {
  saveAudio, loadAudio, deleteAudio,
} from './lib/audio-storage'
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
import SuggestModal from './components/SuggestModal'
import Toast from './components/Toast'

const DEFAULT_PROGRESSION_SIZE = 4
const SECTION_IDS = ['intro', 'verse', 'chorus', 'bridge', 'outro']
const SECTION_LABELS = {
  intro: 'Intro', verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge', outro: 'Outro',
}

/** Build a fresh sections object — empty progressions, default drum pattern. */
function makeEmptySections(progressionSize = DEFAULT_PROGRESSION_SIZE) {
  const out = {}
  for (const id of SECTION_IDS) {
    out[id] = {
      progression: Array(progressionSize).fill(null),
      drumPattern: getDrumPattern(DEFAULT_DRUM_PRESET),
    }
  }
  return out
}

export default function App() {
  // ─── User settings ──────────────────────────────────────────────────
  const [musicKey, setMusicKey] = useState('C')
  const [scale, setScale] = useState('Natural Minor')
  const [bpm, setBpm] = useState(86)
  const [barsPerChord, setBarsPerChord] = useState(2)
  const [complexity, setComplexity] = useState('Triads')
  const [octaveShift, setOctaveShift] = useState(0)
  const [activeSection, setActiveSection] = useState('verse')
  // 'section' = loop just the active section (default). 'song' = sequence
  // every non-empty section in order, then loop the whole arrangement.
  const [playMode, setPlayMode] = useState('section')
  const [collabOpen, setCollabOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)

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
  // Blob lives in IndexedDB (keyed by project id, or 'draft' before save);
  // the metadata (clipName) goes into the regular project JSON.
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [audioLoop, setAudioLoop] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioClipName, setAudioClipName] = useState(null)

  const handleAudioBlobChange = useCallback((blob, name) => {
    setAudioBlob(blob)
    setAudioClipName(name)
  }, [])
  const handleAudioClear = useCallback(() => {
    setAudioBlob(null)
    setAudioClipName(null)
  }, [])

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
  const [drumMutes, setDrumMutes]               = useState(() =>
    Object.fromEntries(DRUM_VOICES.map(v => [v, false]))
  )
  const [drumSolos, setDrumSolos]               = useState(() =>
    Object.fromEntries(DRUM_VOICES.map(v => [v, false]))
  )
  const [drumVolumes, setDrumVolumes]           = useState(() => ({ ...DEFAULT_VOLUMES }))
  // Swing 0..100 — pushes off-beat 16ths later for a shuffled feel.
  // Global across sections (it's a per-song groove, not per-section).
  const [drumSwing, setDrumSwing]               = useState(0)

  // Visual playhead position for the drum grid. Driven by setInterval
  // during playback — close enough for the cell highlight; sample-accurate
  // audio timing remains in the Tone.Transport schedule.
  const [drumStep, setDrumStep] = useState(0)

  // ─── Progression + sections ─────────────────────────────────────────
  // Each section (Intro / Verse / Chorus / Bridge / Outro) carries its
  // own progression and drum pattern. The currently-edited section is
  // `activeSection`; `progression` and `drumPattern` below are *derived*
  // from sections[activeSection]. Custom setters write back into the
  // active section, so all the existing chord/drum-grid handlers keep
  // working unchanged.
  const [progressionSize, setProgressionSize] = useState(DEFAULT_PROGRESSION_SIZE)
  const [sections, setSections] = useState(() => makeEmptySections(DEFAULT_PROGRESSION_SIZE))

  const progression = useMemo(
    () => sections[activeSection]?.progression ?? Array(progressionSize).fill(null),
    [sections, activeSection, progressionSize]
  )
  const drumPattern = useMemo(
    () => sections[activeSection]?.drumPattern ?? emptyDrumPattern(),
    [sections, activeSection]
  )

  const setProgression = useCallback((updaterOrValue) => {
    setSections(s => {
      const cur = s[activeSection]?.progression ?? []
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(cur) : updaterOrValue
      return {
        ...s,
        [activeSection]: { ...(s[activeSection] || {}), progression: next },
      }
    })
  }, [activeSection])

  const setDrumPattern = useCallback((updaterOrValue) => {
    setSections(s => {
      const cur = s[activeSection]?.drumPattern ?? emptyDrumPattern()
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(cur) : updaterOrValue
      return {
        ...s,
        [activeSection]: { ...(s[activeSection] || {}), drumPattern: next },
      }
    })
  }, [activeSection])

  // Keep every section's progression sized to `progressionSize`. When the
  // user picks 4 vs 8 slots, all sections resize in step so switching
  // never produces a length mismatch.
  useEffect(() => {
    setSections(s => {
      let changed = false
      const next = {}
      for (const id of SECTION_IDS) {
        const cur = s[id]?.progression ?? []
        if (cur.length === progressionSize) {
          next[id] = s[id]
          continue
        }
        const resized = cur.slice(0, progressionSize)
        while (resized.length < progressionSize) resized.push(null)
        next[id] = { ...(s[id] || {}), progression: resized }
        changed = true
      }
      return changed ? next : s
    })
  }, [progressionSize])

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
   * Resolve a progression slot to a chord object. Supports three slot
   * shapes:
   *   - legacy raw number → diatonic degree
   *   - {source, degree}   → look up in the Diatonic / Borrowed / Modal palette
   *   - {source: 'Custom', chord} → inline chord (e.g. detected from audio)
   */
  const resolveSlot = useCallback((slot) => {
    if (slot == null) return null
    if (typeof slot === 'number') return diatonicChords[slot] || null
    if (slot.source === 'Custom' && slot.chord) return slot.chord
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
    audio.stopPlayback()
  }, [
    musicKey, scale, complexity,
    bpm, barsPerChord, octaveShift,
    progression, progressionSize,
    chordsEnabled, padsEnabled, pluckEnabled, bassEnabled, drumsEnabled, audioEnabled,
    pluckPattern, pluckRate, bassMode,
    drumPattern, drumMutes, drumSolos, drumSwing,
    playMode,
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

  // Persist the audio clip blob to IndexedDB whenever it changes. The
  // storage key is the project id (or 'draft' for the auto-save slot
  // before the user has explicitly saved). Restore is handled separately
  // — on first mount and on project load — so this effect skips the
  // initial render.
  useEffect(() => {
    if (!restoredRef.current) return
    const key = projectId || 'draft'
    if (audioBlob) {
      saveAudio(key, audioBlob).catch(() => { /* quota — silent */ })
    } else {
      deleteAudio(key).catch(() => {})
    }
  }, [audioBlob, projectId])

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

    // Sections: prefer the new shape, fall back to migrating a flat
    // progression / drum pattern from an older save into sections.verse.
    const normalizeSlots = (arr) => arr.map(slot => {
      if (slot == null) return null
      if (typeof slot === 'number') return { source: 'Diatonic', degree: slot }
      return slot
    })
    if (s.progressionSize != null) setProgressionSize(s.progressionSize)
    const restoredActive = s.activeSection || 'verse'
    if (s.sections) {
      // Defensive: normalize each section's progression slots in case the
      // save predates the {source, degree} schema for individual sections.
      const cleaned = {}
      for (const id of SECTION_IDS) {
        const sec = s.sections[id]
        cleaned[id] = {
          progression: Array.isArray(sec?.progression)
            ? normalizeSlots(sec.progression)
            : Array(s.progressionSize ?? DEFAULT_PROGRESSION_SIZE).fill(null),
          drumPattern: sec?.drumPattern || getDrumPattern(DEFAULT_DRUM_PRESET),
        }
      }
      setSections(cleaned)
    } else {
      // Legacy migration: dump the flat progression + drum pattern into
      // the section the project was last on (or Verse if unspecified).
      const size = s.progressionSize ?? (Array.isArray(s.progression) ? s.progression.length : DEFAULT_PROGRESSION_SIZE)
      const flatProg = Array.isArray(s.progression) ? normalizeSlots(s.progression) : Array(size).fill(null)
      const flatDrums = s.drumPattern || getDrumPattern(DEFAULT_DRUM_PRESET)
      const built = {}
      for (const id of SECTION_IDS) {
        built[id] = {
          progression: id === restoredActive ? flatProg : Array(size).fill(null),
          drumPattern: id === restoredActive ? flatDrums : getDrumPattern(DEFAULT_DRUM_PRESET),
        }
      }
      setSections(built)
    }
    setActiveSection(restoredActive)

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
    if (s.drumMutes)               setDrumMutes(s.drumMutes)
    if (s.drumSolos)               setDrumSolos(s.drumSolos)
    if (s.drumVolumes)             setDrumVolumes(s.drumVolumes)
    if (typeof s.drumSwing === 'number') setDrumSwing(s.drumSwing)
    if (s.audioEnabled != null)    setAudioEnabled(s.audioEnabled)
    if (s.audioLoop != null)       setAudioLoop(s.audioLoop)
    if (s.audioClipName != null)   setAudioClipName(s.audioClipName)
    else                           setAudioClipName(null)
    if (s.layerMutes)              setChannelMutes(prev => ({ ...prev, ...s.layerMutes }))
    if (s.channelVolumes)          setChannelVolumes(prev => ({ ...prev, ...s.channelVolumes }))
    if (p.id)                      setProjectId(p.id)
    if (p.name)                    setProjectName(p.name)
    setHasUnsavedNamed(false)
    audio.stopPlayback()
  }, [audio])

  // Restore the working draft on first mount, including any audio blob
  // stored in IndexedDB under the same project id (or 'draft' if the
  // draft hadn't been promoted to a named project).
  useEffect(() => {
    const draft = loadDraft()
    if (draft) applyProjectState(draft)
    const audioKey = draft?.id || 'draft'
    loadAudio(audioKey).then(blob => {
      if (blob) setAudioBlob(blob)
    }).catch(() => {})
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
        progressionSize, sections,
        chordsEnabled, chordInstrument,
        bassEnabled, bassInstrument, bassMode,
        padsEnabled, padInstrument,
        pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
        drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes, drumSwing, drumSwing,
        audioEnabled, audioLoop, audioClipName,
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
    progressionSize, sections,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes, drumSwing,
    audioEnabled, audioLoop, audioClipName,
    channelMutes, channelVolumes,
  ])

  // Mark "unsaved named" whenever state moves after a save/load (so the
  // Save button can flip from "Saved" to "Save").
  useEffect(() => {
    if (restoredRef.current) setHasUnsavedNamed(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    sections, progressionSize,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes, drumSwing,
    channelVolumes, channelMutes,
  ])

  // Section density (0..1) drives the dot indicators in the arrangement
  // strip. Currently derived from progression fill ratio + drum-cell
  // density; the higher of the two wins so a section with rich drums
  // still reads as "full" even if its progression is sparse.
  const sectionsDensity = useMemo(() => {
    const out = {}
    for (const id of SECTION_IDS) {
      const sec = sections[id]
      const progFill = (sec?.progression?.filter(s => s != null).length || 0) / Math.max(1, progressionSize)
      let drumHits = 0
      for (const v of DRUM_VOICES) {
        const row = sec?.drumPattern?.[v]
        if (Array.isArray(row)) for (const c of row) if (c) drumHits++
      }
      const drumDensity = Math.min(1, drumHits / 32) // 32 hits ≈ a busy bar
      out[id] = Math.max(progFill, drumDensity)
    }
    return out
  }, [sections, progressionSize])

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
      swing:   drumSwing,
    },
  }), [
    chordsEnabled, padsEnabled, pluckEnabled, bassEnabled, drumsEnabled, audioEnabled, audioLoop,
    pluckPattern, pluckRate, bassMode,
    drumPattern, drumMutes, drumSolos, drumVolumes, drumSwing,
  ])

  // ─── Progression mutations ─────────────────────────────────────────
  // Slot is `{source, degree}` for palette chords (Diatonic / Borrowed /
  // Modal) or `{source: 'Custom', chord}` for inline chords coming from
  // the audio chord finder. Null slots are empty.
  const toSlot = (chordOrSlot) => {
    if (chordOrSlot == null) return null
    if (typeof chordOrSlot === 'number') return { source: 'Diatonic', degree: chordOrSlot }
    // Detected-from-audio chord — store the chord object inline so it
    // survives across key changes (it isn't tied to a scale degree).
    if (chordOrSlot.source === 'Custom' && chordOrSlot.midiNotes) {
      return {
        source: 'Custom',
        chord: {
          name: chordOrSlot.name,
          roman: chordOrSlot.roman || chordOrSlot.name,
          quality: chordOrSlot.quality || 'M',
          noteSymbols: chordOrSlot.noteSymbols || [],
          midiNotes: [...chordOrSlot.midiNotes],
          source: 'Custom',
          degree: null,
        },
      }
    }
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

  // Build the chord/drum schedule for "play full arrangement". Walks
  // every section that has at least one filled chord, concatenates
  // their progressions, and emits a parallel section-plan for drums so
  // the engine can swap drum patterns at section boundaries.
  const buildSongSchedule = useCallback(() => {
    const chordsWithSlot = []
    const sectionPlan = []
    let curBar = 0
    for (const id of SECTION_IDS) {
      const sec = sections[id]
      if (!sec?.progression) continue
      const sectionChords = []
      for (let slotIdxInSection = 0; slotIdxInSection < sec.progression.length; slotIdxInSection++) {
        const slot = sec.progression[slotIdxInSection]
        const c = resolveSlot(slot)
        if (c) {
          sectionChords.push({
            midiNotes: shiftNotes(c.midiNotes),
            slotIdx: chordsWithSlot.length + sectionChords.length,
            sectionId: id,
            slotRef: slot,
          })
        }
      }
      if (sectionChords.length === 0) continue // skip empty sections
      chordsWithSlot.push(...sectionChords)
      const sectionBars = sectionChords.length * barsPerChord
      sectionPlan.push({
        sectionId: id,
        startBar: curBar,
        endBar: curBar + sectionBars,
        drumPattern: sec.drumPattern,
      })
      curBar += sectionBars
    }
    return { chordsWithSlot, sectionPlan }
  }, [sections, resolveSlot, shiftNotes, barsPerChord])

  // ─── Playback / export / clipboard ─────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    if (audio.isPlaying) { audio.stopPlayback(); return }

    if (playMode === 'song') {
      const { chordsWithSlot, sectionPlan } = buildSongSchedule()
      if (chordsWithSlot.length === 0) {
        showToast('Add chords to at least one section to play the song')
        return
      }
      audio.startPlayback(chordsWithSlot, { bpm, barsPerChord, layerConfig, sectionPlan })
      return
    }

    // Section mode — loop just the active section.
    const chordsWithSlot = progression
      .map((slot, slotIdx) => {
        const c = resolveSlot(slot)
        return c ? { midiNotes: shiftNotes(c.midiNotes), slotIdx, sectionId: activeSection, slotRef: slot } : null
      })
      .filter(Boolean)

    if (chordsWithSlot.length === 0) {
      showToast('Add chords to your progression first')
      return
    }
    audio.startPlayback(chordsWithSlot, { bpm, barsPerChord, layerConfig })
  }, [audio, progression, resolveSlot, shiftNotes, bpm, barsPerChord, layerConfig, showToast, playMode, buildSongSchedule, activeSection])

  const handleExport = useCallback(() => {
    // Song mode bounces every non-empty section as one timeline; section
    // mode keeps the old behaviour (just the active section's progression).
    let progChords, sectionPlanArg
    if (playMode === 'song') {
      const schedule = buildSongSchedule()
      if (schedule.chordsWithSlot.length === 0) {
        showToast('Add chords to at least one section before exporting the full song')
        return
      }
      progChords = schedule.chordsWithSlot.map(c => ({
        midiNotes: c.midiNotes,
        // give the chord a name for the track / file naming — pull from
        // the resolved chord via slotRef
        ...(() => { const r = resolveSlot(c.slotRef); return r ? { name: r.name } : {} })(),
      }))
      sectionPlanArg = schedule.sectionPlan
    } else {
      progChords = progression.map(slot => {
        const c = resolveSlot(slot)
        return c ? { ...c, midiNotes: shiftNotes(c.midiNotes) } : null
      })
    }
    const ok = exportProgressionAsMidi({
      progression: progChords,
      bpm, barsPerChord, musicKey, scale,
      layerConfig,
      sectionPlan: sectionPlanArg,
    })
    const label = playMode === 'song' ? 'Full-song multi-track MIDI downloaded' : 'Multi-track MIDI downloaded'
    showToast(ok ? label : 'Add chords to export')
  }, [progression, resolveSlot, shiftNotes, bpm, barsPerChord, musicKey, scale, layerConfig, showToast, playMode, buildSongSchedule])

  // ─── Stem export (offline render per layer → WAVs) ─────────────────
  const [isRendering, setIsRendering] = useState(false)
  const handleExportStems = useCallback(async () => {
    // Song mode renders the full Intro→…→Outro arrangement (sections
    // concatenated, drums swap per section). Section mode renders just
    // the active section.
    let chordsArg, sectionPlanArg
    if (playMode === 'song') {
      const schedule = buildSongSchedule()
      if (schedule.chordsWithSlot.length === 0) { showToast('Add chords to at least one section'); return }
      chordsArg = schedule.chordsWithSlot.map(c => ({ midiNotes: c.midiNotes }))
      sectionPlanArg = schedule.sectionPlan
    } else {
      chordsArg = progression
        .map(slot => {
          const c = resolveSlot(slot)
          return c ? { midiNotes: shiftNotes(c.midiNotes) } : null
        })
        .filter(Boolean)
      if (chordsArg.length === 0) { showToast('Add chords to export'); return }
    }

    setIsRendering(true)
    audio.stopPlayback()
    showToast('Rendering stems… this takes a few seconds')
    try {
      const stems = await renderAllStems({
        chords: chordsArg,
        bpm, barsPerChord,
        layers: {
          chords: { enabled: chordsEnabled, instrument: chordInstrument },
          pads:   { enabled: padsEnabled,   instrument: padInstrument   },
          pluck:  { enabled: pluckEnabled,  instrument: pluckInstrument, pattern: pluckPattern, rate: pluckRate },
          bass:   { enabled: bassEnabled,   instrument: bassInstrument,  mode: bassMode },
          drums:  { enabled: drumsEnabled, pattern: drumPattern, mutes: drumMutes, solos: drumSolos, volumes: drumVolumes, swing: drumSwing },
          audio:  { enabled: audioEnabled,  loop: audioLoop },
        },
        audioBuffer: audio.getAudioBuffer?.(),
        sectionPlan: sectionPlanArg,
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
    drumsEnabled, drumPattern, drumMutes, drumSolos, drumVolumes, drumSwing,
    audioEnabled, audioLoop,
    projectName, showToast,
    playMode, buildSongSchedule,
  ])

  // ─── Project menu actions ──────────────────────────────────────────
  const buildSnapshot = useCallback((overrides = {}) => serializeProject({
    id: projectId, name: projectName,
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    activeSection,
    progressionSize, sections,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes, drumSwing,
    audioEnabled, audioLoop, audioClipName,
    layerMutes: channelMutes,
    channelVolumes,
    ...overrides,
  }), [
    projectId, projectName,
    musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
    activeSection,
    progressionSize, sections,
    chordsEnabled, chordInstrument,
    bassEnabled, bassInstrument, bassMode,
    padsEnabled, padInstrument,
    pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
    drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes, drumSwing,
    audioEnabled, audioLoop, audioClipName,
    channelMutes, channelVolumes,
  ])

  const handleSave = useCallback(async () => {
    try {
      const id = saveProject(buildSnapshot())
      // Mirror the audio blob from 'draft' → this project's id so it
      // survives even if the user later loads a different project.
      if (audioBlob && id) await saveAudio(id, audioBlob).catch(() => {})
      setProjectId(id)
      setRecentProjects(listProjects())
      setHasUnsavedNamed(false)
      showToast(`Saved "${projectName}"`)
    } catch (e) {
      showToast(e.message || 'Could not save')
    }
  }, [buildSnapshot, projectName, audioBlob, showToast])

  const handleSaveAsNew = useCallback(async () => {
    const name = window.prompt('Project name', projectName === 'Untitled' ? '' : `${projectName} copy`) || projectName
    try {
      const id = saveProject(buildSnapshot({ id: undefined, name }))
      if (audioBlob && id) await saveAudio(id, audioBlob).catch(() => {})
      setProjectId(id)
      setProjectName(name)
      setRecentProjects(listProjects())
      setHasUnsavedNamed(false)
      showToast(`Saved as "${name}"`)
    } catch (e) {
      showToast(e.message || 'Could not save')
    }
  }, [buildSnapshot, projectName, audioBlob, showToast])

  const handleLoadProject = useCallback(async (id) => {
    const p = loadProject(id)
    if (!p) { showToast('Project not found'); return }
    applyProjectState(p)
    // Pull the project's audio clip out of IDB (if any).
    try {
      const blob = await loadAudio(id)
      setAudioBlob(blob || null)
    } catch { setAudioBlob(null) }
    showToast(`Loaded "${p.name}"`)
  }, [applyProjectState, showToast])

  const handleDeleteProject = useCallback((id) => {
    deleteProject(id)
    deleteAudio(id).catch(() => {})
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
    setSections(makeEmptySections(DEFAULT_PROGRESSION_SIZE))
    setChordsEnabled(true); setChordInstrument(DEFAULT_INSTRUMENT)
    setBassEnabled(false); setBassInstrument(DEFAULT_BASS); setBassMode(DEFAULT_BASS_MODE)
    setPadsEnabled(false); setPadInstrument(DEFAULT_PAD)
    setPluckEnabled(false); setPluckInstrument(DEFAULT_PLUCK)
    setPluckPattern(DEFAULT_ARP_PATTERN); setPluckRate(DEFAULT_ARP_RATE)
    setDrumsEnabled(false); setDrumsPreset(DEFAULT_DRUM_PRESET)
    setDrumMutes(Object.fromEntries(DRUM_VOICES.map(v => [v, false])))
    setDrumSolos(Object.fromEntries(DRUM_VOICES.map(v => [v, false])))
    setDrumVolumes({ ...DEFAULT_VOLUMES })
    setAudioEnabled(true); setAudioLoop(false)
    setAudioBlob(null); setAudioClipName(null)
    deleteAudio('draft').catch(() => {})
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
      // .chordflow.json doesn't carry audio (Blob can't live in JSON),
      // so reset the loaded clip to whatever IDB has under this id (if
      // anything) or to nothing.
      try {
        const blob = project.id ? await loadAudio(project.id) : null
        setAudioBlob(blob || null)
      } catch { setAudioBlob(null) }
      showToast(`Loaded "${project.name || 'project'}" from file`)
    } catch (e) {
      showToast(e.message || 'Could not open file')
    }
  }, [applyProjectState, showToast])

  // ─── Keyboard shortcuts ────────────────────────────────────────────
  // Space = play/stop, Esc = stop, Ctrl/Cmd+S = save, L = toggle song
  // mode, 1-7 = add chord-by-degree from the active chord-source tab.
  // Skipped when the user is typing in any text field.
  useEffect(() => {
    const isTypingTarget = (e) => {
      const t = e.target
      if (!t) return false
      const tag = (t.tagName || '').toUpperCase()
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }
    const onKey = (e) => {
      if (isTypingTarget(e)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); handleSave(); return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === ' ') {
        e.preventDefault(); handlePlayToggle(); return
      }
      if (e.key === 'Escape' && audio.isPlaying) {
        e.preventDefault(); audio.stopPlayback(); return
      }
      if (e.key === 'l' || e.key === 'L') {
        setPlayMode(m => m === 'song' ? 'section' : 'song')
        return
      }
      if (/^[1-7]$/.test(e.key)) {
        const degree = parseInt(e.key, 10) - 1
        const chord = chordsBySource[chordSource]?.[degree]
        if (chord) addChord(chord)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, handlePlayToggle, audio.isPlaying, audio.stopPlayback, chordsBySource, chordSource, addChord])

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
  // Use the engine's slotRef (which carries source + degree, or an
  // inline chord for Custom slots) so the lookup works for both section
  // and song mode without depending on the active section's progression
  // layout.
  const playingChord = useMemo(() => {
    const ref = audio.currentlyPlayingSlotRef
    if (!audio.isPlaying || !ref) return null
    if (ref.source === 'Custom' && ref.chord) return ref.chord
    return chordsBySource[ref.source]?.[ref.degree] || null
  }, [audio.isPlaying, audio.currentlyPlayingSlotRef, chordsBySource])

  // Per-slot highlight in the progression builder: only valid when the
  // currently-playing section matches the section being edited (song
  // mode might be playing a different section than the user is editing).
  const progressionPlayingIdx = useMemo(() => {
    if (!audio.isPlaying) return -1
    if (audio.currentlyPlayingSection && audio.currentlyPlayingSection !== activeSection) return -1
    if (playMode === 'song') {
      // In song mode the engine's currentlyPlayingIdx is a global flat
      // index; translate to the local in-section position via slotRef
      // identity. Custom (audio-detected) chords don't carry a stable
      // identity beyond their notes — skip the slot highlight for them.
      const ref = audio.currentlyPlayingSlotRef
      if (!ref || ref.source === 'Custom') return -1
      const localIdx = progression.findIndex(s => s && s.source === ref.source && s.degree === ref.degree)
      return localIdx
    }
    return audio.currentlyPlayingIdx
  }, [audio.isPlaying, audio.currentlyPlayingSection, audio.currentlyPlayingIdx, audio.currentlyPlayingSlotRef, activeSection, playMode, progression])

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

      <ArrangementStrip
        active={activeSection}
        setActive={setActiveSection}
        densities={sectionsDensity}
        playMode={playMode}
        setPlayMode={setPlayMode}
        playingSection={audio.currentlyPlayingSection}
        isPlaying={audio.isPlaying}
      />

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
                onPreviewChord={(chord) => audio.previewChord(shiftNotes(chord.midiNotes))}
                onAddChord={(chord) => {
                  addChord(chord)
                  showToast(`Added ${chord.name} to ${SECTION_LABELS[activeSection]}`)
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
                currentlyPlayingIdx={progressionPlayingIdx}
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
                activeSectionLabel={SECTION_LABELS[activeSection]}
                onSuggest={() => setSuggestOpen(true)}
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
                activeSectionLabel={SECTION_LABELS[activeSection]}
                swing={drumSwing}            setSwing={setDrumSwing}
              />

              <AudioLayer
                audio={audio}
                enabled={audioEnabled}    setEnabled={setAudioEnabled}
                loop={audioLoop}          setLoop={setAudioLoop}
                muted={channelMutes.audio}
                onToggleMute={() => toggleChannelMute('audio')}
                clipBlob={audioBlob}
                clipName={audioClipName}
                onBlobChange={handleAudioBlobChange}
                onClear={handleAudioClear}
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

      <SuggestModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        context={{
          key: musicKey,
          scale,
          bpm,
          section: SECTION_LABELS[activeSection],
          currentChords: progression
            .map(slot => resolveSlot(slot)?.name)
            .filter(Boolean),
          otherSections: Object.fromEntries(
            SECTION_IDS
              .filter(id => id !== activeSection)
              .map(id => [
                SECTION_LABELS[id],
                (sections[id]?.progression || [])
                  .map(slot => resolveSlot(slot)?.name)
                  .filter(Boolean),
              ])
              .filter(([, chords]) => chords.length > 0)
          ),
        }}
        onPreviewChord={(chord) => audio.previewChord(shiftNotes(chord.midiNotes))}
        onAddChord={(chord) => {
          addChord(chord)
          showToast(`Added ${chord.name} to ${SECTION_LABELS[activeSection]}`)
        }}
      />

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
