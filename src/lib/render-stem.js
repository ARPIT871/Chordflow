import * as Tone from 'tone'
import { midiToToneName } from './theory'
import { INSTRUMENTS, DEFAULT_INSTRUMENT, createDrumKit } from './instruments'
import { buildArpSequence, arpStepDurationSec } from './arp-patterns'
import { buildBassSequence, bassStepDurationSec } from './bass-patterns'
import { DRUM_VOICES, isVoiceAudible } from './drum-patterns'
import { audioBufferToWavBlob } from './wav-encoder'

/**
 * Offline render of a single layer to a WAV. Each layer rebuilds its
 * own audio graph inside Tone.Offline (which produces an AudioBuffer
 * faster than realtime) and returns a downloadable Blob.
 *
 * We deliberately re-create the scheduling logic here rather than
 * sharing it with useAudioEngine — the live engine wires through React
 * refs, while this needs everything to live inside the Tone.Offline
 * callback. Keeping them separate is simpler than threading both
 * shapes through one API.
 *
 * `chords` = resolved progression (chord objects, octave-shifted notes).
 * `bpm`, `barsPerChord` = tempo + slot length.
 */
const SAMPLE_RATE = 44100

function loopSeconds({ chords, bpm, barsPerChord }) {
  const beatSec = 60 / bpm
  const barSec = beatSec * 4
  const slotSec = barsPerChord * barSec
  return chords.length * slotSec
}

async function buildSynth(name) {
  const def = INSTRUMENTS[name] || INSTRUMENTS[DEFAULT_INSTRUMENT]
  if (def.kind === 'synth') return def.create()
  return await new Promise((resolve, reject) => {
    const s = new Tone.Sampler({
      ...def.options,
      onload:  () => resolve(s),
      onerror: (e) => reject(e),
    })
  })
}

/* ─── Per-layer offline scheduling ─────────────────────────────────── */

async function renderChords({ chords, bpm, barsPerChord, instrument }) {
  const dur = loopSeconds({ chords, bpm, barsPerChord }) + 1.5 // tail
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm
    const synth = await buildSynth(instrument)
    synth.toDestination()
    const beatSec = 60 / bpm
    const slotSec = barsPerChord * beatSec * 4
    chords.forEach((c, i) => {
      transport.schedule((time) => {
        if (!c) return
        synth.triggerAttackRelease(c.midiNotes.map(midiToToneName), slotSec * 0.92, time)
      }, i * slotSec)
    })
    transport.start()
  }, dur, 2, SAMPLE_RATE)
}

async function renderPads({ chords, bpm, barsPerChord, instrument }) {
  const dur = loopSeconds({ chords, bpm, barsPerChord }) + 2
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm
    const synth = await buildSynth(instrument)
    synth.toDestination()
    const beatSec = 60 / bpm
    const slotSec = barsPerChord * beatSec * 4
    chords.forEach((c, i) => {
      transport.schedule((time) => {
        if (!c) return
        synth.triggerAttackRelease(c.midiNotes.map(midiToToneName), slotSec * 0.98, time, 0.7)
      }, i * slotSec)
    })
    transport.start()
  }, dur, 2, SAMPLE_RATE)
}

async function renderPluck({ chords, bpm, barsPerChord, instrument, pattern, rate }) {
  const dur = loopSeconds({ chords, bpm, barsPerChord }) + 1
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm
    const synth = await buildSynth(instrument)
    synth.toDestination()
    const beatSec = 60 / bpm
    const slotSec = barsPerChord * beatSec * 4
    const stepSec = arpStepDurationSec(rate, bpm)
    chords.forEach((c, i) => {
      transport.schedule((time) => {
        if (!c) return
        const seq = buildArpSequence(c.midiNotes, pattern, rate, barsPerChord)
        for (const ev of seq) {
          const t = time + ev.stepIdx * stepSec
          if (ev.chord) {
            synth.triggerAttackRelease(ev.chord.map(midiToToneName), stepSec * 0.85, t, 0.6)
          } else {
            synth.triggerAttackRelease(midiToToneName(ev.midi), stepSec * 0.85, t, 0.7)
          }
        }
      }, i * slotSec)
    })
    transport.start()
  }, dur, 2, SAMPLE_RATE)
}

async function renderBass({ chords, bpm, barsPerChord, instrument, mode }) {
  const dur = loopSeconds({ chords, bpm, barsPerChord }) + 1
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm
    const synth = await buildSynth(instrument)
    synth.toDestination()
    const beatSec = 60 / bpm
    const slotSec = barsPerChord * beatSec * 4
    const stepSec = bassStepDurationSec(bpm)
    chords.forEach((c, i) => {
      transport.schedule((time) => {
        if (!c) return
        const seq = buildBassSequence(c.midiNotes, mode, barsPerChord)
        for (const ev of seq) {
          synth.triggerAttackRelease(midiToToneName(ev.midi), stepSec * 0.92, time + ev.stepIdx * stepSec, 0.85)
        }
      }, i * slotSec)
    })
    transport.start()
  }, dur, 2, SAMPLE_RATE)
}

async function renderDrums({ chords, bpm, barsPerChord, pattern, mutes, solos, volumes, swing = 0, sectionPlan }) {
  const dur = loopSeconds({ chords, bpm, barsPerChord }) + 1
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm
    const kit = createDrumKit()
    kit.connect(Tone.getDestination())
    const beatSec = 60 / bpm
    const barSec = beatSec * 4
    const sixteenthSec = beatSec / 4
    const totalLoopSec = chords.length * barsPerChord * barSec
    const totalBars = Math.round(totalLoopSec / barSec)
    const swingDelay = (sixteenthSec / 2) * (Math.max(0, Math.min(100, swing)) / 100)

    const scheduleBars = (pat, startBar, endBar) => {
      if (!pat) return
      for (let bar = startBar; bar < endBar; bar++) {
        for (let step = 0; step < 16; step++) {
          for (const voice of DRUM_VOICES) {
            const row = pat[voice]
            if (!row || !row[step]) continue
            if (!isVoiceAudible(voice, mutes, solos)) continue
            const offset = bar * barSec + step * sixteenthSec + (step % 2 === 1 ? swingDelay : 0)
            const vol = volumes?.[voice] ?? 70
            const velocity = Math.max(0.05, Math.min(1, vol / 99))
            transport.schedule((time) => kit.trigger(voice, time, velocity), offset)
          }
        }
      }
    }

    if (sectionPlan && sectionPlan.length > 0) {
      for (const plan of sectionPlan) scheduleBars(plan.drumPattern, plan.startBar, plan.endBar)
    } else if (pattern) {
      scheduleBars(pattern, 0, totalBars)
    }

    transport.start()
  }, dur, 2, SAMPLE_RATE)
}

/* ─── Public API ───────────────────────────────────────────────────── */

/**
 * Render every enabled non-empty layer to a WAV. Returns a list of
 * `{ name, blob }` pairs ready to download. The audio CLIP layer is
 * rendered as a one-shot copy of the loaded buffer (looped if `audioLoop`
 * is on) so it lines up with the synth stems.
 */
export async function renderAllStems({
  chords, bpm, barsPerChord,
  layers,                 // { chords, pads, pluck, bass, drums, audio }
  audioBuffer,            // Tone.Player buffer for the loaded clip, if any
  sectionPlan,            // optional — per-section drum patterns (song mode)
}) {
  const stems = []
  const filledChords = chords.filter(Boolean)
  if (filledChords.length === 0) return stems

  if (layers.chords?.enabled !== false) {
    const buf = await renderChords({
      chords, bpm, barsPerChord,
      instrument: layers.chords.instrument,
    })
    stems.push({ name: 'chords', blob: audioBufferToWavBlob(buf) })
  }

  if (layers.pads?.enabled) {
    const buf = await renderPads({
      chords, bpm, barsPerChord,
      instrument: layers.pads.instrument,
    })
    stems.push({ name: 'pads', blob: audioBufferToWavBlob(buf) })
  }

  if (layers.bass?.enabled) {
    const buf = await renderBass({
      chords, bpm, barsPerChord,
      instrument: layers.bass.instrument,
      mode:       layers.bass.mode,
    })
    stems.push({ name: 'bass', blob: audioBufferToWavBlob(buf) })
  }

  if (layers.pluck?.enabled) {
    const buf = await renderPluck({
      chords, bpm, barsPerChord,
      instrument: layers.pluck.instrument,
      pattern:    layers.pluck.pattern,
      rate:       layers.pluck.rate,
    })
    stems.push({ name: 'pluck', blob: audioBufferToWavBlob(buf) })
  }

  if (layers.drums?.enabled && (layers.drums.pattern || sectionPlan?.length)) {
    const buf = await renderDrums({
      chords, bpm, barsPerChord,
      pattern: layers.drums.pattern,
      mutes:   layers.drums.mutes,
      solos:   layers.drums.solos,
      volumes: layers.drums.volumes,
      swing:   layers.drums.swing,
      sectionPlan,
    })
    stems.push({ name: 'drums', blob: audioBufferToWavBlob(buf) })
  }

  // Audio layer: re-encode the loaded buffer so the user gets a tidy WAV
  // instead of webm/m4a/etc. Loop it to fill the song length when the
  // user has the loop toggle on.
  if (layers.audio?.enabled && audioBuffer) {
    const totalSec = loopSeconds({ chords, bpm, barsPerChord })
    const out = renderAudioBufferLoop(audioBuffer, totalSec, !!layers.audio.loop)
    stems.push({ name: 'audio', blob: audioBufferToWavBlob(out) })
  }

  return stems
}

/** Copy the user's audio clip into a fresh AudioBuffer of `targetSec`. */
function renderAudioBufferLoop(srcBuffer, targetSec, loop) {
  const ctx = new OfflineAudioContext(
    Math.min(srcBuffer.numberOfChannels, 2),
    Math.ceil(targetSec * srcBuffer.sampleRate),
    srcBuffer.sampleRate,
  )
  // Build via direct sample copy so we don't need OfflineAudioContext.startRendering
  // for the simple case — but actually we DO need to start it. Use a BufferSource.
  const target = ctx.createBuffer(
    Math.min(srcBuffer.numberOfChannels, 2),
    Math.ceil(targetSec * srcBuffer.sampleRate),
    srcBuffer.sampleRate,
  )

  for (let c = 0; c < target.numberOfChannels; c++) {
    const src = srcBuffer.getChannelData(c)
    const dst = target.getChannelData(c)
    if (loop) {
      for (let i = 0; i < dst.length; i++) dst[i] = src[i % src.length]
    } else {
      const copyLen = Math.min(dst.length, src.length)
      for (let i = 0; i < copyLen; i++) dst[i] = src[i]
    }
  }
  return target
}

/** Trigger a download for each stem. */
export function downloadStems(stems, projectName = 'sketch') {
  const safe = (projectName || 'sketch').replace(/[^a-zA-Z0-9-_]+/g, '_')
  for (const stem of stems) {
    const url = URL.createObjectURL(stem.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}_${stem.name}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
