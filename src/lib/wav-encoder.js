/**
 * Tiny Float32 → WAV blob encoder. Produces a standard 16-bit PCM WAV
 * file (stereo if the buffer has two channels, mono otherwise) that any
 * DAW will load directly.
 *
 * Why a hand-rolled encoder instead of a dependency: rolling our own is
 * ~80 lines, has zero ongoing maintenance, and we already produce all
 * the bytes from Tone.Offline so adding a 100kB lib for one tiny job
 * isn't worth the bundle-size cost.
 */

export function audioBufferToWavBlob(audioBuffer) {
  const numCh = Math.min(audioBuffer.numberOfChannels, 2)
  const numFrames = audioBuffer.length
  const sampleRate = audioBuffer.sampleRate

  // 16-bit PCM: 2 bytes per sample per channel.
  const dataBytes = numFrames * numCh * 2
  const bufferSize = 44 + dataBytes
  const out = new ArrayBuffer(bufferSize)
  const view = new DataView(out)

  // ─── RIFF / WAVE header ─────────────────────────────────────────
  writeString(view, 0,  'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeString(view, 8,  'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16,        true)         // PCM chunk size
  view.setUint16(20, 1,         true)         // format = PCM
  view.setUint16(22, numCh,     true)         // channels
  view.setUint32(24, sampleRate,true)         // sample rate
  view.setUint32(28, sampleRate * numCh * 2, true) // byte rate
  view.setUint16(32, numCh * 2, true)         // block align
  view.setUint16(34, 16,        true)         // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  // ─── Interleaved PCM samples ────────────────────────────────────
  const channels = []
  for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = channels[c][i]
      // Clamp to [-1, 1], scale to int16, write little-endian.
      if (s > 1) s = 1; else if (s < -1) s = -1
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }
  }

  return new Blob([out], { type: 'audio/wav' })
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
