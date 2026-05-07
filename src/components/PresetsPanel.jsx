import { Sparkles, Shuffle } from 'lucide-react'
import { getPresets, romanToDegree } from '../lib/presets'
import { classNames } from '../lib/utils'

/**
 * Compact left-rail preset card. 2-column grid of preset buttons. The
 * design's BETA pill / shuffle button are kept as visual affordances.
 */
export default function PresetsPanel({ scale, diatonicChords, onApply }) {
  const presets = getPresets(scale)

  return (
    <div className="surface p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent-pink" />
          <span className="text-[12px] font-semibold tracking-tight">Progression presets</span>
        </div>
        <button aria-label="Shuffle preset" style={{ color: 'var(--text-3)' }}>
          <Shuffle className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-[420px] overflow-y-auto scrollbar-thin pr-0.5">
        {presets.map((p, i) => {
          const previewChords = p.romans.map(r => diatonicChords[romanToDegree(r)])
          return (
            <button
              key={p.category + i}
              onClick={() => onApply(p)}
              className={classNames(
                'text-left px-2.5 py-1.5 rounded-md transition hover:bg-[#33334d]'
              )}
              style={{ background: '#262640' }}
              title={previewChords.map(c => c?.name).filter(Boolean).join(' → ')}
            >
              <div className="text-[12px] font-medium truncate">{p.category}</div>
              <div className="mono text-[9px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {p.romans.join(' – ')}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
