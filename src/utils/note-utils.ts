/**
 * Convert a pitch interval to frequency in Hz.
 * Formula: f = rootFreq × 2^(pitch × intervalCents / 1200)
 */
export function intervalToFrequency(
  pitch: number,
  rootFrequency: number,
  intervalCents: number
): number {
  return rootFrequency * Math.pow(2, (pitch * intervalCents) / 1200);
}

/**
 * Convert a frequency back to the nearest pitch interval.
 * Inverse: pitch = (1200 × log2(freq / rootFreq)) / intervalCents
 */
export function frequencyToInterval(
  frequency: number,
  rootFrequency: number,
  intervalCents: number
): number {
  return (1200 * Math.log2(frequency / rootFrequency)) / intervalCents;
}

/**
 * Check if a pitch value represents a rest (silence).
 */
export function isRest(pitch: number | 'rest'): pitch is 'rest' {
  return pitch === 'rest';
}

/**
 * Convert a beat position to time in seconds at a given tempo.
 * Formula: seconds = (beats / tempo) × 60
 */
export function beatsToSeconds(beats: number, tempo: number): number {
  return (beats / tempo) * 60;
}

/**
 * Convert a time in seconds to beat position at a given tempo.
 * Formula: beats = (seconds × tempo) / 60
 */
export function secondsToBeats(seconds: number, tempo: number): number {
  return (seconds * tempo) / 60;
}
