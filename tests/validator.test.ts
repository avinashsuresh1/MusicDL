import { describe, it, expect } from 'vitest';
import { validateComposition } from '../src/parser/validator.js';
import type { Composition } from '../src/types/music.js';

describe('validator', () => {
  const validComposition: Composition = {
    title: "Valid Composition",
    tempo: 120,
    rootFrequency: 261.63,
    interval: 100,
    instruments: {
      sine: {
        name: "sine",
        harmonics: [{ z: 1, amplitude: 1.0 }]
      }
    },
    melodies: {
      tune: {
        name: "tune",
        instrument: "sine",
        notes: [
          { pitch: 0, offset: 0, duration: 1 },
          { pitch: 'rest', offset: 1, duration: 0.5 }
        ]
      }
    },
    tracks: [
      {
        name: "track1",
        volume: 0.8,
        melodies: ["tune"]
      }
    ]
  };

  it('should pass validation for a valid composition', () => {
    const result = validateComposition(validComposition);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid metadata', () => {
    const invalidComp: Composition = {
      ...validComposition,
      title: "",
      tempo: -20,
      rootFrequency: 0,
      interval: NaN
    };

    const result = validateComposition(invalidComp);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'composition.yaml' && e.message.includes('title'))).toBe(true);
    expect(result.errors.some(e => e.path === 'composition.yaml' && e.message.includes('tempo'))).toBe(true);
    expect(result.errors.some(e => e.path === 'composition.yaml' && e.message.includes('rootFrequency'))).toBe(true);
    expect(result.errors.some(e => e.path === 'composition.yaml' && e.message.includes('interval'))).toBe(true);
  });

  it('should detect invalid instruments', () => {
    const invalidComp: Composition = {
      ...validComposition,
      instruments: {
        bad_inst: {
          name: "bad_inst",
          harmonics: [
            { z: -1, amplitude: 1.0 }, // negative z
            { z: 2, amplitude: 1.5 }   // amplitude > 1
          ]
        }
      },
      melodies: {
        tune: {
          ...validComposition.melodies.tune,
          instrument: "bad_inst"
        }
      }
    };

    const result = validateComposition(invalidComp);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'instruments/bad_inst.yaml' && e.message.includes('z'))).toBe(true);
    expect(result.errors.some(e => e.path === 'instruments/bad_inst.yaml' && e.message.includes('amplitude'))).toBe(true);
  });

  it('should detect invalid ADSR parameters in instruments', () => {
    const invalidComp: Composition = {
      ...validComposition,
      instruments: {
        sine: {
          name: "sine",
          harmonics: [{ z: 1, amplitude: 1.0 }],
          adsr: {
            attack: -10,
            decay: 0,
            sustain: 1.5,
            release: -50
          }
        }
      }
    };

    const result = validateComposition(invalidComp);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'instruments/sine.yaml' && e.message.includes('attack'))).toBe(true);
    expect(result.errors.some(e => e.path === 'instruments/sine.yaml' && e.message.includes('sustain'))).toBe(true);
    expect(result.errors.some(e => e.path === 'instruments/sine.yaml' && e.message.includes('release'))).toBe(true);
  });

  it('should detect invalid notes in melodies', () => {
    const invalidComp: Composition = {
      ...validComposition,
      melodies: {
        tune: {
          name: "tune",
          instrument: "sine",
          notes: [
            { pitch: 1.5, offset: 0, duration: 1 },  // non-integer pitch
            { pitch: 0, offset: -1, duration: 1 },   // negative offset
            { pitch: 0, offset: 0, duration: 0 }     // zero duration
          ]
        }
      }
    };

    const result = validateComposition(invalidComp);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'melodies/tune.yaml' && e.message.includes('pitch'))).toBe(true);
    expect(result.errors.some(e => e.path === 'melodies/tune.yaml' && e.message.includes('offset'))).toBe(true);
    expect(result.errors.some(e => e.path === 'melodies/tune.yaml' && e.message.includes('duration'))).toBe(true);
  });

  it('should detect invalid tracks', () => {
    const invalidComp: Composition = {
      ...validComposition,
      tracks: [
        {
          name: "bad_track",
          volume: 1.2, // volume > 1
          melodies: ["unknown"] // missing reference
        }
      ]
    };

    const result = validateComposition(invalidComp);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'tracks/bad_track.yaml' && e.message.includes('volume'))).toBe(true);
    expect(result.errors.some(e => e.path === 'tracks/bad_track.yaml' && e.message.includes('unknown'))).toBe(true);
  });

  it('should check for empty lists of components', () => {
    const emptyComp: Composition = {
      title: "Empty",
      tempo: 120,
      rootFrequency: 440,
      interval: 100,
      instruments: {},
      melodies: {},
      tracks: []
    };

    const result = validateComposition(emptyComp);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('at least one instrument'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('at least one melody'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('at least one track'))).toBe(true);
  });
});
