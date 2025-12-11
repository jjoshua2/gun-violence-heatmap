/**
 * Main application entry point
 */
import { initMap, updateMapColors, setupTooltips } from './map.js';
import { 
  computeAllIndividualR2, 
  computeModelR2, 
  computeMarginalR2 
} from './regression.js';
import { 
  getConfoundersForOutcome, 
  prepareData, 
  renderConfounders, 
  updateModelSummary,
  renderTables,
  computeRawRanks,
  getTooltipHTML,
  getOutcomeKey,
  onOutcomeChange,
  onSelectAllClick,
  onClearAllClick,
  updateHeadline,
  updateLegendAverage,
  showStateDetail,
  hideStateDetail,
  setupDetailPanel,
  isDetailShowing,
  setupMethodologyPanel,
  exportMapAsPng,
  setupKeyboardNavigation,
  getStateFromUrl,
  updateUrlState,
  setupCompareMode,
  isCompareModeActive,
  setupScatterPlot,
  enableScatterOnConfounders
} from './ui.js';

// Application state
let stateData = null;
let selectedPredictors = [];
let predictorsWithR2 = [];
let currentModelResult = null;
let handleCompareClick = null; // Set by setupCompareMode

/**
 * Load state metrics data
 */
async function loadData() {
  const response = await fetch('./state_metrics_derived.json');
  if (!response.ok) {
    throw new Error('Failed to load state_metrics_derived.json');
  }
  return response.json();
}

/**
 * Get values to display on map based on selected confounders
 * - No confounders: show raw rates (sequential color scale)
 * - With confounders: show residuals (diverging color scale)
 */
function getDisplayValues() {
  const outcomeKey = getOutcomeKey();
  const values = {};

  if (selectedPredictors.length === 0) {
    // Raw values - no adjustment
    for (const usps of Object.keys(stateData.states)) {
      values[usps] = stateData.states[usps][outcomeKey];
    }
    return { values, mode: 'sequential', label: 'Deaths per 100k' };
  }

  // Adjusted - show residuals
  if (!currentModelResult || currentModelResult.stateOrder.length === 0) {
    return { values: {}, mode: 'sequential', label: 'Deaths per 100k' };
  }

  const { residuals, stateOrder } = currentModelResult;
  
  for (let i = 0; i < stateOrder.length; i++) {
    values[stateOrder[i]] = residuals[i];
  }

  return { values, mode: 'diverging', label: 'Residual (actual − expected)' };
}

/**
 * Update the entire visualization
 */
function updateVisualization() {
  const outcomeKey = getOutcomeKey();
  
  // Recompute model if predictors are selected
  if (selectedPredictors.length > 0) {
    currentModelResult = computeModelR2(stateData, selectedPredictors, outcomeKey);
  } else {
    currentModelResult = null;
  }

  // Update model summary with callout
  const combinedR2 = currentModelResult ? currentModelResult.rSquared : 0;
  updateModelSummary(combinedR2, selectedPredictors.length);

  // Get confounders for current outcome
  const currentPredictors = getConfoundersForOutcome(outcomeKey);

  // Compute marginal R² for each predictor
  const marginalR2 = computeMarginalR2(stateData, selectedPredictors, currentPredictors, outcomeKey);

  // Update confounders panel (keep sorted by individual R²)
  renderConfounders(predictorsWithR2, marginalR2, selectedPredictors, handlePredictorChange);

  // Update map
  const { values, mode, label } = getDisplayValues();
  updateMapColors(stateData, values, mode, { label });

  // Update tables with rank change column when adjusted
  const tableLabel = selectedPredictors.length === 0 ? 'Rate' : 'Residual';
  const showRankChange = selectedPredictors.length > 0;
  renderTables(stateData, values, tableLabel, showRankChange);

  // Update dynamic headline
  const outcomeLabels = {
    'mortality_firearm_age_adj_12mo_ending_2023Q1': 'firearm death',
    'mortality_homicide_age_adj_12mo_ending_2023Q1': 'homicide',
    'mortality_overdose_age_adj_12mo_ending_2023Q1': 'drug overdose',
  };
  const outcomeLabel = outcomeLabels[outcomeKey] || 'mortality';
  updateHeadline(stateData, values, selectedPredictors.length > 0, outcomeLabel);

  // Update legend average marker (shows US Avg for raw, 0=Expected for residuals)
  const vals = Object.values(values).filter(v => v != null && !isNaN(v));
  if (vals.length > 0) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    updateLegendAverage(avg, min, max, selectedPredictors.length === 0);
  }

  // Update tooltips and click handlers
  setupTooltips(stateData, (usps, state) => {
    let extra = {};
    if (currentModelResult && selectedPredictors.length > 0) {
      const idx = currentModelResult.stateOrder.indexOf(usps);
      if (idx >= 0) {
        extra.predicted = currentModelResult.yHat[idx];
        extra.residual = currentModelResult.residuals[idx];
      }
    }
    return getTooltipHTML(usps, state, extra);
  }, (usps, state) => {
    // Click handler - check compare mode first, then toggle detail panel
    if (handleCompareClick && handleCompareClick(usps)) {
      return; // Handled by compare mode
    }
    selectState(usps);
  });

  // Update URL state
  updateUrlState(outcomeKey, selectedPredictors);
}

/**
 * Select and show detail for a state (used by click and keyboard)
 */
function selectState(usps) {
  if (!stateData?.states[usps]) return;
  
  if (isDetailShowing(usps)) {
    hideStateDetail();
    return;
  }
  
  const state = stateData.states[usps];
  let extra = {};
  if (currentModelResult && selectedPredictors.length > 0) {
    const idx = currentModelResult.stateOrder.indexOf(usps);
    if (idx >= 0) {
      extra.predicted = currentModelResult.yHat[idx];
      extra.residual = currentModelResult.residuals[idx];
    }
  }
  showStateDetail(usps, state, extra);
}

/**
 * Handle predictor checkbox change
 */
function handlePredictorChange(key, isSelected) {
  if (isSelected) {
    if (!selectedPredictors.includes(key)) {
      selectedPredictors.push(key);
    }
  } else {
    selectedPredictors = selectedPredictors.filter(k => k !== key);
  }
  updateVisualization();
}

/**
 * Initialize the application
 */
async function init() {
  try {
    // Load data
    console.log('Loading data...');
    const rawData = await loadData();
    stateData = prepareData(rawData);
    console.log('Data loaded:', Object.keys(stateData.states).length, 'states');

    // Initialize map
    console.log('Initializing map...');
    await initMap();
    console.log('Map initialized');

    // Compute individual R² for all predictors
    const outcomeKey = getOutcomeKey();
    const initialPredictors = getConfoundersForOutcome(outcomeKey);
    predictorsWithR2 = computeAllIndividualR2(stateData, initialPredictors, outcomeKey);
    console.log('Individual R² computed:', predictorsWithR2);

    // Compute and store raw ranks for rank change display
    computeRawRanks(stateData, outcomeKey);

    // Set up compare mode (returns click handler)
    handleCompareClick = setupCompareMode(stateData, getOutcomeKey, () => currentModelResult);
    
    // Set up scatter plot modal and enable clicking on confounder labels
    setupScatterPlot(stateData, getOutcomeKey);
    enableScatterOnConfounders(stateData, getOutcomeKey, () => selectedPredictors, () => currentModelResult);

    // Set up event handlers
    onSelectAllClick(() => {
      const currentPredictors = getConfoundersForOutcome(getOutcomeKey());
      selectedPredictors = currentPredictors.map(p => p.key);
      updateVisualization();
    });
    onClearAllClick(() => {
      selectedPredictors = [];
      updateVisualization();
    });
    setupDetailPanel(() => {
      hideStateDetail();
    });
    setupMethodologyPanel();
    
    // Export PNG button
    document.getElementById('export-png-btn').addEventListener('click', exportMapAsPng);
    
    // Keyboard navigation
    const stateOrder = Object.keys(stateData.states).sort();
    setupKeyboardNavigation(stateOrder, selectState, hideStateDetail);
    
    onOutcomeChange(() => {
      // Recompute individual R² when outcome changes (confounders change too)
      const newOutcomeKey = getOutcomeKey();
      const newPredictors = getConfoundersForOutcome(newOutcomeKey);
      predictorsWithR2 = computeAllIndividualR2(stateData, newPredictors, newOutcomeKey);
      // Recompute raw ranks for the new outcome
      computeRawRanks(stateData, newOutcomeKey);
      // Clear selected predictors since available confounders changed
      selectedPredictors = [];
      updateVisualization();
    });

    // Check URL for initial state
    const urlState = getStateFromUrl();
    if (urlState.outcome) {
      document.getElementById('outcome-select').value = urlState.outcome;
      const newPredictors = getConfoundersForOutcome(urlState.outcome);
      predictorsWithR2 = computeAllIndividualR2(stateData, newPredictors, urlState.outcome);
    }
    if (urlState.confounders) {
      // Only use confounders that exist in current predictor set
      const validKeys = new Set(getConfoundersForOutcome(getOutcomeKey()).map(p => p.key));
      selectedPredictors = urlState.confounders.filter(k => validKeys.has(k));
    }

    // Initial render
    updateVisualization();

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
    document.body.innerHTML = `
      <div class="flex items-center justify-center min-h-screen bg-gray-900">
        <div class="bg-red-900 text-red-100 p-6 rounded-lg max-w-md">
          <h2 class="text-xl font-bold mb-2">Error Loading Application</h2>
          <p>${error.message}</p>
          <p class="mt-2 text-sm">Make sure state_metrics_derived.json exists. Run: python build_state_metrics.py</p>
        </div>
      </div>
    `;
  }
}

// Start the application
init();
