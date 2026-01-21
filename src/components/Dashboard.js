/**
 * Dashboard Component
 * Main view showing budget overview
 */

import * as BudgetService from '../services/BudgetService.js';
import { formatCurrency, getMonthName, getProgressStatus, calculatePercentage } from '../utils/helpers.js';
import { getIcon } from './Icons.js';

/**
 * Render the dashboard view
 * @returns {Promise<string>} HTML content
 */
export async function renderDashboard() {
  try {
    const overview = await BudgetService.getBudgetOverview();
    const categoriesWithSpending = await BudgetService.getAllCategoriesWithSpending();
    
    const {
      monthlyIncome,
      totalFixedExpenses,
      realAvailable,
      totalSpent,
      totalBudgeted,
      currency,
      currentMonth
    } = overview;
    
    const availableClass = realAvailable < 0 ? 'negative' : '';
    
    // Calculate how much is truly unallocated
    const availableAfterFixed = monthlyIncome - totalFixedExpenses;
    const allocatedPercent = totalBudgeted > 0 
      ? calculatePercentage(totalBudgeted, availableAfterFixed) 
      : 0;
    
    return `
      <div class="container">
        <!-- Month Header -->
        <div class="month-header" style="text-align: center; margin-bottom: var(--space-lg);">
          <span style="font-size: var(--font-size-sm); color: var(--text-secondary);">
            ${getMonthName(currentMonth)}
          </span>
        </div>
        
        <!-- Main Balance Card -->
        <div class="card balance-display">
          <div class="balance-label">Disponible</div>
          <div class="balance-amount ${availableClass}">
            ${formatCurrency(realAvailable, currency)}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: var(--space-sm);">
            de ${formatCurrency(monthlyIncome, currency)} de ingreso
          </div>
        </div>
        
        <!-- Summary Grid -->
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-card-label">Gastos Fijos</div>
            <div class="summary-card-value expense">
              ${formatCurrency(totalFixedExpenses, currency)}
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-card-label">Gastado</div>
            <div class="summary-card-value expense">
              ${formatCurrency(totalSpent, currency)}
            </div>
          </div>
        </div>
        
        <!-- Budget Allocation Progress -->
        ${monthlyIncome > 0 ? `
          <div class="card">
            <div class="card-header">
              <span class="card-title">Asignación de Presupuesto</span>
              <span style="font-size: var(--font-size-sm); color: var(--text-secondary);">
                ${Math.round(allocatedPercent)}%
              </span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${getProgressStatus(allocatedPercent)}" 
                   style="width: ${Math.min(100, allocatedPercent)}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: var(--space-sm); font-size: var(--font-size-xs); color: var(--text-secondary);">
              <span>${formatCurrency(totalBudgeted, currency)} asignado</span>
              <span>${formatCurrency(availableAfterFixed - totalBudgeted, currency)} sin asignar</span>
            </div>
          </div>
        ` : `
          <div class="card empty-state">
            ${getIcon('wallet')}
            <h3>Configura tu ingreso</h3>
            <p>Ve a la pestaña de gastos fijos para establecer tu ingreso mensual.</p>
          </div>
        `}
        
        <!-- Categories Quick View -->
        ${categoriesWithSpending.length > 0 ? `
          <div class="section-header">
            <h3 class="section-title">Categorías</h3>
          </div>
          <div class="categories-list">
            ${categoriesWithSpending.map(cat => `
              <div class="category-item" data-category-id="${cat.id}">
                <div class="category-header">
                  <div class="category-name">
                    <span class="category-dot" style="background: ${cat.color}"></span>
                    ${cat.name}
                  </div>
                  <div class="category-amounts">
                    <span>${formatCurrency(cat.spent, currency)}</span> / ${formatCurrency(cat.budgetLimit, currency)}
                  </div>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill ${getProgressStatus(cat.percentage)}" 
                       style="width: ${Math.min(100, cat.percentage)}%; background: ${cat.color}"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    return `
      <div class="container">
        <div class="card empty-state">
          ${getIcon('empty')}
          <h3>Error al cargar</h3>
          <p>No se pudo cargar el dashboard. Por favor recarga la página.</p>
        </div>
      </div>
    `;
  }
}

/**
 * Initialize dashboard event listeners
 */
export function initDashboard() {
  // Category click handlers
  document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      const categoryId = item.dataset.categoryId;
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { view: 'categories', categoryId } 
      }));
    });
  });
}
