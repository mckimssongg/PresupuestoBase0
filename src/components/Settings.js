/**
 * Settings Component
 * App settings, export/import, and monthly close
 */

import * as db from '../db/database.js';
import { AVAILABLE_CURRENCIES } from '../db/schema.js';
import { formatCurrency, getMonthName } from '../utils/helpers.js';
import { showToast, handleError } from '../utils/errorHandler.js';
import { getIcon } from './Icons.js';
import { confirm } from './Modal.js';

/**
 * Render the settings view
 * @returns {Promise<string>} HTML content
 */
export async function renderSettings() {
  try {
    const [settings, overview] = await Promise.all([
      db.getSettings(),
      import('../services/BudgetService.js').then(m => m.getBudgetOverview())
    ]);
    
    const { currency, currentMonth } = settings || {};
    const { realAvailable } = overview;
    
    // Find current currency info
    const currentCurrency = AVAILABLE_CURRENCIES.find(c => c.code === currency || c.symbol === currency) || AVAILABLE_CURRENCIES[0];
    
    return `
      <div class="container">
        <!-- Current Month Status -->
        <div class="card">
          <div class="month-status-header">
            <div class="month-info">
              <span class="label label-closed">Mes Actual</span>
              <h3 class="month-name">
                ${getMonthName(currentMonth || db.getCurrentMonth())}
              </h3>
            </div>
            <div class="month-amount">
              <span class="label label-closed">Disponible</span>
              <div class="${realAvailable >= 0 ? 'income' : 'expense'} amount-value">
                ${formatCurrency(realAvailable, currency)}
              </div>
            </div>
          </div>
          
          <button class="btn btn-primary" id="close-month-btn" style="width: 100%;">
            Cerrar Mes
          </button>
          <p class="helper-text">
            Archiva el mes actual y reinicia gastos
          </p>
        </div>
        
        <!-- App Settings (PWA) -->
        <div id="app-settings-section" style="display: none;">
          <div class="section-header">
            <h3 class="section-title">Aplicación</h3>
          </div>
          <div class="card">
            <button class="btn btn-primary" id="install-app-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ${getIcon('plus')} Instalar Aplicación
            </button>
            <p class="helper-text" style="margin-top: var(--space-md);">
              Instala la app en tu dispositivo para un acceso más rápido y sin conexión
            </p>
          </div>
        </div>
        
        <!-- Currency Settings -->
        <div class="section-header">
          <h3 class="section-title">Moneda</h3>
        </div>
        
        <div class="card">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" for="currency-select">Selecciona tu moneda</label>
            <select id="currency-select" class="form-input form-select" style="cursor: pointer;">
              ${AVAILABLE_CURRENCIES.map(curr => `
                <option value="${curr.code}" ${(currency === curr.code || currency === curr.symbol) ? 'selected' : ''}>
                  ${curr.symbol} - ${curr.name} (${curr.country})
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        
        <!-- Data Management -->
        <div class="section-header">
          <h3 class="section-title">Datos</h3>
        </div>
        
        <div class="card">
          <div style="display: flex; gap: var(--space-sm);">
            <button class="btn btn-secondary" id="export-btn" style="flex: 1;">
              Exportar
            </button>
            
            <div style="position: relative; flex: 1;">
              <button class="btn btn-secondary" id="import-btn-trigger" style="width: 100%;">
                Importar
              </button>
              <input type="file" id="import-file-input" accept=".json,.pbc" 
                     style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
            </div>
          </div>
          
          <p class="helper-text" style="margin-top: var(--space-md);">
            Backup JSON con todos tus datos
          </p>
        </div>
        
        <!-- App Info -->
        <div style="text-align: center; margin-top: var(--space-xl); color: var(--text-tertiary);">
          <span style="color: var(--accent-primary); font-weight: 500;">Presupuesto Base 0</span>
          <span style="font-size: var(--font-size-xs);"> • v1.2</span>
        </div>
      </div>
    `;
  } catch (error) {
    handleError(error, 'renderSettings');
    return `<div class="container"><p>Error al cargar ajustes</p></div>`;
  }
}

/**
 * Initialize settings event listeners
 * @param {Function} refreshView Callback to refresh the view
 */
export function initSettings(refreshView) {
  // Close Month button
  const closeMonthBtn = document.getElementById('close-month-btn');
  closeMonthBtn?.addEventListener('click', async () => {
    const settings = await db.getSettings();
    const currentMonth = settings?.currentMonth || db.getCurrentMonth();
    
    const confirmed = await confirm({
      title: '¿Cerrar el mes?',
      message: `Se archivará "${getMonthName(currentMonth)}" y los gastos se reiniciarán para el nuevo mes. Esta acción no se puede deshacer.`,
      confirmText: 'Cerrar Mes',
      cancelText: 'Cancelar'
    });
    
    if (confirmed) {
      try {
        closeMonthBtn.disabled = true;
        closeMonthBtn.innerHTML = 'Cerrando...';
        
        const archive = await db.closeMonth();
        
        showToast(`Mes cerrado: ${formatCurrency(archive.summary.totalSaved, archive.summary.currency)} ${archive.summary.totalSaved >= 0 ? 'ahorrado' : 'excedido'}`, 'success');
        refreshView();
      } catch (error) {
        handleError(error, 'closeMonth');
        closeMonthBtn.disabled = false;
        closeMonthBtn.innerHTML = 'Cerrar Mes';
      }
    }
  });
  
  // Currency selector
  const currencySelect = document.getElementById('currency-select');
  currencySelect?.addEventListener('change', async (e) => {
    try {
      await db.saveSettings({ currency: e.target.value });
      showToast('Moneda actualizada');
      // Force reload to update all currency displays
      window.location.reload();
    } catch (error) {
      handleError(error, 'updateCurrency');
    }
  });

  // PWA Install Logic
  const installSection = document.getElementById('app-settings-section');
  const installBtn = document.getElementById('install-app-btn');
  
  function checkInstallState() {
    if (window.deferredPrompt && installSection) {
      installSection.style.display = 'block';
    }
  }
  
  // Check initially
  checkInstallState();
  
  // Listen for event if not yet ready
  window.addEventListener('app-installable', checkInstallState);
  
  installBtn?.addEventListener('click', async () => {
    if (!window.deferredPrompt) return;
    
    // Show the install prompt
    window.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await window.deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    window.deferredPrompt = null;
    
    // Hide section
    if (installSection) installSection.style.display = 'none';
  });
  
  // Export button
  const exportBtn = document.getElementById('export-btn');
  exportBtn?.addEventListener('click', async () => {
    try {
      exportBtn.disabled = true;
      exportBtn.innerHTML = 'Exportando...';
      
      const data = await db.exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date().toISOString().split('T')[0];
      const filename = `presupuesto-backup-${date}.json`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Backup exportado correctamente', 'success');
    } catch (error) {
      handleError(error, 'exportData');
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = 'Exportar';
    }
  });
  
  // Import file input
  const importInput = document.getElementById('import-file-input');
  importInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const confirmed = await confirm({
      title: '¿Importar backup?',
      message: 'Esto reemplazará TODOS tus datos actuales con los del backup. Esta acción no se puede deshacer.',
      confirmText: 'Importar',
      cancelText: 'Cancelar',
      danger: true
    });
    
    if (!confirmed) {
      importInput.value = '';
      return;
    }
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await db.importData(data);
      
      showToast('Backup importado correctamente', 'success');
      
      // Reload app to reflect changes
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      handleError(error, 'importData');
    }
    
    importInput.value = '';
  });
}
