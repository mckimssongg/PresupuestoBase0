/**
 * Helper Utilities
 * Common utility functions used throughout the app
 */

/**
 * Format amount with currency symbol
 * Always shows the full number
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency symbol (default: Q)
 * @returns {string} Formatted amount
 */
export function formatCurrency(amount, currency = 'Q') {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (absAmount >= 1000000) {
    const formatter = new Intl.NumberFormat('es-GT', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    });
    return `${sign}${currency}${formatter.format(absAmount)}`;
  }
  
  const formatted = absAmount.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${sign}${currency}${formatted}`;
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string or YYYY-MM-DD
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Format full date with time
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date with time
 */
export function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get month name from YYYY-MM string
 * @param {string} monthString - Month in YYYY-MM format
 * @returns {string} Month name (e.g., "Enero 2024")
 */
export function getMonthName(monthString) {
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('es-GT', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Validate numeric input
 * @param {string|number} value - Value to validate
 * @returns {boolean} True if valid positive number
 */
export function isValidAmount(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && isFinite(num);
}

/**
 * Validate required string
 * @param {string} value - Value to validate
 * @returns {boolean} True if non-empty string
 */
export function isValidString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Calculate percentage, clamped to 0-100
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
export function calculatePercentage(value, total) {
  if (total <= 0) return 0;
  const percentage = (value / total) * 100;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Get progress bar status based on percentage
 * @param {number} percentage - Current percentage
 * @returns {'normal' | 'warning' | 'danger'} Status class
 */
export function getProgressStatus(percentage) {
  if (percentage >= 100) return 'danger';
  if (percentage >= 80) return 'warning';
  return 'normal';
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Create element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {Array|string} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (Array.isArray(children)) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
  } else if (typeof children === 'string') {
    element.textContent = children;
  }
  
  return element;
}

/**
 * Simple HTML sanitizer
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}
