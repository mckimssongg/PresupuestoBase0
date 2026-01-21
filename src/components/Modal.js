/**
 * Modal Component
 * Reusable bottom sheet modal for forms
 */

import { getIcon } from './Icons.js';

let activeModal = null;

/**
 * Open a modal
 * @param {Object} options Modal options
 * @param {string} options.title Modal title
 * @param {string} options.content HTML content
 * @param {Function} [options.onSubmit] Form submit handler
 * @param {Function} [options.onClose] Close handler
 */
export function openModal({ title, content, onSubmit, onClose }) {
  // Close any existing modal
  closeModal();
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-drawer" role="dialog" aria-labelledby="modal-title">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">${title}</h2>
        <button class="modal-close" aria-label="Cerrar" id="modal-close-btn">
          ${getIcon('close')}
        </button>
      </div>
      <div class="modal-content">
        ${content}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  
  // Store reference
  activeModal = { overlay, onSubmit, onClose };
  
  // Event listeners
  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  // Form submit handler
  if (onSubmit) {
    const form = overlay.querySelector('form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        await onSubmit(data);
      });
    }
  }
  
  // Focus first input
  const firstInput = overlay.querySelector('input, select, textarea');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
  
  return overlay;
}

/**
 * Close the active modal
 */
export function closeModal() {
  if (!activeModal) return;
  
  const { overlay, onClose } = activeModal;
  
  overlay.classList.remove('active');
  
  setTimeout(() => {
    overlay.remove();
    document.body.style.overflow = '';
    if (onClose) onClose();
  }, 250);
  
  activeModal = null;
}

/**
 * Show confirmation dialog
 * @param {Object} options Dialog options
 * @returns {Promise<boolean>} User's choice
 */
export function confirm({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'confirm-overlay';
    
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-dialog-buttons">
          <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    const cleanup = (result) => {
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    };
    
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}
