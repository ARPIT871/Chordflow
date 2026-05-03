import { Sparkles, Plus } from 'lucide-react'
import { getPresets, romanToDegree } from '../lib/presets'

export default function PresetsPanel({ scale, diatonicChords, onApply }) {
  const presets = getPresets(scale)

  return (
    <section className="lg:col-span-3 gradient-border rounded-2xl p-5 border border-white/10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4" /> Presets
      </h2>
      <div className="space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
        {presets.map((preset, i) => {
          const previewChords = preset.romans.map(r => diatonicChords[romanToDegree(r)])
          return (
            <button
              key={i}
              onClick={() => onApply(preset)}
              className="w-full text-left rounded-xl bg-[#252540] hover:bg-[#2d2d4a] border border-white/5 hover:border-accent-teal/40 p-3 transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-accent-teal uppercase tracking-wide">{preset.category}</span>
                <Plus className="w-3.5 h-3.5 text-ink-secondary group-hover:text-accent-teal transition-colors" />
              </div>
              <div className="text-sm font-mono text-accent-pink mb-1">
                {preset.romans.join(' – ')}
              </div>
              <div className="text-xs text-white/80 truncate">
                {previewChords.map(c => c?.name).filter(Boolean).join(' → ')}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
