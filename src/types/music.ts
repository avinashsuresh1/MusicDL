/** A single harmonic partial in an instrument's timbre definition */
export interface Harmonic {
  /** Frequency multiplier relative to the fundamental. Can be non-integer for inharmonic partials (e.g., 2.76 for bells) */
  z: number;
  /** Amplitude of this partial, 0.0–1.0 */
  amplitude: number;
}

/** ADSR volume envelope configuration */
export interface ADSR {
  /** Attack duration in milliseconds */
  attack: number;
  /** Decay duration in milliseconds */
  decay: number;
  /** Sustain amplitude multiplier, 0.0–1.0 */
  sustain: number;
  /** Release duration in milliseconds */
  release: number;
}

/** An instrument defined by its harmonic spectrum (additive synthesis) */
export interface Instrument {
  /** Instrument name (derived from filename) */
  name: string;
  /** Array of harmonic partials that define the instrument's timbre */
  harmonics: Harmonic[];
  /** Optional volume envelope */
  adsr?: ADSR;
}

/** A single note in a melody or chord */
export interface Note {
  /** Integer interval from root frequency, or 'rest' for silence */
  pitch: number | 'rest';
  /** Global beat time — absolute position on the composition timeline */
  offset: number;
  /** Duration in beats */
  duration: number;
}

/** A named collection of notes — sequential (melody) */
export interface Melody {
  /** Melody name (derived from filename) */
  name: string;
  /** Reference to instrument name (must exist in instruments directory) */
  instrument: string;
  /** Array of notes with global beat offsets */
  notes: Note[];
}

export interface TrackMelodyRef {
  name: string;
  offset?: number;
}

export interface TrackChordRef {
  name: string;
  offset: number;
  duration: number;
}

/** A track that groups melodies and chords for playback */
export interface Track {
  /** Track name (derived from filename) */
  name: string;
  /** Volume level, 0.0–1.0 */
  volume: number;
  /** List of melodies referenced by this track, optionally with start offsets */
  melodies: (string | TrackMelodyRef)[];
  /** List of chords scheduled in this track */
  chords?: TrackChordRef[];
}

/** A chord definition (simultaneous pitches) */
export interface Chord {
  /** Chord name (derived from filename) */
  name: string;
  /** Reference to instrument name */
  instrument: string;
  /** List of pitch intervals played simultaneously */
  pitches: number[];
}

/** Complete composition model assembled from all YAML files in a project directory */
export interface Composition {
  /** Composition title */
  title: string;
  /** Tempo in beats per minute */
  tempo: number;
  /** Frequency in Hz of pitch 0 (the root note) */
  rootFrequency: number;
  /** Size of one pitch step in cents (default 100 = 1 semitone in 12-TET) */
  interval: number;
  /** Map of instrument name → Instrument */
  instruments: Record<string, Instrument>;
  /** Map of melody name → Melody */
  melodies: Record<string, Melody>;
  /** Map of chord name → Chord */
  chords?: Record<string, Chord>;
  /** Ordered list of tracks */
  tracks: Track[];
}

/** A note scheduled for playback with all references resolved */
export interface ScheduledNote {
  /** Frequency in Hz (already computed from pitch + root + interval) */
  frequency: number;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** The instrument to use for this note */
  instrument: Instrument;
  /** Volume from the track (0.0–1.0) */
  volume: number;
}
