/**
 * Income & Fixed Expenses Component
 * Manage monthly income and recurring fixed expenses
 */

import * as db from '../db/database.js';
import * as BudgetService from '../services/BudgetService.js';
import { formatCurrency, debounce } from '../utils/helpers.js';
import { showToast, handleError, validateForm } from '../utils/errorHandler.js';
import { getIcon } from './Icons.js';
import { openModal, closeModal, confirm } from './Modal.js';

/**
 * Render the fixed expenses view
 * @returns {Promise<string>} HTML content
 */
export async function renderFixedExpenses() {
  try {
    const [settings, fixedExpenses, overview] = await Promise.all([
      db.getSettings(),
      db.getAllFixedExpenses(),
      BudgetService.getBudgetOverview()
    ]);
    
    const { currency } = overview;
    const monthlyIncome = settings?.monthlyIncome || 0;
    const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = monthlyIncome - totalFixed;
    
    return `
      <div class="container">
        <!-- Income Section -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Ingreso Mensual</span>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <div style="position: relative;">
              <span style="position: absolute; left: var(--space-md); top: 50%; transform: translateY(-50%); font-size: var(--font-size-xl); font-weight: 600; color: var(--text-secondary);">
                ${currency}
              </span>
              <input 
                type="number" 
                id="income-input"
                class="form-input form-input-large" 
                value="${monthlyIncome || ''}"
                placeholder="0.00"
                min="0"
                step="0.01"
                style="padding-left: calc(var(--space-md) + 24px);"
              >
            </div>
          </div>
        </div>
        
        <!-- Summary -->
        ${monthlyIncome > 0 ? `
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-card-label">Gastos Fijos</div>
              <div class="summary-card-value expense">
                ${formatCurrency(totalFixed, currency)}
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">Disponible</div>
              <div class="summary-card-value ${remaining >= 0 ? 'income' : 'expense'}">
                ${formatCurrency(remaining, currency)}
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Fixed Expenses List -->
        <div class="section-header">
          <h3 class="section-title">Gastos Fijos</h3>
          <button class="btn btn-ghost btn-icon" id="add-fixed-btn" aria-label="Agregar gasto fijo">
            ${getIcon('plus')}
          </button>
        </div>
        
        ${fixedExpenses.length > 0 ? `
          <ul class="list draggable-list" id="fixed-expenses-list">
            ${fixedExpenses.map(expense => `
              <li class="list-item draggable-item" data-id="${expense.id}" draggable="true">
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  <span class="drag-handle">${getIcon('grip')}</span>
                  <span class="list-item-title">${expense.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  <span class="list-item-amount expense">${formatCurrency(expense.amount, currency)}</span>
                  <button class="btn btn-ghost btn-icon delete-fixed-btn" data-id="${expense.id}" aria-label="Eliminar">
                    ${getIcon('trash')}
                  </button>
                </div>
              </li>
            `).join('')}
          </ul>
        ` : `
          <div class="empty-state">
            ${getIcon('wallet')}
            <h3>Sin gastos fijos</h3>
            <p>Agrega tus gastos recurrentes como renta, servicios, etc.</p>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    handleError(error, 'renderFixedExpenses');
    return `<div class="container"><p>Error al cargar</p></div>`;
  }
}

/**
 * Initialize fixed expenses event listeners
 * @param {Function} refreshView Callback to refresh the view
 */
export function initFixedExpenses(refreshView) {
  // Income input with debounced save
  const incomeInput = document.getElementById('income-input');
  if (incomeInput) {
    const saveIncome = debounce(async () => {
      const value = parseFloat(incomeInput.value) || 0;
      try {
        await db.updateSettings({ monthlyIncome: value });
        showToast('Ingreso actualizado', 'success');
        refreshView();
      } catch (error) {
        handleError(error, 'saveIncome');
      }
    }, 500);
    
    incomeInput.addEventListener('input', saveIncome);
  }
  
  // Add fixed expense button
  const addBtn = document.getElementById('add-fixed-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => openAddFixedModal(refreshView));
  }
  
  // Delete buttons
  document.querySelectorAll('.delete-fixed-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      
      const confirmed = await confirm({
        title: '¿Eliminar gasto fijo?',
        message: 'Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        danger: true
      });
      
      if (confirmed) {
        try {
          await db.deleteFixedExpense(id);
          showToast('Gasto eliminado', 'success');
          refreshView();
        } catch (error) {
          handleError(error, 'deleteFixedExpense');
        }
      }
    });
  });
  
  // Drag and Drop reordering
  initDragAndDrop('#fixed-expenses-list', async (orderedIds) => {
    try {
      await db.reorderFixedExpenses(orderedIds);
    } catch (error) {
      handleError(error, 'reorderFixedExpenses');
    }
  });
}

/**
 * Initialize drag and drop for a list
 */
function initDragAndDrop(listSelector, onReorder) {
  const list = document.querySelector(listSelector);
  if (!list) return;
  
  let draggedItem = null;
  
  list.querySelectorAll('.draggable-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.draggable-item').forEach(i => {
        i.classList.remove('drag-over');
      });
      
      // Get new order and save
      const orderedIds = Array.from(list.querySelectorAll('.draggable-item'))
        .map(i => i.dataset.id);
      onReorder(orderedIds);
      
      draggedItem = null;
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (draggedItem !== item) {
        item.classList.add('drag-over');
      }
    });
    
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      if (draggedItem !== item) {
        const items = Array.from(list.querySelectorAll('.draggable-item'));
        const draggedIndex = items.indexOf(draggedItem);
        const dropIndex = items.indexOf(item);
        
        if (draggedIndex < dropIndex) {
          item.after(draggedItem);
        } else {
          item.before(draggedItem);
        }
      }
    });
  });
}

/**
 * Open modal to add fixed expense
 */
function openAddFixedModal(refreshView) {
  openModal({
    title: 'Nuevo Gasto Fijo',
    content: `
      <form id="add-fixed-form">
        <div class="form-group">
          <label class="form-label" for="fixed-name">Nombre</label>
          <input type="text" id="fixed-name" name="name" class="form-input" 
                 placeholder="Ej: Renta, Luz, Internet" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="fixed-amount">Monto</label>
          <input type="number" id="fixed-amount" name="amount" class="form-input" 
                 placeholder="0.00" min="0" step="0.01" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">
          Guardar
        </button>
      </form>
    `,
    onSubmit: async (data) => {
      try {
        validateForm(data, {
          name: { required: true, type: 'string', label: 'Nombre' },
          amount: { required: true, type: 'number', min: 0, label: 'Monto' }
        });
        
        await db.createFixedExpense({
          name: data.name.trim(),
          amount: parseFloat(data.amount)
        });
        
        showToast('Gasto fijo agregado', 'success');
        closeModal();
        refreshView();
      } catch (error) {
        handleError(error, 'createFixedExpense');
      }
    }
  });
}
