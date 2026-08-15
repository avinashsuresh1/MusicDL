import { store } from '../state/store.js';
import { audioEngine } from '../engine/audio-engine.js';
import {
  getScheduledNotesForInstrument,
  getScheduledNotesForMelody,
  getScheduledNotesForChord,
  getScheduledNotesForTrack
} from '../engine/scheduler.js';
import styleText from './app-shell.css?inline';
import htmlText from './app-shell.html?raw';

export class AppShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    
    // Subscribe to store events
    store.addEventListener('project-loaded', () => this.updateErrorAlert());
    store.addEventListener('validation-failed', () => this.updateErrorAlert());
    store.addEventListener('composition-changed', () => this.updateErrorAlert());

    // Help modal handlers
    const helpModal = this.shadowRoot!.querySelector('#help-modal') as HTMLElement;
    const closeHelpBtn = this.shadowRoot!.querySelector('#close-help') as HTMLElement;

    this.addEventListener('show-help', () => {
      helpModal.classList.add('visible');
    });

    closeHelpBtn.addEventListener('click', () => {
      helpModal.classList.remove('visible');
    });

    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.remove('visible');
      }
    });

    // Custom non-blocking dialog modal handlers
    const dialogModal = this.shadowRoot!.querySelector('#dialog-modal') as HTMLElement;
    const dialogTitle = this.shadowRoot!.querySelector('#dialog-title') as HTMLElement;
    const dialogMessage = this.shadowRoot!.querySelector('#dialog-message') as HTMLElement;
    const dialogInput = this.shadowRoot!.querySelector('#dialog-input') as HTMLInputElement;
    const dialogCancel = this.shadowRoot!.querySelector('#dialog-cancel') as HTMLElement;
    const dialogConfirm = this.shadowRoot!.querySelector('#dialog-confirm') as HTMLElement;

    let activeCallback: ((val: string | null) => void) | null = null;

    const closeDialog = (res: string | null) => {
      dialogModal.classList.remove('visible');
      if (activeCallback) {
        activeCallback(res);
        activeCallback = null;
      }
    };

    dialogCancel.addEventListener('click', () => closeDialog(null));
    dialogConfirm.addEventListener('click', () => closeDialog(dialogInput.value));
    
    dialogInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') closeDialog(dialogInput.value);
      if (e.key === 'Escape') closeDialog(null);
    });

    this.addEventListener('show-dialog', (e: any) => {
      const opts = e.detail;
      dialogTitle.textContent = opts.title || 'Notification';
      dialogMessage.textContent = opts.message || '';
      
      if (opts.showInput) {
        dialogInput.style.display = 'block';
        dialogInput.value = opts.defaultValue || '';
        setTimeout(() => {
          dialogInput.focus();
          dialogInput.select();
        }, 50);
      } else {
        dialogInput.style.display = 'none';
      }

      dialogCancel.style.display = opts.hideCancel ? 'none' : 'inline-block';
      dialogConfirm.textContent = opts.confirmText || 'OK';
      dialogCancel.textContent = opts.cancelText || 'Cancel';

      activeCallback = opts.callback || null;
      dialogModal.classList.add('visible');
    });

    // Tab switching handlers
    const tabButtons = this.shadowRoot!.querySelectorAll('.tab-btn');
    const tabPanes = this.shadowRoot!.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab')!;
        
        // Remove active class from all buttons and panes
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked button and target pane
        btn.classList.add('active');
        this.shadowRoot!.querySelector(`#${tabId}`)!.classList.add('active');
      });
    });

    // Handle 🧪 test triggers and Alt+T shortcut
    const handleTestFile = (path?: string) => {
      const activePath = path || store.getActiveFilePath();
      const comp = store.getComposition();
      if (!comp || !activePath) return;

      const parts = activePath.split('/');
      if (parts.length < 2) return;

      const folder = parts[0];
      const name = parts[1].replace('.yaml', '');

      let notes: any[] = [];
      if (folder === 'instruments') {
        notes = getScheduledNotesForInstrument(name, comp);
      } else if (folder === 'melodies') {
        notes = getScheduledNotesForMelody(name, comp);
      } else if (folder === 'chords') {
        notes = getScheduledNotesForChord(name, comp);
      } else if (folder === 'tracks') {
        notes = getScheduledNotesForTrack(name, comp);
      }

      if (notes.length > 0) {
        audioEngine.playPreview(notes);
      }
    };

    this.addEventListener('trigger-test', () => handleTestFile());
    this.addEventListener('trigger-test-file', (e: any) => handleTestFile(e.detail.path));

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleTestFile();
      }
    });

    // Resizable Panels Handlers
    const explorerEl = this.shadowRoot!.querySelector('mdl-explorer') as HTMLElement;
    const resizerSidebar = this.shadowRoot!.querySelector('#resizer-sidebar') as HTMLElement;
    
    const bottomPanelEl = this.shadowRoot!.querySelector('.bottom-panel') as HTMLElement;
    const resizerBottom = this.shadowRoot!.querySelector('#resizer-bottom') as HTMLElement;

    // Sidebar Resizer (Horizontal)
    if (resizerSidebar && explorerEl) {
      let isDraggingSidebar = false;

      resizerSidebar.addEventListener('pointerdown', (e: PointerEvent) => {
        isDraggingSidebar = true;
        resizerSidebar.setPointerCapture(e.pointerId);
        resizerSidebar.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
      });

      resizerSidebar.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isDraggingSidebar) return;
        const rect = this.getBoundingClientRect();
        const newWidth = Math.max(160, Math.min(e.clientX - rect.left, window.innerWidth * 0.5));
        explorerEl.style.width = `${newWidth}px`;
      });

      const stopSidebarDrag = (e: PointerEvent) => {
        if (isDraggingSidebar) {
          isDraggingSidebar = false;
          try { resizerSidebar.releasePointerCapture(e.pointerId); } catch {}
          resizerSidebar.classList.remove('dragging');
          document.body.style.cursor = '';
        }
      };

      resizerSidebar.addEventListener('pointerup', stopSidebarDrag);
      resizerSidebar.addEventListener('pointercancel', stopSidebarDrag);
    }

    // Bottom Panel Resizer (Vertical)
    if (resizerBottom && bottomPanelEl) {
      let isDraggingBottom = false;

      resizerBottom.addEventListener('pointerdown', (e: PointerEvent) => {
        isDraggingBottom = true;
        resizerBottom.setPointerCapture(e.pointerId);
        resizerBottom.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
      });

      resizerBottom.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isDraggingBottom) return;
        const rect = this.getBoundingClientRect();
        const newHeight = Math.max(100, Math.min(rect.bottom - e.clientY, window.innerHeight * 0.6));
        bottomPanelEl.style.height = `${newHeight}px`;
      });

      const stopBottomDrag = (e: PointerEvent) => {
        if (isDraggingBottom) {
          isDraggingBottom = false;
          try { resizerBottom.releasePointerCapture(e.pointerId); } catch {}
          resizerBottom.classList.remove('dragging');
          document.body.style.cursor = '';
        }
      };

      resizerBottom.addEventListener('pointerup', stopBottomDrag);
      resizerBottom.addEventListener('pointercancel', stopBottomDrag);
    }
  }

  private updateErrorAlert() {
    const errors = store.getErrors();
    const errorBar = this.shadowRoot!.querySelector('.error-bar') as HTMLElement;
    
    if (errors.length > 0) {
      errorBar.classList.add('visible');
      errorBar.innerHTML = `
        <div class="error-icon">⚠</div>
        <div class="error-msg">
          <strong>Validation Error [${errors[0].path}]:</strong> ${errors[0].message}
          ${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}
        </div>
      `;
    } else {
      errorBar.classList.remove('visible');
    }
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>${styleText}</style>
      ${htmlText}
    `;
  }
}

customElements.define('mdl-app', AppShell);
export default AppShell;
