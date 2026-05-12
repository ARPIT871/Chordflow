import { LayoutGrid, Plus, Maximize2, Play, ListMusic } from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Section pills (Intro / Verse / Chorus / Bridge / Outro). Picking a
 * section switches the live progression + drum pattern to that section's
 * data (the heavy lifting happens in App.jsx). The 16 step-density dots
 * per pill reflect the section's actual content via the `densities`
 * prop — progression fill ratio and drum-cell density combined.
 *
 * A play-mode toggle on the right of the strip switches between looping
 * just the active section and sequencing every non-empty section as a
 * full song. When playing in song mode, the currently-playing section
 * gets a teal indicator that's distinct from the editing highlight.
 */
const SECTIONS = [
  { id: 'intro',  name: 'Intro',  bars: 4 },
  { id: 'verse',  name: 'Verse',  bars: 8 },
  { id: 'chorus', name: 'Chorus', bars: 8 },
  { id: 'bridge', name: 'Bridge', bars: 4 },
  { id: 'outro',  name: 'Outro',  bars: 4 },
]

export default function ArrangementStrip({
  active, setActive,
  densities = {},
  playMode = 'section',
  setPlayMode,
  playingSection = null,
  isPlaying = false,
}) {
  return (
    <div
      className="px-3 sm:px-5 py-2.5 border-b flex items-center gap-3 shrink-0 overflow-x-auto"
      style={{ borderColor: 'var(--line)', background: '#1d1d33' }}
    >
      <div className="flex items-center gap-1.5 mr-1 shrink-0">
        <LayoutGrid className="w-3 h-3 text-ink-secondary" />
        <span className="text-[11px] mono" style={{ color: 'var(--text-3)' }}>ARRANGEMENT</span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-[600px]">
        {SECTIONS.map(s => {
          const isActive = s.id === active
          const isPlayingThis = isPlaying && playingSection === s.id
          const density = Math.max(0, Math.min(1, densities[s.id] ?? 0))
          const cellsOn = Math.round(density * 16)
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={classNames(
                'arr-block flex-1 flex items-center px-3 transition relative',
                isActive       && 'glow-pink',
                isPlayingThis  && 'glow-teal',
              )}
              style={{
                background: isPlayingThis
                  ? 'linear-gradient(90deg, rgba(78,205,196,.20) 0%, rgba(78,205,196,.04) 100%)'
                  : isActive
                    ? 'linear-gradient(90deg, rgba(255,107,157,.18) 0%, rgba(255,107,157,.04) 100%)'
                    : '#262640',
                borderColor: isPlayingThis ? '#4ecdc4' : isActive ? '#ff6b9d' : '#3a3a55',
              }}
            >
              <span className={classNames(
                'text-[12px] font-medium mr-2',
                isPlayingThis ? 'text-white' : isActive ? 'text-white' : 'text-ink-secondary',
              )}>
                {s.name}
              </span>
              <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{s.bars}b</span>
              {isPlayingThis && (
                <span
                  className="mono text-[8px] ml-1.5 px-1 rounded pulse-dot"
                  style={{ background: 'rgba(78,205,196,.18)', color: '#4ecdc4' }}
                >▸ NOW</span>
              )}
              <div className="ml-auto flex items-center gap-[2px]">
                {Array.from({ length: 16 }).map((_, k) => (
                  <div
                    key={k}
                    className={classNames(
                      'stepdot',
                      k < cellsOn && (isPlayingThis ? 'on-teal' : isActive ? 'on' : 'on-teal')
                    )}
                  />
                ))}
              </div>
            </button>
          )
        })}
        <button
          className="arr-block w-12 flex items-center justify-center hover:bg-[#262640]"
          style={{ borderStyle: 'dashed', background: 'transparent' }}
          aria-label="Add section"
        >
          <Plus className="w-3.5 h-3.5 text-ink-mute" />
        </button>
      </div>

      {/* Section ⇄ Song toggle */}
      <div className="flex items-center gap-0.5 chip px-1 py-0.5 shrink-0">
        <button
          onClick={() => setPlayMode?.('section')}
          className={classNames('seg-btn text-[10px] py-0.5 flex items-center gap-1', playMode === 'section' && 'active')}
          title="Play loops the active section only"
        >
          <Play className="w-2.5 h-2.5" />
          Section
        </button>
        <button
          onClick={() => setPlayMode?.('song')}
          className={classNames('seg-btn text-[10px] py-0.5 flex items-center gap-1', playMode === 'song' && 'active')}
          title="Play sequences every non-empty section in order, then loops"
        >
          <ListMusic className="w-2.5 h-2.5" />
          Song
        </button>
      </div>

      <button className="chip px-2.5 py-1 text-[11px] flex items-center gap-1.5 hover:bg-[#33334d] shrink-0">
        <Maximize2 className="w-2.5 h-2.5 text-ink-secondary" />
        <span style={{ color: 'var(--text-2)' }} className="hidden md:inline">Open timeline</span>
      </button>
    </div>
  )
}
