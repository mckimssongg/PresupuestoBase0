/**
 * Charts Component
 * Visualize budget data with Chart.js
 */

import Chart from 'chart.js/auto';
import * as BudgetService from '../services/BudgetService.js';
import { formatCurrency } from '../utils/helpers.js';
import { handleError } from '../utils/errorHandler.js';
import { getIcon } from './Icons.js';
import * as db from '../db/database.js';

let charts = {
  distribution: null,
  comparison: null
};

/**
 * Render the charts view
 * @returns {Promise<string>} HTML content
 */
export async function renderCharts() {
  try {
    const [distribution, comparison, settings] = await Promise.all([
      BudgetService.getCategoryDistribution(),
      BudgetService.getBudgetVsActual(),
      db.getSettings()
    ]);
    
    const currency = settings?.currency || 'Q';
    const hasData = distribution.length > 0 || comparison.some(c => c.actual > 0);
    
    return `
      <div class="container">
        ${hasData ? `
          <!-- Tab Navigation -->
          <div class="tabs" role="tablist">
            <button class="tab active" role="tab" data-tab="distribution" aria-selected="true">
              Distribución
            </button>
            <button class="tab" role="tab" data-tab="comparison" aria-selected="false">
              Presupuesto vs Real
            </button>
          </div>
          
          <!-- Distribution Chart -->
          <div class="chart-panel active" id="distribution-panel">
            <div class="card">
              <div class="card-header">
                <span class="card-title">Gastos por Categoría</span>
              </div>
              <div class="chart-container" style="height: 250px;">
                <canvas id="distribution-chart"></canvas>
              </div>
              
              <!-- Legend -->
              <div class="chart-legend" style="margin-top: var(--space-lg);">
                ${distribution.map(item => `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--bg-tertiary);">
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
              <div class="card-header">
                <span class="card-title">Presupuesto vs Gastado</span>
              </div>
              <div class="chart-container" style="height: 300px;">
                <canvas id="comparison-chart"></canvas>
              </div>
              
              <!-- Summary Table -->
              <div style="margin-top: var(--space-lg); font-size: var(--font-size-sm);">
                ${comparison.map(item => {
                  const diff = item.budget - item.actual;
                  const diffClass = diff >= 0 ? 'income' : 'expense';
                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--bg-tertiary);">
                      <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="category-dot" style="background: ${item.color}"></span>
                        <span>${item.name}</span>
                      </div>
                      <span class="summary-card-value ${diffClass}" style="font-size: var(--font-size-sm);">
                        ${diff >= 0 ? '+' : ''}${formatCurrency(diff, currency)}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        ` : `
          <div class="empty-state" style="margin-top: var(--space-2xl);">
            ${getIcon('chart')}
            <h3>Sin datos para mostrar</h3>
            <p>Agrega gastos a tus categorías para ver los gráficos.</p>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    handleError(error, 'renderCharts');
    return `<div class="container"><p>Error al cargar gráficos</p></div>`;
  }
}

/**
 * Initialize charts and event listeners
 */
export async function initCharts() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // Update tabs
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Update panels
      document.querySelectorAll('.chart-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.classList.remove('active');
      });
      const activePanel = document.getElementById(`${tabId}-panel`);
      if (activePanel) {
        activePanel.style.display = 'block';
        activePanel.classList.add('active');
      }
    });
  });
  
  // Create charts
  await createDistributionChart();
  await createComparisonChart();
}

/**
 * Create the distribution (pie/doughnut) chart
 */
async function createDistributionChart() {
  const canvas = document.getElementById('distribution-chart');
  if (!canvas) return;
  
  // Destroy existing chart
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
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#2a2a2a',
            titleColor: '#ffffff',
            bodyColor: '#a0a0a0',
            borderColor: '#3a3a3a',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const value = context.raw;
                const percentage = Math.round(context.parsed / context.dataset.data.reduce((a, b) => a + b, 0) * 100);
                return `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });
  } catch (error) {
    console.error('Error creating distribution chart:', error);
  }
}

/**
 * Create the comparison (bar) chart
 */
async function createComparisonChart() {
  const canvas = document.getElementById('comparison-chart');
  if (!canvas) return;
  
  // Destroy existing chart
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
            borderRadius: 6,
            barPercentage: 0.7
          },
          {
            label: 'Gastado',
            data: data.map(d => d.actual),
            backgroundColor: data.map(d => d.color),
            borderRadius: 6,
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
            grid: {
              color: '#2a2a2a',
              drawBorder: false
            },
            ticks: {
              color: '#a0a0a0',
              callback: (value) => `Q${value}`
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: '#ffffff',
              font: {
                size: 12
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#a0a0a0',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: '#2a2a2a',
            titleColor: '#ffffff',
            bodyColor: '#a0a0a0',
            borderColor: '#3a3a3a',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: Q${context.raw.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating comparison chart:', error);
  }
}

/**
 * Destroy all charts (cleanup)
 */
export function destroyCharts() {
  Object.values(charts).forEach(chart => {
    if (chart) {
      chart.destroy();
    }
  });
  charts = { distribution: null, comparison: null };
}
