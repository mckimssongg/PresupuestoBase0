/**
 * Database Schema Constants
 * Defines the structure of our IndexedDB stores
 */

export const DB_NAME = 'presupuesto-base-cero';
export const DB_VERSION = 3; // Added order field for drag-drop

/**
 * Store names
 */
export const STORES = {
  SETTINGS: 'settings',
  FIXED_EXPENSES: 'fixedExpenses',
  CATEGORIES: 'categories',
  EXPENSES: 'expenses',
  MONTHLY_ARCHIVES: 'monthlyArchives'
};

/**
 * Settings store schema
 * Single record that holds global app settings
 */
export const SETTINGS_SCHEMA = {
  id: 'main', // Single settings record
  monthlyIncome: 0,
  currency: 'Q',
  currentMonth: null, // YYYY-MM format
  createdAt: null,
  updatedAt: null
};

/**
 * Available currencies for Central American countries
 */
export const AVAILABLE_CURRENCIES = [
  { code: 'Q', name: 'Quetzal', country: 'Guatemala', symbol: 'Q' },
  { code: 'MXN', name: 'Peso Mexicano', country: 'México', symbol: '$' },
  { code: 'CRC', name: 'Colón', country: 'Costa Rica', symbol: '₡' },
  { code: 'HNL', name: 'Lempira', country: 'Honduras', symbol: 'L' },
  { code: 'NIO', name: 'Córdoba', country: 'Nicaragua', symbol: 'C$' },
  { code: 'USD', name: 'Dólar', country: 'El Salvador', symbol: '$' }
];

/**
 * Fixed Expense schema
 * Recurring monthly expenses (rent, utilities, etc.)
 */
export const FIXED_EXPENSE_SCHEMA = {
  id: null, // Auto-generated UUID
  name: '',
  amount: 0,
  order: 0, // For drag-drop reordering
  createdAt: null,
  updatedAt: null
};

/**
 * Category schema
 * Budget categories with spending limits
 */
export const CATEGORY_SCHEMA = {
  id: null, // Auto-generated UUID
  name: '',
  budgetLimit: 0,
  color: '#00d4aa',
  icon: null,
  order: 0, // For drag-drop reordering
  createdAt: null,
  updatedAt: null
};

/**
 * Expense schema
 * Individual expenses linked to categories
 */
export const EXPENSE_SCHEMA = {
  id: null, // Auto-generated UUID
  categoryId: null, // Foreign key to category
  description: '',
  amount: 0,
  date: null, // ISO date string
  month: null, // YYYY-MM format for filtering
  createdAt: null,
  updatedAt: null
};

/**
 * Monthly Archive schema
 * Snapshot of a closed month
 */
export const MONTHLY_ARCHIVE_SCHEMA = {
  id: null, // YYYY-MM format (unique per month)
  month: null, // YYYY-MM format
  closedAt: null, // ISO timestamp when closed
  summary: {
    monthlyIncome: 0,
    totalFixedExpenses: 0,
    totalBudgeted: 0,
    totalSpent: 0,
    totalSaved: 0
  },
  fixedExpenses: [], // Snapshot of fixed expenses
  categories: [], // Snapshot with spending data
  expenses: [] // All expenses for the month
};

/**
 * Default category colors
 */
export const CATEGORY_COLORS = [
  '#00d4aa', // Teal (primary)
  '#6c5ce7', // Purple
  '#fd79a8', // Pink
  '#00b894', // Green
  '#e17055', // Orange
  '#0984e3', // Blue
  '#fdcb6e', // Yellow
  '#74b9ff', // Light Blue
  '#a29bfe', // Light Purple
  '#ff7675', // Coral
  '#55a3ff', // Sky Blue
  '#ffeaa7'  // Light Yellow
];

/**
 * Index definitions for each store
 */
export const STORE_INDEXES = {
  [STORES.FIXED_EXPENSES]: [
    { name: 'createdAt', keyPath: 'createdAt' }
  ],
  [STORES.CATEGORIES]: [
    { name: 'createdAt', keyPath: 'createdAt' },
    { name: 'name', keyPath: 'name' }
  ],
  [STORES.EXPENSES]: [
    { name: 'categoryId', keyPath: 'categoryId' },
    { name: 'month', keyPath: 'month' },
    { name: 'date', keyPath: 'date' },
    { name: 'createdAt', keyPath: 'createdAt' }
  ],
  [STORES.MONTHLY_ARCHIVES]: [
    { name: 'month', keyPath: 'month' },
    { name: 'closedAt', keyPath: 'closedAt' }
  ]
};
