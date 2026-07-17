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
      gainNode.gain.setTargetAtTime(volumeAtRelease, playStartTime, A / 3);
    } else {
      gainNode.gain.setValueAtTime(peakVolume, playStartTime);
    }
    gainNode.gain.setTargetAtTime(0, releaseTime, R / 3);
  } else if (duration <= A + D) {
    // Note is released during the decay phase
    if (A > 0) {
      gainNode.gain.setTargetAtTime(peakVolume, playStartTime, A / 3);
    } else {
      gainNode.gain.setValueAtTime(peakVolume, playStartTime);
    }
    
    const decayDuration = duration - A;
    const volumeAtRelease = D > 0 ? peakVolume - (decayDuration / D) * (peakVolume - sustainVolume) : sustainVolume;
    if (D > 0) {
      gainNode.gain.setTargetAtTime(volumeAtRelease, playStartTime + A, D / 3);
    } else {
      gainNode.gain.setValueAtTime(sustainVolume, playStartTime + A);
    }
    gainNode.gain.setTargetAtTime(0, releaseTime, R / 3);
  } else {
    // Standard ADSR
    if (A > 0) {
      gainNode.gain.setTargetAtTime(peakVolume, playStartTime, A / 3);
      if (D > 0) {
        gainNode.gain.setTargetAtTime(sustainVolume, playStartTime + A, D / 3);
      } else {
        gainNode.gain.setValueAtTime(sustainVolume, playStartTime + A);
      }
    } else {
      gainNode.gain.setValueAtTime(peakVolume, playStartTime);
      if (D > 0) {
        gainNode.gain.setTargetAtTime(sustainVolume, playStartTime, D / 3);
      } else {
        gainNode.gain.setValueAtTime(sustainVolume, playStartTime);
      }
    }
    gainNode.gain.setTargetAtTime(0, releaseTime, R / 3);
  }

  const oscillators: OscillatorNode[] = [];
  const intermediateGains: GainNode[] = [];
  
  // WebKitGTK / GStreamer has multiple volume normalization and clipping bugs with createPeriodicWave.
  // We force playMultiOscillator to ensure consistent volume scaling across all platforms.
  const allHarmonicsInteger = false;

  if (allHarmonicsInteger && instrument.harmonics.length > 0) {
    // Optimization: Use a single PeriodicWave oscillator (bypassed on WebKitGTK/Linux)
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
      playMultiOscillator(ctx, gainNode, frequency, playStartTime, endTime, instrument, oscillators, intermediateGains);
    }
  } else {
    playMultiOscillator(ctx, gainNode, frequency, playStartTime, endTime, instrument, oscillators, intermediateGains);
  }

  // Define a cleanup function to disconnect nodes and release resources
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      gainNode.disconnect();
      oscillators.forEach(osc => {
        try {
          osc.disconnect();
        } catch (_) {}
      });
      intermediateGains.forEach(g => {
        try {
          g.disconnect();
        } catch (_) {}
      });
    } catch (_) {}
  };

  // Trigger cleanup exactly when the first oscillator stops playing on the audio thread
  if (oscillators.length > 0) {
    oscillators[0].onended = () => {
      cleanup();
    };
  }

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
    osc.stop(endTime);
    
    oscillatorsList.push(osc);
    intermediateGainsList.push(oscGain);
  }
}
