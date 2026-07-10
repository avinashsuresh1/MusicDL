import { describe, it, expect } from 'vitest';
import { parseProject } from '../src/parser/yaml-parser.js';

describe('yaml-parser', () => {
  const validFiles: Record<string, string> = {
    'composition.yaml': `
title: "Test Composition"
tempo: 100
root_frequency: 440.0
interval: 100
`,
    'instruments/synth.yaml': `
harmonics:
  - { z: 1, amplitude: 1.0 }
  - { z: 2, amplitude: 0.5 }
`,
    'melodies/lead.yaml': `
instrument: synth
notes:
  - { pitch: 0, offset: 0, duration: 1 }
  - { pitch: 4, offset: 1, duration: 1 }
  - { pitch: rest, offset: 2, duration: 1 }
`,
    'tracks/melody_track.yaml': `
volume: 0.9
melodies:
  - lead
`
  };

  it('should parse a valid project structure correctly', () => {
    const comp = parseProject(validFiles);

    expect(comp.title).toBe("Test Composition");
    expect(comp.tempo).toBe(100);
    expect(comp.rootFrequency).toBe(440.0);
    expect(comp.interval).toBe(100);

    expect(comp.instruments['synth']).toBeDefined();
    expect(comp.instruments['synth'].harmonics).toHaveLength(2);
    expect(comp.instruments['synth'].harmonics[0]).toEqual({ z: 1, amplitude: 1.0 });

    expect(comp.melodies['lead']).toBeDefined();
    expect(comp.melodies['lead'].instrument).toBe('synth');
    expect(comp.melodies['lead'].notes).toHaveLength(3);
    expect(comp.melodies['lead'].notes[0]).toEqual({ pitch: 0, offset: 0, duration: 1 });
    expect(comp.melodies['lead'].notes[2]).toEqual({ pitch: 'rest', offset: 2, duration: 1 });

    expect(comp.tracks).toHaveLength(1);
    expect(comp.tracks[0].name).toBe('melody_track');
    expect(comp.tracks[0].volume).toBe(0.9);
    expect(comp.tracks[0].melodies).toEqual(['lead']);
  });

  it('should throw an error if composition.yaml is missing', () => {
    const badFiles = { ...validFiles };
    delete badFiles['composition.yaml'];
    expect(() => parseProject(badFiles)).toThrow(/Missing 'composition.yaml'/);
  });

  it('should throw an error on unknown instrument reference', () => {
    const badFiles = {
      ...validFiles,
      'melodies/lead.yaml': `
instrument: unknown_inst
notes:
  - { pitch: 0, offset: 0, duration: 1 }
`
    };
    expect(() => parseProject(badFiles)).toThrow(/references unknown instrument 'unknown_inst'/);
  });

  it('should throw an error on unknown melody reference in track', () => {
    const badFiles = {
      ...validFiles,
      'tracks/melody_track.yaml': `
volume: 0.9
melodies:
  - unknown_melody
`
    };
    expect(() => parseProject(badFiles)).toThrow(/references unknown melody 'unknown_melody'/);
  });
});
