import { Sparkles, Minus, Plus } from 'lucide-react'
import Select from './Select'
import { KEYS, KEY_LABELS, SCALE_NAMES } from '../lib/theory'
import { classNames } from '../lib/utils'

const OCTAVE_MIN = -2
const OCTAVE_MAX = 2

const KEY_OPTIONS = KEYS.map(k => ({ value: k, label: KEY_LABELS[k] }))
const SCALE_OPTIONS = SCALE_NAMES.map(s => ({ value: s, label: s }))
const BAR_OPTIONS = [1, 2, 4].map(b => ({ value: String(b), label: `${b} bar${b > 1 ? 's' : ''}` }))
const COMPLEXITY_OPTIONS = [
  { value: 'Triads',   label: 'Triads' },
  { value: '7th',      label: '7ths'   },
  { value: 'Extended', label: '9ths'   },
]

export default function ControlsBar({
  musicKey, setMusicKey,
  scale, setScale,
  bpm, setBpm,
  barsPerChord, setBarsPerChord,
  complexity, setComplexity,
  octaveShift, setOctaveShift,
  onGenerate,
}) {
  const decOctave = () => setOctaveShift(Math.max(OCTAVE_MIN, octaveShift - 1))
  const incOctave = () => setOctaveShift(Math.min(OCTAVE_MAX, octaveShift + 1))

  return (
    <section className="gradient-border rounded-2xl p-4 sm:p-5 border border-white/10">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 items-end">
        <Select label="Key"   value={musicKey} onChange={setMusicKey} options={KEY_OPTIONS} />
        <Select label="Scale" value={scale}    onChange={setScale}    options={SCALE_OPTIONS} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-ink-secondary font-medium">BPM</span>
          <input
            type="number" inputMode="numeric" min={60} max={180} value={bpm}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!Number.isNaN(v)) setBpm(Math.max(60, Math.min(180, v)))
            }}
            className="bg-card hover:bg-[#363654] text-white text-sm font-medium rounded-lg px-3 py-2.5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent-pink/50 min-h-[42px]"
          />
        </label>

        <Select
          label="Bars / chord"
          value={String(barsPerChord)}
          onChange={(v) => setBarsPerChord(parseInt(v, 10))}
          options={BAR_OPTIONS}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-ink-secondary font-medium">Complexity</span>
          <div className="flex bg-card rounded-lg p-1 border border-white/10 min-h-[42px]">
            {COMPLEXITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setComplexity(opt.value)}
                className={classNames(
                  'flex-1 text-xs font-medium px-2 rounded-md transition-all',
                  complexity === opt.value
                    ? 'bg-accent-pink text-white shadow-sm'
                    : 'text-ink-secondary hover:text-white hover:bg-white/5'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-ink-secondary font-medium">Octave</span>
          <div className="flex items-center bg-card rounded-lg border border-white/10 min-h-[42px]">
            <button
              type="button"
              onClick={decOctave}
              disabled={octaveShift <= OCTAVE_MIN}
              className="px-3 py-2.5 flex items-center justify-center text-ink-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Lower octave"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 text-center text-sm font-mono text-white tabular-nums">
              {octaveShift > 0 ? `+${octaveShift}` : octaveShift}
            </span>
            <button
              type="button"
              onClick={incOctave}
              disabled={octaveShift >= OCTAVE_MAX}
              className="px-3 py-2.5 flex items-center justify-center text-ink-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Raise octave"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          onClick={onGenerate}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br from-accent-pink to-pink-300 min-h-[42px]"
        >
          <Sparkles className="w-4 h-4" />
          Generate
        </button>
      </div>
    </section>
  )
}
