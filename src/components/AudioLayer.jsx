import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, ChevronRight, Volume2, VolumeX, Mic, MicOff,
  Upload, X, Repeat, FileAudio2, Square, Disc3,
} from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Audio layer — controlled. The Blob lives in App.jsx so it can be
 * persisted to IndexedDB; this component just emits new Blobs via
 * `onBlobChange` and reacts to `clipBlob` prop changes by loading the
 * audio into Tone.Player.
 *
 * Renders a small canvas waveform of the loaded clip plus a teal
 * playhead while the transport is running. Playhead position is polled
 * via RAF from `audio.getAudioPlaybackPosition()`.
 */
export default function AudioLayer({
  audio,
  enabled, setEnabled,
  loop, setLoop,
  muted, onToggleMute,
  clipBlob, clipName,
  onBlobChange,   // (blob, name) — called when user uploads / records
  onClear,        // called when user clicks the X to clear
}) {
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const [peaks, setPeaks] = useState(null)
  const blobUrlRef = useRef(null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef(null)
  const recordStreamRef = useRef(null)
  const recordTimerRef = useRef(null)
  const recordChunksRef = useRef([])
  const fileInputRef = useRef(null)

  // Push loop toggle changes through to the engine in real time.
  useEffect(() => {
    audio?.setAudioLoop?.(loop)
  }, [loop, audio])

  // ─── Load clipBlob into the player when it (or audio.audioStarted) changes ──
  // Audio context only starts after a user gesture, so on first paint
  // post-restore we may have a blob but no context. We retry once
  // audio.audioStarted flips true.
  useEffect(() => {
    if (!clipBlob) {
      // Cleared: tear down the URL + clear the player.
      if (blobUrlRef.current) { try { URL.revokeObjectURL(blobUrlRef.current) } catch {} ; blobUrlRef.current = null }
      audio?.clearAudio?.()
      setDuration(0)
      setPeaks(null)
      return
    }
    // Skip until the audio context is up.
    if (!audio?.audioStarted) return

    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        if (blobUrlRef.current) { try { URL.revokeObjectURL(blobUrlRef.current) } catch {} }
        const url = URL.createObjectURL(clipBlob)
        blobUrlRef.current = url
        await audio.loadAudioFromUrl(url, { loop })
        if (cancelled) return
        const dur = audio.audioBufferDuration?.() ?? 0
        setDuration(dur)
        const buf = audio.getAudioBuffer?.()
        if (buf) setPeaks(computePeaks(buf, 220))
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not decode audio')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clipBlob, audio?.audioStarted])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => {
    try { recorderRef.current?.stop() } catch {}
    recordStreamRef.current?.getTracks?.().forEach(t => { try { t.stop() } catch {} })
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    if (blobUrlRef.current) { try { URL.revokeObjectURL(blobUrlRef.current) } catch {} }
  }, [])

  // ─── File / record handlers ────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setError('File is larger than 50 MB. Trim it first.')
      return
    }
    setError(null)
    onBlobChange?.(file, file.name)
  }

  const startRecording = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mic recording is not supported in this browser')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setError(e?.message || 'Mic permission denied')
      return
    }
    recordStreamRef.current = stream

    let mimeType
    if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus'
    else if (MediaRecorder.isTypeSupported?.('audio/webm'))         mimeType = 'audio/webm'
    else if (MediaRecorder.isTypeSupported?.('audio/mp4'))          mimeType = 'audio/mp4'

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recordChunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data)
    }
    recorder.onstop = async () => {
      const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      recordChunksRef.current = []
      stream.getTracks().forEach(t => { try { t.stop() } catch {} })
      recordStreamRef.current = null
      const stamp = new Date().toLocaleTimeString().replace(/[: ]/g, '-')
      onBlobChange?.(blob, `recording-${stamp}.webm`)
    }

    recorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
    setRecordSeconds(0)
    recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
  }

  const stopRecording = () => {
    if (!recorderRef.current) return
    try { recorderRef.current.stop() } catch {}
    recorderRef.current = null
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
    setIsRecording(false)
  }

  const hasClip = !!clipBlob && !loading

  return (
    <div className="surface p-3" style={{ opacity: enabled ? 1 : 0.62 }}>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <ToggleSwitch enabled={enabled} onToggle={() => setEnabled(!enabled)} />

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 hover:opacity-90"
        >
          {expanded
            ? <ChevronDown  className="w-3.5 h-3.5 text-ink-secondary" />
            : <ChevronRight className="w-3.5 h-3.5 text-ink-secondary" />}
          <div className="w-1 h-4 rounded-full" style={{ background: '#7be0d8' }} />
          <Disc3 className="w-3.5 h-3.5" style={{ color: '#7be0d8' }} />
          <span className="text-[12px] font-semibold tracking-tight">Audio</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-3)' }}>
            · {hasClip ? `${duration.toFixed(1)}s clip` : isRecording ? 'recording…' : 'empty'}
          </span>
          {muted && (
            <span
              className="mono text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,107,157,.18)', color: '#ff6b9d' }}
            >MUTED</span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setLoop(!loop)}
            className={classNames(
              'h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] hover:brightness-110 transition'
            )}
            style={{
              background: loop ? 'rgba(78,205,196,.15)' : '#262640',
              color: loop ? '#4ecdc4' : 'var(--text-2)',
              border: '1px solid #3a3a55',
            }}
            title="Loop the clip while playing"
          >
            <Repeat className="w-3 h-3" />
            <span className="hidden sm:inline">Loop</span>
          </button>
          <button
            onClick={onToggleMute}
            className="w-7 h-7 rounded-md flex items-center justify-center transition"
            style={{
              background: muted ? 'rgba(255,107,157,.2)' : '#262640',
              border: '1px solid #3a3a55',
            }}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute' : 'Mute (silence in real-time)'}
          >
            {muted
              ? <VolumeX className="w-3 h-3 text-accent-pink" />
              : <Volume2 className="w-3 h-3 text-ink-secondary" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3">
          {!hasClip && !isRecording && !loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DropZone
                onPick={() => fileInputRef.current?.click()}
                onFile={handleFile}
                loading={loading}
              />
              <button
                onClick={startRecording}
                className="surface-soft flex flex-col items-center justify-center p-4 hover:bg-[#33334d] transition rounded-xl"
                style={{ borderColor: 'rgba(255,107,157,.25)' }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5"
                  style={{ background: 'rgba(255,107,157,.15)' }}
                >
                  <Mic className="w-4 h-4 text-accent-pink" />
                </div>
                <div className="text-[12px] font-medium">Record from mic</div>
                <div className="text-[10px] mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Sing, hum, or play along with the loop
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {isRecording && (
            <div
              className="surface-soft p-4 flex items-center gap-4"
              style={{ borderColor: 'rgba(255,107,157,.4)', background: 'rgba(255,107,157,.06)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center pulse-dot"
                style={{ background: '#ff6b9d' }}
              >
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-accent-pink">Recording…</div>
                <div className="text-[10px] mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {formatTime(recordSeconds)} elapsed
                </div>
              </div>
              <button
                onClick={stopRecording}
                className="px-3 py-2 rounded-md text-[11px] font-medium flex items-center gap-1.5"
                style={{ background: '#262640', border: '1px solid #3a3a55', color: 'var(--text)' }}
              >
                <Square className="w-3 h-3 fill-current" />
                Stop
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
              Decoding audio…
            </div>
          )}

          {hasClip && !isRecording && (
            <div className="space-y-2">
              <div
                className="surface-soft p-2.5 flex items-center gap-3"
                style={{ background: 'rgba(78,205,196,.04)' }}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: '#1a1a2e' }}
                >
                  <FileAudio2 className="w-4 h-4 text-accent-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{clipName || 'clip'}</div>
                  <div className="text-[10px] mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {duration.toFixed(2)}s · routes through Audio mixer channel
                  </div>
                </div>
                <button
                  onClick={() => onClear?.()}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#33334d]"
                  aria-label="Clear audio"
                  title="Clear audio"
                >
                  <X className="w-3.5 h-3.5 text-ink-secondary" />
                </button>
              </div>

              <Waveform
                peaks={peaks}
                duration={duration}
                getPosition={audio?.getAudioPlaybackPosition}
                loopOn={loop}
              />
            </div>
          )}

          {error && (
            <div className="mt-2 text-[11px] text-amber-400 flex items-center gap-1.5">
              <MicOff className="w-3 h-3" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Waveform with playhead ────────────────────────────────────────── */

function Waveform({ peaks, duration, getPosition, loopOn }) {
  const canvasRef = useRef(null)
  const [position, setPosition] = useState(null)

  // Draw the static waveform whenever peaks change.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks || peaks.length === 0) return
    const dpr = window.devicePixelRatio || 1
    const cssWidth  = canvas.clientWidth
    const cssHeight = canvas.clientHeight
    canvas.width  = Math.max(1, Math.round(cssWidth  * dpr))
    canvas.height = Math.max(1, Math.round(cssHeight * dpr))
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const barCount = peaks.length
    const barW = cssWidth / barCount
    const mid = cssHeight / 2
    const grad = ctx.createLinearGradient(0, 0, 0, cssHeight)
    grad.addColorStop(0, 'rgba(123,224,216,0.95)')
    grad.addColorStop(1, 'rgba(78,205,196,0.55)')
    ctx.fillStyle = grad

    for (let i = 0; i < barCount; i++) {
      const h = Math.max(1, peaks[i] * (cssHeight - 6))
      ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 0.5), h)
    }
  }, [peaks])

  // Poll the playhead with RAF while the transport is running.
  useEffect(() => {
    if (!getPosition) return
    let raf
    let last = -1
    const tick = () => {
      const p = getPosition()
      if (p == null) {
        if (last !== -1) { setPosition(null); last = -1 }
      } else if (Math.abs(p - last) > 0.01) {
        setPosition(p)
        last = p
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getPosition])

  const playheadPct = useMemo(() => {
    if (position == null || !duration) return null
    return Math.max(0, Math.min(1, position / duration)) * 100
  }, [position, duration])

  return (
    <div
      className="relative rounded-md overflow-hidden"
      style={{ background: '#1a1a2e', border: '1px solid #2f2f48', height: 56 }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ display: 'block' }}
      />
      {playheadPct != null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `${playheadPct}%`,
            width: 2,
            background: '#ff6b9d',
            boxShadow: '0 0 6px rgba(255,107,157,.8)',
          }}
        />
      )}
      <div
        className="absolute bottom-0.5 right-1 mono text-[8px] pointer-events-none"
        style={{ color: 'var(--text-3)' }}
      >
        {loopOn ? '↻ loops with song' : '▸ plays once'}
      </div>
    </div>
  )
}

/**
 * Reduce an AudioBuffer's left channel to N peak values (one per bar).
 * Each peak = max absolute sample within its window. Fast enough to run
 * on the main thread for a few-minute clip.
 */
function computePeaks(audioBuffer, numPeaks) {
  const ch = audioBuffer.getChannelData(0)
  const samplesPerPeak = Math.max(1, Math.floor(ch.length / numPeaks))
  const peaks = new Float32Array(numPeaks)
  for (let p = 0; p < numPeaks; p++) {
    let max = 0
    const start = p * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, ch.length)
    for (let i = start; i < end; i++) {
      const v = ch[i] < 0 ? -ch[i] : ch[i]
      if (v > max) max = v
    }
    peaks[p] = max
  }
  return peaks
}

function DropZone({ onPick, onFile, loading }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <button
      onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onFile?.(e.dataTransfer.files?.[0])
      }}
      disabled={loading}
      className={classNames(
        'surface-soft flex flex-col items-center justify-center p-4 hover:bg-[#33334d] transition rounded-xl',
        dragOver && 'glow-teal'
      )}
      style={{ borderColor: dragOver ? '#4ecdc4' : 'rgba(78,205,196,.25)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5"
        style={{ background: 'rgba(78,205,196,.15)' }}
      >
        <Upload className="w-4 h-4 text-accent-teal" />
      </div>
      <div className="text-[12px] font-medium">Drop or click to upload</div>
      <div className="text-[10px] mono mt-0.5" style={{ color: 'var(--text-3)' }}>
        MP3 · WAV · OGG · M4A
      </div>
    </button>
  )
}

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      className="relative shrink-0 w-10 h-[22px] rounded-full transition-colors"
      style={{ background: enabled ? '#7be0d8' : '#3a3a55' }}
    >
      <span
        className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
        style={{ left: enabled ? 20 : 2 }}
      />
    </button>
  )
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
