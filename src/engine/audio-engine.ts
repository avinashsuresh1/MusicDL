import type { Composition, ScheduledNote } from '../types/music.js';
import { getScheduledNotes } from './scheduler.js';
import { playNote, ActiveNoteNodes } from './synthesizer.js';
import { secondsToBeats, beatsToSeconds } from '../utils/note-utils.js';

export type PlaybackState = 'playing' | 'paused' | 'stopped';

export class AudioEngine extends EventTarget {
  private ctx: AudioContext | null = null;
  private state: PlaybackState = 'stopped';
  private composition: Composition | null = null;
  
  // Audio nodes
  private masterGain: GainNode | null = null;
  
  // Scheduler variables
  private scheduledNotes: ScheduledNote[] = [];
  private lastScheduledNoteIndex = 0;
  private timerId: number | null = null;
  
  // Timing variables (all in seconds)
  private currentPosition = 0; // current position on the timeline in seconds
  private lastTickTime = 0;    // context time of the last scheduling tick
  private playStartTime = 0;   // context time when play started
  private playStartOffset = 0; // currentPosition when play started
  
  private activeNotes: Set<ActiveNoteNodes> = new Set();
  
  // Look-ahead parameters
  private readonly lookAheadMs = 40.0;
  private readonly scheduleAheadTimeSec = 0.12;

  constructor() {
    super();
  }

  setComposition(comp: Composition) {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.pause();
    }
    this.composition = comp;
    this.scheduledNotes = getScheduledNotes(comp);
    this.lastScheduledNoteIndex = 0;
    
    if (wasPlaying) {
      this.play();
    }
    this.dispatchEvent(new CustomEvent('composition-changed'));
  }

  private initAudio() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

        // Add a DynamicsCompressorNode to prevent clipping and system-level AGC/ducking on Linux
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        this.masterGain.connect(compressor);
        compressor.connect(this.ctx.destination);
        console.log("AudioContext initialized successfully with Compressor. State:", this.ctx.state);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          console.log("AudioContext resumed. State:", this.ctx?.state);
        }).catch(err => {
          console.error("Failed to resume AudioContext:", err);
        });
      }
    } catch (err) {
      console.error("AudioContext initialization failed:", err);
    }
  }

  play() {
    if (!this.composition) return;
    this.initAudio();
    if (this.state === 'playing') return;

    this.state = 'playing';
    this.playStartTime = this.ctx!.currentTime;
    this.playStartOffset = this.currentPosition;
    this.lastTickTime = this.ctx!.currentTime;
    
    // Find where to start in our sorted notes list
    this.lastScheduledNoteIndex = 0;
    while (
      this.lastScheduledNoteIndex < this.scheduledNotes.length &&
      this.scheduledNotes[this.lastScheduledNoteIndex].startTime < this.currentPosition
    ) {
      this.lastScheduledNoteIndex++;
    }

    this.timerId = window.setInterval(() => this.tick(), this.lookAheadMs);
    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
  }

  pause() {
    if (this.state !== 'playing') return;
    
    this.state = 'paused';
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Update position (adjusting for 100ms start delay)
    if (this.ctx) {
      this.currentPosition = Math.max(this.playStartOffset, this.playStartOffset + (this.ctx.currentTime - this.playStartTime - 0.1));
    }

    // Stop all active audio nodes immediately
    this.activeNotes.forEach(note => note.stop(this.ctx!.currentTime));
    this.activeNotes.clear();

    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
  }

  stop() {
    this.state = 'stopped';
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentPosition = 0;
    
    if (this.ctx) {
      this.activeNotes.forEach(note => note.stop(this.ctx!.currentTime));
    }
    this.activeNotes.clear();

    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: 0 } }));
  }

  seek(beats: number) {
    if (!this.composition) return;
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.pause();
    }
    
    this.currentPosition = beatsToSeconds(beats, this.composition.tempo);
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: beats } }));
    
    if (wasPlaying) {
      this.play();
    }
  }

  getCurrentPositionBeats(): number {
    if (!this.composition) return 0;
    
    let seconds = this.currentPosition;
    if (this.state === 'playing' && this.ctx) {
      seconds = this.playStartOffset + (this.ctx.currentTime - this.playStartTime);
    }
    
    return secondsToBeats(seconds, this.composition.tempo);
  }

  getCurrentState(): PlaybackState {
    return this.state;
  }

  getDurationBeats(): number {
    if (this.scheduledNotes.length === 0 || !this.composition) return 0;
    const lastNote = this.scheduledNotes[this.scheduledNotes.length - 1];
    const lastNoteEndSeconds = lastNote.startTime + lastNote.duration;
    return secondsToBeats(lastNoteEndSeconds, this.composition.tempo);
  }

  private tick() {
    if (!this.ctx || !this.masterGain || !this.composition) return;
    
    const now = this.ctx.currentTime;
    const currentPlayPos = Math.max(this.playStartOffset, this.playStartOffset + (now - this.playStartTime - 0.1));
    
    // Broadcast position update
    const currentBeats = secondsToBeats(currentPlayPos, this.composition.tempo);
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: currentBeats } }));

    // Schedule notes
    while (
      this.lastScheduledNoteIndex < this.scheduledNotes.length &&
      this.scheduledNotes[this.lastScheduledNoteIndex].startTime < currentPlayPos + this.scheduleAheadTimeSec
    ) {
      const note = this.scheduledNotes[this.lastScheduledNoteIndex];
      
      // Calculate start time relative to the AudioContext timeline (with 100ms start delay)
      const audioCtxStartTime = this.playStartTime + (note.startTime - this.playStartOffset) + 0.1;
      
      // Only schedule if it's in the future (or very near future)
      if (audioCtxStartTime >= now - 0.01) {
        const activeNodes = playNote(
          this.ctx,
          this.masterGain,
          note.frequency,
          audioCtxStartTime,
          note.duration,
          note.instrument,
          note.volume
        );
        
        this.activeNotes.add(activeNodes);
        
        // Clean up from the active list when finished (including ADSR release tail)
        const releaseMs = note.instrument.adsr?.release ?? 50;
        const endTime = audioCtxStartTime + note.duration + (releaseMs / 1000);
        setTimeout(() => {
          this.activeNotes.delete(activeNodes);
        }, (endTime - now + 0.5) * 1000);
      }
      
      this.lastScheduledNoteIndex++;
    }

    // Stop if we reached the end of composition
    if (this.lastScheduledNoteIndex >= this.scheduledNotes.length && this.activeNotes.size === 0) {
      this.stop();
    }
  }
}
export const audioEngine = new AudioEngine();
export default audioEngine;
