import { useRef, useState } from 'react'
import { Upload, Loader2, AlertCircle, ScanLine, RotateCcw, CheckCircle2, FileAudio2, X } from 'lucide-react'
import { analyzeAudioFile } from '../lib/key-detection'
import { classNames } from '../lib/utils'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB cap to avoid gigantic uploads

/**
 * Compact left-rail key-detection card matching the design's surface style.
 * Three states share a single card: idle (drop zone), analyzing (spinner),
 * done (top-5 candidates). Errors show inline.
 */
export default function KeyDetector({ onPick, currentKey, currentScale }) {
  const [state, setState] = useState('idle') // idle | analyzing | done | error
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const reset = () => {
    setState('idle'); setResults([]); setError(null); setFileName(''); setDuration(0)
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
      await new Promise(r => setTimeout(r, 16)) // let React paint the spinner
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
    <div className="surface p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <ScanLine className="w-3.5 h-3.5 text-accent-teal" />
          <span className="text-[12px] font-semibold tracking-tight">Key detection</span>
        </div>
        {state !== 'idle' ? (
          <button
            onClick={reset}
            className="text-[10px] mono flex items-center gap-1 hover:text-white"
            style={{ color: 'var(--text-3)' }}
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        ) : (
          <span
            className="mono text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(78,205,196,.12)', color: '#4ecdc4' }}
          >BETA</span>
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
            'border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-accent-teal bg-accent-teal/10'
              : 'border-white/15 hover:border-accent-teal/40 hover:bg-white/5'
          )}
        >
          <Upload className="w-5 h-5 mx-auto mb-1.5 text-ink-secondary" />
          <div className="text-[12px] text-white">Drop a song or vocal</div>
          <div className="text-[10px] mono mt-1" style={{ color: 'var(--text-3)' }}>
            MP3 · WAV · OGG · M4A
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
        <div className="text-center py-5">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-teal mb-1.5" />
          <div className="text-[11px] text-white truncate">{fileName}</div>
          <div className="text-[10px] mono mt-1" style={{ color: 'var(--text-3)' }}>
            Analyzing chromagram…
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-4">
          <AlertCircle className="w-5 h-5 mx-auto text-amber-400 mb-1" />
          <div className="text-[11px] text-amber-400">{error}</div>
          <button onClick={reset} className="text-[10px] text-ink-secondary hover:text-white mt-2 underline">
            Try a different file
          </button>
        </div>
      )}

      {state === 'done' && results.length > 0 && (
        <>
          <div
            className="surface-soft p-2.5 mb-3"
            style={{ background: 'rgba(78,205,196,.06)', borderColor: 'rgba(78,205,196,.25)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: '#1a1a2e' }}
              >
                <FileAudio2 className="w-3.5 h-3.5 text-accent-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium truncate">{fileName}</div>
                <div className="text-[10px] mono" style={{ color: 'var(--text-3)' }}>
                  {duration.toFixed(1)}s · analyzed
                </div>
              </div>
              <button onClick={reset} aria-label="Clear analysis">
                <X className="w-3 h-3" style={{ color: 'var(--text-3)' }} />
              </button>
            </div>
          </div>

          <div className="text-[10px] mono mb-1.5" style={{ color: 'var(--text-3)' }}>
            TOP 5 CANDIDATES
          </div>
          <div className="space-y-1.5">
            {results.map((r, i) => {
              const active = isCurrent(r)
              return (
                <button
                  key={`${r.key}-${r.scale}`}
                  onClick={() => onPick(r.key, r.scale)}
                  className={classNames(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-left',
                    i === 0 && 'ring-teal',
                    active && !i && 'ring-pink',
                  )}
                  style={{ background: i === 0 ? 'rgba(78,205,196,.08)' : 'transparent' }}
                >
                  <span className="mono text-[10px] w-3" style={{ color: 'var(--text-3)' }}>{i + 1}</span>
                  <span className={classNames(
                    'text-[12px] font-medium w-24 truncate',
                    i === 0 ? 'text-white' : 'text-ink-secondary',
                  )}>
                    {r.key} {r.scale}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#22223a' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.confidence}%`,
                        background: i === 0 ? 'linear-gradient(90deg,#4ecdc4,#7be0d8)' : '#4a4a66',
                      }}
                    />
                  </div>
                  <span className="mono text-[10px] w-7 text-right" style={{ color: 'var(--text-3)' }}>
                    {r.confidence}%
                  </span>
                  {active && <CheckCircle2 className="w-3 h-3 text-accent-pink shrink-0" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
