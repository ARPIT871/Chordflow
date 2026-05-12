/**
 * Project save/load. Two layers:
 *
 *  1. **Working draft** — auto-saved to `localStorage[CURRENT_KEY]` on every
 *     state change (debounced in App.jsx). Restored on page load so a tab
 *     close or refresh never loses your in-progress sketch.
 *
 *  2. **Named projects** — explicit "Save as" entries listed under
 *     `localStorage[INDEX_KEY]`. Each entry has its own slot at
 *     `localStorage[PROJECT_PREFIX + id]`. Audio blobs live in IndexedDB
 *     under the same id (see audio-storage.js).
 *
 * Schema is versioned so future fields don't break old saves — older
 * projects load with whatever fields they have, missing fields fall back
 * to the app's current defaults.
 */

const CURRENT_KEY    = 'chordflow:current'
const INDEX_KEY      = 'chordflow:projects'
const PROJECT_PREFIX = 'chordflow:project:'
const SCHEMA_VERSION = 1

function safeJsonParse(raw, fallback = null) {
  try { return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}

function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/* ─── Serialize / deserialize ─────────────────────────────────────── */

/**
 * Snapshot the parts of app state we want to persist. Audio CLIP is NOT
 * in here — it's stored separately as a Blob in IndexedDB.
 */
export function serializeProject({
  name = 'Untitled',
  id,
  // settings
  musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
  activeSection,
  // progression + per-section data
  progressionSize,
  sections,
  // layers
  chordsEnabled, chordInstrument,
  bassEnabled, bassInstrument, bassMode,
  padsEnabled, padInstrument,
  pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
  drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes,
  audioEnabled, audioLoop, audioClipName,
  layerMutes,
  // mixer (read from audio engine)
  channelVolumes,
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: id || newId(),
    name,
    savedAt: Date.now(),
    state: {
      musicKey, scale, bpm, barsPerChord, complexity, octaveShift,
      activeSection,
      progressionSize,
      sections,                                            // per-section progression + drum pattern
      chordsEnabled, chordInstrument,
      bassEnabled, bassInstrument, bassMode,
      padsEnabled, padInstrument,
      pluckEnabled, pluckInstrument, pluckPattern, pluckRate,
      drumsEnabled, drumsPreset, drumMutes, drumSolos, drumVolumes,
      audioEnabled, audioLoop, audioClipName,
      layerMutes,
      channelVolumes,
    },
  }
}

/* ─── Working-draft slot ──────────────────────────────────────────── */

export function saveDraft(project) {
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(project)) } catch { /* quota */ }
}

export function loadDraft() {
  return safeJsonParse(localStorage.getItem(CURRENT_KEY))
}

export function clearDraft() {
  try { localStorage.removeItem(CURRENT_KEY) } catch { /* noop */ }
}

/* ─── Named-project list ──────────────────────────────────────────── */

export function listProjects() {
  return safeJsonParse(localStorage.getItem(INDEX_KEY), [])
}

export function loadProject(id) {
  return safeJsonParse(localStorage.getItem(PROJECT_PREFIX + id))
}

export function saveProject(project) {
  const id = project.id || newId()
  const stamped = { ...project, id, savedAt: Date.now() }
  try {
    localStorage.setItem(PROJECT_PREFIX + id, JSON.stringify(stamped))
  } catch (e) {
    throw new Error('Out of browser storage space — try deleting old projects')
  }
  // Update the index.
  const list = listProjects().filter(p => p.id !== id)
  list.unshift({ id, name: stamped.name, savedAt: stamped.savedAt })
  // Cap at 30 entries to avoid unbounded growth.
  const capped = list.slice(0, 30)
  localStorage.setItem(INDEX_KEY, JSON.stringify(capped))
  return id
}

export function deleteProject(id) {
  try { localStorage.removeItem(PROJECT_PREFIX + id) } catch { /* noop */ }
  const list = listProjects().filter(p => p.id !== id)
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

/* ─── File export / import ────────────────────────────────────────── */

/** Trigger a download of the project as a .chordflow.json file. */
export function downloadProjectFile(project) {
  const payload = JSON.stringify(project, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = (project.name || 'untitled').replace(/[^a-zA-Z0-9-_]+/g, '_')
  a.download = `${safe}.chordflow.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Read a .chordflow.json file picked by the user. Returns the parsed project. */
export async function readProjectFile(file) {
  const text = await file.text()
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || !parsed.state) {
    throw new Error('Not a valid ChordFlow project file')
  }
  return parsed
}
