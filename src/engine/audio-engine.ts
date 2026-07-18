import type { Composition, ScheduledNote } from '../types/music.js';
import { getScheduledNotes } from './scheduler.js';
import { renderToSamples } from './renderer.js';
import { secondsToBeats, beatsToSeconds } from '../utils/note-utils.js';
import { invoke } from '@tauri-apps/api/core';

export type PlaybackState = 'playing' | 'paused' | 'stopped';

function isTauri(): boolean {
  return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
}

/**
 * Dual-mode audio engine.
 * 
 * - In Tauri (Desktop): Renders the composition into flat samples in JS,
 *   then sends them to the native Rust backend to play via rodio. This
 *   completely bypasses the webview sandbox and GStreamer, solving Bluetooth
 *   A2DP and audio driver bugs on Linux.
 * 
 * - In Browser (Web): Falls back to standard Web Audio API pre-rendering into
 *   an AudioBuffer and playing via an AudioBufferSourceNode.
 */
export class AudioEngine extends EventTarget {
  private ctx: AudioContext | null = null;
  private state: PlaybackState = 'stopped';
  private composition: Composition | null = null;

  // Pre-rendered audio data
  private renderedSamples: Float32Array | null = null;
  private renderedBuffer: AudioBuffer | null = null;

  // Web Audio playback (browser mode)
  private bufferSource: AudioBufferSourceNode | null = null;
  private masterGain: GainNode | null = null;

  // Scheduled notes (kept for duration calculation)
  private scheduledNotes: ScheduledNote[] = [];

  // Playback position tracking (all in seconds)
  private currentOffset = 0;       // where we are in the buffer
  private playStartCtxTime = 0;    // ctx.currentTime when play() was called
  private positionTimerId: number | null = null;
  private tauriPlaybackEndTimeoutId: number | null = null;

  constructor() {
    super();
  }

  setComposition(comp: Composition) {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.stopPlaybackInternal();
    }

    this.composition = comp;
    this.scheduledNotes = getScheduledNotes(comp);
    this.renderedSamples = null;
    this.renderedBuffer = null;
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

    // Pre-render if needed
    if (!this.renderedSamples) {
      this.dispatchEvent(new CustomEvent('rendering', { detail: { rendering: true } }));
      try {
        const sampleRate = this.ctx?.sampleRate ?? 44100;
        this.renderedSamples = renderToSamples(this.scheduledNotes, sampleRate);
      } catch (err) {
        console.error('Failed to render composition:', err);
        this.dispatchEvent(new CustomEvent('rendering', { detail: { rendering: false } }));
        return;
      }
      this.dispatchEvent(new CustomEvent('rendering', { detail: { rendering: false } }));
    }

    const sampleRate = this.ctx?.sampleRate ?? 44100;
    const duration = this.renderedSamples.length / sampleRate;
    if (this.currentOffset >= duration) {
      this.stop();
      return;
    }

    if (isTauri()) {
      // --- Tauri Mode: Play audio via native Rust backend ---
      try {
        // Convert Float32Array to standard array for Tauri IPC serialization
        const samplesArray = Array.from(this.renderedSamples);
        await invoke('play_samples', {
          samples: samplesArray,
          sampleRate,
          startOffset: this.currentOffset,
        });

        this.playStartCtxTime = this.ctx?.currentTime ?? 0;
        this.state = 'playing';
        this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));

        // Start position ticker
        this.startPositionTicker();

        // Set up local timeout for natural end of playback
        const remainingTimeSec = duration - this.currentOffset;
        this.setupTauriPlaybackEndTimer(remainingTimeSec);
      } catch (err) {
        console.error('Tauri native playback failed:', err);
      }
    } else {
      // --- Browser Mode: Fallback to Web Audio pre-rendered buffer ---
      if (!this.renderedBuffer) {
        this.renderedBuffer = this.ctx!.createBuffer(2, this.renderedSamples.length, sampleRate);
        this.renderedBuffer.copyToChannel(this.renderedSamples as any, 0);
        this.renderedBuffer.copyToChannel(this.renderedSamples as any, 1);
      }
      this.startBrowserPlayback();
    }
  }

  async pause() {
    if (this.state !== 'playing') return;

    this.currentOffset = this.getPlaybackPositionSeconds();
    this.stopPlaybackInternal();
    this.state = 'paused';

    if (isTauri()) {
      try {
        await invoke('pause_audio');
      } catch (err) {
        console.error('Tauri pause failed:', err);
      }
    }

    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
  }

  async stop() {
    this.stopPlaybackInternal();
    this.currentOffset = 0;
    this.state = 'stopped';

    if (isTauri()) {
      try {
        await invoke('stop_audio');
      } catch (err) {
        console.error('Tauri stop failed:', err);
      }
    }

    this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: 0 } }));
  }

  async seek(beats: number) {
    if (!this.composition) return;
    const wasPlaying = this.state === 'playing';

    if (wasPlaying) {
      this.stopPlaybackInternal();
      if (isTauri()) {
        try {
          await invoke('stop_audio');
        } catch {}
      }
    }

    this.currentOffset = beatsToSeconds(beats, this.composition.tempo);
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: beats } }));

    if (wasPlaying) {
      await this.play();
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

  private startBrowserPlayback() {
    if (!this.ctx || !this.masterGain || !this.renderedBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.renderedBuffer;
    source.connect(this.masterGain);

    source.onended = () => {
      if (this.state === 'playing') {
        this.stopPlaybackInternal();
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

    this.startPositionTicker();
  }

  private startPositionTicker() {
    if (this.positionTimerId) {
      clearInterval(this.positionTimerId);
    }
    this.positionTimerId = window.setInterval(() => {
      if (this.state === 'playing' && this.composition) {
        const posSec = this.getPlaybackPositionSeconds();
        const posBeats = secondsToBeats(posSec, this.composition.tempo);
        this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: posBeats } }));
      }
    }, 50);
  }

  private setupTauriPlaybackEndTimer(durationSec: number) {
    if (this.tauriPlaybackEndTimeoutId) {
      clearTimeout(this.tauriPlaybackEndTimeoutId);
    }
    this.tauriPlaybackEndTimeoutId = window.setTimeout(() => {
      if (this.state === 'playing') {
        this.stopPlaybackInternal();
        this.currentOffset = 0;
        this.state = 'stopped';
        this.dispatchEvent(new CustomEvent('state-changed', { detail: { state: this.state } }));
        this.dispatchEvent(new CustomEvent('position-changed', { detail: { position: 0 } }));
      }
    }, durationSec * 1000);
  }

  private stopPlaybackInternal() {
    if (this.positionTimerId) {
      clearInterval(this.positionTimerId);
      this.positionTimerId = null;
    }
    if (this.tauriPlaybackEndTimeoutId) {
      clearTimeout(this.tauriPlaybackEndTimeoutId);
      this.tauriPlaybackEndTimeoutId = null;
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
