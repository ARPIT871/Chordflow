import { Layers, Piano, Wind, Zap, Drum } from 'lucide-react'
import Select from './Select'
import { classNames } from '../lib/utils'
import {
  INSTRUMENT_NAMES,
  PAD_INSTRUMENTS,
  PLUCK_INSTRUMENTS,
} from '../lib/instruments'
import { ARP_PATTERNS, ARP_RATES } from '../lib/arp-patterns'
import { DRUM_PRESETS, DRUM_PRESET_NAMES } from '../lib/drum-patterns'

/**
 * Four-layer mixer: chords, pads, pluck, drums. Each row has a power toggle,
 * an instrument/preset picker, and (for pluck/drums) extra params.
 *
 * The chord instrument lives here too so the user has a single mental model
 * — every audible layer is in this panel. Mobile-friendly: rows stack
 * vertically, controls are 44px+ touch targets.
 */
export default function LayersPanel({
  // chords
  chordsEnabled, setChordsEnabled,
  chordInstrument, setChordInstrument,
  // pads
  padsEnabled, setPadsEnabled,
  padInstrument, setPadInstrument,
  // pluck
  pluckEnabled, setPluckEnabled,
  pluckInstrument, setPluckInstrument,
  pluckPattern, setPluckPattern,
  pluckRate, setPluckRate,
  // drums
  drumsEnabled, setDrumsEnabled,
  drumsPreset, setDrumsPreset,
  // global
  instrumentLoading,
}) {
  return (
    <section className="gradient-border rounded-2xl p-4 sm:p-5 border border-white/10">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
          <Layers className="w-4 h-4" /> Layers
        </h2>
        {instrumentLoading && (
          <span className="text-[11px] text-accent-teal animate-pulse">loading samples…</span>
        )}
      </div>

      <div className="space-y-2.5">
        <LayerRow
          icon={<Piano className="w-4 h-4" />}
          name="Chords"
          color="pink"
          enabled={chordsEnabled}
          onToggle={() => setChordsEnabled(!chordsEnabled)}
        >
          <Select
            value={chordInstrument}
            onChange={setChordInstrument}
            options={INSTRUMENT_NAMES.map(n => ({ value: n, label: n }))}
          />
        </LayerRow>

        <LayerRow
          icon={<Wind className="w-4 h-4" />}
          name="Pads"
          color="teal"
          enabled={padsEnabled}
          onToggle={() => setPadsEnabled(!padsEnabled)}
          hint="Sustained backing under everything"
        >
          <Select
            value={padInstrument}
            onChange={setPadInstrument}
            options={PAD_INSTRUMENTS.map(n => ({ value: n, label: n }))}
          />
        </LayerRow>

        <LayerRow
          icon={<Zap className="w-4 h-4" />}
          name="Pluck"
          color="amber"
          enabled={pluckEnabled}
          onToggle={() => setPluckEnabled(!pluckEnabled)}
          hint="Auto-arpeggiates chord tones"
        >
          <div className="grid grid-cols-3 gap-1.5">
            <Select
              value={pluckInstrument}
              onChange={setPluckInstrument}
              options={PLUCK_INSTRUMENTS.map(n => ({ value: n, label: n }))}
            />
            <Select
              value={pluckPattern}
              onChange={setPluckPattern}
              options={ARP_PATTERNS.map(p => ({ value: p, label: p }))}
            />
            <Select
              value={pluckRate}
              onChange={setPluckRate}
              options={ARP_RATES.map(r => ({ value: r, label: r }))}
            />
          </div>
        </LayerRow>

        <LayerRow
          icon={<Drum className="w-4 h-4" />}
          name="Drums"
          color="violet"
          enabled={drumsEnabled}
          onToggle={() => setDrumsEnabled(!drumsEnabled)}
          hint={DRUM_PRESETS[drumsPreset]?.description || ''}
        >
          <Select
            value={drumsPreset}
            onChange={setDrumsPreset}
            options={DRUM_PRESET_NAMES.map(n => ({ value: n, label: n }))}
          />
        </LayerRow>
      </div>

      <p className="text-[11px] text-ink-secondary mt-3 leading-relaxed">
        Toggle layers on, hit Play to preview the full sketch. Export drops a
        multi-track .mid into your downloads — open it in FL Studio and each
        layer is its own channel ready for your favorite plugin.
      </p>
    </section>
  )
}

const COLORS = {
  pink:   { bar: 'bg-accent-pink',  ring: 'ring-accent-pink/40',  text: 'text-accent-pink'  },
  teal:   { bar: 'bg-accent-teal',  ring: 'ring-accent-teal/40',  text: 'text-accent-teal'  },
  amber:  { bar: 'bg-amber-400',    ring: 'ring-amber-400/40',    text: 'text-amber-300'    },
  violet: { bar: 'bg-violet-400',   ring: 'ring-violet-400/40',   text: 'text-violet-300'   },
}

function LayerRow({ icon, name, color, enabled, onToggle, hint, children }) {
  const c = COLORS[color]
  return (
    <div
      className={classNames(
        'rounded-xl border p-3 sm:p-3.5 transition-all',
        enabled
          ? 'bg-[#252540] border-white/15'
          : 'bg-[#1a1a30] border-white/5'
      )}
    >
      <div className="flex items-center gap-3 mb-2 sm:mb-2.5">
        <button
          onClick={onToggle}
          aria-pressed={enabled}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${name} layer`}
          className={classNames(
            'relative shrink-0 w-11 h-6 rounded-full transition-colors',
            enabled ? c.bar : 'bg-white/10'
          )}
        >
          <span
            className={classNames(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              enabled && 'translate-x-5'
            )}
          />
        </button>

        <div className={classNames('flex items-center gap-2 min-w-0', enabled ? 'opacity-100' : 'opacity-50')}>
          <span className={c.text}>{icon}</span>
          <span className="font-semibold text-white text-sm">{name}</span>
        </div>

        {hint && (
          <span className="ml-auto text-[10px] sm:text-[11px] text-ink-secondary truncate hidden sm:inline">
            {hint}
          </span>
        )}
      </div>

      {hint && (
        <span className="block text-[11px] text-ink-secondary mb-2 sm:hidden">
          {hint}
        </span>
      )}

      <div className={classNames('transition-opacity', enabled ? 'opacity-100' : 'opacity-50 pointer-events-none')}>
        {children}
      </div>
    </div>
  )
}
