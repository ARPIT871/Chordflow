/**
 * Persist the LLM provider + API key + model to localStorage so the
 * Suggest popover doesn't prompt for them on every use. The key never
 * leaves the device — there is no server in this app.
 */

const KEY = 'chordflow:llm-settings'

export function loadLlmSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.provider || !parsed?.apiKey) return null
    return parsed
  } catch { return null }
}

export function saveLlmSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* quota */ }
}

export function clearLlmSettings() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}
