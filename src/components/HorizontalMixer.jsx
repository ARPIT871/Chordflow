import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Horizontal mixer strip docked above the keyboard. Drives the audio
 * engine through `audio.setChannelVolume / setChannelMuted /
 * setChannelSoloed` and reads peak levels via `audio.getChannelLevel`
 * each animation frame.
 *
 * Channel ids: chords / drums / bass / pad / arp + master.
 */
const CHANNELS = [
  { id: 'chords', label: 'Chords', color: '#ff6b9d' },
  { id: 'drums',  label: 'Drums',  color: '#ff6b9d' },
  { id: 'bass',   label: 'Bass',   color: '#a78bfa' },
  { id: 'pads',   label: 'Pad',    color: '#4ecdc4' },
  { id: 'pluck',  label: 'Arp',    color: '#f5a524' },
]

export default function HorizontalMixer({ audio, isPlaying, layers = {} }) {
  // We hold volumes / mutes / solos in local state mirrored from the audio
  // engine — the engine is the source of truth, this is a UI cache.
  const [volumes, setVolumes] = useState({
    chords: 78, drums: 84, bass: 72, pads: 46, pluck: 60, master: 88,
  })
  const [mutes, setMutes] = useState({})
  const [solos, setSolos] = useState({})

  // Push initial volumes to the engine once it's ready.
  useEffect(() => {
    if (!audio?.setChannelVolume) return
    for (const id of Object.keys(volumes)) audio.setChannelVolume(id, volumes[id])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio?.audioStarted])

  // Real-time meter polling — RAF driven so it stays smooth without flooding
  // React with state updates we don't need.
  const [levels, setLevels] = useState({})
  const rafRef = useRef(null)
  useEffect(() => {
    if (!audio?.getChannelLevel) return
    if (!isPlaying) {
      setLevels({})
      return
    }
    let prev = {}
    const tick = () => {
      const next = {}
      for (const c of CHANNELS) next[c.id] = audio.getChannelLevel(c.id)
      next.master = audio.getChannelLevel('master')
      // Only commit when something actually moved by >1% to avoid extra renders.
      let changed = false
      for (const k of Object.keys(next)) {
        if (Math.abs((prev[k] || 0) - (next[k] || 0)) > 0.01) { changed = true; break }
      }
      if (changed) { setLevels(next); prev = next }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [audio, isPlaying])

  // Layer-level enable status from props (e.g. user toggled Pad off in the
  // panel) — propagate as a "soft mute" override on the channel so the
  // mixer reflects the toggle even if the user hasn't pressed M here.
  const layerEnabled = {
    chords: layers.chordsEnabled !== false,
    drums:  !!layers.drumsEnabled,
    bass:   !!layers.bassEnabled,
    pads:   !!layers.padsEnabled,
    pluck:  !!layers.pluckEnabled,
  }

  const setVolume = (id, v) => {
    setVolumes(p => ({ ...p, [id]: v }))
    audio?.setChannelVolume?.(id, v)
  }

  const toggleMute = (id) => {
    const next = !mutes[id]
    setMutes(p => ({ ...p, [id]: next }))
    audio?.setChannelMuted?.(id, next)
  }

  const toggleSolo = (id) => {
    const next = !solos[id]
    setSolos(p => ({ ...p, [id]: next }))
    audio?.setChannelSoloed?.(id, next)
  }

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
          {CHANNELS.map(c => (
            <Channel
              key={c.id}
              ch={c}
              vol={volumes[c.id] ?? 80}
              level={levels[c.id] || 0}
              muted={mutes[c.id] || !layerEnabled[c.id]}
              soloed={!!solos[c.id]}
              onVolume={(v) => setVolume(c.id, v)}
              onMute={() => toggleMute(c.id)}
              onSolo={() => toggleSolo(c.id)}
            />
          ))}
          <Channel
            ch={{ id: 'master', label: 'Master', color: '#ececf5', master: true }}
            vol={volumes.master ?? 88}
            level={levels.master || 0}
            muted={false}
            soloed={false}
            onVolume={(v) => setVolume('master', v)}
            onMute={() => {}}
            onSolo={() => {}}
          />
        </div>
      </div>
    </div>
  )
}

function Channel({ ch, vol, level, muted, soloed, onVolume, onMute, onSolo }) {
  const segs = 28
  const lit = Math.round(level * segs)
  const dragRef = useRef(null)

  // Click-to-position on the fader track.
  const onFaderClick = (e) => {
    const rect = dragRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width
    onVolume(Math.max(0, Math.min(100, Math.round(x * 100))))
  }

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
          style={{ background: ch.color, opacity: muted ? 0.3 : 1 }}
        />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {/* Label + M / S + dB */}
          <div className="flex items-center gap-1.5">
            <span className={classNames('text-[11px] font-semibold', muted && 'text-ink-mute')}>
              {ch.label}
            </span>
            {!ch.master && (
              <>
                <button
                  onClick={onMute}
                  className="w-4 h-4 rounded text-[8px] mono font-bold leading-none flex items-center justify-center"
                  style={{
                    background: muted ? 'rgba(255,107,157,.25)' : '#1a1a2e',
                    color: muted ? '#ff6b9d' : 'var(--text-3)',
                  }}
                  aria-label="Mute"
                >M</button>
                <button
                  onClick={onSolo}
                  className="w-4 h-4 rounded text-[8px] mono font-bold leading-none flex items-center justify-center"
                  style={{
                    background: soloed ? 'rgba(245,165,36,.25)' : '#1a1a2e',
                    color: soloed ? '#f5a524' : 'var(--text-3)',
                  }}
                  aria-label="Solo"
                >S</button>
              </>
            )}
            <span className="mono text-[8px] ml-auto" style={{ color: 'var(--text-3)' }}>
              {muted ? '-∞' : (vol === 0 ? '-∞' : ((vol - 100) / 3).toFixed(1) + 'dB')}
            </span>
          </div>

          {/* Meter */}
          <div className="flex gap-[1.5px] h-1.5 w-full">
            {Array.from({ length: segs }).map((_, i) => {
              const isLit = i < lit && !muted
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

          {/* Fader (click-to-position) */}
          <div
            ref={dragRef}
            onClick={onFaderClick}
            className="relative h-2.5 rounded-md w-full cursor-pointer"
            style={{ background: '#1a1a2e', border: '1px solid #2f2f48' }}
          >
            {[0, 25, 50, 75].map(t => (
              <div
                key={t}
                className="absolute top-0 bottom-0 w-px pointer-events-none"
                style={{ left: `${t}%`, background: '#2f2f48' }}
              />
            ))}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-4 rounded-sm pointer-events-none"
              style={{
                left: `calc(${vol}% - 6px)`,
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
