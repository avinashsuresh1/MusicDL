import type { Instrument } from '../types/music.js';

export interface ActiveNoteNodes {
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  stop: (time: number) => void;
}

/**
 * Schedule a single note onto an audio graph.
 * Works with both AudioContext (real-time) and OfflineAudioContext (pre-render).
 *
 * Uses a single PeriodicWave oscillator when all harmonic z values are positive
 * integers; otherwise falls back to multiple sine oscillators.
 */
export function playNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  startTime: number,
  duration: number,
  instrument: Instrument,
  volume: number
): ActiveNoteNodes {
  const adsr = instrument.adsr || { attack: 10, decay: 0, sustain: 1.0, release: 50 };
  const A = adsr.attack / 1000;
  const D = adsr.decay / 1000;
  const S = adsr.sustain;
  const R = adsr.release / 1000;

  const noteStart = Math.max(0, startTime);
  const releaseTime = noteStart + duration;
  const endTime = releaseTime + R;

  // --- ADSR gain envelope ---
  const gainNode = ctx.createGain();
  gainNode.connect(destination);

  const peakVol = volume;
  const susVol = S * volume;

  // Use linearRampToValueAtTime for precise, deterministic envelopes.
  gainNode.gain.setValueAtTime(0, noteStart);

  if (A > 0) {
    gainNode.gain.linearRampToValueAtTime(peakVol, noteStart + A);
  } else {
    gainNode.gain.setValueAtTime(peakVol, noteStart);
  }

  const decayStart = noteStart + A;
  if (decayStart < releaseTime) {
    if (D > 0) {
      const decayEnd = Math.min(decayStart + D, releaseTime);
      gainNode.gain.linearRampToValueAtTime(susVol, decayEnd);
    } else {
      gainNode.gain.setValueAtTime(susVol, decayStart);
    }
    // Hold sustain until release
    gainNode.gain.setValueAtTime(susVol, releaseTime);
  }

  // Release
  if (R > 0) {
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  } else {
    gainNode.gain.setValueAtTime(0, releaseTime);
  }

  // --- Oscillator(s) ---
  const oscillators: OscillatorNode[] = [];
  const intermediateGains: GainNode[] = [];

  const allHarmonicsInteger = instrument.harmonics.length > 0 &&
    instrument.harmonics.every(h => h.z >= 1 && Number.isInteger(h.z));

  if (allHarmonicsInteger) {
    // Single PeriodicWave oscillator — keeps node count low
    const maxZ = Math.max(...instrument.harmonics.map(h => h.z));
    const real = new Float32Array(maxZ + 1);
    const imag = new Float32Array(maxZ + 1);

    for (const h of instrument.harmonics) {
      imag[h.z] += h.amplitude;
    }

    try {
      const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.setValueAtTime(frequency, noteStart);
      osc.connect(gainNode);
      osc.start(noteStart);
      osc.stop(endTime + 0.01);
      oscillators.push(osc);
    } catch {
      scheduleMultiOscillator(ctx, gainNode, frequency, noteStart, endTime, instrument, oscillators, intermediateGains);
    }
  } else {
    scheduleMultiOscillator(ctx, gainNode, frequency, noteStart, endTime, instrument, oscillators, intermediateGains);
  }

  // --- Cleanup ---
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try { gainNode.disconnect(); } catch {}
    for (const osc of oscillators) { try { osc.disconnect(); } catch {} }
    for (const g of intermediateGains) { try { g.disconnect(); } catch {} }
  };

  if (oscillators.length > 0) {
    oscillators[0].onended = cleanup;
  }

  const stop = (time: number) => {
    try {
      const fade = 0.05;
      const t = Math.max(ctx.currentTime, time);
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(gainNode.gain.value || 0, t);
      gainNode.gain.linearRampToValueAtTime(0, t + fade);
      for (const osc of oscillators) {
        try { osc.stop(t + fade); } catch {}
      }
      setTimeout(cleanup, (fade + 0.1) * 1000);
    } catch {}
  };

  return { oscillators, gainNode, stop };
}

function scheduleMultiOscillator(
  ctx: BaseAudioContext,
  gainNode: AudioNode,
  fundamentalFreq: number,
  startTime: number,
  endTime: number,
  instrument: Instrument,
  oscillatorsList: OscillatorNode[],
  intermediateGainsList: GainNode[]
): void {
  for (const h of instrument.harmonics) {
    if (h.amplitude <= 0) continue;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.frequency.setValueAtTime(fundamentalFreq * h.z, startTime);
    oscGain.gain.setValueAtTime(h.amplitude, startTime);

    osc.connect(oscGain);
    oscGain.connect(gainNode);

    osc.start(startTime);
    osc.stop(endTime + 0.01);

    oscillatorsList.push(osc);
    intermediateGainsList.push(oscGain);
  }
}
