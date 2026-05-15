import * as Tone from 'tone'
import { midiToToneName } from './theory'
import { INSTRUMENTS, DEFAULT_INSTRUMENT, createDrumKit } from './instruments'
import { buildArpSequence, arpStepDurationSec } from './arp-patterns'
import { buildBassSequence, bassStepDurationSec } from './bass-patterns'
import { DRUM_VOICES, isVoiceAudible } from './drum-patterns'
import { buildStrumSequence, strumStepDurationSec } from './strum-patterns'
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

async function renderStrum({ chords, bpm, barsPerChord, instrument, pattern, stringDelaySec }) {
  const dur = loopSeconds({ chords, bpm, barsPerChord }) + 1.5
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm
    const synth = await buildSynth(instrument)
    synth.toDestination()
    const beatSec = 60 / bpm
    const slotSec = barsPerChord * beatSec * 4
    const stepSec = strumStepDurationSec(bpm)
    chords.forEach((c, i) => {
      transport.schedule((time) => {
        if (!c) return
        const events = buildStrumSequence(c.midiNotes, pattern, barsPerChord, stringDelaySec)
        for (const ev of events) {
          const stepStart = time + ev.stepIdx * stepSec
          for (const n of ev.notes) {
            synth.triggerAttackRelease(midiToToneName(n.midi), stepSec * 0.95, stepStart + n.offsetSec, n.velocity)
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
 * Render every enabled non-empty layer to its own AudioBuffer. Same as
 * `renderAllStems` but skips the WAV encoding step so callers (the
 * mixdown path) can sum buffers directly without a decode round-trip.
 */
export async function renderAllStemBuffers({
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
    stems.push({ name: 'chords', channelId: 'chords', buffer: buf })
  }

  if (layers.pads?.enabled) {
    const buf = await renderPads({
      chords, bpm, barsPerChord,
      instrument: layers.pads.instrument,
    })
    stems.push({ name: 'pads', channelId: 'pads', buffer: buf })
  }

  if (layers.bass?.enabled) {
    const buf = await renderBass({
      chords, bpm, barsPerChord,
      instrument: layers.bass.instrument,
      mode:       layers.bass.mode,
    })
    stems.push({ name: 'bass', channelId: 'bass', buffer: buf })
  }

  if (layers.strum?.enabled && layers.strum.pattern) {
    const buf = await renderStrum({
      chords, bpm, barsPerChord,
      instrument:     layers.strum.instrument,
      pattern:        layers.strum.pattern,
      stringDelaySec: Math.max(0.001, Math.min(0.08, (layers.strum.stringDelayMs ?? 14) / 1000)),
    })
    stems.push({ name: 'strum', channelId: 'strum', buffer: buf })
  }

  if (layers.pluck?.enabled) {
    const buf = await renderPluck({
      chords, bpm, barsPerChord,
      instrument: layers.pluck.instrument,
      pattern:    layers.pluck.pattern,
      rate:       layers.pluck.rate,
    })
    stems.push({ name: 'pluck', channelId: 'pluck', buffer: buf })
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
    stems.push({ name: 'drums', channelId: 'drums', buffer: buf })
  }

  // Audio layer: copy the loaded buffer to the song's length so it
  // mixes cleanly with the synth stems. Loop it to fill the song
  // length when the user has the loop toggle on.
  if (layers.audio?.enabled && audioBuffer) {
    const totalSec = loopSeconds({ chords, bpm, barsPerChord })
    const out = renderAudioBufferLoop(audioBuffer, totalSec, !!layers.audio.loop)
    stems.push({ name: 'audio', channelId: 'audio', buffer: out })
  }

  return stems
}

/**
 * Wrapper that produces WAV blobs from the buffer-based renderer above.
 * Kept as the public API for the "Export stems" path so existing callers
 * (download into a folder) don't need to change.
 */
export async function renderAllStems(params) {
  const items = await renderAllStemBuffers(params)
  return items.map(it => ({ name: it.name, blob: audioBufferToWavBlob(it.buffer) }))
}

/**
 * Sum the layer AudioBuffers into a single stereo AudioBuffer applying
 * per-channel gain (from the mixer) and a final master gain. Caller
 * provides `gainsByChannel` — same channel ids the engine uses (chords,
 * pads, pluck, bass, drums, audio).
 */
export function mixDownBuffers(items, { gainsByChannel = {}, masterGain = 1 } = {}) {
  if (items.length === 0) return null
  let maxLen = 0
  let sampleRate = items[0].buffer.sampleRate
  for (const it of items) {
    if (it.buffer.length > maxLen) maxLen = it.buffer.length
    if (it.buffer.sampleRate !== sampleRate) {
      // All synth renders use SAMPLE_RATE; the audio clip render
      // re-bakes at SAMPLE_RATE too (see renderAudioBufferLoop). Should
      // never hit this in practice.
      console.warn('Mixdown: sample-rate mismatch — output may be off-pitch for', it.name)
    }
  }

  const out = new AudioBuffer({ numberOfChannels: 2, length: maxLen, sampleRate })
  const outL = out.getChannelData(0)
  const outR = out.getChannelData(1)

  for (const it of items) {
    const g = (gainsByChannel[it.channelId] ?? 1) * masterGain
    if (g <= 0) continue
    const buf = it.buffer
    const isStereo = buf.numberOfChannels >= 2
    const left  = buf.getChannelData(0)
    const right = isStereo ? buf.getChannelData(1) : left
    const n = Math.min(buf.length, maxLen)
    for (let i = 0; i < n; i++) {
      outL[i] += left[i]  * g
      outR[i] += right[i] * g
    }
  }

  // Soft-clip the bus to avoid hard digital distortion on overshoots.
  for (let i = 0; i < maxLen; i++) {
    outL[i] = softClip(outL[i])
    outR[i] = softClip(outR[i])
  }

  return out
}

function softClip(x) {
  if (x >  1) return  1 - 1 / (1 + (x  - 1))
  if (x < -1) return -1 + 1 / (1 + (-x - 1))
  return x
}

/**
 * Convenience: render → mix → wrap as a single WAV blob.
 */
export async function renderFullMix(params) {
  const items = await renderAllStemBuffers(params)
  if (items.length === 0) return null
  const mixed = mixDownBuffers(items, {
    gainsByChannel: params.gainsByChannel || {},
    masterGain:     params.masterGain ?? 1,
  })
  return mixed ? audioBufferToWavBlob(mixed) : null
}

/**
 * Copy the user's audio clip into a fresh AudioBuffer at `SAMPLE_RATE` and
 * `targetSec` length so it lines up sample-for-sample with the synth stems.
 * Linear-interp resampling is good enough for sketchpad-quality preview
 * exports — close to dragging a clip into a DAW that auto-resamples.
 */
function renderAudioBufferLoop(srcBuffer, targetSec, loop) {
  const outSr = SAMPLE_RATE
  const channels = Math.min(srcBuffer.numberOfChannels, 2)
  const length = Math.ceil(targetSec * outSr)
  const target = new AudioBuffer({ numberOfChannels: channels, length, sampleRate: outSr })

  const srcSr = srcBuffer.sampleRate
  const ratio = srcSr / outSr  // how many source samples per output sample

  for (let c = 0; c < channels; c++) {
    const src = srcBuffer.getChannelData(Math.min(c, srcBuffer.numberOfChannels - 1))
    const dst = target.getChannelData(c)
    const srcLen = src.length

    for (let i = 0; i < length; i++) {
      let srcIdx = i * ratio
      if (loop) srcIdx = srcIdx % srcLen
      else if (srcIdx >= srcLen - 1) break
      const i0 = Math.floor(srcIdx)
      const i1 = Math.min(i0 + 1, srcLen - 1)
      const frac = srcIdx - i0
      dst[i] = src[i0] * (1 - frac) + src[i1] * frac
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
