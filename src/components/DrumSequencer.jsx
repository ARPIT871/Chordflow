import { useEffect, useState } from 'react'
import {
  ChevronDown, ChevronRight, Volume2, VolumeX, Grid3x3, Eraser, Dices,
} from 'lucide-react'
import { classNames } from '../lib/utils'
import {
  DRUM_VOICES,
  DRUM_VOICE_LABELS,
  DRUM_VOICE_COLOR,
  DRUM_PRESETS,
  DRUM_PRESET_NAMES,
  emptyDrumPattern,
  isVoiceAudible,
} from '../lib/drum-patterns'

/**
 * Editable 6×16 drum grid with per-row mute/solo/volume + preset bar.
 * Click any cell to toggle it. Click M / S to mute / solo a row. Drag the
 * volume slider to set per-row velocity (used for both visual cell
 * intensity and MIDI export note velocity; per-row gain in the audio
 * engine is wired up in Slice 4).
 *
 * Playhead (`currentStep`) is driven from App.jsx via a setInterval
 * during playback — close enough for visual feedback without adding
 * another Tone.Transport callback to the hot path.
 */
export default function DrumSequencer({
  pattern, setPattern,
  mutes, setMutes,
  solos, setSolos,
  volumes, setVolumes,
  preset, setPreset,
  enabled, setEnabled,
  muted = false, onToggleMute = () => {},
  isPlaying, currentStep,
  activeSectionLabel,
}) {
  const [expanded, setExpanded] = useState(true)

  const togglePat = (voice, step) => {
    setPattern(prev => {
      const next = { ...prev, [voice]: [...prev[voice]] }
      next[voice][step] = next[voice][step] ? 0 : 1
      return next
    })
  }

  const applyPreset = (name) => {
    setPreset(name)
    const p = DRUM_PRESETS[name]
    if (p) setPattern(JSON.parse(JSON.stringify(p.pattern)))
  }

  const clear = () => setPattern(emptyDrumPattern())

  // Generate: keep current preset's overall feel but randomize each row
  // around its existing density. For now: copy preset pattern and randomly
  // toggle ~15% of the steps.
  const generate = () => {
    setPattern(prev => {
      const next = {}
      for (const v of DRUM_VOICES) {
        next[v] = prev[v].map(cell => Math.random() < 0.15 ? (cell ? 0 : 1) : cell)
      }
      return next
    })
  }

  return (
    <div className="surface p-3" style={{ opacity: enabled ? 1 : 0.62 }}>
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <ToggleSwitch enabled={enabled} onToggle={() => setEnabled(!enabled)} />

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 hover:opacity-90"
        >
          {expanded
            ? <ChevronDown  className="w-3.5 h-3.5 text-ink-secondary" />
            : <ChevronRight className="w-3.5 h-3.5 text-ink-secondary" />}
          <div className="w-1 h-4 rounded-full" style={{ background: '#ff6b9d' }} />
          <Grid3x3 className="w-3.5 h-3.5 text-accent-pink" />
          <span className="text-[12px] font-semibold tracking-tight">Drums</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>
            · {preset} · 6 rows
          </span>
          {activeSectionLabel && (
            <span
              className="mono text-[9px] px-1.5 py-0.5 rounded ml-1"
              style={{ background: 'rgba(255,107,157,.15)', color: '#ff6b9d' }}
              title="The drum pattern you're editing belongs to this section. Switch sections in the arrangement strip."
            >{activeSectionLabel}</span>
          )}
          {muted && (
            <span
              className="mono text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,107,157,.18)', color: '#ff6b9d' }}
            >MUTED</span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <button
            onClick={clear}
            className="h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] hover:brightness-110"
            style={{ background: '#262640', color: 'var(--text-2)', border: '1px solid #3a3a55' }}
            title="Clear all rows"
          >
            <Eraser className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            onClick={generate}
            className="h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] hover:brightness-110"
            style={{ background: '#262640', color: 'var(--text-2)', border: '1px solid #3a3a55' }}
            title="Randomly perturb the pattern"
          >
            <Dices className="w-3 h-3" />
            <span className="hidden sm:inline">Generate</span>
          </button>
          <button
            onClick={onToggleMute}
            className="w-7 h-7 rounded-md flex items-center justify-center transition"
            style={{
              background: muted ? 'rgba(255,107,157,.2)' : '#262640',
              border: '1px solid #3a3a55',
            }}
            aria-label={muted ? 'Unmute drums' : 'Mute drums'}
            title={muted ? 'Unmute' : 'Mute (silence in real-time)'}
          >
            {muted
              ? <VolumeX className="w-3 h-3 text-accent-pink" />
              : <Volume2 className="w-3 h-3 text-ink-secondary" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Beat markers (1, 2, 3, 4) above the grid */}
            <div className="flex items-center mb-1 gap-[3px]">
              <div className="w-[140px] shrink-0" />
              <div className="flex-1 flex gap-[3px]">
                {Array.from({ length: 16 }).map((_, i) => {
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
              <div className="ml-3 w-[120px] shrink-0" />
            </div>

            {/* Voice rows */}
            {DRUM_VOICES.map((voice) => {
              const rmuted = mutes[voice]
              const soloed = solos[voice]
              const audible = isVoiceAudible(voice, mutes, solos)
              const dimmed = !audible
              const colorCls = DRUM_VOICE_COLOR[voice]
              const vol = volumes[voice] ?? 70

              return (
                <div key={voice} className="flex items-center gap-[3px] mb-[3px]">
                  {/* Label + M / S */}
                  <div className="w-[140px] flex items-center gap-1.5 pr-2 shrink-0">
                    <button
                      onClick={() => setMutes({ ...mutes, [voice]: !mutes[voice] })}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] mono font-bold"
                      style={{
                        background: rmuted ? 'rgba(255,107,157,.2)' : '#262640',
                        color: rmuted ? '#ff6b9d' : 'var(--text-3)',
                      }}
                      aria-label={`${rmuted ? 'Unmute' : 'Mute'} ${DRUM_VOICE_LABELS[voice]}`}
                    >M</button>
                    <button
                      onClick={() => setSolos({ ...solos, [voice]: !solos[voice] })}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] mono font-bold"
                      style={{
                        background: soloed ? 'rgba(245,165,36,.2)' : '#262640',
                        color: soloed ? '#f5a524' : 'var(--text-3)',
                      }}
                      aria-label={`${soloed ? 'Unsolo' : 'Solo'} ${DRUM_VOICE_LABELS[voice]}`}
                    >S</button>
                    <span className={classNames(
                      'text-[11px] font-medium ml-1 truncate',
                      dimmed && 'text-ink-mute',
                    )}>
                      {DRUM_VOICE_LABELS[voice]}
                    </span>
                  </div>

                  {/* Grid cells */}
                  <div className="flex-1 flex gap-[3px]">
                    {pattern[voice].map((on, si) => {
                      const isBeat = si % 4 === 0
                      const isPlayhead = isPlaying && currentStep === si
                      const cls = on
                        ? `cell ${colorCls} ${dimmed ? 'dim' : ''} ${isPlayhead ? 'playing' : ''}`
                        : `cell ${isBeat ? 'beat' : ''} ${isPlayhead ? 'playing' : ''}`
                      return (
                        <button
                          key={si}
                          onClick={() => togglePat(voice, si)}
                          className={cls}
                          style={on ? { opacity: dimmed ? 0.55 : 0.6 + (vol / 99) * 0.4 } : undefined}
                          title={`Step ${si + 1}${on ? ` · vol ${vol}` : ''}`}
                        />
                      )
                    })}
                  </div>

                  {/* Volume */}
                  <div className="ml-3 w-[120px] flex items-center gap-2 shrink-0">
                    <Volume2 className="w-2.5 h-2.5 text-ink-mute shrink-0" />
                    <input
                      type="range"
                      min={0}
                      max={99}
                      value={vol}
                      onChange={(e) => setVolumes({ ...volumes, [voice]: parseInt(e.target.value, 10) })}
                      className="chf flex-1"
                      aria-label={`${DRUM_VOICE_LABELS[voice]} volume`}
                    />
                    <span
                      className="mono text-[9px] w-5 text-right"
                      style={{ color: 'var(--text-3)' }}
                    >{vol}</span>
                  </div>
                </div>
              )
            })}

            {/* Preset bar */}
            <div
              className="flex items-center gap-1.5 mt-3 pt-3 border-t flex-wrap"
              style={{ borderColor: 'var(--line-soft)' }}
            >
              <span
                className="text-[10px] mono mr-1"
                style={{ color: 'var(--text-3)' }}
              >PATTERNS</span>
              {DRUM_PRESET_NAMES.map(name => (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className={classNames('pill transition', preset === name && 'ring-pink')}
                  style={{
                    background: preset === name ? 'rgba(255,107,157,.12)' : '#262640',
                    color: preset === name ? '#ff6b9d' : 'var(--text-2)',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
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
      style={{ background: enabled ? '#ff6b9d' : '#3a3a55' }}
    >
      <span
        className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
        style={{ left: enabled ? 20 : 2 }}
      />
    </button>
  )
}
