import { useEffect, useRef, useState } from 'react'
import {
  AudioWaveform, Play, Pause, Square, SkipBack, Repeat,
  Users, Minus, Plus, Piano, ChevronDown,
} from 'lucide-react'
import { classNames } from '../lib/utils'
import { KEYS, KEY_LABELS, SCALE_NAMES } from '../lib/theory'

/**
 * Top transport bar — replaces the old header + ControlsBar pattern.
 * Holds Play/Stop/Loop/Record + bar counter + BPM stepper + chip
 * dropdowns for KEY / BARS / COMPLEX / OCT / INST + Save / Export +
 * the Live collab pill. Mobile collapses the chip strip into a scrollable
 * row underneath.
 */
export default function TopBar({
  isPlaying,
  onPlayToggle,
  onStop,
  bpm, setBpm,
  // chip values + setters
  musicKey, setMusicKey,
  scale, setScale,
  barsPerChord, setBarsPerChord,
  complexity, setComplexity,
  octaveShift, setOctaveShift,
  chordInstrument,
  // collab
  collabOpen, onToggleCollab,
  // export / save (save and export now live in slot props)
  exportMenu,
  projectMenu,
  // bar position (visual)
  barPosition = '02 . 03 . 14',
}) {
  const [loop, setLoop] = useState(true)
  const [rec, setRec] = useState(false)

  return (
    <div
      className="px-3 sm:px-5 flex items-center gap-2 sm:gap-4 border-b shrink-0 overflow-x-auto sm:overflow-visible h-14"
      style={{ borderColor: 'var(--line)', background: 'linear-gradient(180deg,#22223a 0%, #1a1a2e 100%)' }}
    >
      {/* ─── Brand ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#ff6b9d 0%,#4ecdc4 100%)' }}
        >
          <AudioWaveform className="w-4 h-4" style={{ color: '#1a1a2e' }} />
        </div>
        <div className="leading-tight hidden sm:block">
          <div className="text-[14px] font-semibold tracking-tight">ChordFlow</div>
          <div className="text-[10px] mono" style={{ color: 'var(--text-3)' }}>STUDIO · v0.7</div>
        </div>
      </div>

      <Sep />

      {/* ─── Transport ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <IconBtn aria="Skip back"><SkipBack className="w-3.5 h-3.5 text-ink-secondary" /></IconBtn>
        <button
          onClick={onPlayToggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={classNames(
            'w-11 h-11 rounded-xl flex items-center justify-center transition',
            isPlaying ? 'glow-pink' : 'hover:scale-[1.02]'
          )}
          style={{ background: isPlaying ? 'linear-gradient(135deg,#ff6b9d,#d94e7d)' : '#3a3a55' }}
        >
          {isPlaying
            ? <Pause className="w-4 h-4" style={{ color: '#1a1a2e' }} />
            : <Play  className="w-4 h-4 ml-0.5" style={{ color: '#ececf5' }} />}
        </button>
        <IconBtn aria="Stop" onClick={onStop}><Square className="w-3 h-3 text-ink-secondary" /></IconBtn>
        <IconBtn
          aria={rec ? 'Recording on' : 'Record'}
          onClick={() => setRec(r => !r)}
          className={rec ? 'ring-pink' : ''}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: rec ? '#ff6b9d' : '#7e7e98' }} />
        </IconBtn>
        <IconBtn
          aria={loop ? 'Loop on' : 'Loop off'}
          onClick={() => setLoop(l => !l)}
          className={loop ? 'text-[#4ecdc4]' : 'text-[#a0a0b8]'}
        >
          <Repeat className="w-3.5 h-3.5" />
        </IconBtn>
      </div>

      {/* ─── Bar counter ─────────────────────────────────────────── */}
      <div className="chip px-3 py-1.5 mono text-[12px] items-center gap-3 shrink-0 hidden md:flex">
        <span style={{ color: 'var(--text-3)' }}>BAR</span>
        <span style={{ color: '#4ecdc4' }}>{barPosition}</span>
        <span style={{ color: 'var(--text-3)' }}>·</span>
        <span
          style={{ color: isPlaying ? '#ff6b9d' : 'var(--text-3)' }}
          className={isPlaying ? 'pulse-dot' : ''}
        >●</span>
        <span style={{ color: 'var(--text-2)' }}>{isPlaying ? 'PLAYING' : 'STOPPED'}</span>
      </div>

      {/* ─── BPM stepper ─────────────────────────────────────────── */}
      <div className="chip px-2 sm:px-3 py-1 flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="text-[10px] mono" style={{ color: 'var(--text-3)' }}>BPM</span>
        <button
          onClick={() => setBpm(Math.max(40, bpm - 1))}
          className="w-5 h-5 rounded hover:bg-[#33334d] flex items-center justify-center"
          aria-label="Decrease BPM"
        >
          <Minus className="w-2.5 h-2.5" />
        </button>
        <span className="mono text-[15px] font-medium tabular-nums w-9 text-center">{bpm}</span>
        <button
          onClick={() => setBpm(Math.min(220, bpm + 1))}
          className="w-5 h-5 rounded hover:bg-[#33334d] flex items-center justify-center"
          aria-label="Increase BPM"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* ─── Chips: KEY / SCALE / BARS / COMPLEX / OCT / INST ────── */}
      <div className="flex items-center gap-2 shrink-0">
        <DropChip
          label="KEY"
          value={musicKey}
          options={KEYS.map(k => ({ value: k, label: KEY_LABELS[k] }))}
          onChange={setMusicKey}
        />
        <DropChip
          label="SCALE"
          value={scale}
          options={SCALE_NAMES.map(s => ({ value: s, label: s }))}
          onChange={setScale}
        />
        <DropChip
          label="BARS"
          value={String(barsPerChord)}
          options={[1, 2, 4].map(b => ({ value: String(b), label: String(b) }))}
          onChange={(v) => setBarsPerChord(parseInt(v, 10))}
        />
        <DropChip
          label="CMPLX"
          value={complexity}
          options={[
            { value: 'Triads',   label: 'Triads' },
            { value: '7th',      label: '7ths'   },
            { value: 'Extended', label: '9ths'   },
          ]}
          onChange={setComplexity}
        />
        <DropChip
          label="OCT"
          value={octaveShift > 0 ? `+${octaveShift}` : String(octaveShift)}
          options={[-2, -1, 0, 1, 2].map(o => ({
            value: String(o),
            label: o > 0 ? `+${o}` : String(o),
          }))}
          onChange={(v) => setOctaveShift(parseInt(v, 10))}
        />
        <DropChip
          label="INST"
          value={chordInstrument}
          icon={<Piano className="w-3 h-3 text-ink-secondary" />}
          // INST is just a display chip up here — the LayersPanel owns the picker.
          readonly
        />
      </div>

      {/* ─── Right side: Save / Export / Live ────────────────────── */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {projectMenu}
        {exportMenu}
        <button
          onClick={onToggleCollab}
          className={classNames(
            'px-3 py-1.5 rounded-lg flex items-center gap-2 text-[12px] transition',
            collabOpen && 'glow-teal'
          )}
          style={{
            background: collabOpen ? '#4ecdc4' : '#262640',
            color: collabOpen ? '#1a1a2e' : 'var(--text)',
            border: '1px solid #3a3a55',
          }}
        >
          <Users className="w-3 h-3" />
          <span className="font-medium">Live · 5</span>
          <div className="hidden md:flex -space-x-1.5">
            {['#ff6b9d', '#4ecdc4', '#f5a524'].map((c) => (
              <div key={c} className="w-4 h-4 rounded-full border" style={{
                background: c, borderColor: collabOpen ? '#4ecdc4' : '#262640',
              }} />
            ))}
          </div>
        </button>
      </div>
    </div>
  )
}

function Sep() {
  return <div className="w-px h-7 shrink-0 hidden sm:block" style={{ background: 'var(--line)' }} />
}

function IconBtn({ children, onClick, className = '', aria }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className={classNames(
        'w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#33334d]',
        className
      )}
    >
      {children}
    </button>
  )
}

function DropChip({ label, value, icon, options, onChange, readonly }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (readonly) {
    return (
      <button className="chip px-2.5 py-1 flex items-center gap-1.5 text-[12px] hover:bg-[#33334d]">
        {icon}
        <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{label}</span>
        <span className="font-medium truncate max-w-[80px]">{value}</span>
      </button>
    )
  }

  const currentLabel = options?.find(o => o.value === value)?.label ?? value

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="chip px-2.5 py-1 flex items-center gap-1.5 text-[12px] hover:bg-[#33334d]"
      >
        {icon}
        <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{label}</span>
        <span className="font-medium">{currentLabel}</span>
        <ChevronDown className="w-2.5 h-2.5 text-ink-secondary" />
      </button>
      {open && options && (
        <div
          className="absolute top-full left-0 mt-1 z-50 surface py-1 min-w-[100px] shadow-2xl"
          role="listbox"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange?.(opt.value); setOpen(false) }}
              className={classNames(
                'w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#33334d] transition',
                opt.value === value && 'text-accent-pink font-medium'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
