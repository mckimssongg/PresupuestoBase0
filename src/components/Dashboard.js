/**
 * Dashboard Component
 * Main view with Resumen (overview) and Análisis (charts) tabs
 */

import * as BudgetService from '../services/BudgetService.js';
import { formatCurrency, getMonthName, getProgressStatus, calculatePercentage } from '../utils/helpers.js';
import { getIcon } from './Icons.js';
import * as db from '../db/database.js';
import Chart from 'chart.js/auto';

let charts = {
  distribution: null,
  comparison: null
};

// Current tab state
let currentTab = 'resumen';

// Selected month for viewing (null = current month)
let selectedMonth = null;

/**
 * Render the dashboard view with tabs
 * @returns {Promise<string>} HTML content
 */
export async function renderDashboard() {
  try {
    // Get available months for navigation
    const availableMonths = await db.getAvailableMonths();
    const currentRealMonth = db.getCurrentMonth();
    
    // Use selected month or default to current
    const viewMonth = selectedMonth || currentRealMonth;
    const isCurrentMonth = viewMonth === currentRealMonth;
    
    // Get current month index in available months
    const currentIndex = availableMonths.indexOf(viewMonth);
    const hasPrevious = currentIndex < availableMonths.length - 1;
    const hasNext = currentIndex > 0;
    
    const overview = await BudgetService.getBudgetOverview(viewMonth);
    const categoriesWithSpending = await BudgetService.getAllCategoriesWithSpending(viewMonth);
    
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
    const availableAfterFixed = monthlyIncome - totalFixedExpenses;
    const allocatedPercent = totalBudgeted > 0 
      ? calculatePercentage(totalBudgeted, availableAfterFixed) 
      : 0;
    
    // Get chart data
    const [distribution, comparison] = await Promise.all([
      BudgetService.getCategoryDistribution(),
      BudgetService.getBudgetVsActual()
    ]);
    const hasChartData = distribution.length > 0 || comparison.some(c => c.actual > 0);
    
    return `
      <div class="container">
        <!-- Month Header with Navigation and Tabs -->
        <div style="margin-bottom: var(--space-md);">
          <div class="month-navigator" style="display: flex; align-items: center; justify-content: center; gap: var(--space-md); margin-bottom: var(--space-md);">
            <button class="btn btn-ghost btn-icon month-nav-btn" id="prev-month-btn" ${!hasPrevious ? 'disabled style="opacity: 0.3; pointer-events: none;"' : ''} aria-label="Mes anterior">
              ${getIcon('chevronLeft')}
            </button>
            <div style="text-align: center; min-width: 140px;">
              <span style="font-size: var(--font-size-md); font-weight: 500; color: var(--text-primary); text-transform: capitalize;">
                ${getMonthName(viewMonth)}
              </span>
              ${!isCurrentMonth ? '<div style="font-size: var(--font-size-xs); color: var(--accent-primary); margin-top: 2px;">Histórico</div>' : ''}
            </div>
            <button class="btn btn-ghost btn-icon month-nav-btn" id="next-month-btn" ${!hasNext ? 'disabled style="opacity: 0.3; pointer-events: none;"' : ''} aria-label="Mes siguiente">
              ${getIcon('chevronRight')}
            </button>
          </div>
          
          <!-- Tab Navigation -->
          <div class="tabs" role="tablist" id="dashboard-tabs">
            <button class="tab ${currentTab === 'resumen' ? 'active' : ''}" role="tab" data-tab="resumen" aria-selected="${currentTab === 'resumen'}">
              Resumen
            </button>
            <button class="tab ${currentTab === 'analisis' ? 'active' : ''}" role="tab" data-tab="analisis" aria-selected="${currentTab === 'analisis'}">
              Análisis
            </button>
          </div>
        </div>
        
        <!-- Resumen Panel -->
        <div class="dashboard-panel ${currentTab === 'resumen' ? 'active' : ''}" id="resumen-panel" style="${currentTab !== 'resumen' ? 'display: none;' : ''}">
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
          ` : ''}
        </div>
        
        <!-- Análisis (Charts) Panel -->
        <div class="dashboard-panel ${currentTab === 'analisis' ? 'active' : ''}" id="analisis-panel" style="${currentTab !== 'analisis' ? 'display: none;' : ''}">
          ${hasChartData ? `
            <!-- Inner tabs for chart types -->
            <div class="tabs" role="tablist" id="chart-tabs" style="margin-bottom: var(--space-md);">
              <button class="tab active" role="tab" data-chart="distribution">
                Distribución
              </button>
              <button class="tab" role="tab" data-chart="comparison">
                Budget vs Real
              </button>
            </div>
            
            <!-- Distribution Chart -->
            <div class="chart-panel active" id="distribution-panel">
              <div class="card">
                <div class="chart-container" style="height: 220px;">
                  <canvas id="distribution-chart"></canvas>
                </div>
                
                <div class="chart-legend" style="margin-top: var(--space-md);">
                  ${distribution.map(item => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-xs) 0; border-bottom: 1px solid var(--bg-tertiary); font-size: var(--font-size-sm);">
                      <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="category-dot" style="background: ${item.color}"></span>
                        <span>${item.name}</span>
                      </div>
                      <span style="font-weight: 500;">${formatCurrency(item.value, currency)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            
            <!-- Comparison Chart -->
            <div class="chart-panel" id="comparison-panel" style="display: none;">
              <div class="card">
                <div class="chart-container" style="height: 280px;">
                  <canvas id="comparison-chart"></canvas>
                </div>
                
                <div style="margin-top: var(--space-md); font-size: var(--font-size-sm);">
                  ${comparison.map(item => {
                    const diff = item.budget - item.actual;
                    const diffClass = diff >= 0 ? 'income' : 'expense';
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-xs) 0; border-bottom: 1px solid var(--bg-tertiary);">
                        <div style="display: flex; align-items: center; gap: var(--space-sm);">
                          <span class="category-dot" style="background: ${item.color}"></span>
                          <span>${item.name}</span>
                        </div>
                        <span class="${diffClass}" style="font-weight: 500;">
                          ${diff >= 0 ? '+' : ''}${formatCurrency(diff, currency)}
                        </span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          ` : `
            <div class="empty-state" style="margin-top: var(--space-xl);">
              ${getIcon('chart')}
              <h3>Sin datos</h3>
              <p>Agrega gastos a tus categorías para ver los gráficos.</p>
            </div>
          `}
        </div>
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
  // Main tab switching (Resumen / Análisis)
  document.querySelectorAll('#dashboard-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      currentTab = tabId;
      
      // Update tabs
      document.querySelectorAll('#dashboard-tabs .tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
        t.setAttribute('aria-selected', t.dataset.tab === tabId);
      });
      
      // Update panels
      document.querySelectorAll('.dashboard-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.classList.remove('active');
      });
      const activePanel = document.getElementById(`${tabId}-panel`);
      if (activePanel) {
        activePanel.style.display = 'block';
        activePanel.classList.add('active');
        
        // Initialize charts if switching to analysis
        if (tabId === 'analisis') {
          setTimeout(() => {
            createDistributionChart();
            createComparisonChart();
          }, 100);
        }
      }
    });
  });
  
  // Chart sub-tabs switching
  document.querySelectorAll('#chart-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const chartType = tab.dataset.chart;
      
      document.querySelectorAll('#chart-tabs .tab').forEach(t => {
        t.classList.toggle('active', t.dataset.chart === chartType);
      });
      
      document.querySelectorAll('.chart-panel').forEach(panel => {
        panel.style.display = 'none';
      });
      const chartPanel = document.getElementById(`${chartType}-panel`);
      if (chartPanel) {
        chartPanel.style.display = 'block';
      }
    });
  });
  
  // Category click handlers
  document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      const categoryId = item.dataset.categoryId;
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { view: 'categories', categoryId } 
      }));
    });
  });
  
  // Month navigation handlers
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');
  
  prevMonthBtn?.addEventListener('click', async () => {
    const availableMonths = await db.getAvailableMonths();
    const currentRealMonth = db.getCurrentMonth();
    const viewMonth = selectedMonth || currentRealMonth;
    const currentIndex = availableMonths.indexOf(viewMonth);
    
    if (currentIndex < availableMonths.length - 1) {
      selectedMonth = availableMonths[currentIndex + 1];
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('expense-changed'));
    }
  });
  
  nextMonthBtn?.addEventListener('click', async () => {
    const availableMonths = await db.getAvailableMonths();
    const currentRealMonth = db.getCurrentMonth();
    const viewMonth = selectedMonth || currentRealMonth;
    const currentIndex = availableMonths.indexOf(viewMonth);
    
    if (currentIndex > 0) {
      selectedMonth = availableMonths[currentIndex - 1];
      // If we're back to current month, reset selectedMonth to null
      if (selectedMonth === currentRealMonth) {
        selectedMonth = null;
      }
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('expense-changed'));
    }
  });
  
  // Create charts if analisis tab is active
  if (currentTab === 'analisis') {
    setTimeout(() => {
      createDistributionChart();
      createComparisonChart();
    }, 100);
  }
}

/**
 * Get currently selected month (for external use)
 */
export function getSelectedMonth() {
  return selectedMonth || db.getCurrentMonth();
}

/**
 * Set selected month (for external use)
 */
export function setSelectedMonth(month) {
  selectedMonth = month;
}

/**
 * Create distribution chart
 */
async function createDistributionChart() {
  const canvas = document.getElementById('distribution-chart');
  if (!canvas) return;
  
  if (charts.distribution) {
    charts.distribution.destroy();
  }
  
  try {
    const data = await BudgetService.getCategoryDistribution();
    if (data.length === 0) return;
    
    charts.distribution = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderColor: '#1a1a1a',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2a2a2a',
            titleColor: '#fff',
            bodyColor: '#a0a0a0',
            padding: 10,
            cornerRadius: 8
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating distribution chart:', error);
  }
}

/**
 * Create comparison chart
 */
async function createComparisonChart() {
  const canvas = document.getElementById('comparison-chart');
  if (!canvas) return;
  
  if (charts.comparison) {
    charts.comparison.destroy();
  }
  
  try {
    const data = await BudgetService.getBudgetVsActual();
    if (data.length === 0) return;
    
    charts.comparison = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.name),
        datasets: [
          {
            label: 'Presupuesto',
            data: data.map(d => d.budget),
            backgroundColor: '#3a3a3a',
            borderRadius: 4,
            barPercentage: 0.7
          },
          {
            label: 'Gastado',
            data: data.map(d => d.actual),
            backgroundColor: data.map(d => d.color),
            borderRadius: 4,
            barPercentage: 0.7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: '#2a2a2a' },
            ticks: { color: '#a0a0a0', callback: v => `Q${v}` }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#fff', font: { size: 11 } }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#a0a0a0', usePointStyle: true, padding: 16 }
          },
          tooltip: {
            backgroundColor: '#2a2a2a',
            padding: 10,
            cornerRadius: 8
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating comparison chart:', error);
  }
}

/**
 * Destroy charts (cleanup)
 */
export function destroyDashboardCharts() {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = { distribution: null, comparison: null };
}
