import { store } from '../state/store.js';
import styleText from './explorer.css?inline';

export class Explorer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  private setupListeners() {
    store.addEventListener('project-loaded', () => this.render());
    store.addEventListener('active-file-changed', () => this.render());
    store.addEventListener('composition-changed', () => this.render());
    store.addEventListener('validation-failed', () => this.render());
  }

  private render() {
    const files = store.getFiles();
    const activePath = store.getActiveFilePath();
    const errors = store.getErrors();

    const filePaths = Object.keys(files).sort();

    if (filePaths.length === 0) {
      this.shadowRoot!.innerHTML = `
        <style>
          :host {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted, #8e8e93);
            font-size: 13px;
          }
        </style>
        <div>No project loaded</div>
      `;
      return;
    }

    // Organize files into root and folders
    const rootFiles: string[] = [];
    const folders: Record<string, string[]> = {
      'instruments': [],
      'melodies': [],
      'chords': [],
      'tracks': []
    };

    filePaths.forEach(path => {
      const parts = path.split('/');
      if (parts.length === 1) {
        rootFiles.push(path);
      } else {
        const folder = parts[0];
        if (folders[folder]) {
          folders[folder].push(path);
        } else {
          folders[folder] = [path];
        }
      }
    });

    let html = `
      <style>${styleText}</style>
      <div class="title">Project Explorer</div>
      <div class="tree-container">
    `;

    // 1. Root Files
    rootFiles.forEach(path => {
      const activeCls = path === activePath ? 'active' : '';
      const hasError = errors.some(e => e.path === path);
      
      html += `
        <div class="file-item root-file ${activeCls} ${hasError ? 'has-error' : ''}" data-path="${path}">
          <div style="display: flex; align-items: center; flex: 1;">
            <span class="icon">📄</span>
            <span class="name">${path}</span>
          </div>
          ${hasError ? '<div class="error-badge"></div>' : ''}
        </div>
      `;
    });

    // 2. Folders
    Object.entries(folders).forEach(([folderName, filesList]) => {
      html += `
        <div class="folder-group">
          <div class="folder-header">
            <div style="display: flex; align-items: center; flex: 1;">
              <span class="icon">📁</span>
              <span>${folderName}</span>
            </div>
            <button class="add-file-btn" data-folder="${folderName}" title="Add File">+</button>
          </div>
      `;

      filesList.forEach(path => {
        const activeCls = path === activePath ? 'active' : '';
        const hasError = errors.some(e => e.path === path);
        const fileName = path.split('/')[1];

        html += `
          <div class="file-item ${activeCls} ${hasError ? 'has-error' : ''}" data-path="${path}">
            <div style="display: flex; align-items: center; flex: 1;">
              <span class="icon">${this.getFileIcon(folderName)}</span>
              <span class="name">${fileName}</span>
            </div>
            <div class="actions">
              <button class="action-btn btn-rename" title="Rename" data-path="${path}">✏️</button>
              <button class="action-btn btn-delete" title="Delete" data-path="${path}">🗑️</button>
            </div>
            ${hasError ? '<div class="error-badge"></div>' : ''}
          </div>
        `;
      });

      html += `</div>`;
    });

    html += `</div>`;

    this.shadowRoot!.innerHTML = html;

    // Attach click listeners
    const items = this.shadowRoot!.querySelectorAll('.file-item');
    items.forEach(item => {
      item.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('action-btn')) {
          return;
        }
        const path = item.getAttribute('data-path')!;
        store.setActiveFilePath(path);
      });
    });

    // Attach rename listeners
    const renameBtns = this.shadowRoot!.querySelectorAll('.btn-rename');
    renameBtns.forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const path = btn.getAttribute('data-path')!;
        const parts = path.split('/');
        const dir = parts[0];
        const oldNameWithExt = parts[1];
        const oldName = oldNameWithExt.replace(/\.ya?ml$/i, '');

        const newName = prompt(`Rename ${oldName} to:`, oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          const newPath = `${dir}/${newName.trim()}.yaml`;
          store.renameFile(path, newPath).catch(err => alert(err.message));
        }
      });
    });

    // Attach delete listeners
    const deleteBtns = this.shadowRoot!.querySelectorAll('.btn-delete');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const path = btn.getAttribute('data-path')!;
        const fileName = path.split('/')[1];

        if (confirm(`Are you sure you want to delete ${fileName}?`)) {
          store.deleteFile(path).catch(err => alert(err.message));
        }
      });
    });

    // Attach add file listeners
    const addBtns = this.shadowRoot!.querySelectorAll('.add-file-btn');
    addBtns.forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const folder = btn.getAttribute('data-folder')!;
        const singular = folder.slice(0, -1);

        const name = prompt(`Enter new ${singular} name:`);
        if (name && name.trim()) {
          store.addFile(folder, name.trim()).catch(err => alert(err.message));
        }
      });
    });
  }

  private getFileIcon(folder: string): string {
    if (folder === 'instruments') return '🎛️';
    if (folder === 'melodies') return '🎹';
    if (folder === 'chords') return '🎶';
    if (folder === 'tracks') return '🔀';
    return '📄';
  }
}

customElements.define('mdl-explorer', Explorer);
export default Explorer;
