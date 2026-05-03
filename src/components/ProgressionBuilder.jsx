import { useRef, useState } from 'react'
import { Music2, Trash2, Plus, X, Square, Play, Download, Copy } from 'lucide-react'
import { classNames } from '../lib/utils'

export default function ProgressionBuilder({
  progression, progressionSize, setProgressionSize, diatonicChords,
  currentlyPlayingIdx, isPlaying, bpm, barsPerChord,
  onPlayToggle, onExport, onCopy, onClear, onRemove, onSwap, onSetSlot,
}) {
  const [pickerForSlot, setPickerForSlot] = useState(-1)
  const dragFromRef = useRef(-1)

  return (
    <section className="lg:col-span-5 gradient-border rounded-2xl p-5 border border-white/10 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
          <Music2 className="w-4 h-4" /> Progression
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-card rounded-md p-0.5 border border-white/10">
            {[4, 8].map(n => (
              <button
                key={n}
                onClick={() => setProgressionSize(n)}
                className={classNames(
                  'text-xs px-2 py-1 rounded',
                  progressionSize === n ? 'bg-white/10 text-white' : 'text-ink-secondary hover:text-white'
                )}
              >
                {n} slots
              </button>
            ))}
          </div>
          <button
            onClick={onClear}
            title="Clear progression"
            className="text-xs text-ink-secondary hover:text-white p-1.5 rounded hover:bg-white/5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-2.5 mb-4 grid-cols-2 sm:grid-cols-4">
        {progression.map((degree, idx) => {
          const chord = degree !== null && degree !== undefined ? diatonicChords[degree] : null
          const playing = idx === currentlyPlayingIdx
          return (
            <div
              key={idx}
              draggable={!!chord}
              onDragStart={() => { dragFromRef.current = idx }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragFromRef.current
                dragFromRef.current = -1
                if (from < 0 || from === idx) return
                onSwap(from, idx)
              }}
              onClick={() => {
                if (chord) setPickerForSlot(pickerForSlot === idx ? -1 : idx)
              }}
              className={classNames(
                'relative rounded-xl border-2 p-3 min-h-[110px] flex flex-col items-center justify-center transition-all',
                chord
                  ? 'bg-[#2d2d4a] border-accent-pink/30 hover:border-accent-pink/60 cursor-pointer'
                  : 'bg-[#1f1f35] border-dashed border-white/10 hover:border-accent-teal/40',
                playing && 'playing-glow border-accent-pink'
              )}
            >
              <div className="absolute top-1.5 left-2 text-[10px] font-mono text-ink-secondary">{idx + 1}</div>
              {chord ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(idx) }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-ink-secondary hover:text-white hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-xs font-mono text-accent-pink mb-1">{chord.roman}</div>
                  <div className="text-xl font-bold text-white text-center break-all leading-tight">{chord.name}</div>
                  <div className="text-[10px] text-ink-secondary mt-1 font-mono truncate max-w-full">
                    {chord.noteSymbols.join(' ')}
                  </div>
                </>
              ) : (
                <Plus className="w-5 h-5 text-[#4a4a6a]" />
              )}

              {pickerForSlot === idx && chord && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full mt-1 left-0 right-0 z-20 bg-[#15152a] border border-white/15 rounded-lg p-2 shadow-2xl"
                >
                  <div className="text-[10px] uppercase text-ink-secondary mb-1.5 px-1">Replace with</div>
                  <div className="grid grid-cols-2 gap-1">
                    {diatonicChords.map((c) => (
                      <button
                        key={c.degree}
                        onClick={() => { onSetSlot(idx, c.degree); setPickerForSlot(-1) }}
                        className="text-xs py-1 px-1.5 rounded hover:bg-white/10 text-left"
                      >
                        <span className="font-mono text-accent-pink mr-1">{c.roman}</span>
                        <span className="text-white">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        <button
          onClick={onPlayToggle}
          className={classNames(
            'flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]',
            isPlaying
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/30'
              : 'bg-gradient-to-br from-accent-teal to-teal-200 shadow-teal-500/30'
          )}
        >
          {isPlaying
            ? (<><Square className="w-4 h-4 fill-current" /> Stop</>)
            : (<><Play className="w-4 h-4 fill-current" /> Play Progression</>)
          }
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium bg-card hover:bg-[#363654] text-white border border-white/10 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export MIDI
        </button>
        <button
          onClick={onCopy}
          className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium bg-card hover:bg-[#363654] text-white border border-white/10 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
      </div>

      <div className="mt-3 text-[11px] text-ink-secondary">
        Drag cards to reorder · click a chord to swap · Play loops at {bpm} BPM ({barsPerChord} {barsPerChord === 1 ? 'bar' : 'bars'} each)
      </div>
    </section>
  )
}
