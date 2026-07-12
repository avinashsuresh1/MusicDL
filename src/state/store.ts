import type { Composition, Note, Melody, Track, Instrument } from '../types/music.js';
import { parseProject } from '../parser/yaml-parser.js';
import { serializeProject, serializeMelody, serializeTrack, serializeInstrument, serializeCompositionMeta } from '../parser/serializer.js';
import { validateComposition } from '../parser/validator.js';
import { audioEngine } from '../engine/audio-engine.js';
import { renameProjectFile, deleteProjectFile, createNewProjectDirectory, saveProjectDirectory } from '../utils/file-io.js';

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
      
      this.composition = comp;

      if (!valResult.valid) {
        this.errors = valResult.errors;
        this.dispatchEvent(new CustomEvent('validation-failed'));
      } else {
        this.errors = [];
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

  // File System mutations (IDE Actions)
  async renameFile(oldPath: string, newPath: string) {
    if (!this.files[oldPath]) return;
    const content = this.files[oldPath];
    delete this.files[oldPath];
    this.files[newPath] = content;

    if (this.activeFilePath === oldPath) {
      this.activeFilePath = newPath;
    }

    try {
      await renameProjectFile(oldPath, newPath);
    } catch (err) {
      console.error('Failed to rename file on disk:', err);
    }

    this.reparseProject();
    this.dispatchEvent(new CustomEvent('project-loaded'));
  }

  async deleteFile(path: string) {
    if (!this.files[path]) return;
    delete this.files[path];

    if (this.activeFilePath === path) {
      this.activeFilePath = 'composition.yaml';
    }

    try {
      await deleteProjectFile(path);
    } catch (err) {
      console.error('Failed to delete file on disk:', err);
    }

    this.reparseProject();
    this.dispatchEvent(new CustomEvent('project-loaded'));
  }

  async addFile(folder: string, name: string) {
    const cleanName = name.replace(/\.ya?ml$/i, '').trim();
    if (!cleanName) return;

    const relPath = `${folder}/${cleanName}.yaml`;
    if (this.files[relPath]) {
      throw new Error(`File '${relPath}' already exists.`);
    }

    const availableInstrument = this.composition ? Object.keys(this.composition.instruments)[0] : 'synth';
    
    let content = '';
    if (folder === 'instruments') {
      content = `harmonics:\n  - { z: 1, amplitude: 1.0 }\n`;
    } else if (folder === 'melodies') {
      content = `type: melody\ninstrument: ${availableInstrument}\nnotes:\n  - { pitch: 0, offset: 0, duration: 1 }\n`;
    } else if (folder === 'chords') {
      content = `instrument: ${availableInstrument}\npitches: [0, 4, 7]\n`;
    } else if (folder === 'tracks') {
      content = `volume: 0.8\nmelodies: []\n`;
    }

    this.files[relPath] = content;

    try {
      // Save it immediately to the local directory if running inside Tauri
      await saveProjectDirectory(this.files);
    } catch (err) {
      console.error('Failed to save newly created file to disk:', err);
    }

    this.activeFilePath = relPath;
    this.reparseProject();
    this.dispatchEvent(new CustomEvent('project-loaded'));
  }

  async createNewProject() {
    const defaultProjectFiles: Record<string, string> = {
      'composition.yaml': `title: "New Project"\ntempo: 120\nroot_frequency: 261.63\ninterval: 100\n`,
      'instruments/synth.yaml': `harmonics:\n  - { z: 1, amplitude: 1.0 }\n  - { z: 2, amplitude: 0.3 }\n`,
      'melodies/melody_1.yaml': `type: melody\ninstrument: synth\nnotes:\n  - { pitch: 0, offset: 0, duration: 1 }\n  - { pitch: 4, offset: 1, duration: 1 }\n  - { pitch: 7, offset: 2, duration: 2 }\n`,
      'tracks/lead.yaml': `volume: 0.8\nmelodies:\n  - melody_1\n`
    };

    try {
      const result = await createNewProjectDirectory(defaultProjectFiles);
      if (result) {
        this.loadProject(result.files);
      }
    } catch (err: any) {
      alert('Error creating new project: ' + err.message);
    }
  }
}

export const store = new ProjectStore();
export default store;
