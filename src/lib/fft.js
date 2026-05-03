/**
 * Iterative Cooley-Tukey FFT (decimation in time, in-place).
 *
 * `makeFFT(n)` returns a function that runs the FFT on length-n buffers,
 * with twiddle-factor sin/cos tables precomputed once.
 *
 * `n` must be a power of 2.
 */
export function makeFFT(n) {
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error('FFT size must be a power of 2 (and >= 2)')
  }

  const cosTable = new Float32Array(n / 2)
  const sinTable = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cosTable[i] = Math.cos(-2 * Math.PI * i / n)
    sinTable[i] = Math.sin(-2 * Math.PI * i / n)
  }

  return function fft(real, imag) {
    if (real.length !== n || imag.length !== n) {
      throw new Error(`FFT buffer length must be ${n}`)
    }

    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1
      for (; j & bit; bit >>= 1) j ^= bit
      j ^= bit
      if (i < j) {
        let t = real[i]; real[i] = real[j]; real[j] = t
        t = imag[i];     imag[i] = imag[j]; imag[j] = t
      }
    }

    // Cooley-Tukey butterflies using precomputed twiddle factors
    for (let size = 2; size <= n; size <<= 1) {
      const halfSize  = size >> 1
      const tableStep = n / size
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + halfSize; j++, k += tableStep) {
          const wReal = cosTable[k]
          const wImag = sinTable[k]
          const tr = real[j + halfSize] * wReal - imag[j + halfSize] * wImag
          const ti = real[j + halfSize] * wImag + imag[j + halfSize] * wReal
          real[j + halfSize] = real[j] - tr
          imag[j + halfSize] = imag[j] - ti
          real[j] += tr
          imag[j] += ti
        }
      }
    }
  }
}
