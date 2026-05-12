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
    "You're an expert music theory assistant helping a songwriter pick chords for a sketch. " +
    "Your job is to give VARIED, MUSICALLY INTERESTING suggestions — not safe diatonic defaults. " +
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
        temperature: 0.9,
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
        temperature: 1,
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
  const {
    key, scale, bpm, section,
    currentChords = [],
    otherSections = {},
    vibe = '',
    avoid = [],
  } = context

  const chordsLine = currentChords.length === 0
    ? 'none yet — suggest the opening chord'
    : currentChords.map(c => c || '_').join(' → ')
  const otherList = Object.entries(otherSections)
    .filter(([, chords]) => chords?.length > 0)
    .map(([id, chords]) => `${id}: ${chords.join(' → ')}`)
    .join('; ') || 'no other sections built yet'
  const vibeLine = vibe.trim() ? `Vibe / style the user wants: ${vibe.trim()}` : ''
  const avoidLine = avoid.length > 0
    ? `DO NOT suggest any of these — already shown to the user: ${avoid.join(', ')}`
    : ''

  return `Key: ${key} ${scale}
Tempo: ${bpm} BPM
Section: ${section}
Current chords in this section: ${chordsLine}
Other sections in the song: ${otherList}
${vibeLine}
${avoidLine}

STEP 1 — Analyze the current progression's harmonic vocabulary silently:
- Is it mostly diatonic, or does it already use borrowed / chromatic chords (secondary dominants, modal interchange, parallel-mode borrowings, tritone subs, chromatic mediants)?
- What's its overall feel given the section, vibe, and tempo?

STEP 2 — Suggest ${count} chord ideas to EXTEND or BRANCH from this vocabulary. CRITICAL CONSTRAINTS:

1. Each suggestion MUST have a distinctly different harmonic function — do NOT return 4 plain diatonic chords.
2. If the existing progression already uses chromatic / borrowed chords, lean MORE chromatic, not less. Match its adventurousness; don't retreat to "safe" diatonic suggestions.
3. Across the ${count} suggestions, deliberately cover this mix:
   - at most ONE plain diatonic choice
   - at least ONE borrowed chord (parallel mode, e.g. iv in a major key, ♭VII, ♭VI, ♭III)
   - at least ONE secondary dominant or tritone substitution (V/V, V/vi, V/iii, etc.)
   - at least ONE color chord (7th, sus2, sus4, add9, maj7, m7, dim7)
4. Avoid suggesting chords that are already in the current progression unless reharmonising as a different quality.
5. Each "reason" must mention the SPECIFIC harmonic role and how it links to the user's existing chords — not generic praise.

Use real chord names: C, Am, F#m, Bbmaj7, Csus4, Bdim, Gsus2, G#maj7, Db7, etc. Stay readable — no extensions beyond 7ths.

Return ONLY this JSON shape (no markdown, no other text):
{
  "analysis": "one short sentence describing the current progression's character",
  "suggestions": [
    {
      "name": "Fm",
      "roman": "iv",
      "function": "borrowed from parallel minor",
      "reason": "Brief one-sentence why this specific chord links to the user's previous chord"
    }
  ]
}`
}
