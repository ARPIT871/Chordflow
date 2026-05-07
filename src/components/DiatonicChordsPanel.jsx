import { Music2, Play, Plus } from 'lucide-react'
import { classNames } from '../lib/utils'
import { borrowedScaleNameFor, modalScaleNameFor } from '../lib/theory'

/**
 * Chord palette with Diatonic / Borrowed / Modal tabs. Borrowed shows
 * chords from the parallel mode (Major↔Natural Minor on the same root)
 * — classic "color chord" territory. Modal surfaces a complementary mode
 * (Mixolydian for major-feeling keys, Dorian for minor-feeling ones).
 *
 * The added chord retains its `source` so the progression can resolve it
 * back to the right list when the key changes.
 */
const TABS = ['Diatonic', 'Borrowed', 'Modal']

export default function DiatonicChordsPanel({
  chordsBySource,           // { Diatonic, Borrowed, Modal } each = chord[]
  activeSource,             // which tab is open
  onChangeSource,
  musicKey, scale, complexity = '7ths',
  playingChord,             // currently-playing resolved chord (or null)
  onPreview, onAdd,
}) {
  const chords = chordsBySource[activeSource] || chordsBySource.Diatonic
  const subtitleSource =
    activeSource === 'Borrowed' ? `from ${borrowedScaleNameFor(scale)}` :
    activeSource === 'Modal'    ? `from ${modalScaleNameFor(scale)}`    :
    `${musicKey} ${scale}`

  return (
    <div className="surface p-3 sm:p-3.5">
      <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Music2 className="w-3.5 h-3.5 text-accent-teal shrink-0" />
          <span className="text-[12px] font-semibold tracking-tight">Chord palette</span>
          <span className="mono text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
            · {subtitleSource} · {complexity}
          </span>
        </div>
        <div className="flex items-center gap-0.5 chip px-1 py-0.5">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => onChangeSource(t)}
              className={classNames('seg-btn text-[10px] py-0.5', activeSource === t && 'active')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {chords.map((chord, i) => {
          const isPlaying =
            playingChord &&
            playingChord.source === chord.source &&
            playingChord.degree === chord.degree
          return (
            <div
              key={`${chord.source}-${i}`}
              className={classNames(
                'surface-soft p-2.5 transition group',
                isPlaying && 'glow-teal'
              )}
              style={{
                background: isPlaying
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
                  <Play className={classNames('w-2.5 h-2.5', isPlaying ? 'text-accent-teal' : 'text-ink-secondary')} />
                  <span style={{ color: isPlaying ? '#4ecdc4' : 'var(--text-2)' }}>
                    {isPlaying ? 'Live' : 'Play'}
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
