import { useEffect, useRef, useState } from 'react'
import {
  Sparkles, X, Settings, Loader2, Play, Plus, RotateCcw, AlertCircle,
  ExternalLink, Trash2, Check,
} from 'lucide-react'
import { classNames } from '../lib/utils'
import {
  PROVIDERS, suggestChords, testConnection,
} from '../lib/llm'
import { parseChordName } from '../lib/chord-parsing'
import {
  loadLlmSettings, saveLlmSettings, clearLlmSettings,
} from '../lib/llm-settings'

/**
 * Modal for "✨ Suggest chords" — two modes share one card:
 *   - Config: first-time setup or when the user clicks the gear.
 *     Picks provider, pastes API key, picks model, optional "Test".
 *   - Suggestions: after settings are in place, hits the LLM, shows a
 *     ranked list of chord ideas with Preview + Add buttons.
 *
 * Context (key/scale/bpm/section/currentChords/otherSections) and
 * callbacks (onPreviewChord/onAddChord) are passed in from App.jsx.
 */
export default function SuggestModal({
  open,
  onClose,
  context,
  onPreviewChord,
  onAddChord,
}) {
  const [settings, setSettings] = useState(() => loadLlmSettings())
  const [configOpen, setConfigOpen] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestIdRef = useRef(0)

  // First time the modal opens, route to config if no settings.
  useEffect(() => {
    if (!open) return
    if (!settings) setConfigOpen(true)
    else { setConfigOpen(false); fetchSuggestions() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchSuggestions = async () => {
    const s = settings || loadLlmSettings()
    if (!s) { setConfigOpen(true); return }
    setLoading(true); setError(null); setSuggestions(null)
    const id = ++requestIdRef.current
    try {
      const result = await suggestChords({
        provider: s.provider,
        apiKey:   s.apiKey,
        model:    s.model,
        context,
        count:    4,
      })
      if (id !== requestIdRef.current) return // stale
      const items = Array.isArray(result?.suggestions) ? result.suggestions : []
      const parsed = items
        .map(item => {
          const chord = parseChordName(item.name)
          if (!chord) return null
          return { ...chord, roman: item.roman || chord.roman, reason: item.reason || '' }
        })
        .filter(Boolean)
      setSuggestions(parsed)
    } catch (e) {
      if (id !== requestIdRef.current) return
      setError(e?.message || 'Suggestion failed')
    } finally {
      if (id === requestIdRef.current) setLoading(false)
    }
  }

  const onSettingsSaved = (next) => {
    setSettings(next)
    saveLlmSettings(next)
    setConfigOpen(false)
    fetchSuggestions()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.6)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface w-full max-w-md mt-12 sm:mt-0 shadow-2xl"
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--line-soft)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-pink" />
            <span className="text-[13px] font-semibold">AI chord suggestions</span>
            {settings?.provider && (
              <span
                className="mono text-[9px] px-1.5 py-0.5 rounded ml-1"
                style={{ background: '#1a1a2e', color: 'var(--text-3)' }}
                title={`${PROVIDERS[settings.provider]?.label || settings.provider} · ${settings.model || PROVIDERS[settings.provider]?.defaultModel}`}
              >
                {PROVIDERS[settings.provider]?.label || settings.provider}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setConfigOpen(o => !o)}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#33334d]"
              title={configOpen ? 'Back to suggestions' : 'API settings'}
            >
              <Settings className="w-3.5 h-3.5 text-ink-secondary" />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#33334d]"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-ink-secondary" />
            </button>
          </div>
        </div>

        {/* Body */}
        {configOpen
          ? <ConfigForm initial={settings} onSaved={onSettingsSaved} onCancel={() => settings && setConfigOpen(false)} />
          : <SuggestionsBody
              context={context}
              loading={loading}
              error={error}
              suggestions={suggestions}
              onPreview={onPreviewChord}
              onAdd={onAddChord}
              onRetry={fetchSuggestions}
            />
        }
      </div>
    </div>
  )
}

/* ─── Suggestions list ──────────────────────────────────────────────── */

function SuggestionsBody({ context, loading, error, suggestions, onPreview, onAdd, onRetry }) {
  return (
    <div className="p-4 space-y-3">
      {/* Context hint */}
      <div
        className="text-[10px] mono px-2 py-1.5 rounded"
        style={{ background: '#1a1a2e', color: 'var(--text-3)' }}
      >
        {context.key} {context.scale} · {context.section} · current: {context.currentChords?.length ? context.currentChords.join(' → ') : '(empty)'}
      </div>

      {loading && (
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-pink mb-1.5" />
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Thinking…</div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md p-3 text-[11px] flex items-start gap-2" style={{ background: 'rgba(245,165,36,.08)', border: '1px solid rgba(245,165,36,.25)' }}>
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-amber-400 font-medium mb-0.5">Couldn't get suggestions</div>
            <div style={{ color: 'var(--text-2)' }}>{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && Array.isArray(suggestions) && suggestions.length === 0 && (
        <div className="text-center py-4 text-[11px]" style={{ color: 'var(--text-3)' }}>
          Model returned no usable chords. Try Retry.
        </div>
      )}

      {!loading && !error && Array.isArray(suggestions) && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div
              key={`${s.name}-${i}`}
              className="surface-soft p-2.5 flex items-start gap-2.5"
            >
              <div className="flex flex-col items-center justify-center w-10 shrink-0 pt-0.5">
                <div className="text-[16px] font-semibold tracking-tight">{s.name}</div>
                <div className="mono text-[9px]" style={{ color: 'var(--text-3)' }}>{s.roman}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono text-[10px] mb-1 truncate" style={{ color: 'var(--text-3)' }}>
                  {s.noteSymbols.join(' · ')}
                </div>
                <div className="text-[11px] leading-tight" style={{ color: 'var(--text-2)' }}>
                  {s.reason || 'No reason given'}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => onPreview?.(s)}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#33334d]"
                  style={{ background: '#262640', border: '1px solid #3a3a55' }}
                  aria-label={`Preview ${s.name}`}
                  title="Preview"
                >
                  <Play className="w-3 h-3 text-accent-teal" />
                </button>
                <button
                  onClick={() => onAdd?.(s)}
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: 'rgba(255,107,157,.15)', border: '1px solid rgba(255,107,157,.4)' }}
                  aria-label={`Add ${s.name} to progression`}
                  title="Add to active section"
                >
                  <Plus className="w-3 h-3 text-accent-pink" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] hover:bg-[#33334d]"
          style={{ background: '#262640', border: '1px solid #3a3a55', color: 'var(--text-2)' }}
        >
          <RotateCcw className="w-3 h-3" />
          {suggestions ? 'Suggest more' : 'Try again'}
        </button>
      )}
    </div>
  )
}

/* ─── Config form ───────────────────────────────────────────────────── */

function ConfigForm({ initial, onSaved, onCancel }) {
  const [provider, setProvider] = useState(initial?.provider || 'openai')
  const [apiKey, setApiKey]     = useState(initial?.apiKey || '')
  const [model, setModel]       = useState(initial?.model || PROVIDERS[initial?.provider || 'openai'].defaultModel)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    // When provider switches, default the model to that provider's default.
    setModel(PROVIDERS[provider].defaultModel)
    setTestResult(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const test = async () => {
    if (!apiKey.trim()) { setTestResult({ ok: false, error: 'Paste a key first' }); return }
    setTesting(true); setTestResult(null)
    const r = await testConnection({ provider, apiKey: apiKey.trim(), model })
    setTesting(false); setTestResult(r)
  }

  const save = () => {
    if (!apiKey.trim()) { setTestResult({ ok: false, error: 'Paste a key first' }); return }
    onSaved({ provider, apiKey: apiKey.trim(), model })
  }

  const forget = () => {
    clearLlmSettings()
    setApiKey('')
    setProvider('openai')
    setModel(PROVIDERS.openai.defaultModel)
    setTestResult(null)
  }

  const cfg = PROVIDERS[provider]

  return (
    <div className="p-4 space-y-3">
      <div className="text-[11px] leading-snug" style={{ color: 'var(--text-2)' }}>
        Paste your API key. It stays in your browser's localStorage and goes
        directly to the provider — no server in between.
      </div>

      <div>
        <div className="text-[10px] mono mb-1.5" style={{ color: 'var(--text-3)' }}>PROVIDER</div>
        <div className="flex items-center gap-1 chip p-1">
          {Object.entries(PROVIDERS).map(([id, info]) => (
            <button
              key={id}
              onClick={() => setProvider(id)}
              className={classNames(
                'flex-1 text-[11px] py-1 rounded-md transition',
                provider === id ? 'text-white' : 'text-ink-secondary hover:text-white',
              )}
              style={{ background: provider === id ? '#3a3a55' : 'transparent' }}
            >
              {info.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] mono mb-1.5 flex items-center justify-between" style={{ color: 'var(--text-3)' }}>
          <span>API KEY</span>
          <a
            href={cfg.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-white"
            style={{ color: 'var(--text-3)' }}
          >
            Get one <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={cfg.keyHint}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-[#1a1a2e] border rounded px-2.5 py-2 text-[12px] mono focus:outline-none"
          style={{ borderColor: '#3a3a55' }}
        />
      </div>

      <div>
        <div className="text-[10px] mono mb-1.5" style={{ color: 'var(--text-3)' }}>MODEL</div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full bg-[#1a1a2e] border rounded px-2 py-1.5 text-[12px] focus:outline-none"
          style={{ borderColor: '#3a3a55' }}
        >
          {cfg.models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
          {provider === 'openai' && model.includes('mini') && '~$0.001 per suggestion · fastest, cheapest'}
          {provider === 'openai' && !model.includes('mini') && '~$0.01-0.05 per suggestion · highest quality'}
          {provider === 'anthropic' && model.includes('haiku') && '~$0.001 per suggestion · fastest, cheapest'}
          {provider === 'anthropic' && model.includes('sonnet') && '~$0.005-0.02 per suggestion · balanced'}
          {provider === 'anthropic' && model.includes('opus') && '~$0.02-0.10 per suggestion · highest quality'}
        </div>
      </div>

      {testResult && (
        <div
          className="rounded-md p-2 text-[11px] flex items-start gap-2"
          style={{
            background: testResult.ok ? 'rgba(78,205,196,.08)' : 'rgba(245,165,36,.08)',
            border: '1px solid ' + (testResult.ok ? 'rgba(78,205,196,.3)' : 'rgba(245,165,36,.3)'),
          }}
        >
          {testResult.ok
            ? <Check className="w-3.5 h-3.5 text-accent-teal shrink-0 mt-0.5" />
            : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            {testResult.ok ? 'Connection looks good.' : testResult.error}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={test}
          disabled={testing || !apiKey.trim()}
          className="px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: '#262640', border: '1px solid #3a3a55', color: 'var(--text-2)' }}
        >
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Test
        </button>
        {initial && (
          <button
            onClick={forget}
            className="px-3 py-1.5 rounded-md text-[11px] flex items-center gap-1.5"
            style={{ background: '#262640', border: '1px solid #3a3a55', color: 'var(--text-2)' }}
          >
            <Trash2 className="w-3 h-3" />
            Forget
          </button>
        )}
        <div className="flex-1" />
        {onCancel && initial && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[11px]"
            style={{ color: 'var(--text-2)' }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={!apiKey.trim()}
          className="px-3 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#ff6b9d,#d94e7d)', color: '#1a1a2e' }}
        >
          Save & suggest
        </button>
      </div>

      <div className="text-[9px] mt-1" style={{ color: 'var(--text-3)' }}>
        Your key stays in this browser's localStorage. Click <strong>Forget</strong> to clear it.
        Don't paste keys you use for production — XSS in this app or a browser
        extension could read them.
      </div>
    </div>
  )
}
