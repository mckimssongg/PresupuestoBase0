/**
 * Error Handler & Toast Notifications
 * Centralized error handling and user feedback
 */

let toastContainer = null;

/**
 * Initialize toast container
 */
function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {'success' | 'error' | 'warning' | 'info'} type - Toast type
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = ensureToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  
  // Add icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Remove toast after duration
  setTimeout(() => {
    toast.remove();
  }, duration);
}

/**
 * Handle errors gracefully
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 */
export function handleError(error, context = '') {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  
  // User-friendly error messages
  let message = 'Ocurrió un error inesperado';
  
  if (error.message) {
    // Check for known error types
    if (error.message.includes('QuotaExceededError')) {
      message = 'Sin espacio de almacenamiento. Intenta eliminar algunos datos.';
    } else if (error.message.includes('NotFoundError')) {
      message = 'El elemento no fue encontrado';
    } else if (error.name === 'ValidationError') {
      message = error.message;
    } else if (error.message.includes('no encontrad')) {
      message = error.message;
    } else {
      message = error.message;
    }
  }
  
  showToast(message, 'error');
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate form data
 * @param {Object} data - Form data object
 * @param {Object} rules - Validation rules
 * @throws {ValidationError} If validation fails
 */
export function validateForm(data, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    if (rule.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`${rule.label || field} es requerido`);
    }
    
    if (rule.type === 'number' && value !== '') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new ValidationError(`${rule.label || field} debe ser un número`);
      }
      if (rule.min !== undefined && num < rule.min) {
        throw new ValidationError(`${rule.label || field} debe ser al menos ${rule.min}`);
      }
      if (rule.max !== undefined && num > rule.max) {
        throw new ValidationError(`${rule.label || field} debe ser menor a ${rule.max}`);
      }
    }
    
    if (rule.type === 'string' && rule.minLength && value.length < rule.minLength) {
      throw new ValidationError(
        `${rule.label || field} debe tener al menos ${rule.minLength} caracteres`
      );
    }
    
    if (rule.type === 'string' && rule.maxLength && value.length > rule.maxLength) {
      throw new ValidationError(
        `${rule.label || field} debe tener máximo ${rule.maxLength} caracteres`
      );
    }
  }
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = '') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      return null;
    }
  };
}
