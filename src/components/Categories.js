/**
 * Categories Component
 * Manage budget categories and their expenses
 */

import * as db from '../db/database.js';
import * as BudgetService from '../services/BudgetService.js';
import { formatCurrency, formatDate, getProgressStatus, getTodayDate } from '../utils/helpers.js';
import { showToast, handleError, validateForm } from '../utils/errorHandler.js';
import { getIcon } from './Icons.js';
import { openModal, closeModal, confirm } from './Modal.js';
import { CATEGORY_COLORS } from '../db/schema.js';

/**
 * Render the categories view
 * @param {string} [selectedCategoryId] Pre-selected category to expand
 * @returns {Promise<string>} HTML content
 */
export async function renderCategories(selectedCategoryId = null) {
  try {
    const [categoriesWithSpending, settings] = await Promise.all([
      BudgetService.getAllCategoriesWithSpending(),
      db.getSettings()
    ]);
    
    const currency = settings?.currency || 'Q';
    
    return `
      <div class="container">
        <!-- Header with Add Button -->
        <div class="section-header" style="margin-top: var(--space-md);">
          <h3 class="section-title">Categorías</h3>
          <button class="btn btn-ghost btn-icon" id="add-category-btn" aria-label="Agregar categoría">
            ${getIcon('plus')}
          </button>
        </div>
        
        ${categoriesWithSpending.length > 0 ? `
          <div class="categories-container" id="categories-list">
            ${categoriesWithSpending.map(cat => renderCategoryItem(cat, currency, selectedCategoryId === cat.id)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            ${getIcon('category')}
            <h3>Sin categorías</h3>
            <p>Crea categorías para organizar tus gastos (ej: Comida, Transporte)</p>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    handleError(error, 'renderCategories');
    return `<div class="container"><p>Error al cargar</p></div>`;
  }
}

/**
 * Render a single category item
 */
function renderCategoryItem(category, currency, isExpanded = false) {
  const { id, name, color, budgetLimit, spent, remaining, percentage, expenseCount } = category;
  
  return `
    <div class="category-item-wrapper" data-category-id="${id}">
      <div class="category-item category-expandable ${isExpanded ? 'expanded' : ''}" 
           role="button" tabindex="0" aria-expanded="${isExpanded}">
        <div class="category-header">
          <div class="category-name">
            <span class="category-dot" style="background: ${color}"></span>
            <span>${name}</span>
            ${expenseCount > 0 ? `<span style="font-size: var(--font-size-xs); color: var(--text-tertiary);">(${expenseCount})</span>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <div class="category-amounts">
              <span>${formatCurrency(spent, currency)}</span> / ${formatCurrency(budgetLimit, currency)}
            </div>
            <span class="category-chevron">${getIcon('chevronDown')}</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${getProgressStatus(percentage)}" 
               style="width: ${Math.min(100, percentage)}%; background: ${color}"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: var(--space-xs); font-size: var(--font-size-xs); color: var(--text-secondary);">
          <span>${Math.round(percentage)}% usado</span>
          <span class="${remaining < 0 ? 'text-danger' : ''}">
            ${remaining >= 0 ? 'Quedan' : 'Excedido'} ${formatCurrency(Math.abs(remaining), currency)}
          </span>
        </div>
      </div>
      
      <!-- Expanded Content -->
      <div class="category-expanded-content" style="display: ${isExpanded ? 'block' : 'none'};">
        <div class="category-actions" style="display: flex; gap: var(--space-sm); padding: var(--space-sm) 0;">
          <button class="btn btn-primary add-expense-btn" data-category-id="${id}" style="flex: 1;">
            ${getIcon('plus')} Agregar Gasto
          </button>
          <button class="btn btn-ghost btn-icon edit-category-btn" data-category-id="${id}" aria-label="Editar">
            ${getIcon('edit')}
          </button>
          <button class="btn btn-ghost btn-icon delete-category-btn" data-category-id="${id}" aria-label="Eliminar">
            ${getIcon('trash')}
          </button>
        </div>
        <div class="category-expenses-list" data-category-id="${id}">
          <!-- Expenses will be loaded here -->
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize categories event listeners
 * @param {Function} refreshView Callback to refresh the view
 */
export function initCategories(refreshView) {
  // Add category button
  const addBtn = document.getElementById('add-category-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => openAddCategoryModal(refreshView));
  }
  
  // Category expand/collapse
  document.querySelectorAll('.category-expandable').forEach(item => {
    item.addEventListener('click', async (e) => {
      // Don't toggle if clicking action buttons
      if (e.target.closest('button')) return;
      
      const wrapper = item.closest('.category-item-wrapper');
      const isExpanded = item.classList.contains('expanded');
      const categoryId = wrapper.dataset.categoryId;
      const expandedContent = wrapper.querySelector('.category-expanded-content');
      
      // Toggle state
      item.classList.toggle('expanded');
      item.setAttribute('aria-expanded', !isExpanded);
      expandedContent.style.display = isExpanded ? 'none' : 'block';
      
      // Load expenses if expanding
      if (!isExpanded) {
        await loadCategoryExpenses(categoryId, wrapper);
      }
    });
    
    // Keyboard accessibility
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
  });
  
  // Add expense buttons
  document.querySelectorAll('.add-expense-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const categoryId = btn.dataset.categoryId;
      openAddExpenseModal(categoryId, refreshView);
    });
  });
  
  // Edit category buttons
  document.querySelectorAll('.edit-category-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const categoryId = btn.dataset.categoryId;
      const category = await db.getCategory(categoryId);
      if (category) {
        openEditCategoryModal(category, refreshView);
      }
    });
  });
  
  // Delete category buttons
  document.querySelectorAll('.delete-category-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const categoryId = btn.dataset.categoryId;
      
      const confirmed = await confirm({
        title: '¿Eliminar categoría?',
        message: 'Se eliminarán todos los gastos de esta categoría.',
        confirmText: 'Eliminar',
        danger: true
      });
      
      if (confirmed) {
        try {
          await db.deleteCategory(categoryId);
          showToast('Categoría eliminada', 'success');
          refreshView();
        } catch (error) {
          handleError(error, 'deleteCategory');
        }
      }
    });
  });
}

/**
 * Load expenses for a category
 */
async function loadCategoryExpenses(categoryId, wrapper) {
  const container = wrapper.querySelector('.category-expenses-list');
  const settings = await db.getSettings();
  const currency = settings?.currency || 'Q';
  
  try {
    const expenses = await db.getExpensesByCategory(categoryId);
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (expenses.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--space-md); color: var(--text-secondary); font-size: var(--font-size-sm);">
          Sin gastos registrados
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <ul class="list" style="margin-top: var(--space-sm);">
        ${expenses.map(exp => `
          <li class="list-item expense-item" data-id="${exp.id}">
            <div class="list-item-content">
              <span class="list-item-title">${exp.description || 'Sin descripción'}</span>
              <span class="list-item-subtitle">${formatDate(exp.date)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <span class="list-item-amount expense">${formatCurrency(exp.amount, currency)}</span>
              <button class="btn btn-ghost btn-icon delete-expense-btn" data-id="${exp.id}" aria-label="Eliminar">
                ${getIcon('trash')}
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
    
    // Add delete handlers for expenses
    container.querySelectorAll('.delete-expense-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const expenseId = btn.dataset.id;
        
        try {
          await db.deleteExpense(expenseId);
          showToast('Gasto eliminado', 'success');
          // Reload expenses
          await loadCategoryExpenses(categoryId, wrapper);
          // Trigger refresh to update totals
          window.dispatchEvent(new CustomEvent('expense-changed'));
        } catch (error) {
          handleError(error, 'deleteExpense');
        }
      });
    });
  } catch (error) {
    handleError(error, 'loadCategoryExpenses');
    container.innerHTML = '<p style="color: var(--accent-danger);">Error al cargar gastos</p>';
  }
}

/**
 * Open modal to add category
 */
function openAddCategoryModal(refreshView) {
  const colorOptions = CATEGORY_COLORS.map((color, i) => `
    <div class="color-option ${i === 0 ? 'selected' : ''}" 
         style="background: ${color}" 
         data-color="${color}"
         role="radio"
         aria-checked="${i === 0}">
    </div>
  `).join('');
  
  openModal({
    title: 'Nueva Categoría',
    content: `
      <form id="add-category-form">
        <div class="form-group">
          <label class="form-label" for="category-name">Nombre</label>
          <input type="text" id="category-name" name="name" class="form-input" 
                 placeholder="Ej: Comida, Transporte" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="category-limit">Límite de Presupuesto</label>
          <input type="number" id="category-limit" name="budgetLimit" class="form-input" 
                 placeholder="0.00" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-options" id="color-picker">
            ${colorOptions}
          </div>
          <input type="hidden" name="color" id="category-color" value="${CATEGORY_COLORS[0]}">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">
          Crear Categoría
        </button>
      </form>
    `,
    onSubmit: async (data) => {
      try {
        validateForm(data, {
          name: { required: true, type: 'string', label: 'Nombre' },
          budgetLimit: { required: true, type: 'number', min: 0, label: 'Límite' }
        });
        
        await db.createCategory({
          name: data.name.trim(),
          budgetLimit: parseFloat(data.budgetLimit),
          color: data.color
        });
        
        showToast('Categoría creada', 'success');
        closeModal();
        refreshView();
      } catch (error) {
        handleError(error, 'createCategory');
      }
    }
  });
  
  // Color picker logic
  setTimeout(() => {
    const colorPicker = document.getElementById('color-picker');
    const colorInput = document.getElementById('category-color');
    
    colorPicker?.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (option) {
        colorPicker.querySelectorAll('.color-option').forEach(opt => {
          opt.classList.remove('selected');
          opt.setAttribute('aria-checked', 'false');
        });
        option.classList.add('selected');
        option.setAttribute('aria-checked', 'true');
        colorInput.value = option.dataset.color;
      }
    });
  }, 100);
}

/**
 * Open modal to edit category
 */
function openEditCategoryModal(category, refreshView) {
  const colorOptions = CATEGORY_COLORS.map(color => `
    <div class="color-option ${color === category.color ? 'selected' : ''}" 
         style="background: ${color}" 
         data-color="${color}"
         role="radio"
         aria-checked="${color === category.color}">
    </div>
  `).join('');
  
  openModal({
    title: 'Editar Categoría',
    content: `
      <form id="edit-category-form">
        <div class="form-group">
          <label class="form-label" for="category-name">Nombre</label>
          <input type="text" id="category-name" name="name" class="form-input" 
                 value="${category.name}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="category-limit">Límite de Presupuesto</label>
          <input type="number" id="category-limit" name="budgetLimit" class="form-input" 
                 value="${category.budgetLimit}" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-options" id="color-picker">
            ${colorOptions}
          </div>
          <input type="hidden" name="color" id="category-color" value="${category.color}">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">
          Guardar Cambios
        </button>
      </form>
    `,
    onSubmit: async (data) => {
      try {
        validateForm(data, {
          name: { required: true, type: 'string', label: 'Nombre' },
          budgetLimit: { required: true, type: 'number', min: 0, label: 'Límite' }
        });
        
        await db.updateCategory(category.id, {
          name: data.name.trim(),
          budgetLimit: parseFloat(data.budgetLimit),
          color: data.color
        });
        
        showToast('Categoría actualizada', 'success');
        closeModal();
        refreshView();
      } catch (error) {
        handleError(error, 'updateCategory');
      }
    }
  });
  
  // Color picker logic
  setTimeout(() => {
    const colorPicker = document.getElementById('color-picker');
    const colorInput = document.getElementById('category-color');
    
    colorPicker?.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (option) {
        colorPicker.querySelectorAll('.color-option').forEach(opt => {
          opt.classList.remove('selected');
          opt.setAttribute('aria-checked', 'false');
        });
        option.classList.add('selected');
        option.setAttribute('aria-checked', 'true');
        colorInput.value = option.dataset.color;
      }
    });
  }, 100);
}

/**
 * Open modal to add expense
 */
export function openAddExpenseModal(categoryId, refreshView) {
  openModal({
    title: 'Agregar Gasto',
    content: `
      <form id="add-expense-form">
        <div class="form-group">
          <label class="form-label" for="expense-amount">Monto</label>
          <input type="number" id="expense-amount" name="amount" class="form-input form-input-large" 
                 placeholder="0.00" min="0" step="0.01" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label" for="expense-desc">Descripción (opcional)</label>
          <input type="text" id="expense-desc" name="description" class="form-input" 
                 placeholder="Ej: Almuerzo, Uber, Supermercado">
        </div>
        <div class="form-group">
          <label class="form-label" for="expense-date">Fecha</label>
          <input type="date" id="expense-date" name="date" class="form-input" 
                 value="${getTodayDate()}">
        </div>
        <input type="hidden" name="categoryId" value="${categoryId}">
        <button type="submit" class="btn btn-primary" style="width: 100%;">
          Agregar Gasto
        </button>
      </form>
    `,
    onSubmit: async (data) => {
      try {
        validateForm(data, {
          amount: { required: true, type: 'number', min: 0.01, label: 'Monto' }
        });
        
        // Get category data for budget check
        const BudgetService = await import('../services/BudgetService.js');
        const categoryData = await BudgetService.getCategoryWithSpending(data.categoryId);
        
        await db.createExpense({
          categoryId: data.categoryId,
          description: data.description?.trim() || '',
          amount: parseFloat(data.amount),
          date: data.date || getTodayDate()
        });
        
        // Check budget limits and notify
        if (categoryData) {
          const newSpent = categoryData.spent + parseFloat(data.amount);
          const newPercentage = categoryData.budgetLimit > 0 
            ? (newSpent / categoryData.budgetLimit) * 100 
            : 0;
          
          if (newPercentage >= 100) {
            showToast(`⚠️ ¡Límite excedido en ${categoryData.name}!`, 'warning');
          } else if (newPercentage >= 80) {
            showToast(`⚠️ ${categoryData.name}: ${Math.round(newPercentage)}% del límite usado`, 'warning');
          } else {
            showToast('Gasto agregado', 'success');
          }
        } else {
          showToast('Gasto agregado', 'success');
        }
        
        closeModal();
        refreshView();
      } catch (error) {
        handleError(error, 'createExpense');
      }
    }
  });
}
