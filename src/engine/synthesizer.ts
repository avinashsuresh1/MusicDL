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

  // Clamp start time to current context time to prevent GStreamer latency issues
  const playStartTime = Math.max(ctx.currentTime, startTime);
  const releaseTime = playStartTime + duration;
  const endTime = playStartTime + duration + R;

  const gainNode = ctx.createGain();
  gainNode.connect(destination);

  const peakVolume = volume;
  const sustainVolume = S * volume;

  gainNode.gain.setValueAtTime(0, playStartTime);

  if (duration <= A) {
    // Note is released during the attack phase
    const volumeAtRelease = A > 0 ? (duration / A) * peakVolume : peakVolume;
    if (A > 0) {
      gainNode.gain.linearRampToValueAtTime(volumeAtRelease, releaseTime);
    } else {
      gainNode.gain.setValueAtTime(peakVolume, playStartTime);
    }
    gainNode.gain.setValueAtTime(volumeAtRelease, releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  } else if (duration <= A + D) {
    // Note is released during the decay phase
    if (A > 0) {
      gainNode.gain.linearRampToValueAtTime(peakVolume, playStartTime + A);
    } else {
      gainNode.gain.setValueAtTime(peakVolume, playStartTime);
    }
    
    const decayDuration = duration - A;
    const volumeAtRelease = D > 0 ? peakVolume - (decayDuration / D) * (peakVolume - sustainVolume) : sustainVolume;
    if (D > 0) {
      gainNode.gain.linearRampToValueAtTime(volumeAtRelease, releaseTime);
    } else {
      gainNode.gain.setValueAtTime(sustainVolume, releaseTime);
    }
    gainNode.gain.setValueAtTime(volumeAtRelease, releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  } else {
    // Standard ADSR
    if (A > 0) {
      gainNode.gain.linearRampToValueAtTime(peakVolume, playStartTime + A);
      if (D > 0) {
        gainNode.gain.linearRampToValueAtTime(sustainVolume, playStartTime + A + D);
      } else {
        gainNode.gain.setValueAtTime(sustainVolume, playStartTime + A);
      }
    } else {
      gainNode.gain.setValueAtTime(peakVolume, playStartTime);
      if (D > 0) {
        gainNode.gain.linearRampToValueAtTime(sustainVolume, playStartTime + D);
      } else {
        gainNode.gain.setValueAtTime(sustainVolume, playStartTime);
      }
    }
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
      if (h.z >= 1) {
        imag[h.z] += h.amplitude;
      }
    }

    try {
      const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.setValueAtTime(frequency, playStartTime);
      osc.connect(gainNode);
      osc.start(playStartTime);
      osc.stop(endTime);
      oscillators.push(osc);
    } catch (e) {
      playMultiOscillator(ctx, gainNode, frequency, playStartTime, endTime, instrument, oscillators);
    }
  } else {
    playMultiOscillator(ctx, gainNode, frequency, playStartTime, endTime, instrument, oscillators);
  }

  // Define a cleanup function to disconnect nodes and release resources
  let cleanupTimeout: any = null;
  const cleanup = () => {
    if (cleanupTimeout) {
      clearTimeout(cleanupTimeout);
      cleanupTimeout = null;
    }
    try {
      gainNode.disconnect();
      oscillators.forEach(osc => {
        try {
          osc.disconnect();
        } catch (_) {}
      });
    } catch (_) {}
  };

  // Schedule automatic cleanup shortly after the note release tail completes
  cleanupTimeout = setTimeout(cleanup, (duration + R + 0.5) * 1000);

  const stop = (time: number) => {
    try {
      const fadeTime = 0.05; // 50ms fade out for clean stops
      const clampTime = Math.max(ctx.currentTime, time);
      gainNode.gain.cancelScheduledValues(clampTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value || 0, clampTime);
      gainNode.gain.linearRampToValueAtTime(0, clampTime + fadeTime);
      
      oscillators.forEach(osc => {
        try {
          osc.stop(clampTime + fadeTime);
        } catch (_) {}
      });

      // Schedule final cleanup after fade-out completes
      setTimeout(cleanup, (fadeTime + 0.1) * 1000);
    } catch (_) {}
  };

  return {
    oscillators,
    gainNode,
    stop
  };
}

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
