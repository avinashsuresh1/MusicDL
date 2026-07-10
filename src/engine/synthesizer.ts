import type { Instrument } from '../types/music.js';

export interface ActiveNoteNodes {
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  stop: (time: number) => void;
}

/**
 * Creates and starts Web Audio API nodes for a single scheduled note.
 * Uses a single PeriodicWave if all z values are integers, otherwise falls back to multiple oscillators.
 * Returns the nodes and a stop function.
 */
export function playNote(
  ctx: AudioContext,
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

  const endTime = startTime + duration + R;
  const gainNode = ctx.createGain();
  gainNode.connect(destination);

  const peakVolume = volume;
  const sustainVolume = S * volume;
  const releaseTime = startTime + duration;

  gainNode.gain.setValueAtTime(0, startTime);

  if (duration <= A) {
    // Note is released during the attack phase
    const volumeAtRelease = A > 0 ? (duration / A) * peakVolume : peakVolume;
    gainNode.gain.linearRampToValueAtTime(volumeAtRelease, releaseTime);
    gainNode.gain.setValueAtTime(volumeAtRelease, releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  } else if (duration <= A + D) {
    // Note is released during the decay phase
    gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + A);
    const decayDuration = duration - A;
    const volumeAtRelease = D > 0 ? peakVolume - (decayDuration / D) * (peakVolume - sustainVolume) : sustainVolume;
    gainNode.gain.linearRampToValueAtTime(volumeAtRelease, releaseTime);
    gainNode.gain.setValueAtTime(volumeAtRelease, releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  } else {
    // Standard ADSR
    gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + A);
    gainNode.gain.linearRampToValueAtTime(sustainVolume, startTime + A + D);
    gainNode.gain.setValueAtTime(sustainVolume, releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  }

  const oscillators: OscillatorNode[] = [];
  const allHarmonicsInteger = instrument.harmonics.every(h => Number.isInteger(h.z));

  if (allHarmonicsInteger && instrument.harmonics.length > 0) {
    // Optimization: Use a single PeriodicWave oscillator
    const maxZ = Math.max(...instrument.harmonics.map(h => h.z));
    const real = new Float32Array(maxZ + 1);
    const imag = new Float32Array(maxZ + 1);

    for (const h of instrument.harmonics) {
      // Harmonic z=0 is not valid, z starts at 1
      if (h.z >= 1) {
        imag[h.z] += h.amplitude;
      }
    }

    try {
      const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.setValueAtTime(frequency, startTime);
      osc.connect(gainNode);
      osc.start(startTime);
      osc.stop(endTime);
      oscillators.push(osc);
    } catch (e) {
      // Fallback if PeriodicWave creation fails
      playMultiOscillator(ctx, gainNode, frequency, startTime, endTime, instrument, oscillators);
    }
  } else {
    // Fallback: Multiple oscillators (needed for non-integer z values)
    playMultiOscillator(ctx, gainNode, frequency, startTime, endTime, instrument, oscillators);
  }

  const stop = (time: number) => {
    try {
      const fadeTime = 0.005;
      const clampTime = Math.max(ctx.currentTime, time);
      gainNode.gain.cancelScheduledValues(clampTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, clampTime);
      gainNode.gain.linearRampToValueAtTime(0, clampTime + fadeTime);
      
      oscillators.forEach(osc => {
        try {
          osc.stop(clampTime + fadeTime);
        } catch (_) {}
      });
    } catch (_) {}
  };

  return {
    oscillators,
    gainNode,
    stop
  };
}

/**
 * Creates multiple oscillators for non-integer or failed PeriodicWave harmonics.
 */
function playMultiOscillator(
  ctx: AudioContext,
  gainNode: AudioNode,
  fundamentalFreq: number,
  startTime: number,
  endTime: number,
  instrument: Instrument,
  oscillatorsList: OscillatorNode[]
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
    osc.stop(endTime);
    
    oscillatorsList.push(osc);
  }
}
