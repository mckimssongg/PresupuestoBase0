/**
 * Database Service
 * Handles all IndexedDB operations with proper error handling
 */

import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, STORES, STORE_INDEXES, SETTINGS_SCHEMA } from './schema.js';

let dbInstance = null;

/**
 * Generate a unique ID (UUID v4 compatible)
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Initialize and get database instance
 * @returns {Promise<IDBDatabase>}
 */
export async function getDB() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading database from v${oldVersion} to v${newVersion}`);

        // Create Settings store (simple key-value)
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }

        // Create Fixed Expenses store
        if (!db.objectStoreNames.contains(STORES.FIXED_EXPENSES)) {
          const store = db.createObjectStore(STORES.FIXED_EXPENSES, { keyPath: 'id' });
          STORE_INDEXES[STORES.FIXED_EXPENSES]?.forEach((index) => {
            store.createIndex(index.name, index.keyPath);
          });
        }

        // Create Categories store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          const store = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
          STORE_INDEXES[STORES.CATEGORIES]?.forEach((index) => {
            store.createIndex(index.name, index.keyPath);
          });
        }

        // Create Expenses store
        if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
          const store = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
          STORE_INDEXES[STORES.EXPENSES]?.forEach((index) => {
            store.createIndex(index.name, index.keyPath);
          });
        }

        // Create Monthly Archives store (v2+)
        if (!db.objectStoreNames.contains(STORES.MONTHLY_ARCHIVES)) {
          const store = db.createObjectStore(STORES.MONTHLY_ARCHIVES, { keyPath: 'id' });
          STORE_INDEXES[STORES.MONTHLY_ARCHIVES]?.forEach((index) => {
            store.createIndex(index.name, index.keyPath);
          });
        }
      },
      blocked() {
        console.warn('Database upgrade blocked. Please close other tabs.');
      },
      blocking() {
        console.warn('This connection is blocking a database upgrade.');
        dbInstance?.close();
        dbInstance = null;
      },
      terminated() {
        console.error('Database connection terminated unexpectedly.');
        dbInstance = null;
      }
    });

    // Initialize default settings if needed
    await initializeSettings();

    return dbInstance;
  } catch (error) {
    console.error('Failed to open database:', error);
    throw new Error('No se pudo abrir la base de datos. Por favor, recarga la página.');
  }
}

/**
 * Initialize default settings if they don't exist
 */
async function initializeSettings() {
  const db = dbInstance;
  const settings = await db.get(STORES.SETTINGS, 'main');
  
  if (!settings) {
    const now = new Date().toISOString();
    await db.put(STORES.SETTINGS, {
      ...SETTINGS_SCHEMA,
      id: 'main',
      currentMonth: getCurrentMonth(),
      createdAt: now,
      updatedAt: now
    });
  }
}

// ==========================================
// Settings Operations
// ==========================================

/**
 * Get application settings
 */
export async function getSettings() {
  const db = await getDB();
  return db.get(STORES.SETTINGS, 'main');
}

/**
 * Update application settings
 */
export async function updateSettings(updates) {
  const db = await getDB();
  const current = await getSettings();
  
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put(STORES.SETTINGS, updated);
  return updated;
}

// ==========================================
// Fixed Expenses Operations
// ==========================================

/**
 * Get all fixed expenses
 */
export async function getAllFixedExpenses() {
  const db = await getDB();
  return db.getAllFromIndex(STORES.FIXED_EXPENSES, 'createdAt');
}

/**
 * Create a fixed expense
 */
export async function createFixedExpense(data) {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const expense = {
    id: generateId(),
    name: data.name?.trim() || '',
    amount: parseFloat(data.amount) || 0,
    createdAt: now,
    updatedAt: now
  };
  
  await db.add(STORES.FIXED_EXPENSES, expense);
  return expense;
}

/**
 * Update a fixed expense
 */
export async function updateFixedExpense(id, updates) {
  const db = await getDB();
  const current = await db.get(STORES.FIXED_EXPENSES, id);
  
  if (!current) {
    throw new Error('Gasto fijo no encontrado');
  }
  
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put(STORES.FIXED_EXPENSES, updated);
  return updated;
}

/**
 * Delete a fixed expense
 */
export async function deleteFixedExpense(id) {
  const db = await getDB();
  await db.delete(STORES.FIXED_EXPENSES, id);
}

// ==========================================
// Categories Operations
// ==========================================

/**
 * Get all categories
 */
export async function getAllCategories() {
  const db = await getDB();
  return db.getAllFromIndex(STORES.CATEGORIES, 'createdAt');
}

/**
 * Get a single category by ID
 */
export async function getCategory(id) {
  const db = await getDB();
  return db.get(STORES.CATEGORIES, id);
}

/**
 * Create a category
 */
export async function createCategory(data) {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const category = {
    id: generateId(),
    name: data.name?.trim() || '',
    budgetLimit: parseFloat(data.budgetLimit) || 0,
    color: data.color || '#00d4aa',
    icon: data.icon || null,
    createdAt: now,
    updatedAt: now
  };
  
  await db.add(STORES.CATEGORIES, category);
  return category;
}

/**
 * Update a category
 */
export async function updateCategory(id, updates) {
  const db = await getDB();
  const current = await db.get(STORES.CATEGORIES, id);
  
  if (!current) {
    throw new Error('Categoría no encontrada');
  }
  
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put(STORES.CATEGORIES, updated);
  return updated;
}

/**
 * Delete a category and all its expenses
 */
export async function deleteCategory(id) {
  const db = await getDB();
  
  // Delete all expenses in this category
  const tx = db.transaction([STORES.CATEGORIES, STORES.EXPENSES], 'readwrite');
  const expenseStore = tx.objectStore(STORES.EXPENSES);
  const index = expenseStore.index('categoryId');
  
  let cursor = await index.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  
  // Delete category
  await tx.objectStore(STORES.CATEGORIES).delete(id);
  await tx.done;
}

// ==========================================
// Expenses Operations
// ==========================================

/**
 * Get all expenses for current month
 */
export async function getExpensesForMonth(month = null) {
  const db = await getDB();
  const targetMonth = month || getCurrentMonth();
  return db.getAllFromIndex(STORES.EXPENSES, 'month', targetMonth);
}

/**
 * Get expenses by category for current month
 */
export async function getExpensesByCategory(categoryId, month = null) {
  const db = await getDB();
  const allExpenses = await getExpensesForMonth(month);
  return allExpenses.filter(e => e.categoryId === categoryId);
}

/**
 * Create an expense
 */
export async function createExpense(data) {
  const db = await getDB();
  const now = new Date().toISOString();
  const expenseDate = data.date || now.split('T')[0];
  const [year, month] = expenseDate.split('-');
  
  const expense = {
    id: generateId(),
    categoryId: data.categoryId,
    description: data.description?.trim() || '',
    amount: parseFloat(data.amount) || 0,
    date: expenseDate,
    month: `${year}-${month}`,
    createdAt: now,
    updatedAt: now
  };
  
  await db.add(STORES.EXPENSES, expense);
  return expense;
}

/**
 * Update an expense
 */
export async function updateExpense(id, updates) {
  const db = await getDB();
  const current = await db.get(STORES.EXPENSES, id);
  
  if (!current) {
    throw new Error('Gasto no encontrado');
  }
  
  // Recalculate month if date changed
  let month = current.month;
  if (updates.date) {
    const [year, m] = updates.date.split('-');
    month = `${year}-${m}`;
  }
  
  const updated = {
    ...current,
    ...updates,
    month,
    updatedAt: new Date().toISOString()
  };
  
  await db.put(STORES.EXPENSES, updated);
  return updated;
}

/**
 * Delete an expense
 */
export async function deleteExpense(id) {
  const db = await getDB();
  await db.delete(STORES.EXPENSES, id);
}

// ==========================================
// Aggregation Operations
// ==========================================

/**
 * Get total fixed expenses
 */
export async function getTotalFixedExpenses() {
  const expenses = await getAllFixedExpenses();
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Get total budgeted amount (sum of category limits)
 */
export async function getTotalBudgeted() {
  const categories = await getAllCategories();
  return categories.reduce((sum, c) => sum + c.budgetLimit, 0);
}

/**
 * Get spending summary for current month
 */
export async function getMonthlySpendingSummary(month = null) {
  const [categories, expenses] = await Promise.all([
    getAllCategories(),
    getExpensesForMonth(month)
  ]);
  
  const categorySpending = {};
  categories.forEach(cat => {
    categorySpending[cat.id] = {
      category: cat,
      spent: 0,
      remaining: cat.budgetLimit,
      percentage: 0,
      expenses: []
    };
  });
  
  expenses.forEach(expense => {
    if (categorySpending[expense.categoryId]) {
      const catData = categorySpending[expense.categoryId];
      catData.spent += expense.amount;
      catData.remaining = catData.category.budgetLimit - catData.spent;
      catData.percentage = catData.category.budgetLimit > 0 
        ? (catData.spent / catData.category.budgetLimit) * 100 
        : 0;
      catData.expenses.push(expense);
    }
  });
  
  return categorySpending;
}

/**
 * Export all data for backup
 * Now includes all months' expenses and archives
 */
export async function exportData() {
  const db = await getDB();
  
  const [settings, fixedExpenses, categories, allExpenses, archives] = await Promise.all([
    getSettings(),
    getAllFixedExpenses(),
    getAllCategories(),
    db.getAll(STORES.EXPENSES), // Get ALL expenses, not just current month
    db.getAll(STORES.MONTHLY_ARCHIVES)
  ]);
  
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'Presupuesto Base Cero',
    data: {
      settings,
      fixedExpenses,
      categories,
      expenses: allExpenses,
      monthlyArchives: archives
    }
  };
}

/**
 * Import data from backup
 * Now supports archives
 */
export async function importData(backup) {
  if (!backup?.data) {
    throw new Error('Archivo de backup inválido');
  }
  
  const db = await getDB();
  const { settings, fixedExpenses, categories, expenses, monthlyArchives } = backup.data;
  
  // Clear existing data
  const stores = [STORES.SETTINGS, STORES.FIXED_EXPENSES, STORES.CATEGORIES, STORES.EXPENSES];
  if (db.objectStoreNames.contains(STORES.MONTHLY_ARCHIVES)) {
    stores.push(STORES.MONTHLY_ARCHIVES);
  }
  
  const tx = db.transaction(stores, 'readwrite');
  
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  
  // Import all data
  if (settings) {
    await tx.objectStore(STORES.SETTINGS).put(settings);
  }
  
  for (const item of fixedExpenses || []) {
    await tx.objectStore(STORES.FIXED_EXPENSES).put(item);
  }
  
  for (const item of categories || []) {
    await tx.objectStore(STORES.CATEGORIES).put(item);
  }
  
  for (const item of expenses || []) {
    await tx.objectStore(STORES.EXPENSES).put(item);
  }
  
  // Import archives if store exists
  if (db.objectStoreNames.contains(STORES.MONTHLY_ARCHIVES) && monthlyArchives) {
    for (const item of monthlyArchives) {
      await tx.objectStore(STORES.MONTHLY_ARCHIVES).put(item);
    }
  }
  
  await tx.done;
}

// ==========================================
// Monthly Archive Operations
// ==========================================

/**
 * Get all monthly archives
 * @returns {Promise<Array>} List of archived months
 */
export async function getAllArchives() {
  const db = await getDB();
  const archives = await db.getAllFromIndex(STORES.MONTHLY_ARCHIVES, 'closedAt');
  // Sort by month descending (most recent first)
  return archives.sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Get a specific monthly archive
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object|null>} Archive data
 */
export async function getArchive(month) {
  const db = await getDB();
  return db.get(STORES.MONTHLY_ARCHIVES, month);
}

/**
 * Check if a month has been archived
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<boolean>}
 */
export async function isMonthArchived(month) {
  const archive = await getArchive(month);
  return !!archive;
}

/**
 * Close the current month and archive it
 * Creates a snapshot of all data and clears current month expenses
 * @param {string} [month] - Month to close (defaults to current month)
 * @returns {Promise<Object>} The created archive
 */
export async function closeMonth(month = null) {
  const targetMonth = month || getCurrentMonth();
  
  // Check if already archived
  const existing = await getArchive(targetMonth);
  if (existing) {
    throw new Error(`El mes ${targetMonth} ya fue cerrado anteriormente.`);
  }
  
  // Gather all data for the month
  const [settings, fixedExpenses, categories, expenses] = await Promise.all([
    getSettings(),
    getAllFixedExpenses(),
    getAllCategories(),
    getExpensesForMonth(targetMonth)
  ]);
  
  // Calculate totals
  const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBudgeted = categories.reduce((sum, c) => sum + c.budgetLimit, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyIncome = settings?.monthlyIncome || 0;
  const totalSaved = monthlyIncome - totalFixedExpenses - totalSpent;
  
  // Build category spending snapshot
  const categorySnapshots = categories.map(cat => {
    const catExpenses = expenses.filter(e => e.categoryId === cat.id);
    const spent = catExpenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      ...cat,
      spent,
      remaining: cat.budgetLimit - spent,
      percentage: cat.budgetLimit > 0 ? (spent / cat.budgetLimit) * 100 : 0
    };
  });
  
  // Create archive record
  const archive = {
    id: targetMonth,
    month: targetMonth,
    closedAt: new Date().toISOString(),
    summary: {
      monthlyIncome,
      totalFixedExpenses,
      totalBudgeted,
      totalSpent,
      totalSaved,
      currency: settings?.currency || 'Q'
    },
    fixedExpenses: [...fixedExpenses],
    categories: categorySnapshots,
    expenses: [...expenses]
  };
  
  // Save archive and delete current month's expenses
  const db = await getDB();
  const tx = db.transaction([STORES.MONTHLY_ARCHIVES, STORES.EXPENSES], 'readwrite');
  
  // Save archive
  await tx.objectStore(STORES.MONTHLY_ARCHIVES).put(archive);
  
  // Delete expenses for this month
  const expenseStore = tx.objectStore(STORES.EXPENSES);
  const monthIndex = expenseStore.index('month');
  let cursor = await monthIndex.openCursor(IDBKeyRange.only(targetMonth));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  
  await tx.done;
  
  // Update settings to next month if closing current month
  if (targetMonth === getCurrentMonth()) {
    const [year, monthNum] = targetMonth.split('-').map(Number);
    const nextMonth = monthNum === 12 
      ? `${year + 1}-01` 
      : `${year}-${String(monthNum + 1).padStart(2, '0')}`;
    await updateSettings({ currentMonth: nextMonth });
  }
  
  return archive;
}

/**
 * Delete an archive (use with caution)
 * @param {string} month - Month in YYYY-MM format
 */
export async function deleteArchive(month) {
  const db = await getDB();
  await db.delete(STORES.MONTHLY_ARCHIVES, month);
}

/**
 * Get all expenses (across all months, not just current)
 */
export async function getAllExpenses() {
  const db = await getDB();
  return db.getAll(STORES.EXPENSES);
}

