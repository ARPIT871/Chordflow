import { useRef, useState } from 'react'
import { Upload, Loader2, AlertCircle, Search, RotateCcw, CheckCircle2 } from 'lucide-react'
import { analyzeAudioFile } from '../lib/key-detection'
import { classNames } from '../lib/utils'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB cap to avoid gigantic uploads

export default function KeyDetector({ onPick, currentKey, currentScale }) {
  const [state, setState] = useState('idle') // idle | analyzing | done | error
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const reset = () => {
    setState('idle')
    setResults([])
    setError(null)
    setFileName('')
    setDuration(0)
  }

  const handleFile = async (file) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setFileName(file.name)
      setError(`File is larger than ${Math.round(MAX_BYTES / 1024 / 1024)} MB. Trim it down first.`)
      setState('error')
      return
    }
    setFileName(file.name)
    setState('analyzing')
    setError(null)
    try {
      // Yield a tick so React paints the spinner before the heavy work
      await new Promise(r => setTimeout(r, 16))
      const { results: r, durationSec } = await analyzeAudioFile(file)
      setResults(r.slice(0, 5))
      setDuration(durationSec)
      setState('done')
    } catch (e) {
      setError(e.message || String(e))
      setState('error')
    }
  }

  const isCurrent = (r) => r.key === currentKey && r.scale === currentScale

  return (
    <section className="gradient-border rounded-2xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
          <Search className="w-4 h-4" /> Detect key from audio
        </h2>
        {state !== 'idle' && (
          <button
            onClick={reset}
            className="text-xs text-ink-secondary hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {state === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => inputRef.current?.click()}
          className={classNames(
            'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-accent-teal bg-accent-teal/10'
              : 'border-white/15 hover:border-accent-teal/40 hover:bg-white/5'
          )}
        >
          <Upload className="w-7 h-7 mx-auto mb-2 text-ink-secondary" />
          <div className="text-sm text-white">Drop a vocal or song file, or click to browse</div>
          <div className="text-xs text-ink-secondary mt-1">
            MP3 · WAV · OGG · M4A — about 1 minute is enough
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {state === 'analyzing' && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent-teal mb-2" />
          <div className="text-sm text-white truncate">Analyzing {fileName}…</div>
          <div className="text-xs text-ink-secondary mt-1">
            STFT → chromagram → matching against 24 key profiles
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-6">
          <AlertCircle className="w-7 h-7 mx-auto text-amber-400 mb-2" />
          <div className="text-sm text-amber-400">Couldn't analyze: {error}</div>
          <button onClick={reset} className="text-xs text-ink-secondary hover:text-white mt-2 underline">
            Try a different file
          </button>
        </div>
      )}

      {state === 'done' && results.length > 0 && (
        <div>
          <div className="text-xs text-ink-secondary mb-3 truncate">
            <span className="text-white">{fileName}</span> · {duration.toFixed(1)}s · top 5 candidates
          </div>
          <div className="space-y-1.5">
            {results.map((r, i) => {
              const active = isCurrent(r)
              return (
                <button
                  key={`${r.key}-${r.scale}`}
                  onClick={() => onPick(r.key, r.scale)}
                  className={classNames(
                    'w-full flex items-center justify-between rounded-lg px-3 py-2.5 transition-all text-left',
                    i === 0
                      ? 'bg-accent-teal/15 hover:bg-accent-teal/25 border border-accent-teal/40'
                      : 'bg-card hover:bg-[#363654] border border-white/5',
                    active && 'ring-2 ring-accent-pink/50'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {active && <CheckCircle2 className="w-3.5 h-3.5 text-accent-pink shrink-0" />}
                    <span className={classNames(
                      'text-base font-bold truncate',
                      i === 0 ? 'text-accent-teal' : 'text-white'
                    )}>
                      {r.key} {r.scale}
                    </span>
                    {i === 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-ink-secondary">
                        most likely
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ConfidenceBar value={r.confidence} highlight={i === 0} />
                    <span className="text-xs font-mono text-ink-secondary tabular-nums w-9 text-right">
                      {r.confidence}%
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="text-[11px] text-ink-secondary mt-3 leading-relaxed">
            Click a row to apply that key to the controls above. If the top guess feels wrong,
            try the second — usually it's the relative major/minor (same notes, different tonic).
          </div>
        </div>
      )}
    </section>
  )
}

function ConfidenceBar({ value, highlight }) {
  return (
    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className={highlight ? 'h-full bg-accent-teal' : 'h-full bg-ink-secondary'}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
