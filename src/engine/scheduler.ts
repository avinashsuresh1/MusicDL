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

  // 1. Calculate composition total duration from non-looping track elements
  let totalDurationBeats = 0;
  for (const track of composition.tracks) {
    if (track.melodies) {
      for (const melodyRef of track.melodies) {
        let melodyName = typeof melodyRef === 'string' ? melodyRef : melodyRef.name;
        let melodyOffset = typeof melodyRef === 'string' ? 0 : (melodyRef.offset ?? 0);
        const melody = composition.melodies[melodyName];
        if (!melody || melody.loop) {
          continue;
        }
        for (const note of melody.notes) {
          totalDurationBeats = Math.max(totalDurationBeats, melodyOffset + note.offset + note.duration);
        }
      }
    }
    if (track.chords) {
      for (const chordRef of track.chords) {
        totalDurationBeats = Math.max(totalDurationBeats, chordRef.offset + chordRef.duration);
      }
    }
  }
  if (totalDurationBeats === 0) {
    totalDurationBeats = 16; // default fallback if there are only looping elements or empty tracks
  }

  for (const track of composition.tracks) {
    // 2. Schedule melodies
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

        if (melody.loop) {
          // Calculate loop start and end beats relative to the melody itself
          const start = melody.loopStart !== undefined ? melody.loopStart : 0.0;
          let end = melody.loopEnd;
          if (end === undefined) {
            // Find max note end time
            let maxTime = 0;
            for (const note of melody.notes) {
              maxTime = Math.max(maxTime, note.offset + note.duration);
            }
            end = maxTime;
          }
          const loopLength = end - start;

          if (loopLength > 0) {
            // Divide notes into two categories:
            // 1. Introductory notes (before start)
            // 2. Looping notes (within [start, end])
            const introNotes = melody.notes.filter(n => n.offset < start);
            const loopNotes = melody.notes.filter(n => n.offset >= start && n.offset < end);

            // Schedule intro notes once
            for (const note of introNotes) {
              if (isRest(note.pitch)) continue;
              const absoluteOffset = note.offset + melodyOffset;
              const startTime = beatsToSeconds(absoluteOffset, composition.tempo);
              const duration = beatsToSeconds(note.duration, composition.tempo);
              const totalPitch = note.pitch + (instrument.octaveShift ?? 0) * 12;
              const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);
              scheduledNotes.push({
                frequency,
                startTime,
                duration,
                instrument,
                volume: track.volume
              });
            }

            // Loop notes until totalDurationBeats is reached
            let currentLoopStartBeats = start;
            while (currentLoopStartBeats + melodyOffset < totalDurationBeats) {
              for (const note of loopNotes) {
                if (isRest(note.pitch)) continue;
                // Calculate note offset relative to current loop iteration start
                const relativeOffset = note.offset - start;
                const absoluteOffset = melodyOffset + currentLoopStartBeats + relativeOffset;
                const startTime = beatsToSeconds(absoluteOffset, composition.tempo);
                const duration = beatsToSeconds(note.duration, composition.tempo);
                const totalPitch = note.pitch + (instrument.octaveShift ?? 0) * 12;
                const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);
                scheduledNotes.push({
                  frequency,
                  startTime,
                  duration,
                  instrument,
                  volume: track.volume
                });
              }
              currentLoopStartBeats += loopLength;
            }
          }
        } else {
          // Schedule all notes normally
          for (const note of melody.notes) {
            if (isRest(note.pitch)) {
              continue;
            }

            const absoluteOffset = note.offset + melodyOffset;
            const startTime = beatsToSeconds(absoluteOffset, composition.tempo);
            const duration = beatsToSeconds(note.duration, composition.tempo);
            const totalPitch = note.pitch + (instrument.octaveShift ?? 0) * 12;
            const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);

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
          const totalPitch = pitch + (instrument.octaveShift ?? 0) * 12;
          const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);

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

/**
 * Schedules a single audition note for testing an instrument's timbre.
 * Plays 1 single note at pitch 0 (root frequency, shifted by octaveShift if defined) for 1.5 seconds.
 */
export function getScheduledNotesForInstrument(instrumentName: string, composition: Composition): ScheduledNote[] {
  const instrument = composition.instruments[instrumentName];
  if (!instrument) return [];

  const totalPitch = (instrument.octaveShift ?? 0) * 12;
  const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);

  return [{
    frequency,
    startTime: 0,
    duration: 1.5,
    instrument,
    volume: 0.8
  }];
}

/**
 * Schedules notes for a single melody starting at t = 0.
 */
export function getScheduledNotesForMelody(melodyName: string, composition: Composition): ScheduledNote[] {
  const melody = composition.melodies[melodyName];
  if (!melody) return [];

  const instrument = composition.instruments[melody.instrument];
  if (!instrument) return [];

  const scheduledNotes: ScheduledNote[] = [];
  for (const note of melody.notes) {
    if (isRest(note.pitch)) continue;

    const startTime = beatsToSeconds(note.offset, composition.tempo);
    const duration = beatsToSeconds(note.duration, composition.tempo);
    const totalPitch = note.pitch + (instrument.octaveShift ?? 0) * 12;
    const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);

    scheduledNotes.push({
      frequency,
      startTime,
      duration,
      instrument,
      volume: 0.8
    });
  }

  return scheduledNotes.sort((a, b) => a.startTime - b.startTime || a.frequency - b.frequency);
}

/**
 * Schedules notes for a single chord starting at t = 0 (striking all pitches simultaneously for 2 beats).
 */
export function getScheduledNotesForChord(chordName: string, composition: Composition): ScheduledNote[] {
  const chord = composition.chords?.[chordName];
  if (!chord) return [];

  const instrument = composition.instruments[chord.instrument];
  if (!instrument) return [];

  const duration = beatsToSeconds(2.0, composition.tempo); // 2 beats preview
  const scheduledNotes: ScheduledNote[] = [];

  for (const pitch of chord.pitches) {
    const totalPitch = pitch + (instrument.octaveShift ?? 0) * 12;
    const frequency = intervalToFrequency(totalPitch, composition.rootFrequency, composition.interval);

    scheduledNotes.push({
      frequency,
      startTime: 0,
      duration,
      instrument,
      volume: 0.8
    });
  }

  return scheduledNotes;
}
