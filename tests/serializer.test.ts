import { describe, it, expect } from 'vitest';
import { serializeProject } from '../src/parser/serializer.js';
import { parseProject } from '../src/parser/yaml-parser.js';
import type { Composition } from '../src/types/music.js';

describe('serializer', () => {
  const originalComp: Composition = {
    title: "Roundtrip test",
    tempo: 105,
    rootFrequency: 440,
    interval: 100,
    instruments: {
      flute: {
        name: "flute",
        harmonics: [
          { z: 1, amplitude: 1.0 },
          { z: 2.5, amplitude: 0.4 }
        ],
        adsr: {
          attack: 100,
          decay: 200,
          sustain: 0.7,
          release: 400
        }
      }
    },
    melodies: {
      lead: {
        name: "lead",
        instrument: "flute",
        notes: [
          { pitch: 0, offset: 0, duration: 1 },
          { pitch: 'rest', offset: 1.5, duration: 0.5 },
          { pitch: 12, offset: 2, duration: 2 }
        ]
      }
    },
    tracks: [
      {
        name: "melody_track",
        volume: 0.75,
        melodies: ["lead"]
      }
    ]
  };

  it('should serialize a composition into the correct file paths', () => {
    const files = serializeProject(originalComp);

    expect(files['composition.yaml']).toBeDefined();
    expect(files['instruments/flute.yaml']).toBeDefined();
    expect(files['melodies/lead.yaml']).toBeDefined();
    expect(files['tracks/melody_track.yaml']).toBeDefined();

    expect(files['composition.yaml']).toContain('title: Roundtrip test');
    expect(files['composition.yaml']).toContain('tempo: 105');
    expect(files['composition.yaml']).toContain('root_frequency: 440');

    expect(files['instruments/flute.yaml']).toContain('z: 1');
    expect(files['instruments/flute.yaml']).toContain('z: 2.5');
    expect(files['instruments/flute.yaml']).toContain('attack: 100');
    expect(files['instruments/flute.yaml']).toContain('decay: 200');
    expect(files['instruments/flute.yaml']).toContain('sustain: 0.7');
    expect(files['instruments/flute.yaml']).toContain('release: 400');

    // Verify notes are serialized flow-style (inline `{ pitch: ... }`)
    expect(files['melodies/lead.yaml']).toContain('- { pitch: 0, offset: 0, duration: 1 }');
    expect(files['melodies/lead.yaml']).toContain('- { pitch: rest, offset: 1.5, duration: 0.5 }');
    expect(files['melodies/lead.yaml']).toContain('- { pitch: 12, offset: 2, duration: 2 }');

    expect(files['tracks/melody_track.yaml']).toContain('volume: 0.75');
    expect(files['tracks/melody_track.yaml']).toContain('- lead');
  });

  it('should support full roundtrip parsing and serialization without losing information', () => {
    const files = serializeProject(originalComp);
    const parsedComp = parseProject(files);

    expect(parsedComp.title).toBe(originalComp.title);
    expect(parsedComp.tempo).toBe(originalComp.tempo);
    expect(parsedComp.rootFrequency).toBe(originalComp.rootFrequency);
    expect(parsedComp.interval).toBe(originalComp.interval);

    expect(parsedComp.instruments['flute']).toEqual(originalComp.instruments['flute']);
    expect(parsedComp.melodies['lead']).toEqual(originalComp.melodies['lead']);
    expect(parsedComp.tracks).toEqual(originalComp.tracks);
  });

  it('should serialize strictly sequential melodies without the offset key', () => {
    const sequentialComp: Composition = {
      ...originalComp,
      melodies: {
        lead: {
          name: "lead",
          instrument: "flute",
          notes: [
            { pitch: 0, offset: 0, duration: 1.0 },
            { pitch: 4, offset: 1.0, duration: 1.5 },
            { pitch: 7, offset: 2.5, duration: 2.0 }
          ]
        }
      }
    };
    const files = serializeProject(sequentialComp);
    const melodyYaml = files['melodies/lead.yaml'];

    // Verify it does NOT contain 'offset:' keys
    expect(melodyYaml).toContain('- { pitch: 0, duration: 1 }');
    expect(melodyYaml).toContain('- { pitch: 4, duration: 1.5 }');
    expect(melodyYaml).toContain('- { pitch: 7, duration: 2 }');
    expect(melodyYaml).not.toContain('offset:');
  });
});
