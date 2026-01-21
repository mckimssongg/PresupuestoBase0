/**
 * Budget Service
 * Business logic for budget calculations
 */

import * as db from '../db/database.js';
import { calculatePercentage } from '../utils/helpers.js';

/**
 * Get complete budget overview
 * @returns {Promise<Object>} Budget summary
 */
export async function getBudgetOverview() {
  const [settings, fixedExpenses, categories, expenses] = await Promise.all([
    db.getSettings(),
    db.getAllFixedExpenses(),
    db.getAllCategories(),
    db.getExpensesForMonth()
  ]);
  
  const monthlyIncome = settings?.monthlyIncome || 0;
  const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBudgeted = categories.reduce((sum, c) => sum + c.budgetLimit, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Available for budgeting (after fixed expenses)
  const availableForBudget = monthlyIncome - totalFixedExpenses;
  
  // Remaining from budgets (unspent from category limits)
  const remainingBudget = totalBudgeted - totalSpent;
  
  // Unassigned money (available but not assigned to categories)
  const unassigned = availableForBudget - totalBudgeted;
  
  // Real available (what's actually left)
  const realAvailable = monthlyIncome - totalFixedExpenses - totalSpent;
  
  return {
    monthlyIncome,
    totalFixedExpenses,
    totalBudgeted,
    totalSpent,
    availableForBudget,
    remainingBudget,
    unassigned,
    realAvailable,
    currency: settings?.currency || 'Q',
    currentMonth: settings?.currentMonth || db.getCurrentMonth(),
    // Percentages
    fixedExpensesPercent: calculatePercentage(totalFixedExpenses, monthlyIncome),
    budgetedPercent: calculatePercentage(totalBudgeted, availableForBudget),
    spentPercent: calculatePercentage(totalSpent, totalBudgeted)
  };
}

/**
 * Get category with spending details
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object|null>} Category with spending info
 */
export async function getCategoryWithSpending(categoryId) {
  const [category, expenses] = await Promise.all([
    db.getCategory(categoryId),
    db.getExpensesByCategory(categoryId)
  ]);
  
  if (!category) return null;
  
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = category.budgetLimit - spent;
  const percentage = calculatePercentage(spent, category.budgetLimit);
  
  return {
    ...category,
    spent,
    remaining,
    percentage,
    expenses: expenses.sort((a, b) => new Date(b.date) - new Date(a.date))
  };
}

/**
 * Get all categories with spending summary
 * @returns {Promise<Array>} Categories with spending
 */
export async function getAllCategoriesWithSpending() {
  const [categories, expenses] = await Promise.all([
    db.getAllCategories(),
    db.getExpensesForMonth()
  ]);
  
  // Group expenses by category
  const expensesByCategory = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.categoryId]) {
      expensesByCategory[expense.categoryId] = [];
    }
    expensesByCategory[expense.categoryId].push(expense);
  });
  
  return categories.map(category => {
    const categoryExpenses = expensesByCategory[category.id] || [];
    const spent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = category.budgetLimit - spent;
    const percentage = calculatePercentage(spent, category.budgetLimit);
    
    return {
      ...category,
      spent,
      remaining,
      percentage,
      expenseCount: categoryExpenses.length
    };
  });
}

/**
 * Check if user can add expense to category
 * @param {string} categoryId - Category ID
 * @param {number} amount - Expense amount
 * @returns {Promise<Object>} Validation result
 */
export async function validateExpenseAddition(categoryId, amount) {
  const categoryData = await getCategoryWithSpending(categoryId);
  
  if (!categoryData) {
    return { valid: false, message: 'Categoría no encontrada' };
  }
  
  const wouldExceed = categoryData.spent + amount > categoryData.budgetLimit;
  const newPercentage = calculatePercentage(
    categoryData.spent + amount,
    categoryData.budgetLimit
  );
  
  return {
    valid: true,
    wouldExceed,
    newPercentage,
    remaining: categoryData.remaining - amount,
    category: categoryData
  };
}

/**
 * Get spending trend for charts
 * @returns {Promise<Array>} Daily spending data
 */
export async function getSpendingTrend() {
  const expenses = await db.getExpensesForMonth();
  
  // Group by date
  const dailySpending = {};
  expenses.forEach(expense => {
    const date = expense.date;
    dailySpending[date] = (dailySpending[date] || 0) + expense.amount;
  });
  
  // Convert to array sorted by date
  return Object.entries(dailySpending)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get category distribution for pie chart
 * @returns {Promise<Array>} Category spending distribution
 */
export async function getCategoryDistribution() {
  const categoriesWithSpending = await getAllCategoriesWithSpending();
  
  return categoriesWithSpending
    .filter(c => c.spent > 0)
    .map(c => ({
      name: c.name,
      value: c.spent,
      color: c.color,
      percentage: c.percentage
    }));
}

/**
 * Get budget vs actual comparison
 * @returns {Promise<Array>} Comparison data for bar chart
 */
export async function getBudgetVsActual() {
  const categoriesWithSpending = await getAllCategoriesWithSpending();
  
  return categoriesWithSpending.map(c => ({
    name: c.name,
    budget: c.budgetLimit,
    actual: c.spent,
    color: c.color
  }));
}
