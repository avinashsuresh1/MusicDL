import { store } from '../state/store.js';
import styleText from './code-editor.css?inline';
import htmlText from './code-editor.html?raw';

export class CodeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  private setupListeners() {
    store.addEventListener('active-file-changed', () => {
      this.refreshHeader();
      this.refreshTextarea();
    });

    store.addEventListener('project-loaded', () => {
      this.refreshHeader();
      this.refreshTextarea();
    });
  }

  private refreshHeader() {
    const headerTitle = this.shadowRoot!.querySelector('.editor-title') as HTMLElement;
    if (headerTitle) {
      headerTitle.textContent = store.getActiveFilePath();
    }
  }

  private refreshTextarea() {
    const files = store.getFiles();
    const activePath = store.getActiveFilePath();
    const textarea = this.shadowRoot!.querySelector('.editor-textarea') as HTMLTextAreaElement;
    
    if (textarea) {
      textarea.value = files[activePath] || '';
    }
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>${styleText}</style>
      ${htmlText}
    `;

    this.refreshHeader();
    this.refreshTextarea();

    const textarea = this.shadowRoot!.querySelector('.editor-textarea') as HTMLTextAreaElement;
    if (textarea) {
      // 1. Support real-time typing / reparsing
      textarea.addEventListener('input', () => {
        store.updateFile(store.getActiveFilePath(), textarea.value);
      });

      // 2. Custom tab key handling (inserts 2 spaces)
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          
          textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
          
          // Trigger input event to re-parse in store
          textarea.dispatchEvent(new Event('input'));
        }
      });
    }
  }
}

customElements.define('mdl-code-editor', CodeEditor);
export default CodeEditor;
