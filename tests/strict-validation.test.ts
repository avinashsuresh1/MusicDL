import { describe, it, expect } from 'vitest';
import { parseProject } from '../src/parser/yaml-parser.js';

describe('strict-validation', () => {
  const baseValidFiles: Record<string, string> = {
    'composition.yaml': `
title: "Test Composition"
tempo: 100
root_frequency: 440.0
interval: 100
`,
    'instruments/synth.yaml': `
harmonics:
  - { z: 1, amplitude: 1.0 }
`,
    'melodies/lead.yaml': `
instrument: synth
notes:
  - { pitch: 0, offset: 0, duration: 1 }
`,
    'tracks/melody_track.yaml': `
volume: 0.9
melodies:
  - lead
`
  };

  it('should throw an error on misspelled composition metadata parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'composition.yaml': `
title: "Test Composition"
tempo: 100
root_frequency: 440.0
interval: 100
tempo_wrong: 120
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'tempo_wrong'/);
  });

  it('should throw an error on misspelled instrument parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'instruments/synth.yaml': `
harmonics:
  - { z: 1, amplitude: 1.0 }
adsr_wrong:
  attack: 10
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'adsr_wrong'/);
  });

  it('should throw an error on misspelled instrument ADSR parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'instruments/synth.yaml': `
harmonics:
  - { z: 1, amplitude: 1.0 }
adsr:
  attack: 10
  decay: 50
  sustain: 0.8
  release: 100
  release_wrong: 10
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'release_wrong'/);
  });

  it('should throw an error on misspelled melody parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'melodies/lead.yaml': `
instrument: synth
notes:
  - { pitch: 0, offset: 0, duration: 1 }
melody_wrong: true
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'melody_wrong'/);
  });

  it('should throw an error on misspelled melody note parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'melodies/lead.yaml': `
instrument: synth
notes:
  - { pitch: 0, offset: 0, duration: 1, offset_wrong: 5 }
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'offset_wrong'/);
  });

  it('should throw an error on misspelled track parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'tracks/melody_track.yaml': `
volume: 0.9
melodies:
  - lead
track_wrong: true
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'track_wrong'/);
  });

  it('should throw an error on misspelled chords parameters', () => {
    const badFiles = {
      ...baseValidFiles,
      'chords/c_maj.yaml': `
instrument: synth
pitches: [0, 4, 7]
chord_wrong: true
`
    };
    expect(() => parseProject(badFiles)).toThrow(/Unrecognized parameter 'chord_wrong'/);
  });
});
