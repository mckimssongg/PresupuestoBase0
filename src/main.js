/**
 * Presupuesto Base Cero - Main Application
 * Mobile-first PWA for zero-based budgeting
 */

import './styles/index.css';
import { getDB } from './db/database.js';
import { getIcon } from './components/Icons.js';
import { renderDashboard, initDashboard, destroyDashboardCharts } from './components/Dashboard.js';
import { renderFixedExpenses, initFixedExpenses } from './components/FixedExpenses.js';
import { renderCategories, initCategories, openAddExpenseModal } from './components/Categories.js';
import { renderHistory, initHistory } from './components/History.js';
import { renderSettings, initSettings } from './components/Settings.js';
import { handleError, showToast } from './utils/errorHandler.js';

// App state
const state = {
  currentView: 'dashboard',
  isLoading: true
};

/**
 * Initialize the application
 */
async function init() {
  try {
    // Show loading state
    renderApp();
    
    // Initialize database
    await getDB();
    
    state.isLoading = false;
    
    // Render initial view
    await renderApp();
    
    // Register service worker
    registerServiceWorker();
    
  } catch (error) {
    handleError(error, 'init');
    state.isLoading = false;
    renderError();
  }
}

/**
 * Render the full application
 */
async function renderApp() {
  const app = document.getElementById('app');
  
  if (state.isLoading) {
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: var(--space-lg);">
        <div class="loading-spinner"></div>
        <p style="color: var(--text-secondary);">Cargando...</p>
      </div>
    `;
    return;
  }
  
  app.innerHTML = `
    <!-- Header -->
    <header class="app-header">
      <h1>Presupuesto Base 0</h1>
    </header>
    
    <!-- Main Content -->
    <main class="app-main" id="main-content">
      ${await renderCurrentView()}
    </main>
    
    <!-- Bottom Navigation with centered Add button -->
    <nav class="bottom-nav" role="navigation" aria-label="Navegación principal">
      <button class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" 
              data-view="dashboard" aria-label="Dashboard">
        ${getIcon('home')}
        <span>Inicio</span>
      </button>
      <button class="nav-item ${state.currentView === 'fixed' ? 'active' : ''}" 
              data-view="fixed" aria-label="Gastos Fijos">
        ${getIcon('wallet')}
        <span>Fijos</span>
      </button>
      
      <!-- Central Add Button -->
      <button class="nav-add-btn" id="fab-btn" aria-label="Agregar gasto">
        ${getIcon('plus')}
      </button>
      
      <button class="nav-item ${state.currentView === 'categories' ? 'active' : ''}" 
              data-view="categories" aria-label="Categorías">
        ${getIcon('category')}
        <span>Categorías</span>
      </button>
      <button class="nav-item ${state.currentView === 'settings' ? 'active' : ''}" 
              data-view="settings" aria-label="Ajustes">
        ${getIcon('settings')}
        <span>Ajustes</span>
      </button>
    </nav>
  `;
  
  // Initialize event listeners
  initNavigation();
  initCurrentView();
  initFAB();
}

/**
 * Render current view content
 */
async function renderCurrentView() {
  switch (state.currentView) {
    case 'dashboard':
      return renderDashboard();
    case 'fixed':
      return renderFixedExpenses();
    case 'categories':
      return renderCategories();
    case 'history':
      return renderHistory();
    case 'settings':
      return renderSettings();
    default:
      return renderDashboard();
  }
}

/**
 * Initialize current view's event listeners
 */
function initCurrentView() {
  switch (state.currentView) {
    case 'dashboard':
      initDashboard();
      break;
    case 'fixed':
      initFixedExpenses(refreshCurrentView);
      break;
    case 'categories':
      initCategories(refreshCurrentView);
      break;
    case 'history':
      initHistory();
      break;
    case 'settings':
      initSettings(refreshCurrentView);
      break;
  }
}

/**
 * Initialize navigation
 */
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async () => {
      const view = item.dataset.view;
      if (view !== state.currentView) {
        // Cleanup current view
        if (state.currentView === 'dashboard') {
          destroyDashboardCharts();
        }
        
        state.currentView = view;
        await refreshCurrentView();
        
        // Update nav state
        document.querySelectorAll('.nav-item').forEach(nav => {
          nav.classList.toggle('active', nav.dataset.view === view);
        });
      }
    });
  });
  
  // Custom navigation events
  window.addEventListener('navigate', async (e) => {
    const { view, categoryId } = e.detail;
    if (view) {
      // Cleanup current view
      if (state.currentView === 'dashboard') {
        destroyDashboardCharts();
      }
      
      state.currentView = view;
      await refreshCurrentView(categoryId);
      
      // Update nav state
      document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === view);
      });
    }
  });
  
  // Listen for expense changes to refresh
  window.addEventListener('expense-changed', () => {
    if (state.currentView === 'dashboard') {
      refreshCurrentView();
    }
  });
}

/**
 * Initialize FAB button
 */
async function initFAB() {
  const fab = document.getElementById('fab-btn');
  const categories = await import('./db/database.js').then(m => m.getAllCategories());
  
  fab?.addEventListener('click', async () => {
    if (categories.length === 0) {
      // No categories, redirect to create one
      state.currentView = 'categories';
      await refreshCurrentView();
      document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === 'categories');
      });
      return;
    }
    
    // Open quick expense modal with category selector
    openQuickExpenseModal(categories);
  });
}

/**
 * Open quick expense modal
 */
async function openQuickExpenseModal(categories) {
  const { openModal, closeModal } = await import('./components/Modal.js');
  const { createExpense } = await import('./db/database.js');
  const { showToast } = await import('./utils/errorHandler.js');
  const { validateForm } = await import('./utils/errorHandler.js');
  const { getTodayDate } = await import('./utils/helpers.js');
  
  openModal({
    title: 'Gasto Rápido',
    content: `
      <form id="quick-expense-form">
        <div class="form-group">
          <label class="form-label" for="quick-amount">Monto</label>
          <input type="number" id="quick-amount" name="amount" class="form-input form-input-large" 
                 placeholder="0.00" min="0" step="0.01" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label" for="quick-category">Categoría</label>
          <select id="quick-category" name="categoryId" class="form-input form-select" required>
            ${categories.map(cat => `
              <option value="${cat.id}">${cat.name}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="quick-desc">Descripción (opcional)</label>
          <input type="text" id="quick-desc" name="description" class="form-input" 
                 placeholder="Ej: Almuerzo, Uber, Supermercado">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">
          Agregar Gasto
        </button>
      </form>
    `,
    onSubmit: async (data) => {
      try {
        validateForm(data, {
          amount: { required: true, type: 'number', min: 0.01, label: 'Monto' },
          categoryId: { required: true, label: 'Categoría' }
        });
        
        await createExpense({
          categoryId: data.categoryId,
          description: data.description?.trim() || '',
          amount: parseFloat(data.amount),
          date: getTodayDate()
        });
        
        showToast('Gasto agregado', 'success');
        closeModal();
        await refreshCurrentView();
      } catch (error) {
        const { handleError } = await import('./utils/errorHandler.js');
        handleError(error, 'createQuickExpense');
      }
    }
  });
}

/**
 * Refresh current view
 */
async function refreshCurrentView(categoryId = null) {
  const main = document.getElementById('main-content');
  if (!main) return;
  
  try {
    if (state.currentView === 'categories' && categoryId) {
      main.innerHTML = await renderCategories(categoryId);
    } else {
      main.innerHTML = await renderCurrentView();
    }
    initCurrentView();
  } catch (error) {
    handleError(error, 'refreshCurrentView');
  }
}

/**
 * Render error state
 */
function renderError() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: var(--space-lg); text-align: center;">
      <h2 style="color: var(--accent-danger); margin-bottom: var(--space-md);">Error</h2>
      <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">
        No se pudo cargar la aplicación. Por favor recarga la página.
      </p>
      <button class="btn btn-primary" onclick="location.reload()">
        Recargar
      </button>
    </div>
  `;
}

/**
 * Register service worker for PWA
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('ServiceWorker registered:', registration.scope);
      } catch (error) {
        console.log('ServiceWorker registration failed:', error);
      }
    });
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
