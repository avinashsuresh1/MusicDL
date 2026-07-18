import { describe, it, expect } from 'vitest';
import { renderToSamples } from '../src/engine/renderer.js';
import type { ScheduledNote } from '../src/types/music.js';

describe('renderer', () => {
  it('returns a silent buffer when notes list is empty', () => {
    const samples = renderToSamples([], 44100);
    expect(samples.length).toBe(44100);
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i]).toBe(0);
    }
  });

  it('renders a single note correctly with non-zero samples and normalization', () => {
    const note: ScheduledNote = {
      frequency: 440, // A4
      startTime: 0,
      duration: 0.5,
      volume: 1.0,
      instrument: {
        name: 'sine',
        harmonics: [{ z: 1, amplitude: 1.0 }],
        adsr: { attack: 10, decay: 0, sustain: 1.0, release: 50 }
      }
    };

    const sampleRate = 1000; // lower sample rate for fast testing
    const samples = renderToSamples([note], sampleRate);

    // Total duration: 0.5s duration + 0.05s release = 0.55s.
    // Plus 0.25s pad = 0.80s.
    // 0.80 * 1000 = 800 samples.
    expect(samples.length).toBeGreaterThanOrEqual(550);
    
    // There must be non-zero samples
    let hasNonZero = false;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i] !== 0) {
        hasNonZero = true;
      }
    }
    expect(hasNonZero).toBe(true);

    // Peak amplitude should be normalized to exactly 0.9
    let maxVal = 0;
    for (let i = 0; i < samples.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(samples[i]));
    }
    expect(maxVal).toBeCloseTo(0.9, 5);
  });
});
