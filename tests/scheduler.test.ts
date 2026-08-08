import { describe, it, expect } from 'vitest';
import { getScheduledNotes, getScheduledNotesForInstrument, getScheduledNotesForMelody, getScheduledNotesForChord, getScheduledNotesForTrack } from '../src/engine/scheduler.js';
import type { Composition } from '../src/types/music.js';
import { intervalToFrequency } from '../src/utils/note-utils.js';

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

  it('should loop melodies correctly to fill composition duration', () => {
    const loopComp: Composition = {
      title: "Loop Test",
      tempo: 120, // 1 beat = 0.5s
      rootFrequency: 440.0,
      interval: 100,
      instruments: {
        sine: { name: "sine", harmonics: [{ z: 1, amplitude: 1.0 }] }
      },
      melodies: {
        oneShot: {
          name: "oneShot",
          instrument: "sine",
          notes: [{ pitch: 0, offset: 0, duration: 4 }] // ends at beat 4 (2.0s)
        },
        looping: {
          name: "looping",
          instrument: "sine",
          loop: true,
          loopStart: 1.0,
          loopEnd: 2.0,
          notes: [
            { pitch: 4, offset: 0, duration: 1.0 }, // intro note
            { pitch: 7, offset: 1.0, duration: 1.0 } // loop note (repeats every 1.0 beat)
          ]
        }
      },
      tracks: [
        {
          name: "nonLoopingTrack",
          volume: 0.8,
          melodies: ["oneShot"]
        },
        {
          name: "loopingTrack",
          volume: 0.5,
          melodies: [{ name: "looping", offset: 0.0 }]
        }
      ]
    };

    const notes = getScheduledNotes(loopComp);

    // Non-looping composition duration is 4.0 beats.
    // The looping melody has:
    // - intro note at beat 0, dur 1
    // - loop note at beat 1, repeating at beat 2, beat 3
    // So we should have:
    // - 1 oneShot note
    // - 1 loop intro note
    // - 3 loop repetitions of the loop note (at beats 1.0, 2.0, 3.0)
    // Total = 5 scheduled notes.
    expect(notes).toHaveLength(5);

    // Verify intro note: starts at 0.0s (beat 0)
    const introNote = notes.find(n => n.frequency === intervalToFrequency(4, 440.0, 100));
    expect(introNote).toBeDefined();
    expect(introNote!.startTime).toBeCloseTo(0.0, 4);

    // Verify loop notes: frequencies are 7 semitones (587.33Hz)
    const loopNotes = notes.filter(n => n.frequency === intervalToFrequency(7, 440.0, 100));
    expect(loopNotes).toHaveLength(3);
    expect(loopNotes[0].startTime).toBeCloseTo(0.5, 4); // beat 1.0 -> 0.5s
    expect(loopNotes[1].startTime).toBeCloseTo(1.0, 4); // beat 2.0 -> 1.0s
    expect(loopNotes[2].startTime).toBeCloseTo(1.5, 4); // beat 3.0 -> 1.5s
  });

  it('should apply instrument-level octaveShift to note pitch when defined', () => {
    const instRootComp: Composition = {
      title: "Instrument Root Test",
      tempo: 120,
      rootFrequency: 261.63, // C4
      interval: 100,
      instruments: {
        bass: {
          name: "bass",
          octaveShift: -1, // 1 octave down -> C3 (130.81Hz)
          harmonics: [{ z: 1, amplitude: 1.0 }]
        }
      },
      melodies: {
        bassline: {
          name: "bassline",
          instrument: "bass",
          notes: [
            { pitch: 0, offset: 0, duration: 1 }
          ]
        }
      },
      tracks: [
        {
          name: "bass_track",
          volume: 0.8,
          melodies: ["bassline"]
        }
      ]
    };

    const notes = getScheduledNotes(instRootComp);
    expect(notes).toHaveLength(1);
    // Pitch 0 + octaveShift -1 (12 semitones down) at rootFrequency 261.63Hz should yield 130.81Hz
    expect(notes[0].frequency).toBeCloseTo(130.81, 1);
  });

  it('should generate audition note for an instrument', () => {
    const notes = getScheduledNotesForInstrument('sine', testComp);
    expect(notes).toHaveLength(1);
    expect(notes[0].frequency).toBeCloseTo(261.63, 1);
    expect(notes[0].duration).toBe(1.5);
  });

  it('should generate scheduled notes for a single melody from t=0', () => {
    const notes = getScheduledNotesForMelody('melody1', testComp);
    expect(notes).toHaveLength(2); // 2 non-rest notes in melody1
    expect(notes[0].startTime).toBe(0);
    expect(notes[1].startTime).toBe(0.5);
  });

  it('should generate scheduled notes for a single chord from t=0', () => {
    const chordComp: Composition = {
      ...testComp,
      chords: {
        triad: {
          name: "triad",
          instrument: "sine",
          pitches: [0, 4, 7]
        }
      }
    };
    const notes = getScheduledNotesForChord('triad', chordComp);
    expect(notes).toHaveLength(3);
    expect(notes[0].startTime).toBe(0);
    expect(notes[1].startTime).toBe(0);
    expect(notes[2].startTime).toBe(0);
  });

  it('should generate scheduled notes for a single track (soloing that track)', () => {
    const notes = getScheduledNotesForTrack('track1', testComp);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].instrument.name).toBe('sine');
  });
});
