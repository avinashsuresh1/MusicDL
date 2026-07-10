import { store } from '../state/store.js';
import styleText from './visualizer.css?inline';

export class Visualizer extends HTMLElement {
  private zoomX = 40; // px per beat
  private maxBeats = 16;
  private laneHeight = 45; // height of each track lane

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  private setupListeners() {
    store.addEventListener('project-loaded', () => this.refresh());
    store.addEventListener('composition-changed', () => this.refresh());
    
    // Playhead and note highlighting
    store.addEventListener('cursor-changed', (e: any) => {
      const beat = e.detail.beat;
      
      const playhead = this.shadowRoot!.querySelector('.playhead') as HTMLElement;
      if (playhead) {
        playhead.style.left = `${beat * this.zoomX + 120}px`; // align with grid (120px is header width)
      }

      const noteBlocks = this.shadowRoot!.querySelectorAll('.note-block');
      noteBlocks.forEach(block => {
        const offset = parseFloat(block.getAttribute('data-offset')!);
        const duration = parseFloat(block.getAttribute('data-duration')!);
        const isActive = beat >= offset && beat < offset + duration;
        
        if (isActive) {
          block.classList.add('active');
        } else {
          block.classList.remove('active');
        }
      });
    });
  }

  private refresh() {
    this.render();
  }

  private calculateMaxBeats(): number {
    const comp = store.getComposition();
    if (!comp) return 16;

    let max = 16;
    for (const track of comp.tracks) {
      if (track.melodies) {
        for (const melRef of track.melodies) {
          const melName = typeof melRef === 'string' ? melRef : melRef.name;
          const offsetShift = typeof melRef === 'string' ? 0 : (melRef.offset ?? 0);
          const mel = comp.melodies[melName];
          if (mel) {
            for (const note of mel.notes) {
              const end = note.offset + offsetShift + note.duration;
              if (end > max) max = end;
            }
          }
        }
      }
      if (track.chords && comp.chords) {
        for (const chordRef of track.chords) {
          const end = chordRef.offset + chordRef.duration;
          if (end > max) max = end;
        }
      }
    }
    return Math.ceil((max + 4) / 4) * 4;
  }

  private render() {
    const comp = store.getComposition();
    if (!comp) {
      this.shadowRoot!.innerHTML = `
        <style>
          :host {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted, #8e8e93);
            font-size: 14px;
          }
        </style>
        <div>No project loaded</div>
      `;
      return;
    }

    this.maxBeats = this.calculateMaxBeats();
    const gridWidth = this.maxBeats * this.zoomX;

    // 1. Generate Ruler ticks
    let rulerTicksHtml = '';
    for (let i = 0; i < this.maxBeats; i++) {
      const isBar = i % 4 === 0;
      rulerTicksHtml += `
        <div class="ruler-tick ${isBar ? 'bar-tick' : ''}" style="left: ${i * this.zoomX}px; width: ${this.zoomX}px;">
          <span>${i + 1}</span>
        </div>
      `;
    }

    // 2. Generate Lanes and Note blocks
    let lanesHtml = '';
    comp.tracks.forEach(track => {
      let notesHtml = '';
      
      if (track.melodies) {
        track.melodies.forEach(melRef => {
          const melName = typeof melRef === 'string' ? melRef : melRef.name;
          const offsetShift = typeof melRef === 'string' ? 0 : (melRef.offset ?? 0);
          const melody = comp.melodies[melName];
          if (!melody) return;

          melody.notes.forEach((note: any) => {
            if (note.pitch === 'rest') return;

            const absoluteOffset = note.offset + offsetShift;
            const left = absoluteOffset * this.zoomX;
            const width = note.duration * this.zoomX;
            
            // Color coding based on pitch step (hue shift)
            const pitchColor = `hsl(${(180 + (note.pitch * 15)) % 360}, 80%, 55%)`;

            notesHtml += `
              <div class="note-block" 
                   style="left: ${left}px; width: ${width}px; background: ${pitchColor}; --color-glow: ${pitchColor};"
                   data-offset="${absoluteOffset}" 
                   data-duration="${note.duration}">
                <span class="note-label">${note.pitch}</span>
              </div>
            `;
          });
        });
      }

      if (track.chords && comp.chords) {
        track.chords.forEach(chordRef => {
          const chord = comp.chords![chordRef.name];
          if (!chord) return;

          chord.pitches.forEach(pitch => {
            const left = chordRef.offset * this.zoomX;
            const width = chordRef.duration * this.zoomX;
            
            // Color coding based on pitch step (hue shift)
            const pitchColor = `hsl(${(180 + (pitch * 15)) % 360}, 80%, 55%)`;

            notesHtml += `
              <div class="note-block" 
                   style="left: ${left}px; width: ${width}px; background: ${pitchColor}; --color-glow: ${pitchColor};"
                   data-offset="${chordRef.offset}" 
                   data-duration="${chordRef.duration}">
                <span class="note-label">${pitch}</span>
              </div>
            `;
          });
        });
      }

      lanesHtml += `
        <div class="lane-row" style="height: ${this.laneHeight}px;">
          <div class="lane-header">
            <span class="lane-name">${track.name}</span>
            <span class="lane-vol">${Math.round(track.volume * 100)}%</span>
          </div>
          
          <div class="lane-timeline" style="width: ${gridWidth}px;">
            <!-- Vertical grid cell ticks -->
            ${Array.from({ length: this.maxBeats }).map((_, idx) => {
              const isBar = idx % 4 === 0;
              return `<div class="grid-tick-line ${isBar ? 'bar-line' : ''}" style="left: ${idx * this.zoomX}px; width: ${this.zoomX}px;"></div>`;
            }).join('')}
            
            ${notesHtml}
          </div>
        </div>
      `;
    });

    const containerWidth = gridWidth + 120; // 120px for lane header width

    this.shadowRoot!.innerHTML = `
      <style>${styleText}</style>
      
      <div class="visualizer-header">Playback Visualizer</div>
      
      <div class="scrollable-area">
        <div class="ruler" style="width: ${containerWidth}px;">
          <div class="ruler-left-padding"></div>
          <div class="ruler-ticks" style="width: ${gridWidth}px;">
            ${rulerTicksHtml}
          </div>
        </div>
        
        <div class="lanes-scroll-container" style="width: ${containerWidth}px;">
          <div class="playhead"></div>
          ${lanesHtml}
        </div>
      </div>
    `;
  }
}

customElements.define('mdl-visualizer', Visualizer);
export default Visualizer;
