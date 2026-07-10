import { describe, it, expect } from 'vitest';
import {
  intervalToFrequency,
  frequencyToInterval,
  isRest,
  beatsToSeconds,
  secondsToBeats
} from '../src/utils/note-utils.js';

describe('note-utils', () => {
  describe('intervalToFrequency', () => {
    it('should calculate frequency for unison (pitch 0)', () => {
      expect(intervalToFrequency(0, 261.63, 100)).toBeCloseTo(261.63, 2);
    });

    it('should calculate frequency for octave (pitch 12) in 12-TET', () => {
      expect(intervalToFrequency(12, 261.63, 100)).toBeCloseTo(523.26, 2);
    });

    it('should calculate frequency for a perfect fifth (pitch 7) in 12-TET', () => {
      expect(intervalToFrequency(7, 440, 100)).toBeCloseTo(659.26, 2);
    });

    it('should calculate frequency for octave down (pitch -12)', () => {
      expect(intervalToFrequency(-12, 261.63, 100)).toBeCloseTo(130.81, 2);
    });

    it('should support custom intervals (e.g. 200 cents whole-tone)', () => {
      // 1 step of 200 cents from 440Hz: 440 * 2^(200/1200) = 440 * 2^(1/6)
      const expected = 440 * Math.pow(2, 1/6);
      expect(intervalToFrequency(1, 440, 200)).toBeCloseTo(expected, 4);
    });
  });

  describe('frequencyToInterval', () => {
    it('should roundtrip with intervalToFrequency', () => {
      const root = 261.63;
      const step = 100;
      for (let pitch = -24; pitch <= 24; pitch++) {
        const freq = intervalToFrequency(pitch, root, step);
        const calcPitch = frequencyToInterval(freq, root, step);
        expect(calcPitch).toBeCloseTo(pitch, 2);
      }
    });
  });

  describe('isRest', () => {
    it('should correctly identify rests', () => {
      expect(isRest('rest')).toBe(true);
      expect(isRest(0)).toBe(false);
      expect(isRest(-5)).toBe(false);
    });
  });

  describe('beatsToSeconds & secondsToBeats', () => {
    it('should convert beats to seconds at 120 BPM', () => {
      expect(beatsToSeconds(4, 120)).toBe(2.0);
      expect(beatsToSeconds(1, 120)).toBe(0.5);
    });

    it('should convert seconds to beats at 120 BPM', () => {
      expect(secondsToBeats(2.0, 120)).toBe(4);
      expect(secondsToBeats(0.5, 120)).toBe(1);
    });

    it('should roundtrip beats and seconds', () => {
      const tempo = 90;
      for (let beats = 0.5; beats <= 16; beats += 0.5) {
        const secs = beatsToSeconds(beats, tempo);
        const calcBeats = secondsToBeats(secs, tempo);
        expect(calcBeats).toBeCloseTo(beats, 4);
      }
    });
  });
});
