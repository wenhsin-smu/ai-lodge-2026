// Detects blowing into the mic. Blowing shows up as loud, broadband noise
// concentrated in the low frequencies, so we track loudness below ~500 Hz.

export type BlowDetector = {
  /** Low-frequency loudness, 0 (silent) to 1 (very loud). */
  read(): number;
  close(): void;
};

const LOW_BAND_HZ = 500;
const MIN_DB = -90;
const MAX_DB = -25;

export function createBlowDetector(stream: MediaStream): BlowDetector {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.3;
  source.connect(analyser);

  const bins = new Float32Array(analyser.frequencyBinCount);
  const binHz = audioCtx.sampleRate / analyser.fftSize;
  const lastBin = Math.max(2, Math.floor(LOW_BAND_HZ / binHz));

  return {
    read() {
      analyser.getFloatFrequencyData(bins);
      // Average power (not dB) across the low band, skipping the DC bin.
      let power = 0;
      for (let i = 1; i <= lastBin; i++) power += Math.pow(10, bins[i] / 10);
      const db = 10 * Math.log10(power / lastBin + 1e-12);
      return Math.min(1, Math.max(0, (db - MIN_DB) / (MAX_DB - MIN_DB)));
    },
    close() {
      source.disconnect();
      void audioCtx.close();
    },
  };
}
