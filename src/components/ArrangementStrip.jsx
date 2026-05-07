import { LayoutGrid, Plus, Maximize2 } from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Section pills (Intro / Verse / Chorus / Bridge / Outro). Selecting a
 * section is currently visual — section-aware playback patterns are a
 * future slice. Each pill shows 16 step-density dots so the user can read
 * "intensity" at a glance.
 */
const SECTIONS = [
  { id: 'intro',  name: 'Intro',  bars: 4, density: 0.30 },
  { id: 'verse',  name: 'Verse',  bars: 8, density: 0.60 },
  { id: 'chorus', name: 'Chorus', bars: 8, density: 0.90 },
  { id: 'bridge', name: 'Bridge', bars: 4, density: 0.50 },
  { id: 'outro',  name: 'Outro',  bars: 4, density: 0.20 },
]

export default function ArrangementStrip({ active, setActive }) {
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
          const cellsOn = Math.round(s.density * 16)
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={classNames(
                'arr-block flex-1 flex items-center px-3 transition',
                isActive && 'glow-pink'
              )}
              style={{
                background: isActive
                  ? 'linear-gradient(90deg, rgba(255,107,157,.18) 0%, rgba(255,107,157,.04) 100%)'
                  : '#262640',
                borderColor: isActive ? '#ff6b9d' : '#3a3a55',
              }}
            >
              <span className={classNames(
                'text-[12px] font-medium mr-2',
                isActive ? 'text-white' : 'text-ink-secondary',
              )}>
                {s.name}
              </span>
              <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{s.bars}b</span>
              <div className="ml-auto flex items-center gap-[2px]">
                {Array.from({ length: 16 }).map((_, k) => (
                  <div
                    key={k}
                    className={classNames(
                      'stepdot',
                      k < cellsOn && (isActive ? 'on' : 'on-teal')
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

      <button className="chip px-2.5 py-1 text-[11px] flex items-center gap-1.5 hover:bg-[#33334d] shrink-0">
        <Maximize2 className="w-2.5 h-2.5 text-ink-secondary" />
        <span style={{ color: 'var(--text-2)' }} className="hidden md:inline">Open timeline</span>
      </button>
    </div>
  )
}
