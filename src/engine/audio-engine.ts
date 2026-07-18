import type { Composition, ScheduledNote } from '../types/music.js';
import { getScheduledNotes } from './scheduler.js';
import { renderToSamples } from './renderer.js';
import { secondsToBeats, beatsToSeconds } from '../utils/note-utils.js';

export type PlaybackState = 'playing' | 'paused' | 'stopped';

/**
 * Audio engine that pre-renders the entire composition into an AudioBuffer
 * using pure JS mathematical synthesis, then plays it back with a single
 * AudioBufferSourceNode. This avoids all Web Audio node scheduling,
 * PeriodicWave, and mixer/filter issues on WebKitGTK/GStreamer (Linux).
 */
export class AudioEngine extends EventTarget {
  private ctx: AudioContext | null = null;
  private state: PlaybackState = 'stopped';
  private composition: Composition | null = null;

  // Pre-rendered audio
  private renderedBuffer: AudioBuffer | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private masterGain: GainNode | null = null;

  // Scheduled notes (kept for duration calculation)
  private scheduledNotes: ScheduledNote[] = [];

  // Playback position tracking (all in seconds)
  private currentOffset = 0;       // where we are in the buffer
  private playStartCtxTime = 0;    // ctx.currentTime when play() was called
  private positionTimerId: number | null = null;

  constructor() {
    super();
  }

  setComposition(comp: Composition) {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.stopSource();
    }

    this.composition = comp;
    this.scheduledNotes = getScheduledNotes(comp);
    this.renderedBuffer = null; // invalidate — will re-render on play
    this.currentOffset = 0;
    this.state = 'stopped';

    this.dispatchEvent(new CustomEvent('composition-changed'));
    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: 0 } }));
  }

  // ---------- Public transport controls ----------

  async play() {
    if (!this.composition) return;
    this.initAudio();
    if (this.state === 'playing') return;

    // Pre-render on first play (or after composition change)
    if (!this.renderedBuffer) {
      this.dispatchEvent(new CustomEvent('rendering', { detail: { rendering: true } }));
      try {
        this.renderedBuffer = await this.renderComposition();
      } catch (err) {
        console.error('Failed to render composition:', err);
        this.dispatchEvent(new CustomEvent('rendering', { detail: { rendering: false } }));
        return;
      }
      this.dispatchEvent(new CustomEvent('rendering', { detail: { rendering: false } }));
    }

    this.startPlayback();
  }

  pause() {
    if (this.state !== 'playing') return;

    // Capture position before stopping source
    this.currentOffset = this.getPlaybackPositionSeconds();
    this.stopSource();
    this.state = 'paused';

    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
  }

  stop() {
    this.stopSource();
    this.currentOffset = 0;
    this.state = 'stopped';

    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: 0 } }));
  }

  seek(beats: number) {
    if (!this.composition) return;
    const wasPlaying = this.state === 'playing';

    if (wasPlaying) {
      this.stopSource();
    }

    this.currentOffset = beatsToSeconds(beats, this.composition.tempo);
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: beats } }));

    if (wasPlaying) {
      this.startPlayback();
    }
  }

  getCurrentPositionBeats(): number {
    if (!this.composition) return 0;
    return secondsToBeats(this.getPlaybackPositionSeconds(), this.composition.tempo);
  }

  getCurrentState(): PlaybackState {
    return this.state;
  }

  getDurationBeats(): number {
    if (this.scheduledNotes.length === 0 || !this.composition) return 0;
    const lastNote = this.scheduledNotes[this.scheduledNotes.length - 1];
    const lastNoteEndSeconds = lastNote.startTime + lastNote.duration;
    // Add release tail of the last note's instrument
    const releaseSec = (lastNote.instrument.adsr?.release ?? 50) / 1000;
    return secondsToBeats(lastNoteEndSeconds + releaseSec, this.composition.tempo);
  }

  // ---------- Internals ----------

  private initAudio() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(err => {
          console.error('Failed to resume AudioContext:', err);
        });
      }
    } catch (err) {
      console.error('AudioContext initialization failed:', err);
    }
  }

  /**
   * Pre-render the entire composition using pure JS rendering.
   * This runs all synthesis in pure JS (Math.sin & linear ADSR segments)
   * into raw float samples, then copies them to an AudioBuffer.
   * Completely immune to Web Audio API engine bugs in GStreamer.
   */
  private async renderComposition(): Promise<AudioBuffer> {
    const sampleRate = this.ctx?.sampleRate ?? 44100;

    if (!this.composition || this.scheduledNotes.length === 0) {
      // Return a tiny silent buffer
      return this.ctx?.createBuffer(1, 4410, sampleRate) ?? new AudioBuffer({ length: 4410, sampleRate, numberOfChannels: 1 });
    }

    const samples = renderToSamples(this.scheduledNotes, sampleRate);

    // Create a 2-channel stereo buffer and copy mono samples to both channels
    const audioBuffer = this.ctx!.createBuffer(2, samples.length, sampleRate);
    audioBuffer.copyToChannel(samples as any, 0);
    audioBuffer.copyToChannel(samples as any, 1);

    return audioBuffer;
  }

  private startPlayback() {
    if (!this.ctx || !this.masterGain || !this.renderedBuffer) return;

    // Clamp offset to buffer bounds
    const bufferDuration = this.renderedBuffer.duration;
    if (this.currentOffset >= bufferDuration) {
      this.stop();
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this.renderedBuffer;
    source.connect(this.masterGain);

    source.onended = () => {
      // Natural end of playback
      if (this.state === 'playing') {
        this.stopSource();
        this.currentOffset = 0;
        this.state = 'stopped';
        this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
        this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: 0 } }));
      }
    };

    this.bufferSource = source;
    this.playStartCtxTime = this.ctx.currentTime;
    source.start(0, this.currentOffset);

    this.state = 'playing';
    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));

    // Position broadcast ticker
    this.positionTimerId = window.setInterval(() => {
      if (this.state === 'playing' && this.composition) {
        const posSec = this.getPlaybackPositionSeconds();
        const posBeats = secondsToBeats(posSec, this.composition.tempo);
        this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: posBeats } }));
      }
    }, 50);
  }

  private stopSource() {
    if (this.positionTimerId) {
      clearInterval(this.positionTimerId);
      this.positionTimerId = null;
    }
    if (this.bufferSource) {
      try { this.bufferSource.stop(); } catch {}
      try { this.bufferSource.disconnect(); } catch {}
      this.bufferSource = null;
    }
  }

  private getPlaybackPositionSeconds(): number {
    if (this.state === 'playing' && this.ctx) {
      return this.currentOffset + (this.ctx.currentTime - this.playStartCtxTime);
    }
    return this.currentOffset;
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
