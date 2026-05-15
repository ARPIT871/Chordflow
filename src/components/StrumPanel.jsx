import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Volume2, VolumeX, Guitar, Eraser, ArrowDown, ArrowUp,
} from 'lucide-react'
import Select from './Select'
import { classNames } from '../lib/utils'
import { PLUCK_INSTRUMENTS } from '../lib/instruments'
import {
  STRUM_PRESETS, STRUM_PRESET_NAMES, STRUM_PATTERN_LEN,
  cycleStrumStep, emptyStrumPattern,
} from '../lib/strum-patterns'

/**
 * Guitar strum pattern editor — 16-step grid of D / U / - cells.
 *
 * Click a cell to cycle through  -  →  ↓ (down-stroke)  →  ↑ (up-stroke).
 * Pre-built patterns load into the grid as starting points; the user
 * can then tweak. Strings-delay slider controls how spread-out each
 * strum is — small values feel like a stab, larger values like a
 * lazy lounge strum.
 *
 * Plays whichever chord is in the current slot (same as the other
 * pattern-based layers). Exports as guitar notes with staggered start
 * times in MIDI / stem / full-mix.
 */
export default function StrumPanel({
  enabled, setEnabled,
  pattern, setPattern,
  preset, setPreset,
  instrument, setInstrument,
  stringDelayMs, setStringDelayMs,
  muted = false, onToggleMute = () => {},
  isPlaying, currentStep,
}) {
  const [expanded, setExpanded] = useState(true)

  const cycle = (idx) => setPattern(cycleStrumStep(pattern, idx))

  const applyPreset = (name) => {
    setPreset(name)
    const p = STRUM_PRESETS[name]
    if (p) setPattern(p.dirs.slice(0, STRUM_PATTERN_LEN).padEnd(STRUM_PATTERN_LEN, '-'))
  }

  const clearAll = () => setPattern(emptyStrumPattern())

  return (
    <div className="surface p-3" style={{ opacity: enabled ? 1 : 0.62 }}>
      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <ToggleSwitch enabled={enabled} onToggle={() => setEnabled(!enabled)} />

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 hover:opacity-90"
        >
          {expanded
            ? <ChevronDown  className="w-3.5 h-3.5 text-ink-secondary" />
            : <ChevronRight className="w-3.5 h-3.5 text-ink-secondary" />}
          <div className="w-1 h-4 rounded-full" style={{ background: '#f5a524' }} />
          <Guitar className="w-3.5 h-3.5" style={{ color: '#f5a524' }} />
          <span className="text-[12px] font-semibold tracking-tight">Strum</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>
            · {preset} · {stringDelayMs}ms
          </span>
          {muted && (
            <span
              className="mono text-[9px] px-1.5 py-0.5 rounded ml-1"
              style={{ background: 'rgba(255,107,157,.18)', color: '#ff6b9d' }}
            >MUTED</span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <div className="min-w-[120px]">
            <Select
              value={instrument}
              onChange={setInstrument}
              options={PLUCK_INSTRUMENTS.map(n => ({ value: n, label: n }))}
            />
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ background: '#262640', border: '1px solid #3a3a55' }}
            title="Delay between strings — small = tight, large = lazy"
          >
            <span className="mono text-[9px]" style={{ color: 'var(--text-3)' }}>STRINGS</span>
            <input
              type="range" min={3} max={45} value={stringDelayMs}
              onChange={(e) => setStringDelayMs(parseInt(e.target.value, 10))}
              className="chf w-16"
            />
            <span className="mono text-[9px] w-7 text-right" style={{ color: 'var(--text-2)' }}>
              {stringDelayMs}ms
            </span>
          </div>
          <button
            onClick={clearAll}
            className="h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] hover:brightness-110"
            style={{ background: '#262640', color: 'var(--text-2)', border: '1px solid #3a3a55' }}
            title="Clear pattern"
          >
            <Eraser className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            onClick={onToggleMute}
            className="w-7 h-7 rounded-md flex items-center justify-center transition"
            style={{
              background: muted ? 'rgba(255,107,157,.2)' : '#262640',
              border: '1px solid #3a3a55',
            }}
            aria-label={muted ? 'Unmute strum' : 'Mute strum'}
          >
            {muted
              ? <VolumeX className="w-3 h-3 text-accent-pink" />
              : <Volume2 className="w-3 h-3 text-ink-secondary" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Beat markers (1 e & a 2 e & a …) */}
          <div className="flex items-center gap-[3px]">
            {Array.from({ length: STRUM_PATTERN_LEN }).map((_, i) => {
              const isBeat = i % 4 === 0
              return (
                <div key={i} className="flex-1 flex justify-center">
                  <span className={classNames(
                    'mono text-[9px]',
                    isBeat ? 'text-ink-secondary' : 'text-ink-mute',
                  )}>
                    {isBeat ? Math.floor(i / 4) + 1 : '·'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Cell grid */}
          <div className="flex items-center gap-[3px]">
            {pattern.split('').map((dir, i) => {
              const isBeat = i % 4 === 0
              const isPlayhead = isPlaying && currentStep === i
              return (
                <button
                  key={i}
                  onClick={() => cycle(i)}
                  className={classNames(
                    'flex-1 aspect-square rounded-md flex items-center justify-center transition',
                    dir === 'D' && 'glow-amber',
                    isPlayhead && 'ring-2 ring-white',
                  )}
                  style={{
                    background:
                      dir === 'D' ? 'linear-gradient(180deg,#f5a524,#c47e10)' :
                      dir === 'U' ? 'linear-gradient(180deg,#4ecdc4,#2fa49c)' :
                      isBeat ? '#262640' : '#22223a',
                    border: '1px solid ' + (
                      dir === 'D' ? '#ffc56b' :
                      dir === 'U' ? '#7be0d8' :
                      '#2f2f48'
                    ),
                    minWidth: 0,
                  }}
                  title={`Step ${i + 1} · ${dir === '-' ? 'rest' : dir === 'D' ? 'down-stroke' : 'up-stroke'} — click to cycle`}
                >
                  {dir === 'D' && <ArrowDown className="w-3 h-3" style={{ color: '#1a1a2e' }} />}
                  {dir === 'U' && <ArrowUp   className="w-3 h-3" style={{ color: '#1a1a2e' }} />}
                </button>
              )
            })}
          </div>

          {/* Preset row */}
          <div
            className="flex items-center gap-1.5 pt-3 border-t flex-wrap"
            style={{ borderColor: 'var(--line-soft)' }}
          >
            <span className="text-[10px] mono mr-1" style={{ color: 'var(--text-3)' }}>PATTERNS</span>
            {STRUM_PRESET_NAMES.map(name => (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                className={classNames('pill transition', preset === name && 'ring-amber')}
                style={{
                  background: preset === name ? 'rgba(245,165,36,.12)' : '#262640',
                  color: preset === name ? '#f5a524' : 'var(--text-2)',
                }}
              >
                {STRUM_PRESETS[name].label}
              </button>
            ))}
          </div>

          <div className="text-[10px] mono" style={{ color: 'var(--text-3)' }}>
            Click a cell to cycle — · ↓ ↑ · — patterns play the current chord with
            staggered string timing. Pick a chord on guitar, tap your strum into
            the grid, hit Export → MIDI or Full mix to drop it into FL.
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      className="relative shrink-0 w-10 h-[22px] rounded-full transition-colors"
      style={{ background: enabled ? '#f5a524' : '#3a3a55' }}
    >
      <span
        className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
        style={{ left: enabled ? 20 : 2 }}
      />
    </button>
  )
}
