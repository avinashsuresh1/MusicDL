import type { Composition, Note, Melody, Track, Instrument } from '../types/music.js';
import { parseProject } from '../parser/yaml-parser.js';
import { serializeProject, serializeMelody, serializeTrack, serializeInstrument, serializeCompositionMeta } from '../parser/serializer.js';
import { validateComposition } from '../parser/validator.js';
import { audioEngine } from '../engine/audio-engine.js';

export class ProjectStore extends EventTarget {
  private composition: Composition | null = null;
  private files: Record<string, string> = {};
  
  // Selection State
  private selectedTrackName: string | null = null;
  private selectedMelodyName: string | null = null;
  
  // Playback Cursor State
  private currentBeat = 0;
  
  // UI Tab State
  private activeTab: 'timeline' | 'yaml' | 'instruments' = 'timeline';

  // Active File for IDE Editor
  private activeFilePath = 'composition.yaml';

  // Validation errors
  private errors: { path: string; message: string }[] = [];

  constructor() {
    super();
    
    // Sync cursor with audio engine
    audioEngine.addEventListener('position-changed', (e: any) => {
      this.currentBeat = e.detail.position;
      this.dispatchEvent(new CustomEvent('cursor-changed', { detail: { beat: this.currentBeat } }));
    });

    audioEngine.addEventListener('state-changed', (e: any) => {
      this.dispatchEvent(new CustomEvent('playback-state-changed', { detail: { state: e.detail.state } }));
    });
  }

  getComposition(): Composition | null {
    return this.composition;
  }

  getFiles(): Record<string, string> {
    return this.files;
  }

  getSelectedTrackName(): string | null {
    return this.selectedTrackName;
  }

  getSelectedMelodyName(): string | null {
    return this.selectedMelodyName;
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  getActiveTab(): 'timeline' | 'yaml' | 'instruments' {
    return this.activeTab;
  }

  getErrors() {
    return this.errors;
  }

  getActiveFilePath(): string {
    return this.activeFilePath;
  }

  setActiveFilePath(path: string) {
    this.activeFilePath = path;
    this.dispatchEvent(new CustomEvent('active-file-changed', { detail: { path } }));
  }

  /**
   * Load a full set of project YAML files into the store.
   */
  loadProject(files: Record<string, string>) {
    this.files = { ...files };
    try {
      const comp = parseProject(files);
      const valResult = validateComposition(comp);
      
      if (!valResult.valid) {
        this.errors = valResult.errors;
        this.composition = comp; // Still load it so we can view the broken YAML
        this.dispatchEvent(new CustomEvent('validation-failed'));
      } else {
        this.errors = [];
        this.composition = comp;
        audioEngine.setComposition(comp);
      }

      // Reset active file path if it doesn't exist in loaded files
      if (!this.files[this.activeFilePath]) {
        this.activeFilePath = 'composition.yaml';
      }

      // Auto-select first track and its first melody
      if (comp.tracks.length > 0) {
        this.selectedTrackName = comp.tracks[0].name;
        if (comp.tracks[0].melodies.length > 0) {
          const firstMel = comp.tracks[0].melodies[0];
          this.selectedMelodyName = typeof firstMel === 'string' ? firstMel : firstMel.name;
        } else {
          this.selectedMelodyName = null;
        }
      } else {
        this.selectedTrackName = null;
        this.selectedMelodyName = null;
      }
      
      this.dispatchEvent(new CustomEvent('project-loaded'));
    } catch (err: any) {
      this.errors = [{ path: 'parser', message: err.message }];
      this.dispatchEvent(new CustomEvent('validation-failed'));
    }
  }

  /**
   * Update a single file in the project.
   */
  updateFile(path: string, content: string) {
    this.files[path] = content;
    this.reparseProject();
  }

  /**
   * Re-parse project from current files state.
   */
  private reparseProject() {
    try {
      const comp = parseProject(this.files);
      const valResult = validateComposition(comp);
      
      if (!valResult.valid) {
        this.errors = valResult.errors;
        this.dispatchEvent(new CustomEvent('validation-failed'));
      } else {
        this.errors = [];
        this.composition = comp;
        audioEngine.setComposition(comp);
        this.dispatchEvent(new CustomEvent('composition-changed'));
      }
    } catch (err: any) {
      this.errors = [{ path: 'parser', message: err.message }];
      this.dispatchEvent(new CustomEvent('validation-failed'));
    }
  }

  // Selection mutations
  selectTrack(name: string) {
    this.selectedTrackName = name;
    
    // Auto-select first melody in that track
    const track = this.composition?.tracks.find(t => t.name === name);
    if (track && track.melodies.length > 0) {
      const firstMel = track.melodies[0];
      this.selectedMelodyName = typeof firstMel === 'string' ? firstMel : firstMel.name;
    } else {
      this.selectedMelodyName = null;
    }
    
    this.dispatchEvent(new CustomEvent('selection-changed'));
  }

  selectMelody(name: string) {
    this.selectedMelodyName = name;
    this.dispatchEvent(new CustomEvent('selection-changed'));
  }

  setActiveTab(tab: 'timeline' | 'yaml' | 'instruments') {
    this.activeTab = tab;
    this.dispatchEvent(new CustomEvent('tab-changed', { detail: { tab } }));
  }

  // Note updates (visual piano-roll editor actions)
  addNote(melodyName: string, note: Note) {
    if (!this.composition || !this.composition.melodies[melodyName]) return;
    
    const melody = this.composition.melodies[melodyName];
    melody.notes.push(note);
    
    // Sort notes
    melody.notes.sort((a, b) => a.offset - b.offset);

    // Update files map & reparse
    const yamlStr = serializeMelody(melody);
    this.files[`melodies/${melodyName}.yaml`] = yamlStr;
    this.reparseProject();
  }

  updateNote(melodyName: string, index: number, updatedNote: Note) {
    if (!this.composition || !this.composition.melodies[melodyName]) return;
    
    const melody = this.composition.melodies[melodyName];
    if (index >= 0 && index < melody.notes.length) {
      melody.notes[index] = updatedNote;
      melody.notes.sort((a, b) => a.offset - b.offset);

      const yamlStr = serializeMelody(melody);
      this.files[`melodies/${melodyName}.yaml`] = yamlStr;
      this.reparseProject();
    }
  }

  deleteNote(melodyName: string, index: number) {
    if (!this.composition || !this.composition.melodies[melodyName]) return;
    
    const melody = this.composition.melodies[melodyName];
    if (index >= 0 && index < melody.notes.length) {
      melody.notes.splice(index, 1);

      const yamlStr = serializeMelody(melody);
      this.files[`melodies/${melodyName}.yaml`] = yamlStr;
      this.reparseProject();
    }
  }

  // Instrument updates
  updateInstrumentHarmonics(name: string, harmonics: { z: number; amplitude: number }[]) {
    if (!this.composition || !this.composition.instruments[name]) return;
    
    const instrument = this.composition.instruments[name];
    instrument.harmonics = harmonics;

    const yamlStr = serializeInstrument(instrument);
    this.files[`instruments/${name}.yaml`] = yamlStr;
    this.reparseProject();
  }
}

export const store = new ProjectStore();
export default store;
