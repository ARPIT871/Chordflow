import { useMemo } from 'react'
import { classNames } from '../lib/utils'

const ACCENT_PINK = '#ff6b9d'
const ACCENT_TEAL = '#4ecdc4'

const START_MIDI = 36 // C2
const END_MIDI   = 84 // C6

export default function PianoKeyboard({ activeMidiNotes }) {
  const activeSet = useMemo(() => new Set(activeMidiNotes), [activeMidiNotes])

  const { whiteKeys, blackKeys, totalWhites } = useMemo(() => {
    const whites = []
    const blacks = []
    let whiteIdx = 0
    for (let m = START_MIDI; m <= END_MIDI; m++) {
      const noteClass = m % 12
      const isBlack = [1, 3, 6, 8, 10].includes(noteClass)
      if (isBlack) {
        blacks.push({ midi: m, prevWhiteIndex: whiteIdx - 1 })
      } else {
        whites.push({ midi: m, whiteIndex: whiteIdx })
        whiteIdx++
      }
    }
    return { whiteKeys: whites, blackKeys: blacks, totalWhites: whites.length }
  }, [])

  return (
    <div className="relative w-full select-none" style={{ height: '120px' }}>
      <div className="relative flex h-full w-full rounded-lg overflow-hidden border border-white/10 bg-[#0f0f1c]">
        {whiteKeys.map(({ midi }) => {
          const active = activeSet.has(midi)
          const isC = midi % 12 === 0
          const octave = Math.floor(midi / 12) - 1
          return (
            <div
              key={midi}
              className={classNames(
                'flex-1 border-r border-black/40 transition-colors duration-150 relative flex items-end justify-center pb-1',
                active && 'shadow-inner'
              )}
              style={{
                background: active
                  ? `linear-gradient(to bottom, ${ACCENT_PINK}, #c14778)`
                  : 'linear-gradient(to bottom, #f5f5fa, #d8d8e4)',
              }}
            >
              {isC && (
                <span className={classNames(
                  'text-[9px] font-mono',
                  active ? 'text-white/90' : 'text-gray-500'
                )}>
                  C{octave}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {blackKeys.map(({ midi, prevWhiteIndex }) => {
          const active = activeSet.has(midi)
          const leftPct = ((prevWhiteIndex + 1) / totalWhites) * 100
          return (
            <div
              key={midi}
              className="absolute top-0 rounded-b-md transition-colors duration-150"
              style={{
                left:   `calc(${leftPct}% - ${100 / totalWhites / 2.6}%)`,
                width:  `calc(${100 / totalWhites}% / 1.6)`,
                height: '62%',
                background: active
                  ? `linear-gradient(to bottom, ${ACCENT_TEAL}, #2e8a85)`
                  : 'linear-gradient(to bottom, #1a1a2e, #0a0a18)',
                boxShadow: active
                  ? `0 0 12px ${ACCENT_TEAL}80`
                  : '0 2px 4px rgba(0,0,0,0.6)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
