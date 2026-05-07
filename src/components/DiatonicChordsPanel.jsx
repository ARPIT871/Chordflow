import { Music2, Play, Plus } from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Chord palette row — 7 diatonic chords in a single horizontal strip.
 * Each card glows teal when its chord is currently being played in the
 * progression. On phones, the grid wraps to 4 columns then 3 then 2 to
 * stay tappable.
 */
export default function DiatonicChordsPanel({
  chords,
  musicKey,
  scale,
  complexity = '7ths',
  playingDegree = -1,
  onPreview,
  onAdd,
}) {
  return (
    <div className="surface p-3 sm:p-3.5">
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Music2 className="w-3.5 h-3.5 text-accent-teal shrink-0" />
          <span className="text-[12px] font-semibold tracking-tight">Chord palette</span>
          <span className="mono text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
            · {musicKey} {scale} · {complexity}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {chords.map((chord, i) => {
          const playing = chord.degree === playingDegree
          return (
            <div
              key={i}
              className={classNames(
                'surface-soft p-2.5 transition group',
                playing && 'glow-teal'
              )}
              style={{
                background: playing
                  ? 'linear-gradient(180deg, rgba(78,205,196,.18), rgba(78,205,196,.04))'
                  : undefined,
                animationDelay: `${i * 40}ms`,
              }}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{chord.roman}</span>
                <span className="mono text-[9px]" style={{ color: 'var(--text-3)' }}>{chord.quality}</span>
              </div>
              <div className="text-[18px] font-semibold tracking-tight leading-none mb-0.5 truncate">
                {chord.name}
              </div>
              <div
                className="mono text-[9px] mb-2 truncate"
                style={{ color: 'var(--text-3)' }}
              >
                {chord.noteSymbols.join(' ')}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPreview(chord)}
                  className="flex-1 text-[10px] py-1.5 rounded-md flex items-center justify-center gap-1 hover:bg-[#33334d]"
                  style={{ background: '#262640' }}
                >
                  <Play className={classNames('w-2.5 h-2.5', playing ? 'text-accent-teal' : 'text-ink-secondary')} />
                  <span style={{ color: playing ? '#4ecdc4' : 'var(--text-2)' }}>
                    {playing ? 'Live' : 'Play'}
                  </span>
                </button>
                <button
                  onClick={() => onAdd(chord)}
                  aria-label="Add to progression"
                  className="text-[10px] py-1.5 px-2 rounded-md flex items-center justify-center hover:bg-[#33334d]"
                  style={{ background: 'rgba(255,107,157,.12)' }}
                >
                  <Plus className="w-2.5 h-2.5 text-accent-pink" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
