/**
 * UI components and interactions
 */
import * as d3 from 'd3';

/**
 * Predictor definitions with labels
 */
// Base confounders available for all outcomes
const BASE_PREDICTORS = [
  { key: 'pct_black', label: '% Black', derived: true },
  { key: 'pct_white', label: '% White', derived: true },
  { key: 'pct_asian', label: '% Asian', derived: true },
  { key: 'income_median_household_2022', label: 'Median Income', transform: 'log' },
  { key: 'poverty_rate_2022_pct', label: 'Poverty Rate' },
  { key: 'education_bachelors_or_higher_2022_pct', label: 'Education (Bachelor\'s+)' },
  { key: 'unemployment_rate_2022_pct', label: 'Unemployment Rate' },
  { key: 'heavy_drinking_prevalence_2022_crude', label: 'Heavy Drinking' },
  { key: 'depression_prevalence_2022_crude', label: 'Depression' },
  { key: 'giffords_gun_law_rank_2022', label: 'Gun Law Strength (Giffords Rank)' },
  { key: 'gun_ownership_household_pct', label: 'Gun Ownership %' },
  { key: 'gini_coefficient_2019', label: 'Income Inequality (Gini)' },
  { key: 'veteran_population_pct_2021', label: 'Veteran Pop. %' },
  { key: 'single_parent_household_pct_2022', label: 'Single Parent Households %' },
  { key: 'religiosity_high_pct_2024', label: 'High Religiosity %' },
];

// Mortality-specific confounders (to show other outcomes as confounders)
const MORTALITY_CONFOUNDERS = {
  'mortality_firearm_age_adj_12mo_ending_2023Q1': [
    { key: 'mortality_homicide_age_adj_12mo_ending_2023Q1', label: 'Homicide Rate' },
    { key: 'mortality_overdose_age_adj_12mo_ending_2023Q1', label: 'Drug Overdose Rate' },
  ],
  'mortality_homicide_age_adj_12mo_ending_2023Q1': [
    { key: 'mortality_firearm_age_adj_12mo_ending_2023Q1', label: 'Firearm Mortality' },
    { key: 'mortality_overdose_age_adj_12mo_ending_2023Q1', label: 'Drug Overdose Rate' },
  ],
  'mortality_overdose_age_adj_12mo_ending_2023Q1': [
    { key: 'mortality_firearm_age_adj_12mo_ending_2023Q1', label: 'Firearm Mortality' },
    { key: 'mortality_homicide_age_adj_12mo_ending_2023Q1', label: 'Homicide Rate' },
  ],
};

/**
 * Get confounders for a specific outcome variable
 * @param {string} outcomeKey - The outcome variable key
 * @returns {Object[]} Array of predictor objects
 */
export function getConfoundersForOutcome(outcomeKey) {
  const mortalityConfounders = MORTALITY_CONFOUNDERS[outcomeKey] || [];
  return [...BASE_PREDICTORS, ...mortalityConfounders];
}

/**
 * Prepare data with derived fields (race percentages, log transforms)
 */
export function prepareData(rawData) {
  const data = JSON.parse(JSON.stringify(rawData)); // Deep clone
  
  for (const usps of Object.keys(data.states)) {
    const s = data.states[usps];
    
    // Compute race percentages
    if (s.population_total_2022 && s.population_total_2022 > 0) {
      s.pct_white = (s.race_white_alone_2022 / s.population_total_2022) * 100;
      s.pct_black = (s.race_black_alone_2022 / s.population_total_2022) * 100;
      s.pct_asian = (s.race_asian_alone_2022 / s.population_total_2022) * 100;
    }
    
    // Log transform income (for regression)
    if (s.income_median_household_2022 && s.income_median_household_2022 > 0) {
      s.income_log = Math.log(s.income_median_household_2022);
    }
  }
  
  return data;
}

/**
 * Render the confounders checkbox list
 * @param {Object[]} predictorsWithR2 - Array of { key, label, r2 } sorted by R²
 * @param {Object} marginalR2 - Map of key -> marginal R²
 * @param {string[]} selectedKeys - Currently selected predictor keys
 * @param {Function} onChange - Callback when selection changes
 */
export function renderConfounders(predictorsWithR2, marginalR2, selectedKeys, onChange) {
  const container = document.getElementById('confounders-list');
  container.innerHTML = '';

  for (const { key, label, r2 } of predictorsWithR2) {
    const isSelected = selectedKeys.includes(key);
    const marginal = marginalR2[key];
    
    const item = document.createElement('label');
    item.className = 'confounder-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isSelected;
    checkbox.dataset.key = key;
    checkbox.addEventListener('change', () => {
      onChange(key, checkbox.checked);
    });
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'confounder-label';
    labelSpan.textContent = label;
    
    // Scatter plot button
    const scatterBtn = document.createElement('button');
    scatterBtn.className = 'scatter-btn';
    scatterBtn.innerHTML = '📊';
    scatterBtn.title = 'View scatter plot';
    scatterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (scatterPlotCallback) {
        scatterPlotCallback(key, label);
      }
    });
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'confounder-stats';
    
    const r2Span = document.createElement('span');
    r2Span.className = 'r2-individual';
    r2Span.textContent = `${(r2 * 100).toFixed(1)}%`;
    r2Span.title = 'Variance explained by this factor alone';
    
    const marginalSpan = document.createElement('span');
    if (marginal.isSelected) {
      // Show unique contribution (how much R² would drop if removed)
      marginalSpan.className = 'r2-marginal selected';
      marginalSpan.textContent = `${(marginal.value * 100).toFixed(1)}%`;
      marginalSpan.title = 'Unique contribution: R² would drop by this much if removed';
    } else {
      // Show marginal gain (how much R² would increase if added)
      marginalSpan.className = 'r2-marginal';
      marginalSpan.textContent = `+${(marginal.value * 100).toFixed(1)}%`;
      marginalSpan.title = 'Additional variance when added to current selection';
    }
    
    statsDiv.appendChild(r2Span);
    statsDiv.appendChild(marginalSpan);
    
    item.appendChild(checkbox);
    item.appendChild(labelSpan);
    item.appendChild(statsDiv);
    item.appendChild(scatterBtn);
    
    container.appendChild(item);
  }
}

/**
 * Update the variance explained display
 * @param {number} combinedR2 - Combined R² of selected predictors
 */
export function updateModelSummary(combinedR2, numConfounders = 0) {
  document.getElementById('variance-explained').textContent = (combinedR2 * 100).toFixed(1) + '%';
  
  // Update callout with interpretation
  const callout = document.getElementById('variance-callout');
  const pct = (combinedR2 * 100).toFixed(0);
  const remaining = (100 - combinedR2 * 100).toFixed(0);
  
  if (numConfounders === 0) {
    callout.textContent = 'Select confounders to see how much of the variation they explain.';
  } else if (combinedR2 < 0.3) {
    callout.textContent = `These ${numConfounders} factor(s) explain only ${pct}% — most variation (${remaining}%) is due to other factors.`;
  } else if (combinedR2 < 0.6) {
    callout.textContent = `These factors explain ${pct}% of state differences. The remaining ${remaining}% may reflect policy, culture, or unmeasured factors.`;
  } else {
    callout.textContent = `These factors explain most (${pct}%) of the variation. States that still stand out may have unique circumstances.`;
  }
}

// Store raw ranks for comparison
let rawRanks = {};

/**
 * Compute and store raw ranks for all states
 * @param {Object} stateData - Full state data
 * @param {string} outcomeKey - Current outcome variable key
 */
export function computeRawRanks(stateData, outcomeKey) {
  const entries = Object.entries(stateData.states)
    .filter(([_, s]) => s[outcomeKey] != null)
    .map(([usps, s]) => ({ usps, value: s[outcomeKey] }))
    .sort((a, b) => b.value - a.value);
  
  rawRanks = {};
  entries.forEach((e, i) => {
    rawRanks[e.usps] = i + 1; // 1 = worst (highest rate)
  });
}

/**
 * Render top/bottom 10 tables
 * @param {Object} stateData - Full state data
 * @param {Object} values - Map of USPS -> value
 * @param {string} valueLabel - Label for the value column
 * @param {boolean} showRankChange - Whether to show rank change column
 */
export function renderTables(stateData, values, valueLabel = 'Rate', showRankChange = false) {
  const entries = Object.entries(values)
    .filter(([_, v]) => v != null && !isNaN(v))
    .map(([usps, value]) => ({
      usps,
      name: stateData.states[usps]?.name || usps,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Compute current ranks
  const currentRanks = {};
  entries.forEach((e, i) => {
    currentRanks[e.usps] = i + 1;
  });

  const top10 = entries.slice(0, 10);
  const bottom10 = entries.slice(-10).reverse();

  // Show/hide rank change headers
  document.getElementById('rank-change-header-top').classList.toggle('hidden', !showRankChange);
  document.getElementById('rank-change-header-bottom').classList.toggle('hidden', !showRankChange);

  renderTable('top-10-table', top10, currentRanks, showRankChange);
  renderTable('bottom-10-table', bottom10, currentRanks, showRankChange);
}

/**
 * Render a single table
 */
function renderTable(tableId, items, currentRanks, showRankChange) {
  const tbody = document.getElementById(tableId);
  tbody.innerHTML = '';

  items.forEach((item, i) => {
    const tr = document.createElement('tr');
    
    let rankChangeHtml = '';
    if (showRankChange && rawRanks[item.usps] != null) {
      const rawRank = rawRanks[item.usps];
      const curRank = currentRanks[item.usps];
      const delta = rawRank - curRank; // positive = improved (lower rank number = worse)
      
      if (delta > 0) {
        rankChangeHtml = `<td class="text-right text-green-400 text-xs">↑${delta}</td>`;
      } else if (delta < 0) {
        rankChangeHtml = `<td class="text-right text-red-400 text-xs">↓${Math.abs(delta)}</td>`;
      } else {
        rankChangeHtml = `<td class="text-right text-gray-500 text-xs">—</td>`;
      }
    }
    
    tr.innerHTML = `
      <td class="text-gray-500">${i + 1}</td>
      <td>${item.name}</td>
      <td class="text-right font-mono">${item.value.toFixed(1)}</td>
      ${rankChangeHtml}
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Generate tooltip HTML content
 * @param {string} usps - State abbreviation
 * @param {Object} state - State data object
 * @param {Object} extra - Additional computed values { predicted, residual }
 * @returns {string} HTML content
 */
export function getTooltipHTML(usps, state, extra = {}) {
  const formatNum = (n, decimals = 1) => n != null ? n.toFixed(decimals) : 'N/A';
  const formatPct = (n) => n != null ? n.toFixed(1) + '%' : 'N/A';
  const formatMoney = (n) => n != null ? '$' + n.toLocaleString() : 'N/A';

  let html = `<div class="tooltip-title">${state.name} (${usps})</div>`;
  
  // Mortality rates
  html += `<div class="tooltip-row"><span class="tooltip-label">Firearm Rate:</span><span class="tooltip-value">${formatNum(state.mortality_firearm_age_adj_12mo_ending_2023Q1)}</span></div>`;
  html += `<div class="tooltip-row"><span class="tooltip-label">Homicide Rate:</span><span class="tooltip-value">${formatNum(state.mortality_homicide_age_adj_12mo_ending_2023Q1)}</span></div>`;
  
  // Predicted and residual if available
  if (extra.predicted != null) {
    html += `<div class="tooltip-row"><span class="tooltip-label">Predicted:</span><span class="tooltip-value">${formatNum(extra.predicted)}</span></div>`;
  }
  if (extra.residual != null) {
    const sign = extra.residual >= 0 ? '+' : '';
    const color = extra.residual >= 0 ? '#ef4444' : '#22c55e';
    html += `<div class="tooltip-row"><span class="tooltip-label">Residual:</span><span class="tooltip-value" style="color:${color}">${sign}${formatNum(extra.residual)}</span></div>`;
  }
  
  html += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #374151;">`;
  html += `<div class="tooltip-row"><span class="tooltip-label">Income:</span><span class="tooltip-value">${formatMoney(state.income_median_household_2022)}</span></div>`;
  html += `<div class="tooltip-row"><span class="tooltip-label">Poverty:</span><span class="tooltip-value">${formatPct(state.poverty_rate_2022_pct)}</span></div>`;
  html += `<div class="tooltip-row"><span class="tooltip-label">Education:</span><span class="tooltip-value">${formatPct(state.education_bachelors_or_higher_2022_pct)}</span></div>`;
  html += `<div class="tooltip-row"><span class="tooltip-label">% Black:</span><span class="tooltip-value">${formatPct(state.pct_black)}</span></div>`;
  html += `</div>`;

  return html;
}

/**
 * Get selected outcome variable
 */
export function getOutcomeKey() {
  return document.getElementById('outcome-select').value;
}

/**
 * Set up outcome variable change handler
 */
export function onOutcomeChange(callback) {
  document.getElementById('outcome-select').addEventListener('change', callback);
}

/**
 * Set up Select All / Clear All button handlers
 */
export function onSelectAllClick(callback) {
  document.getElementById('select-all-btn').addEventListener('click', callback);
}

export function onClearAllClick(callback) {
  document.getElementById('clear-all-btn').addEventListener('click', callback);
}

/**
 * Update the dynamic headline based on current state
 * @param {Object} stateData - Full state data
 * @param {Object} values - Current display values (raw or residuals)
 * @param {boolean} isAdjusted - Whether confounders are selected
 * @param {string} outcomeLabel - Label for the outcome (e.g., "firearm deaths")
 */
export function updateHeadline(stateData, values, isAdjusted, outcomeLabel) {
  const headline = document.getElementById('dynamic-headline');
  
  const entries = Object.entries(values)
    .filter(([_, v]) => v != null && !isNaN(v))
    .map(([usps, value]) => ({ usps, name: stateData.states[usps]?.name || usps, value }))
    .sort((a, b) => b.value - a.value);

  if (entries.length === 0) {
    headline.textContent = '';
    return;
  }

  const worst = entries[0];
  const best = entries[entries.length - 1];

  if (!isAdjusted) {
    headline.textContent = `${worst.name} has the highest ${outcomeLabel} rate (${worst.value.toFixed(1)} per 100k)`;
  } else {
    const sign = worst.value >= 0 ? '+' : '';
    headline.textContent = `After adjustment, ${worst.name} is ${sign}${worst.value.toFixed(1)} deaths from expected — the worst outlier`;
  }
}

/**
 * Update the legend's national average marker position
 * @param {number} avg - The average value
 * @param {number} min - Legend minimum
 * @param {number} max - Legend maximum
 * @param {boolean} isRawView - True for raw view (US Avg), false for residual view (0 = Expected)
 */
export function updateLegendAverage(avg, min, max, isRawView) {
  const marker = document.getElementById('legend-avg-marker');
  const label = marker.querySelector('div');
  
  if (min === max) {
    marker.classList.add('hidden');
    return;
  }

  let value, labelText;
  if (isRawView) {
    value = avg;
    labelText = 'US Avg';
  } else {
    // Residual view - show 0 as the expected value
    value = 0;
    labelText = '0 = Expected';
  }

  // Calculate position as percentage
  const pct = ((value - min) / (max - min)) * 100;
  
  // Clamp to 5-95% to keep it visible
  const clampedPct = Math.max(5, Math.min(95, pct));
  
  marker.style.left = `${clampedPct}%`;
  label.textContent = labelText;
  marker.classList.remove('hidden');
}

/**
 * Show the state detail panel
 * @param {string} usps - State abbreviation
 * @param {Object} state - State data
 * @param {Object} extra - { predicted, residual } if adjusted
 */
export function showStateDetail(usps, state, extra = {}) {
  const panel = document.getElementById('state-detail-panel');
  
  // Populate basic info
  document.getElementById('detail-state-name').textContent = `${state.name} (${usps})`;
  document.getElementById('detail-firearm').textContent = formatVal(state.mortality_firearm_age_adj_12mo_ending_2023Q1);
  document.getElementById('detail-homicide').textContent = formatVal(state.mortality_homicide_age_adj_12mo_ending_2023Q1);
  document.getElementById('detail-overdose').textContent = formatVal(state.mortality_overdose_age_adj_12mo_ending_2023Q1);
  document.getElementById('detail-income').textContent = state.income_median_household_2022 
    ? '$' + state.income_median_household_2022.toLocaleString() 
    : 'N/A';
  document.getElementById('detail-poverty').textContent = formatPct(state.poverty_rate_2022_pct);
  document.getElementById('detail-education').textContent = formatPct(state.education_bachelors_or_higher_2022_pct);

  // Adjustment section
  const adjSection = document.getElementById('detail-adjustment');
  if (extra.predicted != null && extra.residual != null) {
    const actual = extra.predicted + extra.residual;
    document.getElementById('detail-actual').textContent = actual.toFixed(1);
    document.getElementById('detail-expected').textContent = extra.predicted.toFixed(1);
    
    const diffEl = document.getElementById('detail-difference');
    const sign = extra.residual >= 0 ? '+' : '';
    diffEl.textContent = `${sign}${extra.residual.toFixed(1)}`;
    diffEl.className = extra.residual >= 0 
      ? 'text-lg font-bold text-red-400' 
      : 'text-lg font-bold text-green-400';

    const interp = document.getElementById('detail-interpretation');
    if (extra.residual >= 2) {
      interp.textContent = `${state.name} has significantly more violence than expected given its demographics.`;
    } else if (extra.residual <= -2) {
      interp.textContent = `${state.name} has significantly less violence than expected given its demographics.`;
    } else {
      interp.textContent = `${state.name} is close to expected based on selected factors.`;
    }
    
    adjSection.classList.remove('hidden');
  } else {
    adjSection.classList.add('hidden');
  }

  panel.classList.remove('hidden');
  currentDetailState = usps;
}

/**
 * Hide the state detail panel
 */
export function hideStateDetail() {
  document.getElementById('state-detail-panel').classList.add('hidden');
  currentDetailState = null;
}

// Track which state is currently shown in detail panel
let currentDetailState = null;

/**
 * Check if detail panel is showing a specific state
 */
export function isDetailShowing(usps) {
  return currentDetailState === usps;
}

/**
 * Set up close button for state detail panel
 */
export function setupDetailPanel(onClose) {
  document.getElementById('close-detail-btn').addEventListener('click', onClose);
}

function formatVal(v) {
  return v != null ? v.toFixed(1) : 'N/A';
}

function formatPct(v) {
  return v != null ? v.toFixed(1) + '%' : 'N/A';
}

/**
 * Set up methodology panel toggle
 */
export function setupMethodologyPanel() {
  const toggle = document.getElementById('methodology-toggle');
  const content = document.getElementById('methodology-content');
  const chevron = document.getElementById('methodology-chevron');
  
  toggle.addEventListener('click', () => {
    const isHidden = content.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180', !isHidden);
  });
}

/**
 * Export the map area as PNG
 */
export async function exportMapAsPng() {
  const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
  
  const mapContainer = document.getElementById('map-container');
  const legend = document.getElementById('legend');
  const headline = document.getElementById('dynamic-headline');
  
  // Create a wrapper div for export
  const exportWrapper = document.createElement('div');
  exportWrapper.style.cssText = 'background: #1f2937; padding: 20px; display: inline-block;';
  
  // Clone headline
  const headlineClone = headline.cloneNode(true);
  headlineClone.style.cssText = 'color: #facc15; font-size: 18px; text-align: center; margin-bottom: 10px; font-weight: 500;';
  exportWrapper.appendChild(headlineClone);
  
  // Clone map
  const mapClone = mapContainer.cloneNode(true);
  mapClone.querySelector('#tooltip')?.remove();
  exportWrapper.appendChild(mapClone);
  
  // Clone legend
  const legendClone = legend.cloneNode(true);
  legendClone.style.marginTop = '10px';
  exportWrapper.appendChild(legendClone);
  
  // Add attribution
  const attr = document.createElement('div');
  attr.style.cssText = 'color: #6b7280; font-size: 10px; text-align: center; margin-top: 10px;';
  attr.textContent = 'Data: CDC VSRR; ACS 2022; BRFSS 2022; GIFFORDS; RAND';
  exportWrapper.appendChild(attr);
  
  document.body.appendChild(exportWrapper);
  
  try {
    const canvas = await html2canvas(exportWrapper, {
      backgroundColor: '#1f2937',
      scale: 2,
    });
    
    const link = document.createElement('a');
    link.download = 'gun-violence-map.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(exportWrapper);
  }
}

/**
 * Set up keyboard navigation
 * @param {string[]} stateOrder - Ordered list of state USPS codes
 * @param {Function} onSelectState - Callback when state is selected
 * @param {Function} onClose - Callback to close detail panel
 */
export function setupKeyboardNavigation(stateOrder, onSelectState, onClose) {
  let currentIndex = -1;
  
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    if (e.key === 'Escape') {
      onClose();
      currentIndex = -1;
      return;
    }
    
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      
      if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % stateOrder.length;
      } else {
        currentIndex = (currentIndex - 1 + stateOrder.length) % stateOrder.length;
      }
      
      onSelectState(stateOrder[currentIndex]);
    }
  });
}

/**
 * Get state from URL hash
 * @returns {{ outcome: string|null, confounders: string[]|null }}
 */
export function getStateFromUrl() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    outcome: params.get('outcome'),
    confounders: params.get('confounders')?.split(',').filter(Boolean) || null,
  };
}

/**
 * Update URL hash with current state
 * @param {string} outcome - Current outcome key
 * @param {string[]} confounders - Selected confounder keys
 */
export function updateUrlState(outcome, confounders) {
  const params = new URLSearchParams();
  params.set('outcome', outcome);
  if (confounders.length > 0) {
    params.set('confounders', confounders.join(','));
  }
  window.history.replaceState(null, '', '#' + params.toString());
}

// Comparison mode state
let compareMode = false;
let compareStates = [];

/**
 * Set up comparison mode toggle and modal
 */
export function setupCompareMode(stateData, getOutcomeKey, getCurrentModelResult) {
  const toggle = document.getElementById('compare-mode-toggle');
  const listContainer = document.getElementById('compare-states-list');
  const modal = document.getElementById('compare-modal');
  const closeBtn = document.getElementById('compare-close');
  
  toggle.addEventListener('change', () => {
    compareMode = toggle.checked;
    listContainer.classList.toggle('hidden', !compareMode);
    if (!compareMode) {
      compareStates = [];
      updateCompareList(listContainer);
    }
  });
  
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
  
  // Return function to handle state selection in compare mode
  return (usps) => {
    if (!compareMode) return false;
    
    const idx = compareStates.indexOf(usps);
    if (idx >= 0) {
      compareStates.splice(idx, 1);
    } else if (compareStates.length < 3) {
      compareStates.push(usps);
    }
    
    updateCompareList(listContainer);
    
    if (compareStates.length >= 2) {
      showCompareModal(stateData, compareStates, getOutcomeKey(), getCurrentModelResult());
    }
    
    return true; // Handled
  };
}

function updateCompareList(container) {
  container.innerHTML = compareStates.map(usps => 
    `<span class="px-2 py-1 bg-blue-600 rounded text-sm">${usps}</span>`
  ).join('') || '<span class="text-gray-500 text-sm">Click states on map...</span>';
}

function showCompareModal(stateData, uspsArray, outcomeKey, modelResult) {
  const modal = document.getElementById('compare-modal');
  const content = document.getElementById('compare-content');
  
  const states = uspsArray.map(usps => {
    const s = stateData.states[usps];
    let predicted = null, residual = null;
    if (modelResult) {
      const idx = modelResult.stateOrder.indexOf(usps);
      if (idx >= 0) {
        predicted = modelResult.yHat[idx];
        residual = modelResult.residuals[idx];
      }
    }
    return { usps, ...s, predicted, residual };
  });
  
  const outcomeLabels = {
    'mortality_firearm_age_adj_12mo_ending_2023Q1': 'Firearm Rate',
    'mortality_homicide_age_adj_12mo_ending_2023Q1': 'Homicide Rate',
    'mortality_overdose_age_adj_12mo_ending_2023Q1': 'Overdose Rate',
  };
  
  const metrics = [
    { key: outcomeKey, label: outcomeLabels[outcomeKey] || 'Rate', format: v => v?.toFixed(1) || 'N/A' },
    { key: 'predicted', label: 'Expected', format: v => v?.toFixed(1) || '—', show: !!modelResult },
    { key: 'residual', label: 'Difference', format: v => v != null ? (v >= 0 ? '+' : '') + v.toFixed(1) : '—', show: !!modelResult },
    { key: 'income_median_household_2022', label: 'Median Income', format: v => v ? '$' + v.toLocaleString() : 'N/A' },
    { key: 'poverty_rate_2022_pct', label: 'Poverty Rate', format: v => v?.toFixed(1) + '%' || 'N/A' },
    { key: 'education_bachelors_or_higher_2022_pct', label: 'Education (BA+)', format: v => v?.toFixed(1) + '%' || 'N/A' },
    { key: 'gun_ownership_household_pct', label: 'Gun Ownership', format: v => v?.toFixed(1) + '%' || 'N/A' },
    { key: 'giffords_gun_law_rank_2022', label: 'Gun Law Rank', format: v => v ? '#' + v : 'N/A' },
  ].filter(m => m.show !== false);
  
  let html = `<table class="w-full text-sm">
    <thead>
      <tr class="border-b border-gray-700">
        <th class="text-left py-2 text-gray-400">Metric</th>
        ${states.map(s => `<th class="text-right py-2 text-white">${s.name}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;
  
  for (const m of metrics) {
    html += `<tr class="border-b border-gray-700/50">
      <td class="py-2 text-gray-400">${m.label}</td>
      ${states.map(s => {
        const val = s[m.key];
        let cls = 'text-right py-2 font-mono';
        if (m.key === 'residual' && val != null) {
          cls += val >= 0 ? ' text-red-400' : ' text-green-400';
        }
        return `<td class="${cls}">${m.format(val)}</td>`;
      }).join('')}
    </tr>`;
  }
  
  html += '</tbody></table>';
  
  content.innerHTML = html;
  modal.classList.remove('hidden');
}

/**
 * Check if compare mode is active
 */
export function isCompareModeActive() {
  return compareMode;
}

/**
 * Set up scatter plot modal
 */
export function setupScatterPlot(stateData, getOutcomeKey) {
  const modal = document.getElementById('scatter-modal');
  const closeBtn = document.getElementById('scatter-close');
  
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

/**
 * Show scatter plot for a predictor
 * @param {boolean} adjusted - If true, show residuals (controlling for other selected confounders)
 * @param {string[]} selectedPredictors - Currently selected predictor keys
 * @param {Object} modelResult - Current model result with residuals
 */
export function showScatterPlot(stateData, predictorKey, predictorLabel, outcomeKey, outcomeLabel, adjusted = false, selectedPredictors = [], modelResult = null) {
  const modal = document.getElementById('scatter-modal');
  const container = document.getElementById('scatter-container');
  const title = document.getElementById('scatter-title');
  const info = document.getElementById('scatter-info');
  
  const yLabel = adjusted && modelResult ? `${outcomeLabel} (Residual)` : outcomeLabel;
  title.textContent = `${predictorLabel} vs ${yLabel}`;
  
  // Get data points
  const points = [];
  for (const [usps, state] of Object.entries(stateData.states)) {
    let x = state[predictorKey];
    let y;
    
    if (adjusted && modelResult) {
      // Use residuals from current model
      const idx = modelResult.stateOrder.indexOf(usps);
      y = idx >= 0 ? modelResult.residuals[idx] : null;
    } else {
      y = state[outcomeKey];
    }
    
    // Handle log transform for income
    if (predictorKey === 'income_median_household_2022' && x) {
      x = Math.log(x);
    }
    
    if (x != null && y != null && !isNaN(x) && !isNaN(y)) {
      points.push({ usps, x, y, name: state.name, rawY: state[outcomeKey] });
    }
  }
  
  if (points.length < 3) {
    container.innerHTML = '<p class="text-center text-gray-400">Not enough data points</p>';
    modal.classList.remove('hidden');
    return;
  }
  
  // Compute regression line
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Compute R²
  const meanY = sumY / n;
  const ssTot = points.reduce((a, p) => a + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  
  // Draw with D3
  const margin = { top: 20, right: 30, bottom: 45, left: 55 };
  const width = 520;
  const height = 320;
  
  container.innerHTML = '';
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .style('background', '#1f2937')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  const xExtent = d3.extent(points, d => d.x);
  const yExtent = d3.extent(points, d => d.y);
  
  const x = d3.scaleLinear().domain(xExtent).nice().range([0, width]);
  const y = d3.scaleLinear().domain(yExtent).nice().range([height, 0]);
  
  // Grid lines
  svg.append('g')
    .attr('class', 'grid')
    .selectAll('line')
    .data(y.ticks(6))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', width)
    .attr('y1', d => y(d))
    .attr('y2', d => y(d))
    .attr('stroke', '#374151')
    .attr('stroke-dasharray', '2,2');
  
  svg.append('g')
    .attr('class', 'grid')
    .selectAll('line')
    .data(x.ticks(6))
    .enter()
    .append('line')
    .attr('x1', d => x(d))
    .attr('x2', d => x(d))
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#374151')
    .attr('stroke-dasharray', '2,2');
  
  // X Axis
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6))
    .call(g => g.selectAll('text').attr('fill', '#9ca3af').attr('font-size', '11px'))
    .call(g => g.selectAll('line').attr('stroke', '#4b5563'))
    .call(g => g.select('.domain').attr('stroke', '#4b5563'));
  
  // Y Axis
  svg.append('g')
    .call(d3.axisLeft(y).ticks(6))
    .call(g => g.selectAll('text').attr('fill', '#9ca3af').attr('font-size', '11px'))
    .call(g => g.selectAll('line').attr('stroke', '#4b5563'))
    .call(g => g.select('.domain').attr('stroke', '#4b5563'));
  
  // X axis label
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + 35)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6b7280')
    .attr('font-size', '11px')
    .text(predictorLabel);
  
  // Y axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6b7280')
    .attr('font-size', '11px')
    .text(outcomeLabel);
  
  // Regression line
  const lineX = x.domain();
  svg.append('line')
    .attr('class', 'regression-line')
    .attr('x1', x(lineX[0]))
    .attr('y1', y(slope * lineX[0] + intercept))
    .attr('x2', x(lineX[1]))
    .attr('y2', y(slope * lineX[1] + intercept))
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,4');
  
  // Tooltip element
  const tooltip = document.getElementById('scatter-tooltip');
  
  // Points with rich tooltips
  svg.selectAll('.scatter-point')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', 'scatter-point')
    .attr('cx', d => x(d.x))
    .attr('cy', d => y(d.y))
    .attr('r', 4)
    .attr('fill', '#f59e0b')
    .attr('stroke', '#1f2937')
    .attr('stroke-width', 1)
    .attr('opacity', 0.85)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const state = stateData.states[d.usps];
      if (!state) return;
      
      // Build tooltip HTML similar to map tooltip
      let html = `<div style="font-weight:600; margin-bottom:4px;">${state.name} (${d.usps})</div>`;
      html += `<div style="display:flex; justify-content:space-between;"><span style="color:#9ca3af">${predictorLabel}:</span><span style="font-family:monospace">${d.x.toFixed(1)}</span></div>`;
      html += `<div style="display:flex; justify-content:space-between;"><span style="color:#9ca3af">${outcomeLabel}:</span><span style="font-family:monospace">${d.y.toFixed(1)}</span></div>`;
      html += `<div style="margin-top:4px; padding-top:4px; border-top:1px solid #374151;">`;
      html += `<div style="display:flex; justify-content:space-between;"><span style="color:#9ca3af">Income:</span><span>$${(state.income_median_household_2022 || 0).toLocaleString()}</span></div>`;
      html += `<div style="display:flex; justify-content:space-between;"><span style="color:#9ca3af">Poverty:</span><span>${(state.poverty_rate_2022_pct || 0).toFixed(1)}%</span></div>`;
      html += `</div>`;
      
      tooltip.innerHTML = html;
      tooltip.classList.remove('hidden');
      
      // Position tooltip
      const rect = container.getBoundingClientRect();
      tooltip.style.left = (event.clientX - rect.left + 10) + 'px';
      tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
      
      d3.select(this).attr('r', 6).attr('stroke', '#fff').attr('stroke-width', 2);
    })
    .on('mousemove', function(event) {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = (event.clientX - rect.left + 10) + 'px';
      tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
    })
    .on('mouseout', function() {
      tooltip.classList.add('hidden');
      d3.select(this).attr('r', 4).attr('stroke', '#1f2937').attr('stroke-width', 1);
    });
  
  info.textContent = `R² = ${(r2 * 100).toFixed(1)}% (${n} states)`;
  
  modal.classList.remove('hidden');
}

// Store scatter plot callback and current state for toggle
let scatterPlotCallback = null;
let currentScatterState = null;

/**
 * Enable scatter plot functionality - stores callback for button clicks
 */
export function enableScatterOnConfounders(stateData, getOutcomeKey, getSelectedPredictors, getModelResult) {
  // Set up adjusted toggle handler
  const toggle = document.getElementById('scatter-adjusted-toggle');
  toggle.addEventListener('change', () => {
    if (currentScatterState) {
      const { key, label, outcomeKey, outcomeLabel } = currentScatterState;
      const adjusted = toggle.checked;
      const selectedPredictors = getSelectedPredictors();
      const modelResult = getModelResult();
      showScatterPlot(stateData, key, label, outcomeKey, outcomeLabel, adjusted, selectedPredictors, modelResult);
    }
  });
  
  scatterPlotCallback = (key, labelText) => {
    const outcomeKey = getOutcomeKey();
    const outcomeLabels = {
      'mortality_firearm_age_adj_12mo_ending_2023Q1': 'Firearm Mortality',
      'mortality_homicide_age_adj_12mo_ending_2023Q1': 'Homicide Mortality',
      'mortality_overdose_age_adj_12mo_ending_2023Q1': 'Drug Overdose Mortality',
    };
    const outcomeLabel = outcomeLabels[outcomeKey] || 'Mortality';
    const toggle = document.getElementById('scatter-adjusted-toggle');
    const adjusted = toggle.checked;
    const selectedPredictors = getSelectedPredictors();
    const modelResult = getModelResult();
    
    // Store state for toggle
    currentScatterState = { key, label: labelText, outcomeKey, outcomeLabel };
    
    showScatterPlot(stateData, key, labelText, outcomeKey, outcomeLabel, adjusted, selectedPredictors, modelResult);
  };
}

/**
 * Called by scatter button click handler
 */
function handleScatterClick(key, label) {
  if (scatterPlotCallback) {
    scatterPlotCallback(key, label);
  }
}
