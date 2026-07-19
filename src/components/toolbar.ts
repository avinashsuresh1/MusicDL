import { store } from '../state/store.js';
import { audioEngine } from '../engine/audio-engine.js';
import { openProjectDirectory, saveProjectDirectory } from '../utils/file-io.js';
import styleText from './toolbar.css?inline';
import htmlText from './toolbar.html?raw';
import appIconUrl from '../assets/app_icon.png';

const demoFiles = {
  'composition.yaml': `title: "My Grandfather's Clock"
tempo: 80
root_frequency: 392.0
interval: 100`,

  'instruments/saxophone.yaml': `harmonics:
  - { z: 1.0, amplitude: 1.0 }
  - { z: 2.0, amplitude: 0.75 }
  - { z: 3.0, amplitude: 0.5 }
  - { z: 4.0, amplitude: 0.35 }
  - { z: 5.0, amplitude: 0.2 }
  - { z: 6.0, amplitude: 0.1 }
adsr:
  attack: 30
  decay: 100
  sustain: 0.75
  release: 120`,

  'instruments/strings.yaml': `harmonics:
  - { z: 1.0, amplitude: 0.8 }
  - { z: 2.0, amplitude: 0.4 }
  - { z: 3.0, amplitude: 0.25 }
  - { z: 4.0, amplitude: 0.15 }
  - { z: 0.5, amplitude: 0.3 }
adsr:
  attack: 180
  decay: 150
  sustain: 0.8
  release: 900`,

  'instruments/clock_chime.yaml': `harmonics:
  - { z: 1.0, amplitude: 1.0 }
  - { z: 2.0, amplitude: 0.4 }
  - { z: 0.5, amplitude: 0.25 }
  - { z: 3.0, amplitude: 0.15 }
  - { z: 4.0, amplitude: 0.1 }
adsr:
  attack: 25
  decay: 800
  sustain: 0.4
  release: 1200`,

  'instruments/clock_tick.yaml': `harmonics:
  - { z: 4.5, amplitude: 1.0 }
  - { z: 9.2, amplitude: 0.6 }
  - { z: 13.8, amplitude: 0.3 }
adsr:
  attack: 1
  decay: 15
  sustain: 0.0
  release: 15`,

  'melodies/verse_line_1.yaml': `instrument: saxophone
notes:
  - { pitch: -5, duration: 1.0 }
  - { pitch: 0,  duration: 1.0 }
  - { pitch: -1, duration: 0.5 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: 2,  duration: 1.0 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 4,  duration: 1.0 }
  - { pitch: 5,  duration: 0.5 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: -3, duration: 0.5 }
  - { pitch: rest, duration: 0.5 }`,

  'melodies/verse_line_2.yaml': `instrument: saxophone
notes:
  - { pitch: -3, duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 0,  duration: 1.0 }
  - { pitch: rest, duration: 0.1 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: rest, duration: 0.05 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: rest, duration: 0.1 }
  - { pitch: -1,  duration: 1.0 }
  - { pitch: -3,  duration: 0.5 }
  - { pitch: -1,  duration: 0.5 }
  - { pitch: 0,  duration: 2.0 }
  - { pitch: rest, duration: 2.0 }`,

  'melodies/verse_line_3.yaml': `instrument: saxophone
notes:
  - { pitch: 0,  duration: 0.5 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 7,  duration: 1.0 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 0,  duration: 1.0 }
  - { pitch: -1,  duration: 0.5 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: -3,  duration: 0.5 }
  - { pitch: -5, duration: 0.5 }`,

  'melodies/verse_line_4.yaml': `instrument: saxophone
notes:
  - { pitch: 0,  duration: 0.5 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 7,  duration: 1.0 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 0,  duration: 1.0 }
  - { pitch: -1,  duration: 0.5 }
  - { pitch: 0,  duration: 0.5 }
  - { pitch: 2,  duration: 2.0 }
  - { pitch: rest, duration: 2.4 }`,

  'melodies/chorus_line.yaml': `instrument: clock_chime
notes:
  - { pitch: 7,  duration: 0.5 }
  - { pitch: 7,  duration: 0.5 }
  - { pitch: 12, duration: 1.0 }
  - { pitch: 7,  duration: 0.5 }
  - { pitch: 7,  duration: 0.5 }
  - { pitch: 9,  duration: 1.0 }
  - { pitch: 9,  duration: 1.0 }
  - { pitch: 7,  duration: 2.0 }
  - { pitch: rest, duration: 3.0 }`,

  'melodies/chorus_ending_1.yaml': `instrument: saxophone
notes:
  - { pitch: -5, duration: 0.5 }
  - { pitch: -5,  duration: 0.5 }
  - { pitch: 0, duration: 0.5 }
  - { pitch: rest, duration: 1 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: rest, duration: 1 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: 5,  duration: 0.5 }
  - { pitch: 4,  duration: 0.5 }
  - { pitch: -3, duration: 0.5 }`,

  'melodies/chorus_ending_2.yaml': `instrument: saxophone
notes:
  - { pitch: -3,  duration: 0.5 }
  - { pitch: 2,  duration: 0.5 }
  - { pitch: 0,  duration: 1.0 }
  - { pitch: -1, duration: 1.0 }
  - { pitch: 0,  duration: 3.0 }`,

  'melodies/ticks.yaml': `instrument: clock_tick
type: melody
loop: true
notes:
  - { pitch: 19, duration: 1.0 }
  - { pitch: 12, duration: 1.0 }`,

  'melodies/arpeggio_verse_1.yaml': `instrument: strings
notes:
  - { pitch: -12, duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -5,  duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -17, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: -10, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: -12, duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -5,  duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -19, duration: 0.5 }
  - { pitch: -15, duration: 0.5 }
  - { pitch: -12, duration: 0.5 }
  - { pitch: -15, duration: 0.5 }`,

  'melodies/arpeggio_verse_2.yaml': `instrument: strings
notes:
  - { pitch: -19, duration: 0.5 }
  - { pitch: -15, duration: 0.5 }
  - { pitch: -12, duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -5,  duration: 0.6 }
  - { pitch: -8,  duration: 0.6 }
  - { pitch: -17, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: -10, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: -12, duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -5,  duration: 1.0 }
  - { pitch: -8,  duration: 1.0 }
  - { pitch: rest, duration: 1.2 }`,

  'melodies/arpeggio_verse_3.yaml': `instrument: strings
notes:
  - { pitch: -12, duration: 1.0 }
  - { pitch: -8,  duration: 1.0 }
  - { pitch: -5,  duration: 1.0 }
  - { pitch: -8,  duration: 1.0 }
  - { pitch: -17, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: -10, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: -17, duration: 0.5 }
  - { pitch: -12, duration: 0.5 }
  - { pitch: -8,  duration: 0.5 }
  - { pitch: -12, duration: 0.5 }
  - { pitch: -17, duration: 0.5 }
  - { pitch: -13, duration: 0.5 }
  - { pitch: rest, duration: 1.0 }`,

  'melodies/arpeggio_chorus.yaml': `instrument: strings
notes:
  - { pitch: -12, duration: 1.0 }
  - { pitch: -8,  duration: 1.0 }
  - { pitch: -5,  duration: 1.0 }
  - { pitch: -19, duration: 1.0 }
  - { pitch: -15, duration: 1.0 }
  - { pitch: -12, duration: 1.0 }
  - { pitch: -8,  duration: 1.0 }
  - { pitch: rest, duration: 3.0 }`,

  'chords/chord_I.yaml': `instrument: strings
pitches:
  - -12
  - -8
  - -5`,

  'chords/chord_IV.yaml': `instrument: strings
pitches:
  - -19
  - -15
  - -12`,

  'chords/chord_V7.yaml': `instrument: strings
pitches:
  - -17
  - -13
  - -10
  - -7`,

  'chords/chord_I_final.yaml': `instrument: strings
pitches:
  - -12
  - -8
  - -5
  - 0`,

  'tracks/melody_track.yaml': `volume: 0.65
melodies:
  - { name: verse_line_1, offset: 0.0 }
  - { name: verse_line_2, offset: 8.0 }
  - { name: verse_line_1, offset: 17.4 }
  - { name: verse_line_2, offset: 25.4 }
  - { name: verse_line_3, offset: 34.8 }
  - { name: verse_line_4, offset: 42.8 }
  - { name: chorus_ending_1, offset: 54.2 }
  - { name: chorus_ending_2, offset: 62.2 }
  - { name: chorus_line, offset: 70.2 }
  - { name: chorus_line, offset: 80.2 }
  - { name: chorus_ending_1, offset: 90.2 }
  - { name: chorus_ending_2, offset: 98.2 }
  - { name: chorus_ending_1, offset: 106.5 }
  - { name: chorus_ending_2, offset: 113.5 }`,

  'tracks/chords_track.yaml': `volume: 0.3
melodies:
  - { name: arpeggio_verse_1, offset: 0.0 }
  - { name: arpeggio_verse_2, offset: 8.0 }
  - { name: arpeggio_verse_1, offset: 17.4 }
  - { name: arpeggio_verse_2, offset: 25.4 }
  - { name: arpeggio_verse_3, offset: 34.8 }
  - { name: arpeggio_verse_2, offset: 42.8 }
  - { name: arpeggio_chorus, offset: 70.2 }
  - { name: arpeggio_chorus, offset: 80.2 }
chords:
  - { name: chord_I, offset: 54.2, duration: 3.0 }
  - { name: chord_V7, offset: 57.2, duration: 3.0 }
  - { name: chord_I, offset: 60.2, duration: 2.0 }
  - { name: chord_IV, offset: 62.2, duration: 2.0 }
  - { name: chord_V7, offset: 64.2, duration: 2.0 }
  - { name: chord_I_final, offset: 66.2, duration: 4.0 }
  - { name: chord_I, offset: 90.2, duration: 3.0 }
  - { name: chord_V7, offset: 93.2, duration: 3.0 }
  - { name: chord_I, offset: 96.2, duration: 2.0 }
  - { name: chord_IV, offset: 98.2, duration: 2.0 }
  - { name: chord_V7, offset: 100.2, duration: 2.0 }
  - { name: chord_I_final, offset: 102.2, duration: 4.3 }
  - { name: chord_I, offset: 106.5, duration: 3.0 }
  - { name: chord_V7, offset: 109.5, duration: 3.0 }
  - { name: chord_I, offset: 112.5, duration: 1.0 }
  - { name: chord_IV, offset: 113.5, duration: 2.0 }
  - { name: chord_V7, offset: 115.5, duration: 2.0 }
  - { name: chord_I_final, offset: 117.5, duration: 4.2 }`,

  'tracks/ticks_track.yaml': `volume: 0.1
melodies:
  - ticks`
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
    const newBtn = this.shadowRoot!.querySelector('#btn-new')!;
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

    // Listen to rendering states to show visual loading feedback
    audioEngine.addEventListener('rendering', (e: any) => {
      const isRendering = e.detail.rendering;
      if (isRendering) {
        playBtn.classList.add('rendering');
        playBtn.innerHTML = `⏳ Loading...`;
        playBtn.setAttribute('disabled', 'true');
      } else {
        playBtn.classList.remove('rendering');
        playBtn.innerHTML = `▶ Run`;
        playBtn.removeAttribute('disabled');
      }
    });

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

    newBtn.addEventListener('click', () => {
      store.createNewProject();
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
    let template = htmlText.replace(
      '<div class="playback-indicator"></div>',
      `<div class="playback-indicator"></div><img src="${appIconUrl}" class="logo-icon" alt="MusicDL Logo" />`
    );
    this.shadowRoot!.innerHTML = `
      <style>${styleText}</style>
      ${template}
    `;
  }
}

customElements.define('mdl-toolbar', Toolbar);
export default Toolbar;
