import { useRef, useState } from 'react'
import {
  ListMusic, Trash2, Plus, X, Square, Play, FileDown, Copy, Repeat, Shuffle, GripVertical, Sparkles, Undo2, Redo2,
} from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Progression slot grid — design's surface-soft cards with playing glow.
 * Tool buttons (Play / Stop / Loop / Randomize / Copy / Export) live in
 * the panel header right next to the title for one-thumb access.
 */
export default function ProgressionBuilder({
  progression, progressionSize, setProgressionSize, diatonicChords,
  currentlyPlayingIdx, isPlaying, bpm, barsPerChord,
  onPlayToggle, onExport, onCopy, onClear, onRemove, onSwap, onSetSlot,
  activeSectionLabel,
  onSuggest,
  onUndo, canUndo, onRedo, canRedo,
}) {
  const [pickerForSlot, setPickerForSlot] = useState(-1)
  const dragFromRef = useRef(-1)

  return (
    <div className="surface p-3 sm:p-3.5">
      {/* Header: title + slot toggle + tool buttons */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-4 rounded-full" style={{ background: '#ff6b9d' }} />
          <ListMusic className="w-3.5 h-3.5 text-accent-pink shrink-0" />
          <span className="text-[12px] font-semibold tracking-tight">Chords</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>· progression</span>
          {activeSectionLabel && (
            <span
              className="mono text-[9px] px-1.5 py-0.5 rounded ml-1"
              style={{ background: 'rgba(255,107,157,.15)', color: '#ff6b9d' }}
              title="The progression you're editing belongs to this section. Switch sections in the arrangement strip."
            >{activeSectionLabel}</span>
          )}

          <div className="flex items-center gap-0.5 ml-2 chip px-1 py-0.5">
            {[4, 8].map(n => (
              <button
                key={n}
                onClick={() => setProgressionSize(n)}
                className={classNames(
                  'seg-btn text-[10px] py-0.5 px-2',
                  progressionSize === n && 'active',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <ToolBtn
            icon={isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            label={isPlaying ? 'Stop' : 'Play'}
            active={isPlaying}
            accent="pink"
            onClick={onPlayToggle}
          />
          <ToolBtn icon={<Repeat className="w-3 h-3" />} label="Loop" active accent="teal" />
          <ToolBtn icon={<Shuffle className="w-3 h-3" />} label="Randomize" />
          {onSuggest && (
            <ToolBtn
              icon={<Sparkles className="w-3 h-3" />}
              label="Suggest"
              onClick={onSuggest}
              accent="pink"
              active
            />
          )}
          {onUndo && (
            <ToolBtn
              icon={<Undo2 className="w-3 h-3" />}
              label="Undo"
              onClick={onUndo}
              disabled={!canUndo}
            />
          )}
          {onRedo && (
            <ToolBtn
              icon={<Redo2 className="w-3 h-3" />}
              label="Redo"
              onClick={onRedo}
              disabled={!canRedo}
            />
          )}
          <Sep />
          <ToolBtn icon={<Copy className="w-3 h-3" />} label="Copy" onClick={onCopy} />
          <ToolBtn icon={<FileDown className="w-3 h-3" />} label="MIDI" onClick={onExport} />
          <ToolBtn icon={<Trash2 className="w-3 h-3" />} label="Clear" onClick={onClear} />
        </div>
      </div>

      {/* Slot grid — `progression` is already resolved to chord objects */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {progression.map((chord, idx) => {
          const isCur = idx === currentlyPlayingIdx && isPlaying
          return (
            <div
              key={idx}
              draggable={!!chord}
              onDragStart={() => { dragFromRef.current = idx }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragFromRef.current
                dragFromRef.current = -1
                if (from < 0 || from === idx) return
                onSwap(from, idx)
              }}
              onClick={() => {
                if (chord) setPickerForSlot(pickerForSlot === idx ? -1 : idx)
              }}
              className={classNames(
                'aspect-square rounded-xl p-3 flex flex-col transition cursor-pointer relative',
                isCur && 'glow-pink',
              )}
              style={{
                background: isCur
                  ? 'linear-gradient(180deg, rgba(255,107,157,.22), rgba(255,107,157,.05))'
                  : chord
                    ? 'linear-gradient(180deg, #33334d, #2a2a42)'
                    : '#1f1f35',
                border: '1px solid ' + (isCur ? '#ff6b9d' : chord ? '#3a3a55' : 'rgba(255,255,255,.08)'),
                borderStyle: chord ? 'solid' : 'dashed',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>{idx + 1}</span>
                {chord && <GripVertical className="w-2.5 h-2.5 text-ink-mute" />}
              </div>

              {chord ? (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center -mt-1 min-w-0 px-1">
                    <div
                      className="mono text-[10px]"
                      style={{ color: isCur ? '#ff6b9d' : 'var(--text-3)' }}
                    >
                      {chord.roman}
                    </div>
                    <div className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none mt-1 truncate max-w-full">
                      {chord.name}
                    </div>
                    <div className="mono text-[9px] mt-1" style={{ color: 'var(--text-3)' }}>
                      {chord.quality}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] mono" style={{ color: 'var(--text-3)' }}>
                      {chord.noteSymbols.length}-note
                    </span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 4 }).map((_, k) => (
                        <div
                          key={k}
                          className="w-1 h-1 rounded-full"
                          style={{ background: isCur && k <= currentlyPlayingIdx % 4 ? '#ff6b9d' : '#3a3a55' }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(idx) }}
                      aria-label="Remove chord"
                      style={{ color: 'var(--text-3)' }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-ink-mute" />
                </div>
              )}

              {/* Replace-with picker */}
              {pickerForSlot === idx && chord && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full mt-1 left-0 right-0 z-20 surface p-2 shadow-2xl"
                >
                  <div
                    className="text-[10px] uppercase mono mb-1.5 px-1"
                    style={{ color: 'var(--text-3)' }}
                  >Replace with</div>
                  <div className="grid grid-cols-2 gap-1">
                    {diatonicChords.map((c) => (
                      <button
                        key={c.degree}
                        onClick={() => { onSetSlot(idx, c); setPickerForSlot(-1) }}
                        className="text-[11px] py-1 px-1.5 rounded hover:bg-white/10 text-left"
                      >
                        <span className="mono text-accent-pink mr-1">{c.roman}</span>
                        <span className="text-white">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div
        className="mt-3 text-[10px] mono"
        style={{ color: 'var(--text-3)' }}
      >
        Drag · click to swap · loop @ {bpm} BPM ({barsPerChord} {barsPerChord === 1 ? 'bar' : 'bars'} each)
      </div>
    </div>
  )
}

function Sep() {
  return <div className="w-px h-5 mx-1" style={{ background: 'var(--line)' }} />
}

function ToolBtn({ icon, label, active, accent = 'default', onClick, disabled }) {
  const bg =
    active && accent === 'pink' ? 'rgba(255,107,157,.15)'
    : active && accent === 'teal' ? 'rgba(78,205,196,.15)'
    : active ? '#3a3a55'
    : '#262640'
  const fg =
    active && accent === 'pink' ? '#ff6b9d'
    : active && accent === 'teal' ? '#4ecdc4'
    : 'var(--text-2)'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: bg, color: fg, border: '1px solid #3a3a55' }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
