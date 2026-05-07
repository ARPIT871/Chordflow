import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

/**
 * Horizontal mixer strip docked above the keyboard. For Slice 1 this is a
 * VISUAL stub — meters animate randomly while playing, faders/M/S buttons
 * are non-functional. Slice 4 will wire each channel to a Tone.Gain node
 * and drive the meters from real waveform peaks.
 *
 * Props:
 *   isPlaying  — drives the random-meter animation
 *   layers     — { chordsEnabled, padsEnabled, pluckEnabled, drumsEnabled }
 *                so muted channels (= disabled layers) render dim
 */
export default function HorizontalMixer({ isPlaying, layers = {} }) {
  const [levels, setLevels] = useState({ chords: 0.6, drums: 0.85, bass: 0, pad: 0.4, arp: 0, master: 0.78 })

  // Random meter pulse — visual only. Replaced by real meters in Slice 4.
  useEffect(() => {
    if (!isPlaying) {
      setLevels({ chords: 0, drums: 0, bass: 0, pad: 0, arp: 0, master: 0 })
      return
    }
    const t = setInterval(() => {
      setLevels({
        chords: layers.chordsEnabled ? 0.4 + Math.random() * 0.4 : 0,
        drums:  layers.drumsEnabled  ? 0.55 + Math.random() * 0.4 : 0,
        bass:   0,                                                   // bass not built yet
        pad:    layers.padsEnabled   ? 0.25 + Math.random() * 0.25 : 0,
        arp:    layers.pluckEnabled  ? 0.35 + Math.random() * 0.35 : 0,
        master: 0.55 + Math.random() * 0.35,
      })
    }, 110)
    return () => clearInterval(t)
  }, [isPlaying, layers.chordsEnabled, layers.padsEnabled, layers.pluckEnabled, layers.drumsEnabled])

  const channels = [
    { id: 'chords', label: 'Chords', color: '#ff6b9d', vol: 78, muted: !layers.chordsEnabled },
    { id: 'drums',  label: 'Drums',  color: '#ff6b9d', vol: 84, muted: !layers.drumsEnabled  },
    { id: 'bass',   label: 'Bass',   color: '#a78bfa', vol: 72, muted: true /* not built */  },
    { id: 'pad',    label: 'Pad',    color: '#4ecdc4', vol: 46, muted: !layers.padsEnabled   },
    { id: 'arp',    label: 'Arp',    color: '#f5a524', vol: 60, muted: !layers.pluckEnabled  },
  ]

  return (
    <div
      className="border-t shrink-0"
      style={{ borderColor: 'var(--line)', background: 'linear-gradient(180deg,#1d1d33 0%,#161629 100%)' }}
    >
      <div className="px-3 sm:px-5 py-2.5 flex items-center gap-3 overflow-x-auto">
        <SlidersHorizontal className="w-3.5 h-3.5 text-ink-secondary shrink-0" />
        <span className="text-[11px] font-semibold tracking-tight shrink-0">Mixer</span>
        <span className="mono text-[10px] shrink-0 hidden md:inline" style={{ color: 'var(--text-3)' }}>
          · 6 channels
        </span>
        <div className="flex items-center gap-2 ml-2 sm:ml-4 flex-1 min-w-[700px]">
          {channels.map(ch => (
            <Channel key={ch.id} ch={ch} level={levels[ch.id] || 0} />
          ))}
          <Channel
            ch={{ id: 'master', label: 'Master', color: '#ececf5', vol: 88, muted: false, master: true }}
            level={levels.master || 0}
          />
        </div>
      </div>
    </div>
  )
}

function Channel({ ch, level }) {
  const segs = 28
  const lit = Math.round(level * segs)
  return (
    <div
      className={ch.master ? 'glow-pink' : ''}
      style={{
        background: ch.master
          ? 'linear-gradient(90deg, rgba(255,107,157,.08) 0%, rgba(78,205,196,.06) 100%)'
          : '#22223a',
        border: '1px solid ' + (ch.master ? 'rgba(255,107,157,.4)' : '#2f2f48'),
        borderRadius: 8,
        flex: ch.master ? '1.4' : '1',
        minWidth: 0,
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-1.5">
        <div
          className="w-1 h-9 rounded-full shrink-0"
          style={{ background: ch.color, opacity: ch.muted ? 0.3 : 1 }}
        />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {/* Label + M / S + dB */}
          <div className="flex items-center gap-1.5">
            <span className={'text-[11px] font-semibold ' + (ch.muted ? 'text-ink-mute' : '')}>
              {ch.label}
            </span>
            <button
              className="w-4 h-4 rounded text-[8px] mono font-bold leading-none flex items-center justify-center"
              style={{
                background: ch.muted ? 'rgba(255,107,157,.25)' : '#1a1a2e',
                color: ch.muted ? '#ff6b9d' : 'var(--text-3)',
              }}
            >M</button>
            <button
              className="w-4 h-4 rounded text-[8px] mono font-bold leading-none flex items-center justify-center"
              style={{ background: '#1a1a2e', color: 'var(--text-3)' }}
            >S</button>
            <span className="mono text-[8px] ml-auto" style={{ color: 'var(--text-3)' }}>
              {ch.muted ? '-∞' : ((ch.vol - 100) / 3).toFixed(1) + 'dB'}
            </span>
          </div>

          {/* Meter */}
          <div className="flex gap-[1.5px] h-1.5 w-full">
            {Array.from({ length: segs }).map((_, i) => {
              const isLit = i < lit && !ch.muted
              const segColor = i >= segs - 3 ? '#ff6b9d' : i >= segs - 6 ? '#f5a524' : ch.color
              return (
                <div
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    background: isLit ? segColor : '#1a1a2e',
                    opacity: isLit ? 0.9 : 0.4,
                    boxShadow: isLit ? `0 0 3px ${segColor}` : 'none',
                  }}
                />
              )
            })}
          </div>

          {/* Fader */}
          <div
            className="relative h-2.5 rounded-md w-full"
            style={{ background: '#1a1a2e', border: '1px solid #2f2f48' }}
          >
            {[0, 25, 50, 75].map(t => (
              <div
                key={t}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${t}%`, background: '#2f2f48' }}
              />
            ))}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-4 rounded-sm"
              style={{
                left: `calc(${ch.vol}% - 6px)`,
                background: ch.master
                  ? 'linear-gradient(180deg,#ff6b9d,#4ecdc4)'
                  : 'linear-gradient(180deg,#ececf5,#a0a0b8)',
                border: '1px solid #1a1a2e',
                boxShadow: '0 1px 3px rgba(0,0,0,.5)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
