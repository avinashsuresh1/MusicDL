import { store } from '../state/store.js';
import { audioEngine } from '../engine/audio-engine.js';
import { openProjectDirectory, saveProjectDirectory } from '../utils/file-io.js';
import styleText from './toolbar.css?inline';
import htmlText from './toolbar.html?raw';

const demoFiles = {
  'composition.yaml': `title: "I-V-vi-IV Progression"
tempo: 90
root_frequency: 261.63
interval: 100`,
  
  'instruments/pad.yaml': `harmonics:
  - { z: 1, amplitude: 1.0 }
  - { z: 2, amplitude: 0.5 }
  - { z: 3, amplitude: 0.25 }
  - { z: 4, amplitude: 0.12 }
adsr:
  attack: 150
  decay: 200
  sustain: 0.6
  release: 600`,
  
  'instruments/bass_synth.yaml': `harmonics:
  - { z: 1, amplitude: 1.0 }
  - { z: 2, amplitude: 0.7 }
  - { z: 3, amplitude: 0.4 }
  - { z: 0.5, amplitude: 0.3 }
adsr:
  attack: 20
  decay: 100
  sustain: 0.8
  release: 150`,
  
  'melodies/lead.yaml': `instrument: pad
notes:
  - { pitch: 12, offset: 0,  duration: 1 }
  - { pitch: 16, offset: 1,  duration: 0.5 }
  - { pitch: 19, offset: 1.5, duration: 0.5 }
  - { pitch: 17, offset: 2,  duration: 1 }
  - { pitch: 16, offset: 3,  duration: 1 }
  - { pitch: 12, offset: 4,  duration: 1.5 }
  - { pitch: 11, offset: 5.5, duration: 0.5 }
  - { pitch: 12, offset: 6,  duration: 1 }
  - { pitch: 7,  offset: 7,  duration: 1 }
  - { pitch: 12, offset: 8,  duration: 2 }
  - { pitch: rest, offset: 10, duration: 2 }`,
  
  'chords/chord_I.yaml': `instrument: pad
pitches: [0, 4, 7]`,
  
  'chords/chord_V.yaml': `instrument: pad
pitches: [7, 11, 14]`,
  
  'chords/chord_vi.yaml': `instrument: pad
pitches: [9, 12, 16]`,
  
  'chords/chord_IV.yaml': `instrument: pad
pitches: [5, 9, 12]`,
  
  'melodies/bass_line.yaml': `instrument: bass_synth
notes:
  - { pitch: -12, offset: 0,  duration: 3 }
  - { pitch: -5,  offset: 3,  duration: 3 }
  - { pitch: -3,  offset: 6,  duration: 3 }
  - { pitch: -7,  offset: 9,  duration: 3 }`,
  
  'tracks/melody.yaml': `volume: 0.7
melodies:
  - lead`,
  
  'tracks/chords.yaml': `volume: 0.5
chords:
  - { name: chord_I, offset: 0, duration: 3.0 }
  - { name: chord_V, offset: 3, duration: 3.0 }
  - { name: chord_vi, offset: 6, duration: 3.0 }
  - { name: chord_IV, offset: 9, duration: 3.0 }`,
  
  'tracks/bass.yaml': `volume: 0.6
melodies:
  - bass_line`
};

export class Toolbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    
    // Auto-load demo on first load so user gets active UI immediately
    setTimeout(() => {
      store.loadProject(demoFiles);
    }, 100);
  }

  private setupListeners() {
    const playBtn = this.shadowRoot!.querySelector('#btn-play')!;
    const stopBtn = this.shadowRoot!.querySelector('#btn-stop')!;
    const openBtn = this.shadowRoot!.querySelector('#btn-open')!;
    const saveBtn = this.shadowRoot!.querySelector('#btn-save')!;
    const demoBtn = this.shadowRoot!.querySelector('#btn-demo')!;
    const helpBtn = this.shadowRoot!.querySelector('#btn-help')!;
    
    const timeDisplay = this.shadowRoot!.querySelector('.time-display')!;
    
    const bpmInput = this.shadowRoot!.querySelector('#input-bpm') as HTMLInputElement;
    const rootInput = this.shadowRoot!.querySelector('#input-root') as HTMLInputElement;
    const intervalInput = this.shadowRoot!.querySelector('#input-interval') as HTMLInputElement;

    // Help button
    helpBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('show-help', { bubbles: true, composed: true }));
    });

    // Transport buttons
    playBtn.addEventListener('click', () => audioEngine.play());
    stopBtn.addEventListener('click', () => audioEngine.stop());

    // File IO buttons
    openBtn.addEventListener('click', async () => {
      try {
        const files = await openProjectDirectory();
        store.loadProject(files);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          alert('Error loading project: ' + err.message);
        }
      }
    });

    saveBtn.addEventListener('click', async () => {
      try {
        const files = store.getFiles();
        await saveProjectDirectory(files);
        alert('Project saved successfully!');
      } catch (err: any) {
        alert('Error saving project: ' + err.message);
      }
    });

    demoBtn.addEventListener('click', () => {
      store.loadProject(demoFiles);
    });

    // Inputs updates
    bpmInput.addEventListener('change', () => {
      const val = parseFloat(bpmInput.value);
      if (val > 0) this.updateCompositionMeta('tempo', val);
    });

    rootInput.addEventListener('change', () => {
      const val = parseFloat(rootInput.value);
      if (val > 0) this.updateCompositionMeta('root_frequency', val);
    });

    intervalInput.addEventListener('change', () => {
      const val = parseFloat(intervalInput.value);
      if (val > 0) this.updateCompositionMeta('interval', val);
    });

    // Store listener
    store.addEventListener('project-loaded', () => this.syncMetaInputs());
    store.addEventListener('composition-changed', () => this.syncMetaInputs());

    store.addEventListener('cursor-changed', (e: any) => {
      const beat = e.detail.beat;
      const measure = Math.floor(beat / 4) + 1;
      const beatInMeasure = Math.floor(beat % 4) + 1;
      const ticks = Math.floor((beat % 1) * 100);
      
      const pad = (num: number, size: number) => num.toString().padStart(size, '0');
      timeDisplay.textContent = `${pad(measure, 3)}.${pad(beatInMeasure, 1)}.${pad(ticks, 2)}`;
    });

    store.addEventListener('playback-state-changed', (e: any) => {
      const state = e.detail.state;
      playBtn.classList.toggle('active', state === 'playing');
      
      const indicator = this.shadowRoot!.querySelector('.playback-indicator')!;
      indicator.classList.toggle('playing', state === 'playing');
    });
  }

  private updateCompositionMeta(key: string, val: number) {
    const files = store.getFiles();
    const compYaml = files['composition.yaml'] || '';
    
    // Parse key-value replacement
    const lines = compYaml.split('\n');
    let found = false;
    
    const updatedLines = lines.map(line => {
      const regex = new RegExp(`^(\\s*)${key}:.*$`);
      if (regex.test(line)) {
        found = true;
        return line.replace(regex, `$1${key}: ${val}`);
      }
      return line;
    });

    if (!found) {
      updatedLines.push(`${key}: ${val}`);
    }

    store.updateFile('composition.yaml', updatedLines.join('\n'));
  }

  private syncMetaInputs() {
    const comp = store.getComposition();
    if (!comp) return;

    const bpmInput = this.shadowRoot!.querySelector('#input-bpm') as HTMLInputElement;
    const rootInput = this.shadowRoot!.querySelector('#input-root') as HTMLInputElement;
    const intervalInput = this.shadowRoot!.querySelector('#input-interval') as HTMLInputElement;
    const titleEl = this.shadowRoot!.querySelector('.project-title')!;

    bpmInput.value = comp.tempo.toString();
    rootInput.value = comp.rootFrequency.toString();
    intervalInput.value = comp.interval.toString();
    titleEl.textContent = comp.title || 'Untitled';
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>${styleText}</style>
      ${htmlText}
    `;
  }
}

customElements.define('mdl-toolbar', Toolbar);
export default Toolbar;
