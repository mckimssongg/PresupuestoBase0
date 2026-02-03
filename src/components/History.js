/**
 * History Component
 * View archived months and their details
 */

import * as db from '../db/database.js';
import { formatCurrency, getMonthName, getProgressStatus } from '../utils/helpers.js';
import { handleError } from '../utils/errorHandler.js';
import { getIcon } from './Icons.js';

/**
 * Render the history view
 * @returns {Promise<string>} HTML content
 */
export async function renderHistory() {
  try {
    const archives = await db.getAllArchives();
    
    return `
      <div class="container">
        <div class="section-header" style="margin-top: var(--space-md);">
          <h3 class="section-title">Historial de Meses</h3>
        </div>
        
        ${archives.length > 0 ? `
          <div class="archives-list" id="archives-list">
            ${archives.map(archive => renderArchiveItem(archive)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            ${getIcon('empty')}
            <h3>Sin historial</h3>
            <p>Cuando cierres un mes, aparecerá aquí como registro permanente.</p>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    handleError(error, 'renderHistory');
    return `<div class="container"><p>Error al cargar historial</p></div>`;
  }
}

/**
 * Render a single archive item
 */
function renderArchiveItem(archive) {
  const { month, summary, closedAt } = archive;
  const { monthlyIncome, totalSpent, totalSaved, currency } = summary;
  
  const savedClass = totalSaved >= 0 ? 'income' : 'expense';
  const closedDate = new Date(closedAt).toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'short'
  });
  
  return `
    <div class="archive-item" data-month="${month}">
      <div class="card" style="margin-bottom: var(--space-sm);">
        <!-- Main row -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
          <div>
            <h4 style="margin: 0 0 2px 0; text-transform: capitalize; font-size: var(--font-size-md);">
              ${getMonthName(month)}
            </h4>
            <span style="font-size: var(--font-size-xs); color: var(--text-tertiary);">
              Cerrado ${closedDate}
            </span>
          </div>
          <div style="text-align: right;">
            <div class="${savedClass}" style="font-size: var(--font-size-lg); font-weight: 600;">
              ${totalSaved >= 0 ? '+' : ''}${formatCurrency(totalSaved, currency)}
            </div>
            <span style="font-size: var(--font-size-xs); color: var(--text-tertiary);">
              ${totalSaved >= 0 ? 'ahorrado' : 'excedido'}
            </span>
          </div>
        </div>
        
        <!-- Mini summary -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm) var(--space-lg); font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-md);">
          <span>Ingreso: <span class="income">${formatCurrency(monthlyIncome, currency)}</span></span>
          <span>Gastado: <span class="expense">${formatCurrency(totalSpent, currency)}</span></span>
        </div>
        
        <!-- Expand Button -->
        <button class="btn btn-ghost archive-expand-btn" 
                data-month="${month}" 
                style="width: 100%; padding: var(--space-sm); font-size: var(--font-size-sm);">
          Ver detalle
        </button>
        
        <!-- Expanded Details -->
        <div class="archive-details" style="display: none;" data-details="${month}"></div>
      </div>
    </div>
  `;
}

/**
 * Initialize history event listeners
 */
export function initHistory() {
  // Expand/collapse archive details
  document.querySelectorAll('.archive-expand-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const month = btn.dataset.month;
      const detailsContainer = document.querySelector(`[data-details="${month}"]`);
      const isExpanded = detailsContainer.style.display !== 'none';
      
      if (isExpanded) {
        detailsContainer.style.display = 'none';
        btn.innerHTML = `Ver detalle ${getIcon('chevronDown')}`;
      } else {
        await loadArchiveDetails(month, detailsContainer);
        detailsContainer.style.display = 'block';
        btn.innerHTML = `Ocultar detalle ${getIcon('chevronDown')}`;
      }
    });
  });
}

/**
 * Load full details for an archive
 */
async function loadArchiveDetails(month, container) {
  try {
    const archive = await db.getArchive(month);
    if (!archive) {
      container.innerHTML = '<p>No se encontró el archivo</p>';
      return;
    }
    
    const { summary, categories, fixedExpenses } = archive;
    const { currency } = summary;
    
    container.innerHTML = `
      <div style="margin-top: var(--space-lg); border-top: 1px solid var(--bg-tertiary); padding-top: var(--space-lg);">
        
        <!-- Fixed Expenses -->
        <div style="margin-bottom: var(--space-lg);">
          <h5 style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--space-sm);">
            Gastos Fijos (${formatCurrency(summary.totalFixedExpenses, currency)})
          </h5>
          ${fixedExpenses.map(fe => `
            <div class="list-item" style="padding: var(--space-sm);">
              <span>${fe.name}</span>
              <span class="list-item-amount expense">${formatCurrency(fe.amount, currency)}</span>
            </div>
          `).join('')}
        </div>
        
        <!-- Categories -->
        <div>
          <h5 style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--space-sm);">
            Categorías
          </h5>
          ${categories.map(cat => `
            <div class="category-item" style="margin-bottom: var(--space-sm);">
              <div class="category-header">
                <div class="category-name">
                  <span class="category-dot" style="background: ${cat.color}"></span>
                  <span>${cat.name}</span>
                </div>
                <div class="category-amounts">
                  <span class="amount-spent">${formatCurrency(cat.spent, currency)}</span>
                  <span class="amount-budget">de ${formatCurrency(cat.budgetLimit, currency)}</span>
                </div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${getProgressStatus(cat.percentage)}" 
                     style="width: ${Math.min(100, cat.percentage)}%; background: ${cat.color}"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    handleError(error, 'loadArchiveDetails');
    container.innerHTML = '<p style="color: var(--accent-danger);">Error al cargar detalles</p>';
  }
}
