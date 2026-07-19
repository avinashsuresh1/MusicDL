import * as yaml from 'js-yaml';
import type { Composition, Instrument, Melody, Track, Note, Harmonic, Chord } from '../types/music.js';

/**
 * Normalizes relative file paths to use forward slashes and removes leading slashes.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

export function validateObjectKeys(obj: any, expectedKeys: Set<string>, errorPrefix: string) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const key of Object.keys(obj)) {
    if (!expectedKeys.has(key)) {
      throw new Error(`${errorPrefix}: Unrecognized parameter '${key}'`);
    }
  }
}

/**
 * Parse composition metadata from composition.yaml.
 */
export function parseCompositionMeta(yamlContent: string): {
  title: string;
  tempo: number;
  rootFrequency: number;
  interval: number;
} {
  const data = yaml.load(yamlContent) as any;
  if (!data) {
    throw new Error('composition.yaml is empty or invalid');
  }

  validateObjectKeys(data, new Set(['title', 'tempo', 'root_frequency', 'interval']), 'composition.yaml');

  if (typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error("composition.yaml: 'title' must be a non-empty string");
  }

  if (typeof data.tempo !== 'number' || isNaN(data.tempo) || data.tempo <= 0) {
    throw new Error("composition.yaml: 'tempo' must be a positive number");
  }

  if (typeof data.root_frequency !== 'number' || isNaN(data.root_frequency) || data.root_frequency <= 0) {
    throw new Error("composition.yaml: 'root_frequency' must be a positive number");
  }

  const interval = typeof data.interval === 'number' ? data.interval : 100;
  if (isNaN(interval) || interval <= 0) {
    throw new Error("composition.yaml: 'interval' must be a positive number");
  }

  return {
    title: data.title,
    tempo: data.tempo,
    rootFrequency: data.root_frequency,
    interval
  };
}

/**
 * Parse a single instrument from YAML content.
 */
export function parseInstrument(yamlContent: string, name: string): Instrument {
  const data = yaml.load(yamlContent) as any;
  if (!data || !Array.isArray(data.harmonics)) {
    throw new Error(`Instrument '${name}' must have a 'harmonics' list`);
  }

  validateObjectKeys(data, new Set(['harmonics', 'adsr']), `Instrument '${name}'`);

  const harmonics: Harmonic[] = data.harmonics.map((h: any, idx: number) => {
    validateObjectKeys(h, new Set(['z', 'amplitude']), `Instrument '${name}': harmonic[${idx}]`);
    if (typeof h.z !== 'number' || isNaN(h.z) || h.z <= 0) {
      throw new Error(`Instrument '${name}': harmonic[${idx}] 'z' must be a positive number`);
    }
    if (typeof h.amplitude !== 'number' || isNaN(h.amplitude) || h.amplitude < 0 || h.amplitude > 1) {
      throw new Error(`Instrument '${name}': harmonic[${idx}] 'amplitude' must be a number between 0.0 and 1.0`);
    }
    return {
      z: h.z,
      amplitude: h.amplitude
    };
  });

  const instrument: Instrument = { name, harmonics };

  if (data.adsr) {
    validateObjectKeys(data.adsr, new Set(['attack', 'decay', 'sustain', 'release']), `Instrument '${name}': adsr`);
    if (
      typeof data.adsr.attack !== 'number' || isNaN(data.adsr.attack) || data.adsr.attack < 0 ||
      typeof data.adsr.decay !== 'number' || isNaN(data.adsr.decay) || data.adsr.decay < 0 ||
      typeof data.adsr.sustain !== 'number' || isNaN(data.adsr.sustain) || data.adsr.sustain < 0 || data.adsr.sustain > 1 ||
      typeof data.adsr.release !== 'number' || isNaN(data.adsr.release) || data.adsr.release < 0
    ) {
      throw new Error(`Instrument '${name}': invalid 'adsr' parameters`);
    }
    instrument.adsr = {
      attack: data.adsr.attack,
      decay: data.adsr.decay,
      sustain: data.adsr.sustain,
      release: data.adsr.release
    };
  }

  return instrument;
}

/**
 * Parse a single melody from YAML content.
 */
export function parseMelody(yamlContent: string, name: string): Melody {
  const data = yaml.load(yamlContent) as any;
  if (!data) {
    throw new Error(`Melody '${name}' is empty or invalid`);
  }

  validateObjectKeys(data, new Set(['type', 'instrument', 'notes', 'loop', 'loop_start', 'loop_end']), `Melody '${name}'`);

  if (typeof data.instrument !== 'string' || !data.instrument.trim()) {
    throw new Error(`Melody '${name}': 'instrument' must be a non-empty string`);
  }

  if (!Array.isArray(data.notes)) {
    throw new Error(`Melody '${name}': 'notes' must be a list`);
  }

  let currentOffset = 0;
  const notes: Note[] = data.notes.map((n: any, idx: number) => {
    validateObjectKeys(n, new Set(['pitch', 'offset', 'duration']), `Melody '${name}': note[${idx}]`);
    let pitch: number | 'rest';
    if (n.pitch === 'rest') {
      pitch = 'rest';
    } else if (typeof n.pitch === 'number' && Number.isInteger(n.pitch)) {
      pitch = n.pitch;
    } else {
      throw new Error(`Melody '${name}': note[${idx}] 'pitch' must be an integer or 'rest'`);
    }

    let offset = n.offset;
    if (offset !== undefined) {
      if (typeof offset !== 'number' || isNaN(offset) || offset < 0) {
        throw new Error(`Melody '${name}': note[${idx}] 'offset' must be a non-negative number`);
      }
      currentOffset = offset;
    } else {
      offset = currentOffset;
    }

    if (typeof n.duration !== 'number' || isNaN(n.duration) || n.duration <= 0) {
      throw new Error(`Melody '${name}': note[${idx}] 'duration' must be a positive number`);
    }

    currentOffset = offset + n.duration;

    return {
      pitch,
      offset,
      duration: n.duration
    };
  });

  const loop = data.loop !== undefined ? Boolean(data.loop) : undefined;
  const loopStart = typeof data.loop_start === 'number' ? data.loop_start : undefined;
  const loopEnd = typeof data.loop_end === 'number' ? data.loop_end : undefined;

  return {
    name,
    instrument: data.instrument,
    notes,
    ...(loop !== undefined && { loop }),
    ...(loopStart !== undefined && { loopStart }),
    ...(loopEnd !== undefined && { loopEnd })
  };
}

/**
 * Parse a single track from YAML content.
 */
export function parseTrack(yamlContent: string, name: string): Track {
  const data = yaml.load(yamlContent) as any;
  if (!data) {
    throw new Error(`Track '${name}' is empty or invalid`);
  }

  validateObjectKeys(data, new Set(['volume', 'melodies', 'chords']), `Track '${name}'`);

  if (typeof data.volume !== 'number' || isNaN(data.volume) || data.volume < 0 || data.volume > 1) {
    throw new Error(`Track '${name}': 'volume' must be a number between 0.0 and 1.0`);
  }

  if (data.melodies !== undefined && !Array.isArray(data.melodies)) {
    throw new Error(`Track '${name}': 'melodies' must be a list`);
  }

  const melodies: (string | { name: string; offset: number })[] = [];
  if (data.melodies) {
    data.melodies.forEach((m: any, idx: number) => {
      if (typeof m === 'string') {
        if (!m.trim()) {
          throw new Error(`Track '${name}': melodies[${idx}] must be a non-empty string`);
        }
        melodies.push(m.trim());
      } else if (m && typeof m === 'object' && typeof m.name === 'string') {
        validateObjectKeys(m, new Set(['name', 'offset']), `Track '${name}': melodies[${idx}]`);
        if (typeof m.offset !== 'number' || isNaN(m.offset) || m.offset < 0) {
          throw new Error(`Track '${name}': melodies[${idx}] 'offset' must be a non-negative number`);
        }
        melodies.push({
          name: m.name.trim(),
          offset: m.offset
        });
      } else {
        throw new Error(`Track '${name}': melodies[${idx}] must be a string or a valid melody reference object`);
      }
    });
  }

  const track: Track = { name, volume: data.volume, melodies };

  if (data.chords !== undefined) {
    if (!Array.isArray(data.chords)) {
      throw new Error(`Track '${name}': 'chords' must be a list`);
    }
    track.chords = data.chords.map((c: any, idx: number) => {
      if (!c || typeof c !== 'object' || typeof c.name !== 'string') {
        throw new Error(`Track '${name}': chords[${idx}] must be a valid chord reference object`);
      }
      validateObjectKeys(c, new Set(['name', 'offset', 'duration']), `Track '${name}': chords[${idx}]`);
      if (typeof c.offset !== 'number' || isNaN(c.offset) || c.offset < 0) {
        throw new Error(`Track '${name}': chords[${idx}] 'offset' must be a non-negative number`);
      }
      if (typeof c.duration !== 'number' || isNaN(c.duration) || c.duration <= 0) {
        throw new Error(`Track '${name}': chords[${idx}] 'duration' must be a positive number`);
      }
      return {
        name: c.name.trim(),
        offset: c.offset,
        duration: c.duration
      };
    });
  }

  return track;
}

/**
 * Parse a single chord from YAML content.
 */
export function parseChord(yamlContent: string, name: string): Chord {
  const data = yaml.load(yamlContent) as any;
  if (!data) {
    throw new Error(`Chord '${name}' is empty or invalid`);
  }

  validateObjectKeys(data, new Set(['instrument', 'pitches']), `Chord '${name}'`);

  if (typeof data.instrument !== 'string' || !data.instrument.trim()) {
    throw new Error(`Chord '${name}': 'instrument' must be a non-empty string`);
  }

  if (!Array.isArray(data.pitches)) {
    throw new Error(`Chord '${name}': 'pitches' must be an array of numbers`);
  }

  const pitches = data.pitches.map((p: any, idx: number) => {
    if (typeof p !== 'number' || isNaN(p) || !Number.isInteger(p)) {
      throw new Error(`Chord '${name}': pitch[${idx}] must be an integer, got ${p}`);
    }
    return p;
  });

  return {
    name,
    instrument: data.instrument.trim(),
    pitches
  };
}

/**
 * Parse a full MusicDL project directory map into a Composition model.
 */
export function parseProject(files: Record<string, string>): Composition {
  const normalizedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    normalizedFiles[normalizePath(path)] = content;
  }

  const metaContent = normalizedFiles['composition.yaml'];
  if (metaContent === undefined) {
    throw new Error("Missing 'composition.yaml' in project files");
  }

  let meta;
  try {
    meta = parseCompositionMeta(metaContent);
  } catch (err: any) {
    throw new Error(`In composition.yaml: ${err.message}`);
  }

  const instruments: Record<string, Instrument> = {};
  const melodies: Record<string, Melody> = {};
  const chords: Record<string, Chord> = {};
  const tracks: Track[] = [];

  // Regex patterns to capture entity name from filenames
  const instrumentRegex = /^instruments\/([^\/]+)\.ya?ml$/i;
  const melodyRegex = /^melodies\/([^\/]+)\.ya?ml$/i;
  const chordRegex = /^chords\/([^\/]+)\.ya?ml$/i;
  const trackRegex = /^tracks\/([^\/]+)\.ya?ml$/i;

  for (const [path, content] of Object.entries(normalizedFiles)) {
    const instMatch = path.match(instrumentRegex);
    if (instMatch) {
      const name = instMatch[1];
      try {
        instruments[name] = parseInstrument(content, name);
      } catch (err: any) {
        throw new Error(`In ${path}: ${err.message}`);
      }
      continue;
    }

    const melMatch = path.match(melodyRegex);
    if (melMatch) {
      const name = melMatch[1];
      try {
        melodies[name] = parseMelody(content, name);
      } catch (err: any) {
        throw new Error(`In ${path}: ${err.message}`);
      }
      continue;
    }

    const chordMatch = path.match(chordRegex);
    if (chordMatch) {
      const name = chordMatch[1];
      try {
        chords[name] = parseChord(content, name);
      } catch (err: any) {
        throw new Error(`In ${path}: ${err.message}`);
      }
      continue;
    }

    const trackMatch = path.match(trackRegex);
    if (trackMatch) {
      const name = trackMatch[1];
      try {
        tracks.push(parseTrack(content, name));
      } catch (err: any) {
        throw new Error(`In ${path}: ${err.message}`);
      }
      continue;
    }
  }

  // Cross-reference checks
  for (const [melName, melody] of Object.entries(melodies)) {
    if (!instruments[melody.instrument]) {
      throw new Error(`Melody '${melName}' references unknown instrument '${melody.instrument}'`);
    }
  }

  for (const [chordName, chord] of Object.entries(chords)) {
    if (!instruments[chord.instrument]) {
      throw new Error(`Chord '${chordName}' references unknown instrument '${chord.instrument}'`);
    }
  }

  for (const track of tracks) {
    for (const melRef of track.melodies) {
      const melName = typeof melRef === 'string' ? melRef : melRef.name;
      if (!melodies[melName]) {
        throw new Error(`Track '${track.name}' references unknown melody '${melName}'`);
      }
    }
    if (track.chords) {
      for (const chordRef of track.chords) {
        if (!chords[chordRef.name]) {
          throw new Error(`Track '${track.name}' references unknown chord '${chordRef.name}'`);
        }
      }
    }
  }

  return {
    title: meta.title,
    tempo: meta.tempo,
    rootFrequency: meta.rootFrequency,
    interval: meta.interval,
    instruments,
    melodies,
    chords,
    tracks
  };
}
