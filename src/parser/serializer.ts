import * as yaml from 'js-yaml';
import type { Composition, Instrument, Melody, Track, Chord } from '../types/music.js';

/**
 * Convert metadata of composition into YAML.
 */
export function serializeCompositionMeta(composition: Composition): string {
  const data = {
    title: composition.title,
    tempo: composition.tempo,
    root_frequency: composition.rootFrequency,
    interval: composition.interval
  };
  return yaml.dump(data, { indent: 2 });
}

/**
 * Convert a single instrument into YAML.
 */
export function serializeInstrument(instrument: Instrument): string {
  const data: any = {
    harmonics: instrument.harmonics.map(h => ({
      z: h.z,
      amplitude: h.amplitude
    }))
  };
  if (instrument.adsr) {
    data.adsr = {
      attack: instrument.adsr.attack,
      decay: instrument.adsr.decay,
      sustain: instrument.adsr.sustain,
      release: instrument.adsr.release
    };
  }
  return yaml.dump(data, { indent: 2 });
}

/**
 * Convert a single melody into YAML with flow-style notes.
 */
export function serializeMelody(melody: Melody): string {
  const header: any = {
    instrument: melody.instrument
  };
  if (melody.loop !== undefined) header.loop = melody.loop;
  if (melody.loopStart !== undefined) header.loop_start = melody.loopStart;
  if (melody.loopEnd !== undefined) header.loop_end = melody.loopEnd;
  
  let output = yaml.dump(header, { indent: 2 });
  
  if (melody.notes.length === 0) {
    output += 'notes: []\n';
  } else {
    output += 'notes:\n';
    
    // Check if the notes are strictly sequential (i.e. start at 0 and have no gaps or overlaps)
    let isSequential = true;
    let expectedOffset = 0;
    for (const note of melody.notes) {
      if (note.offset === undefined || Math.abs(note.offset - expectedOffset) > 0.0001) {
        isSequential = false;
        break;
      }
      expectedOffset += note.duration;
    }

    for (const note of melody.notes) {
      const pitchVal = note.pitch === 'rest' ? 'rest' : note.pitch;
      if (isSequential) {
        output += `  - { pitch: ${pitchVal}, duration: ${note.duration} }\n`;
      } else {
        output += `  - { pitch: ${pitchVal}, offset: ${note.offset}, duration: ${note.duration} }\n`;
      }
    }
  }
  return output;
}

/**
 * Convert a single track into YAML.
 */
export function serializeTrack(track: Track): string {
  const data: any = {
    volume: track.volume,
    melodies: track.melodies
  };
  if (track.chords && track.chords.length > 0) {
    data.chords = track.chords;
  }
  return yaml.dump(data, { indent: 2 });
}

/**
 * Convert a single chord into YAML.
 */
export function serializeChord(chord: Chord): string {
  const data = {
    instrument: chord.instrument,
    pitches: chord.pitches
  };
  return yaml.dump(data, { indent: 2, flowLevel: 1 });
}

/**
 * Convert a Composition model back to a file tree map.
 */
export function serializeProject(composition: Composition): Record<string, string> {
  const files: Record<string, string> = {};

  files['composition.yaml'] = serializeCompositionMeta(composition);

  for (const [name, inst] of Object.entries(composition.instruments)) {
    files[`instruments/${name}.yaml`] = serializeInstrument(inst);
  }

  for (const [name, mel] of Object.entries(composition.melodies)) {
    files[`melodies/${name}.yaml`] = serializeMelody(mel);
  }

  if (composition.chords) {
    for (const [name, chord] of Object.entries(composition.chords)) {
      files[`chords/${name}.yaml`] = serializeChord(chord);
    }
  }

  for (const track of composition.tracks) {
    files[`tracks/${track.name}.yaml`] = serializeTrack(track);
  }

  return files;
}
