import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, ChevronRight, Volume2, VolumeX, Mic, MicOff,
  Upload, X, Repeat, FileAudio2, Square, Disc3,
} from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Audio layer — load an audio file or record from the mic, play it back
 * in sync with the chord loop. The loaded clip routes through the audio
 * mixer channel (no synth reverb) and starts at Transport time 0 when
 * Play is pressed.
 *
 * Storage is in-memory only — refreshing the page clears the audio.
 * Persistence via IndexedDB is deferred.
 *
 * Props expect an `audio` object from useAudioEngine with:
 *   loadAudioFromUrl(url) → Player
 *   clearAudio()
 *   setAudioLoop(bool)
 *   audioBufferDuration() → seconds
 */
export default function AudioLayer({
  audio,
  enabled, setEnabled,
  loop, setLoop,
  muted, onToggleMute,
}) {
  const [expanded, setExpanded] = useState(true)
  const [clipName, setClipName] = useState(null)
  const [clipUrl, setClipUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef(null)
  const recordStreamRef = useRef(null)
  const recordTimerRef = useRef(null)
  const recordChunksRef = useRef([])
  const fileInputRef = useRef(null)

  // ─── Cleanup on unmount: stop mic stream + revoke any object URL ───
  useEffect(() => () => {
    try { recorderRef.current?.stop() } catch {}
    recordStreamRef.current?.getTracks?.().forEach(t => { try { t.stop() } catch {} })
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    if (clipUrl) { try { URL.revokeObjectURL(clipUrl) } catch {} }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push loop toggle changes through to the engine in real time.
  useEffect(() => {
    audio?.setAudioLoop?.(loop)
  }, [loop, audio])

  // ─── Loading from a File / Blob ────────────────────────────────────
  const loadFromBlob = async (blob, name) => {
    if (clipUrl) { try { URL.revokeObjectURL(clipUrl) } catch {} }
    const url = URL.createObjectURL(blob)
    setClipUrl(url)
    setClipName(name)
    setLoading(true)
    setError(null)
    try {
      await audio.loadAudioFromUrl(url, { loop })
      setDuration(audio.audioBufferDuration?.() ?? 0)
    } catch (e) {
      setError(e?.message || 'Could not decode audio')
      setClipUrl(null); setClipName(null)
      try { URL.revokeObjectURL(url) } catch {}
    } finally {
      setLoading(false)
    }
  }

  const handleFile = (file) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setError('File is larger than 50 MB. Trim it first.')
      return
    }
    loadFromBlob(file, file.name)
  }

  const clearClip = () => {
    setClipName(null); setDuration(0); setError(null)
    if (clipUrl) { try { URL.revokeObjectURL(clipUrl) } catch {} }
    setClipUrl(null)
    audio?.clearAudio?.()
  }

  // ─── Recording from the mic ────────────────────────────────────────
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

    // Pick a mime the browser will encode. Most evergreen browsers do
    // webm/opus; Safari may need mp4. We let MediaRecorder default if
    // neither works.
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
      await loadFromBlob(blob, `recording-${stamp}.webm`)
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

  const hasClip = !!clipUrl && !loading

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
          {!hasClip && !isRecording && (
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
            <div
              className="surface-soft p-3 flex items-center gap-3"
              style={{ background: 'rgba(78,205,196,.04)' }}
            >
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{ background: '#1a1a2e' }}
              >
                <FileAudio2 className="w-4 h-4 text-accent-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate">{clipName}</div>
                <div className="text-[10px] mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {duration.toFixed(2)}s · routes through Audio mixer channel · plays on Transport start
                </div>
              </div>
              <button
                onClick={clearClip}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#33334d]"
                aria-label="Clear audio"
                title="Clear audio"
              >
                <X className="w-3.5 h-3.5 text-ink-secondary" />
              </button>
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
