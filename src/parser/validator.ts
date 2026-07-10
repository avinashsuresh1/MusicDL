import type { Composition, Instrument, Melody, Track, Chord } from '../types/music.js';

export interface ValidationError {
  /** Which file or component the error is in */
  path: string;
  /** Human-readable error message */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a single instrument.
 */
export function validateInstrument(instrument: Instrument, name: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `instruments/${name}.yaml`;

  if (!instrument.harmonics || !Array.isArray(instrument.harmonics) || instrument.harmonics.length === 0) {
    errors.push({ path, message: `Instrument '${name}' must have at least one harmonic` });
    return errors;
  }

  instrument.harmonics.forEach((h, idx) => {
    if (typeof h.z !== 'number' || isNaN(h.z) || h.z <= 0) {
      errors.push({ path, message: `Instrument '${name}': harmonic[${idx}] 'z' must be a positive number, got ${h.z}` });
    }
    if (typeof h.amplitude !== 'number' || isNaN(h.amplitude) || h.amplitude < 0 || h.amplitude > 1) {
      errors.push({ path, message: `Instrument '${name}': harmonic[${idx}] 'amplitude' must be between 0.0 and 1.0, got ${h.amplitude}` });
    }
  });

  if (instrument.adsr) {
    const adsr = instrument.adsr;
    if (typeof adsr.attack !== 'number' || isNaN(adsr.attack) || adsr.attack < 0) {
      errors.push({ path, message: `Instrument '${name}': ADSR 'attack' must be a non-negative number, got ${adsr.attack}` });
    }
    if (typeof adsr.decay !== 'number' || isNaN(adsr.decay) || adsr.decay < 0) {
      errors.push({ path, message: `Instrument '${name}': ADSR 'decay' must be a non-negative number, got ${adsr.decay}` });
    }
    if (typeof adsr.sustain !== 'number' || isNaN(adsr.sustain) || adsr.sustain < 0 || adsr.sustain > 1) {
      errors.push({ path, message: `Instrument '${name}': ADSR 'sustain' must be between 0.0 and 1.0, got ${adsr.sustain}` });
    }
    if (typeof adsr.release !== 'number' || isNaN(adsr.release) || adsr.release < 0) {
      errors.push({ path, message: `Instrument '${name}': ADSR 'release' must be a non-negative number, got ${adsr.release}` });
    }
  }

  return errors;
}

/**
 * Validate a single melody.
 */
export function validateMelody(
  melody: Melody,
  name: string,
  instruments: Record<string, Instrument>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `melodies/${name}.yaml`;

  if (!melody.instrument) {
    errors.push({ path, message: `Melody '${name}' must specify an 'instrument'` });
  } else if (!instruments[melody.instrument]) {
    errors.push({ path, message: `Melody '${name}' references unknown instrument '${melody.instrument}'` });
  }

  if (!melody.notes || !Array.isArray(melody.notes) || melody.notes.length === 0) {
    errors.push({ path, message: `Melody '${name}' must have at least one note` });
    return errors;
  }

  melody.notes.forEach((note, idx) => {
    if (note.pitch !== 'rest' && (typeof note.pitch !== 'number' || !Number.isInteger(note.pitch))) {
      errors.push({ path, message: `Melody '${name}': note[${idx}] 'pitch' must be an integer or 'rest', got ${note.pitch}` });
    }
    if (typeof note.offset !== 'number' || isNaN(note.offset) || note.offset < 0) {
      errors.push({ path, message: `Melody '${name}': note[${idx}] 'offset' must be a non-negative number, got ${note.offset}` });
    }
    if (typeof note.duration !== 'number' || isNaN(note.duration) || note.duration <= 0) {
      errors.push({ path, message: `Melody '${name}': note[${idx}] 'duration' must be a positive number, got ${note.duration}` });
    }
  });

  return errors;
}

/**
 * Validate a single track.
 */
export function validateTrack(
  track: Track,
  name: string,
  melodies: Record<string, Melody>,
  chords: Record<string, Chord> = {}
): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `tracks/${name}.yaml`;

  if (typeof track.volume !== 'number' || isNaN(track.volume) || track.volume < 0 || track.volume > 1) {
    errors.push({ path, message: `Track '${name}': 'volume' must be between 0.0 and 1.0, got ${track.volume}` });
  }

  const hasMelodies = track.melodies && Array.isArray(track.melodies) && track.melodies.length > 0;
  const hasChords = track.chords && Array.isArray(track.chords) && track.chords.length > 0;

  if (!hasMelodies && !hasChords) {
    errors.push({ path, message: `Track '${name}' must have at least one melody reference or chord reference` });
    return errors;
  }

  if (track.melodies) {
    track.melodies.forEach((melRef, idx) => {
      if (typeof melRef === 'string') {
        if (!melRef.trim()) {
          errors.push({ path, message: `Track '${name}': melodies[${idx}] must be a non-empty string` });
        } else if (!melodies[melRef]) {
          errors.push({ path, message: `Track '${name}' references unknown melody '${melRef}'` });
        }
      } else if (melRef && typeof melRef === 'object' && typeof melRef.name === 'string') {
        if (!melRef.name.trim()) {
          errors.push({ path, message: `Track '${name}': melodies[${idx}] 'name' must be a non-empty string` });
        } else if (!melodies[melRef.name]) {
          errors.push({ path, message: `Track '${name}' references unknown melody '${melRef.name}'` });
        }
        if (typeof melRef.offset !== 'number' || isNaN(melRef.offset) || melRef.offset < 0) {
          errors.push({ path, message: `Track '${name}': melodies[${idx}] 'offset' must be a non-negative number` });
        }
      } else {
        errors.push({ path, message: `Track '${name}': melodies[${idx}] must be a string or a valid melody reference object` });
      }
    });
  }

  if (track.chords) {
    track.chords.forEach((chordRef, idx) => {
      if (!chordRef || typeof chordRef !== 'object' || typeof chordRef.name !== 'string') {
        errors.push({ path, message: `Track '${name}': chords[${idx}] must be a valid chord reference object` });
      } else {
        if (!chords[chordRef.name]) {
          errors.push({ path, message: `Track '${name}' references unknown chord '${chordRef.name}'` });
        }
        if (typeof chordRef.offset !== 'number' || isNaN(chordRef.offset) || chordRef.offset < 0) {
          errors.push({ path, message: `Track '${name}': chords[${idx}] 'offset' must be a non-negative number` });
        }
        if (typeof chordRef.duration !== 'number' || isNaN(chordRef.duration) || chordRef.duration <= 0) {
          errors.push({ path, message: `Track '${name}': chords[${idx}] 'duration' must be a positive number` });
        }
      }
    });
  }

  return errors;
}

/**
 * Validate a single chord.
 */
export function validateChord(chord: Chord, name: string, instruments: Record<string, Instrument>): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `chords/${name}.yaml`;

  if (typeof chord.instrument !== 'string' || !chord.instrument.trim()) {
    errors.push({ path, message: `Chord '${name}': 'instrument' must be a non-empty string` });
  } else if (!instruments[chord.instrument]) {
    errors.push({ path, message: `Chord '${name}' references unknown instrument '${chord.instrument}'` });
  }

  if (!chord.pitches || !Array.isArray(chord.pitches) || chord.pitches.length === 0) {
    errors.push({ path, message: `Chord '${name}' must define at least one pitch` });
  } else {
    chord.pitches.forEach((p, idx) => {
      if (typeof p !== 'number' || isNaN(p) || !Number.isInteger(p)) {
        errors.push({ path, message: `Chord '${name}': pitches[${idx}] must be an integer, got ${p}` });
      }
    });
  }

  return errors;
}

/**
 * Validate a full Composition.
 */
export function validateComposition(composition: Composition): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Composition metadata
  const metaPath = 'composition.yaml';
  if (!composition.title || typeof composition.title !== 'string' || !composition.title.trim()) {
    errors.push({ path: metaPath, message: "Composition 'title' must be a non-empty string" });
  }

  if (typeof composition.tempo !== 'number' || isNaN(composition.tempo) || composition.tempo <= 0) {
    errors.push({ path: metaPath, message: `Composition 'tempo' must be a positive number, got ${composition.tempo}` });
  }

  if (typeof composition.rootFrequency !== 'number' || isNaN(composition.rootFrequency) || composition.rootFrequency <= 0) {
    errors.push({ path: metaPath, message: `Composition 'rootFrequency' must be a positive number, got ${composition.rootFrequency}` });
  }

  if (typeof composition.interval !== 'number' || isNaN(composition.interval) || composition.interval <= 0) {
    errors.push({ path: metaPath, message: `Composition 'interval' must be a positive number, got ${composition.interval}` });
  }

  // 2. Minimum entity checks
  const instCount = Object.keys(composition.instruments || {}).length;
  const melCount = Object.keys(composition.melodies || {}).length;
  const chordCount = Object.keys(composition.chords || {}).length;
  const trackCount = (composition.tracks || []).length;

  if (instCount === 0) {
    errors.push({ path: 'project', message: 'Composition must define at least one instrument' });
  }
  if (melCount === 0 && chordCount === 0) {
    errors.push({ path: 'project', message: 'Composition must define at least one melody or chord' });
  }
  if (trackCount === 0) {
    errors.push({ path: 'project', message: 'Composition must define at least one track' });
  }

  // 3. Instruments validation
  if (composition.instruments) {
    for (const [name, inst] of Object.entries(composition.instruments)) {
      errors.push(...validateInstrument(inst, name));
    }
  }

  // 4. Melodies validation
  if (composition.melodies) {
    for (const [name, mel] of Object.entries(composition.melodies)) {
      errors.push(...validateMelody(mel, name, composition.instruments || {}));
    }
  }

  // 5. Chords validation
  if (composition.chords) {
    for (const [name, chord] of Object.entries(composition.chords)) {
      errors.push(...validateChord(chord, name, composition.instruments || {}));
    }
  }

  // 6. Tracks validation
  if (composition.tracks) {
    composition.tracks.forEach(track => {
      errors.push(...validateTrack(track, track.name, composition.melodies || {}, composition.chords || {}));
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
