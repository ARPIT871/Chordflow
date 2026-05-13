import { useEffect, useRef, useState } from 'react'
import { Download, FileMusic, AudioLines, Loader2, ChevronDown, Disc3 } from 'lucide-react'

/**
 * Export button with a popover. Two formats:
 *   - MIDI: multi-track .mid (chords / pads / pluck / bass / drums on
 *     channel 10). Drop into FL Studio's piano-roll, swap plugins per
 *     channel.
 *   - Stems (WAV): renders each layer to its own .wav using Tone.Offline.
 *     Slower than MIDI export (a few seconds per layer) but lossless and
 *     usable by any DAW without needing to recreate the synth choice.
 */
export default function ExportMenu({ onExportMidi, onExportStems, onExportFullMix, isRendering }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="chip px-3 py-1.5 flex items-center gap-2 text-[12px] hover:bg-[#33334d]"
      >
        {isRendering
          ? <Loader2 className="w-3 h-3 animate-spin text-accent-teal" />
          : <Download className="w-3 h-3 text-ink-secondary" />}
        <span style={{ color: 'var(--text-2)' }} className="hidden lg:inline">
          {isRendering ? 'Rendering…' : 'Export'}
        </span>
        <ChevronDown className="w-2.5 h-2.5 text-ink-secondary" />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 surface shadow-2xl"
          style={{ width: 280 }}
        >
          <button
            onClick={() => { onExportMidi?.(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#33334d] text-left border-b"
            style={{ borderColor: 'var(--line-soft)' }}
          >
            <FileMusic className="w-4 h-4 text-accent-pink shrink-0" />
            <span className="flex-1 min-w-0">
              <div className="text-[12px] font-medium">MIDI (multi-track .mid)</div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                Chords / Pads / Pluck / Bass / Drums as separate tracks
              </div>
            </span>
          </button>
          <button
            onClick={() => { onExportStems?.(); setOpen(false) }}
            disabled={isRendering}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#33334d] text-left border-b disabled:opacity-50"
            style={{ borderColor: 'var(--line-soft)' }}
          >
            <AudioLines className="w-4 h-4 text-accent-teal shrink-0" />
            <span className="flex-1 min-w-0">
              <div className="text-[12px] font-medium">Stems (WAV per layer)</div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                One WAV per enabled layer — drop into your DAW's channel rack
              </div>
            </span>
          </button>
          <button
            onClick={() => { onExportFullMix?.(); setOpen(false) }}
            disabled={isRendering}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#33334d] text-left disabled:opacity-50"
          >
            <Disc3 className="w-4 h-4" style={{ color: '#7be0d8' }} />
            <span className="flex-1 min-w-0">
              <div className="text-[12px] font-medium">Full mix (one WAV)</div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                Every layer summed with your current mixer levels — shareable demo
              </div>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
