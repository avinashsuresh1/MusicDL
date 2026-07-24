import { store } from '../state/store.js';
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
