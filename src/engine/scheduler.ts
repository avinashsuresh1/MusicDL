import type { Composition, ScheduledNote } from '../types/music.js';
import { intervalToFrequency, beatsToSeconds, isRest } from '../utils/note-utils.js';

/**
 * Resolves a full composition into a sorted flat array of scheduled notes.
 * Converts beats and offsets to seconds, pitches to frequencies, and filters out rests.
 */
export function getScheduledNotes(composition: Composition): ScheduledNote[] {
  const scheduledNotes: ScheduledNotesWithVolume[] = [];

  // Helper type to store scheduling info with track volume before finalizing
  interface ScheduledNotesWithVolume {
    frequency: number;
    startTime: number;
    duration: number;
    instrument: any;
    volume: number;
  }

  for (const track of composition.tracks) {
    // 1. Schedule melodies
    if (track.melodies) {
      for (const melodyRef of track.melodies) {
        let melodyName: string;
        let melodyOffset = 0;

        if (typeof melodyRef === 'string') {
          melodyName = melodyRef;
        } else if (melodyRef && typeof melodyRef === 'object' && typeof melodyRef.name === 'string') {
          melodyName = melodyRef.name;
          melodyOffset = typeof melodyRef.offset === 'number' ? melodyRef.offset : 0;
        } else {
          continue;
        }

        const melody = composition.melodies[melodyName];
        if (!melody) {
          continue;
        }

        const instrument = composition.instruments[melody.instrument];
        if (!instrument) {
          continue;
        }

        for (const note of melody.notes) {
          if (isRest(note.pitch)) {
            continue;
          }

          const absoluteOffset = note.offset + melodyOffset;
          const startTime = beatsToSeconds(absoluteOffset, composition.tempo);
          const duration = beatsToSeconds(note.duration, composition.tempo);
          const frequency = intervalToFrequency(note.pitch, composition.rootFrequency, composition.interval);

          scheduledNotes.push({
            frequency,
            startTime,
            duration,
            instrument,
            volume: track.volume
          });
        }
      }
    }

    // 2. Schedule chords
    if (track.chords && composition.chords) {
      for (const chordRef of track.chords) {
        const chord = composition.chords[chordRef.name];
        if (!chord) {
          continue;
        }

        const instrument = composition.instruments[chord.instrument];
        if (!instrument) {
          continue;
        }

        for (const pitch of chord.pitches) {
          const startTime = beatsToSeconds(chordRef.offset, composition.tempo);
          const duration = beatsToSeconds(chordRef.duration, composition.tempo);
          const frequency = intervalToFrequency(pitch, composition.rootFrequency, composition.interval);

          scheduledNotes.push({
            frequency,
            startTime,
            duration,
            instrument,
            volume: track.volume
          });
        }
      }
    }
  }

  // Sort notes by start time (and then by frequency to make it deterministic)
  return (scheduledNotes as ScheduledNote[]).sort((a, b) => {
    if (Math.abs(a.startTime - b.startTime) > 0.0001) {
      return a.startTime - b.startTime;
    }
    return a.frequency - b.frequency;
  });
}
