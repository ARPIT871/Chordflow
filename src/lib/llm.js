/**
 * Provider-agnostic LLM client for chord suggestions. Runs entirely in
 * the browser — the user pastes their own API key (stored only in
 * localStorage) and the key goes directly to OpenAI or Anthropic. There
 * is no server in the loop.
 *
 * Two surfaces:
 *   - testConnection({provider, apiKey, model}) → { ok, error? }
 *   - suggestChords({provider, apiKey, model, context, count}) → { suggestions: [{name, roman, reason}] }
 *
 * Provider quirks worth knowing:
 *   - OpenAI supports response_format: 'json_object' so its replies are
 *     reliably parsable. Default model: gpt-4o-mini.
 *   - Anthropic needs the `anthropic-dangerous-direct-browser-access`
 *     header for direct browser calls and doesn't have a built-in JSON
 *     mode — we ask for JSON in the prompt and strip any ``` fences.
 *     Default model: claude-haiku-4-5-20251001.
 */

export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic',
    defaultModel: 'claude-haiku-4-5-20251001',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
}

/* ─── Test the user's API key with a 1-token ping ──────────────────── */
export async function testConnection({ provider, apiKey, model }) {
  try {
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || PROVIDERS.openai.defaultModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.error?.message || `HTTP ${r.status}`)
      }
      return { ok: true }
    }
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: model || PROVIDERS.anthropic.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.error?.message || `HTTP ${r.status}`)
      }
      return { ok: true }
    }
    throw new Error('Unknown provider')
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}

/* ─── Ask for chord suggestions ────────────────────────────────────── */
export async function suggestChords({ provider, apiKey, model, context, count = 4 }) {
  const system =
    "You're an expert music theory assistant helping a songwriter pick chords. " +
    "Return ONLY a JSON object — no markdown fences, no commentary."
  const userPrompt = buildPrompt(context, count)

  let rawText
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || PROVIDERS.openai.defaultModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error(body?.error?.message || `HTTP ${r.status}`)
    }
    const data = await r.json()
    rawText = data.choices?.[0]?.message?.content || ''
  } else if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || PROVIDERS.anthropic.defaultModel,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error(body?.error?.message || `HTTP ${r.status}`)
    }
    const data = await r.json()
    rawText = data.content?.[0]?.text || ''
  } else {
    throw new Error('Unknown provider')
  }

  return parseJsonLoosely(rawText)
}

/**
 * LLMs occasionally wrap JSON in ```json fences or prepend a comment.
 * Strip the common offenders before JSON.parse — last resort: extract
 * the first {...} block.
 */
function parseJsonLoosely(text) {
  if (!text) throw new Error('Empty response from the model')
  let s = text.trim()
  // Strip ```json … ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(s)
  } catch {
    // Fall back to the first JSON object we can find.
    const m = s.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Model did not return JSON')
    return JSON.parse(m[0])
  }
}

function buildPrompt(context, count) {
  const { key, scale, bpm, section, currentChords = [], otherSections = {} } = context
  const chordsLine = currentChords.length === 0
    ? 'none yet — suggest the opening chord'
    : currentChords.map(c => c || '_').join(' → ')
  const otherList = Object.entries(otherSections)
    .filter(([, chords]) => chords?.length > 0)
    .map(([id, chords]) => `${id}: ${chords.join(' → ')}`)
    .join('; ') || 'no other sections built yet'

  return `Key: ${key} ${scale}
Tempo: ${bpm} BPM
Section: ${section}
Current chords in this section: ${chordsLine}
Other sections in the song: ${otherList}

Suggest ${count} chord recommendations to extend this section's progression. Mix diatonic chords with borrowed / secondary chords for color where it makes musical sense.

Use real chord names like C, Am, F#m, Bbmaj7, Csus4, Bdim, Gsus2 — keep it readable, avoid fancy extensions beyond 7ths.

Return ONLY this JSON shape (no markdown, no other text):
{
  "suggestions": [
    { "name": "Fm", "roman": "iv", "reason": "Brief one-sentence why" }
  ]
}`
}
