import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Volume2, VolumeX,
  Cloudy, Waves, Piano,
} from 'lucide-react'
import Select from './Select'
import { classNames } from '../lib/utils'
import {
  INSTRUMENT_NAMES,
  PAD_INSTRUMENTS,
  PLUCK_INSTRUMENTS,
} from '../lib/instruments'
import { ARP_PATTERNS, ARP_RATES } from '../lib/arp-patterns'

/**
 * Stacked layer panels matching the design — one surface card per layer,
 * each with an accent color bar, collapse toggle, mute button, and
 * per-layer controls. Order mirrors the design: Pad → Arp → Drums (chord
 * is owned elsewhere — its instrument lives in the TopBar's INST chip and
 * the chord palette row).
 *
 * Layer color coding: Pad = teal, Pluck/Arp = amber, Drums = pink.
 * (Bass = violet is reserved for Slice 3.)
 */
const LAYER_COLORS = {
  pink:   { bar: '#ff6b9d', accent: 'text-accent-pink',   ring: 'ring-pink'   },
  teal:   { bar: '#4ecdc4', accent: 'text-accent-teal',   ring: 'ring-teal'   },
  amber:  { bar: '#f5a524', accent: 'text-accent-amber',  ring: 'ring-amber'  },
  violet: { bar: '#a78bfa', accent: 'text-accent-violet', ring: 'ring-violet' },
}

/**
 * Note: the Drums layer is not in this panel — it lives in its own
 * `DrumSequencer` component because the editable 6×16 grid needs
 * significantly more vertical real estate than the other layers.
 */
export default function LayersPanel({
  // chords (used for the visual "Chords" status only — its instrument is
  // managed via the TopBar / dedicated picker)
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
}) {
  return (
    <div className="space-y-2.5">
      {/* Chords sound row — visual mirror of design's "INST" chip */}
      <ChordsBar
        enabled={chordsEnabled}
        onToggle={() => setChordsEnabled(!chordsEnabled)}
        instrument={chordInstrument}
        setInstrument={setChordInstrument}
      />

      <LayerCard
        color="teal"
        icon={<Cloudy className="w-3.5 h-3.5" style={{ color: LAYER_COLORS.teal.bar }} />}
        name="Pad"
        status="sustained chords · wet"
        enabled={padsEnabled}
        onToggleEnabled={() => setPadsEnabled(!padsEnabled)}
        controls={(
          <>
            <Select
              value={padInstrument}
              onChange={setPadInstrument}
              options={PAD_INSTRUMENTS.map(n => ({ value: n, label: n }))}
            />
          </>
        )}
        bodyHint="Pad MIDI track in the export holds each chord for the full slot duration."
      />

      <LayerCard
        color="amber"
        icon={<Waves className="w-3.5 h-3.5" style={{ color: LAYER_COLORS.amber.bar }} />}
        name="Arpeggiator"
        status={`${pluckPattern} · ${pluckRate}`}
        enabled={pluckEnabled}
        onToggleEnabled={() => setPluckEnabled(!pluckEnabled)}
        controls={(
          <>
            <div className="flex items-center gap-0.5 chip px-1 py-0.5">
              {ARP_PATTERNS.map(m => (
                <button
                  key={m}
                  onClick={() => setPluckPattern(m)}
                  className={classNames('seg-btn text-[10px] py-0.5', pluckPattern === m && 'active')}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 chip px-1 py-0.5">
              {ARP_RATES.map(r => (
                <button
                  key={r}
                  onClick={() => setPluckRate(r)}
                  className={classNames('seg-btn text-[10px] py-0.5', pluckRate === r && 'active')}
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        )}
        secondaryControls={(
          <Select
            value={pluckInstrument}
            onChange={setPluckInstrument}
            options={PLUCK_INSTRUMENTS.map(n => ({ value: n, label: n }))}
          />
        )}
      />

    </div>
  )
}

/* ─── Chords-as-a-layer header (sits above the variable layer cards) ── */
function ChordsBar({ enabled, onToggle, instrument, setInstrument }) {
  return (
    <div className="surface p-3">
      <div className="flex items-center gap-3">
        <ToggleSwitch enabled={enabled} onToggle={onToggle} color="pink" />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-4 rounded-full shrink-0" style={{ background: '#ff6b9d' }} />
          <Piano className="w-3.5 h-3.5 text-accent-pink shrink-0" />
          <span className="text-[12px] font-semibold tracking-tight">Chords</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>· instrument</span>
        </div>
        <div className="ml-auto min-w-[160px]">
          <Select
            value={instrument}
            onChange={setInstrument}
            options={INSTRUMENT_NAMES.map(n => ({ value: n, label: n }))}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Generic collapsible layer card ────────────────────────────────── */
function LayerCard({
  color, icon, name, status,
  enabled, onToggleEnabled,
  controls, secondaryControls,
  bodyHint,
}) {
  const [expanded, setExpanded] = useState(true)
  const c = LAYER_COLORS[color]
  return (
    <div className="surface p-3" style={{ opacity: enabled ? 1 : 0.62 }}>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <ToggleSwitch enabled={enabled} onToggle={onToggleEnabled} color={color} />

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 hover:opacity-90"
        >
          {expanded
            ? <ChevronDown  className="w-3.5 h-3.5 text-ink-secondary" />
            : <ChevronRight className="w-3.5 h-3.5 text-ink-secondary" />}
          <div className="w-1 h-4 rounded-full" style={{ background: c.bar }} />
          {icon}
          <span className="text-[12px] font-semibold tracking-tight">{name}</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>· {status}</span>
        </button>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {controls}
          <button
            onClick={onToggleEnabled}
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: !enabled ? 'rgba(255,107,157,.2)' : '#262640' }}
            aria-label={enabled ? 'Mute layer' : 'Unmute layer'}
          >
            {enabled
              ? <Volume2 className="w-3 h-3 text-ink-secondary" />
              : <VolumeX className="w-3 h-3 text-accent-pink" />}
          </button>
        </div>
      </div>

      {expanded && (secondaryControls || bodyHint) && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {secondaryControls && (
            <div className="min-w-[160px] flex-1 max-w-xs">{secondaryControls}</div>
          )}
          {bodyHint && (
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{bodyHint}</span>
          )}
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ enabled, onToggle, color }) {
  const c = LAYER_COLORS[color]
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      className="relative shrink-0 w-10 h-[22px] rounded-full transition-colors"
      style={{ background: enabled ? c.bar : '#3a3a55' }}
    >
      <span
        className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
        style={{ left: enabled ? 20 : 2 }}
      />
    </button>
  )
}
