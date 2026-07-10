import { describe, it, expect } from 'vitest';
import { getScheduledNotes } from '../src/engine/scheduler.js';
import type { Composition } from '../src/types/music.js';

describe('scheduler', () => {
  const testComp: Composition = {
    title: "Scheduler Test",
    tempo: 120, // 1 beat = 0.5s
    rootFrequency: 261.63, // C4
    interval: 100, // semitones
    instruments: {
      sine: {
        name: "sine",
        harmonics: [{ z: 1, amplitude: 1.0 }]
      }
    },
    melodies: {
      melody1: {
        name: "melody1",
        instrument: "sine",
        notes: [
          { pitch: 0, offset: 0, duration: 1 },    // 0.0s, C4 (261.63Hz)
          { pitch: 'rest', offset: 1, duration: 1 } // 0.5s, rest (filtered)
        ]
      },
      melody2: {
        name: "melody2",
        instrument: "sine",
        notes: [
          { pitch: 12, offset: 2, duration: 2 },   // 1.0s, C5 (523.26Hz)
          { pitch: 7, offset: 2, duration: 2 }     // 1.0s, G4 (392.00Hz)
        ]
      }
    },
    tracks: [
      {
        name: "track1",
        volume: 0.8,
        melodies: ["melody1", "melody2"]
      }
    ]
  };

  it('should flatten melodies and sort them chronologically', () => {
    const notes = getScheduledNotes(testComp);

    // Expect 3 notes (melody1.note[0], melody2.note[0], melody2.note[1])
    // The rest note should be filtered out
    expect(notes).toHaveLength(3);

    // First note: 0.0s, pitch 0 (261.63Hz)
    expect(notes[0].startTime).toBeCloseTo(0.0, 4);
    expect(notes[0].duration).toBeCloseTo(0.5, 4);
    expect(notes[0].frequency).toBeCloseTo(261.63, 2);
    expect(notes[0].volume).toBe(0.8);

    // Second and third notes should start at 1.0s (offset 2 at 120bpm = 1.0s)
    // They are sorted by frequency, so G4 (392.00Hz) is first, then C5 (523.26Hz)
    expect(notes[1].startTime).toBeCloseTo(1.0, 4);
    expect(notes[1].duration).toBeCloseTo(1.0, 4);
    expect(notes[1].frequency).toBeCloseTo(392.00, 2);

    expect(notes[2].startTime).toBeCloseTo(1.0, 4);
    expect(notes[2].duration).toBeCloseTo(1.0, 4);
    expect(notes[2].frequency).toBeCloseTo(523.26, 2);
  });
});
