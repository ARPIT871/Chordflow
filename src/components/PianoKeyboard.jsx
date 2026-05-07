import { useMemo } from 'react'
import { Piano, ZoomIn, ZoomOut } from 'lucide-react'
import { classNames } from '../lib/utils'
import { midiToToneName } from '../lib/theory'

/**
 * Bottom keyboard strip — design has 3 visible octaves (C3 to B5) with
 * fixed-width 32px white / 22px black keys and pink-lit active keys.
 *
 * Active keys are matched by *note name* (e.g. "C4", "F#5") so the
 * keyboard works whether the active notes come from the chord layer,
 * pluck, or pads. Out-of-range active notes are displayed as chips above.
 */
const OCTAVES = [3, 4, 5]
const WHITES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACK_AFTER = { C: true, D: true, E: false, F: true, G: true, A: true, B: false }

export default function PianoKeyboard({ activeMidiNotes = [], currentChordName }) {
  const activeNoteSet = useMemo(() => {
    const s = new Set()
    for (const m of activeMidiNotes) s.add(midiToToneName(m))
    return s
  }, [activeMidiNotes])

  const activeNoteList = useMemo(
    () => activeMidiNotes.map(midiToToneName),
    [activeMidiNotes]
  )

  return (
    <div className="border-t shrink-0" style={{
      borderColor: 'var(--line)',
      background: 'linear-gradient(180deg,#15152a 0%,#0f0f20 100%)',
    }}>
      <div className="px-3 sm:px-5 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Piano className="w-3.5 h-3.5 text-ink-secondary shrink-0" />
          <span className="text-[11px] font-semibold tracking-tight">Live keyboard</span>
          <span className="mono text-[10px] hidden sm:inline" style={{ color: 'var(--text-3)' }}>
            · now sounding
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {activeNoteList.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="mono text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,107,157,.15)', color: '#ff6b9d' }}
              >
                {n}
              </span>
            ))}
          </div>
          {currentChordName && (
            <span className="text-[11px] ml-1 hidden md:inline" style={{ color: 'var(--text-2)' }}>
              — {currentChordName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] mono" style={{ color: 'var(--text-3)' }}>C3 — B5</span>
          <button className="w-6 h-6 rounded hover:bg-[#33334d] flex items-center justify-center" aria-label="Zoom out">
            <ZoomOut className="w-2.5 h-2.5 text-ink-secondary" />
          </button>
          <button className="w-6 h-6 rounded hover:bg-[#33334d] flex items-center justify-center" aria-label="Zoom in">
            <ZoomIn className="w-2.5 h-2.5 text-ink-secondary" />
          </button>
        </div>
      </div>

      <div className="relative px-3 sm:px-5 pb-3 overflow-x-auto">
        <div className="relative h-[110px] flex justify-center min-w-[672px]">
          {OCTAVES.map(o => (
            <div key={o} className="relative flex">
              {WHITES.map(w => {
                const note = `${w}${o}`
                const lit = activeNoteSet.has(note)
                return <div key={note} className={classNames('key-w', lit && 'lit')} title={note} />
              })}
              {WHITES.map((w, wi) => {
                if (!BLACK_AFTER[w]) return null
                const blackNote = `${w}#${o}`
                const left = (wi + 1) * 32 - 11
                const lit = activeNoteSet.has(blackNote)
                return (
                  <div
                    key={blackNote}
                    className={classNames('key-b absolute top-0', lit && 'lit')}
                    style={{ left: `${left}px` }}
                    title={blackNote}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
