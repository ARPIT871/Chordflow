import { Music, Play, Plus } from 'lucide-react'
import { classNames, qualityChip } from '../lib/utils'

export default function DiatonicChordsPanel({ chords, musicKey, scale, onPreview, onAdd }) {
  return (
    <section className="lg:col-span-4 gradient-border rounded-2xl p-4 sm:p-5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
          <Music className="w-4 h-4" /> Diatonic Chords
        </h2>
        <span className="text-xs text-ink-secondary">{musicKey} {scale}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-2.5">
        {chords.map((chord, i) => {
          const chip = qualityChip(chord.quality)
          return (
            <div
              key={i}
              className="chord-card-anim group rounded-xl bg-[#252540] hover:bg-[#2d2d4a] border border-white/5 hover:border-accent-pink/40 p-3 transition-all"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-lg font-mono text-accent-pink">{chord.roman}</span>
                <span className={classNames('text-[10px] px-1.5 py-0.5 rounded font-mono', chip.bg, chip.text)}>
                  {chip.label}
                </span>
              </div>
              <div className="text-xl font-bold text-white truncate" title={chord.name}>{chord.name}</div>
              <div className="text-[11px] text-ink-secondary mt-1 mb-2.5 font-mono truncate">
                {chord.noteSymbols.join(' – ')}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onPreview(chord)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 active:bg-teal-500/30 rounded-md py-2 transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" /> Play
                </button>
                <button
                  onClick={() => onAdd(chord)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-pink-300 bg-pink-500/10 hover:bg-pink-500/20 active:bg-pink-500/30 rounded-md py-2 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
