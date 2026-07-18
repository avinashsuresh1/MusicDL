/**
 * Pure JavaScript audio renderer.
 *
 * Synthesises a composition into a raw PCM Float32Array using only Math.sin()
 * and simple arithmetic — no Web Audio API oscillators, gain automation, or
 * PeriodicWave.  This completely bypasses WebKitGTK / GStreamer audio bugs.
 */
import type { ScheduledNote, Instrument } from '../types/music.js';

/**
 * Render an array of scheduled notes into a mono Float32Array of PCM samples.
 */
export function renderToSamples(
  notes: ScheduledNote[],
  sampleRate: number
): Float32Array {
  if (notes.length === 0) {
    return new Float32Array(sampleRate); // 1 s of silence
  }

  // Find total duration (last note end + its release tail + a short pad)
  let maxEnd = 0;
  for (const n of notes) {
    const rel = (n.instrument.adsr?.release ?? 50) / 1000;
    const end = n.startTime + n.duration + rel;
    if (end > maxEnd) maxEnd = end;
  }

  const totalSamples = Math.ceil((maxEnd + 0.25) * sampleRate);
  const buffer = new Float32Array(totalSamples);

  // Render each note additively
  for (const note of notes) {
    renderNote(buffer, note, sampleRate);
  }

  // Peak-normalise to 0.9 to prevent clipping
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const a = Math.abs(buffer[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0.001) {
    const scale = 0.9 / peak;
    for (let i = 0; i < totalSamples; i++) {
      buffer[i] *= scale;
    }
  }

  return buffer;
}

/** Render a single note into the buffer (additive). */
function renderNote(
  buffer: Float32Array,
  note: ScheduledNote,
  sampleRate: number
): void {
  const adsr = note.instrument.adsr ?? { attack: 10, decay: 0, sustain: 1.0, release: 50 };
  const A = adsr.attack / 1000;  // seconds
  const D = adsr.decay / 1000;
  const S = adsr.sustain;
  const R = adsr.release / 1000;
  const dur = note.duration;
  const totalNoteDur = dur + R;

  const startSample = Math.max(0, Math.floor(note.startTime * sampleRate));
  const numSamples = Math.ceil(totalNoteDur * sampleRate);
  const endSample = Math.min(startSample + numSamples, buffer.length);

  // Pre-compute 2πfz for each harmonic to avoid repeated multiplication
  const harmonics = note.instrument.harmonics;
  const twoPiFreqs: number[] = new Array(harmonics.length);
  const amps: number[] = new Array(harmonics.length);
  for (let h = 0; h < harmonics.length; h++) {
    twoPiFreqs[h] = 2 * Math.PI * note.frequency * harmonics[h].z;
    amps[h] = harmonics[h].amplitude;
  }

  const vol = note.volume;
  const invSR = 1 / sampleRate;

  for (let i = startSample; i < endSample; i++) {
    // Time relative to note start
    const t = (i - startSample) * invSR;

    // ADSR envelope (linear segments)
    let env: number;
    if (t < A) {
      env = A > 0 ? t / A : 1;
    } else if (t < A + D) {
      env = D > 0 ? 1 - ((t - A) / D) * (1 - S) : S;
    } else if (t < dur) {
      env = S;
    } else {
      const rt = t - dur;
      env = R > 0 ? S * (1 - rt / R) : 0;
    }
    if (env < 0) env = 0;

    // Additive synthesis — sum of sine harmonics
    let sample = 0;
    for (let h = 0; h < harmonics.length; h++) {
      sample += amps[h] * Math.sin(twoPiFreqs[h] * t);
    }

    buffer[i] += sample * env * vol;
  }
}
