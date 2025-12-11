/**
 * Regression utilities using ml-regression-multivariate-linear
 */
import MLR from 'ml-regression-multivariate-linear';

/**
 * Compute mean of an array
 */
export function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Compute total sum of squares: Σ(yi - ȳ)²
 */
export function ssTot(y) {
  const yMean = mean(y);
  return y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
}

/**
 * Compute residual sum of squares: Σ(yi - ŷi)²
 */
export function ssRes(y, yHat) {
  return y.reduce((sum, yi, i) => sum + (yi - yHat[i]) ** 2, 0);
}

/**
 * Compute R² from y and predicted values
 */
export function rSquared(y, yHat) {
  const tot = ssTot(y);
  if (tot === 0) return 0;
  const res = ssRes(y, yHat);
  return Math.max(0, 1 - res / tot);
}

/**
 * Standardize a variable (z-score normalization)
 */
export function standardize(arr) {
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / arr.length;
  const std = Math.sqrt(variance);
  if (std === 0) return arr.map(() => 0);
  return arr.map(x => (x - m) / std);
}

/**
 * Fit multivariate linear regression
 * @param {number[][]} X - Matrix of predictors (n x p)
 * @param {number[]} y - Outcome vector (n x 1)
 * @returns {Object} { model, yHat, residuals, rSquared }
 */
export function fitOLS(X, y) {
  if (X.length === 0 || X[0].length === 0) {
    // No predictors: predict mean
    const yMean = mean(y);
    const yHat = y.map(() => yMean);
    const residuals = y.map(yi => yi - yMean);
    return { model: null, yHat, residuals, rSquared: 0 };
  }

  // ml-regression-multivariate-linear expects Y as a 2D array
  const Y = y.map(yi => [yi]);
  
  try {
    const model = new MLR(X, Y);
    const yHat = X.map(xi => model.predict(xi)[0]);
    const residuals = y.map((yi, i) => yi - yHat[i]);
    const r2 = rSquared(y, yHat);
    
    return { model, yHat, residuals, rSquared: r2 };
  } catch (e) {
    console.warn('Regression failed:', e.message);
    // Fallback: predict mean
    const yMean = mean(y);
    const yHat = y.map(() => yMean);
    const residuals = y.map(yi => yi - yMean);
    return { model: null, yHat, residuals, rSquared: 0 };
  }
}

/**
 * Compute individual R² for a single predictor
 * @param {number[]} x - Single predictor values
 * @param {number[]} y - Outcome values
 * @returns {number} R²
 */
export function individualR2(x, y) {
  const X = x.map(xi => [xi]);
  const result = fitOLS(X, y);
  return result.rSquared;
}

/**
 * Compute R² for a set of predictors
 * @param {Object} data - Object with state data
 * @param {string[]} predictorKeys - Keys of predictors to include
 * @param {string} outcomeKey - Key of outcome variable
 * @returns {Object} { rSquared, yHat, residuals, stateOrder }
 */
export function computeModelR2(data, predictorKeys, outcomeKey) {
  const states = Object.keys(data.states);
  
  // Filter out states with missing values
  const validStates = states.filter(st => {
    const s = data.states[st];
    if (s[outcomeKey] == null) return false;
    for (const key of predictorKeys) {
      if (s[key] == null) return false;
    }
    return true;
  });

  if (validStates.length === 0) {
    return { rSquared: 0, yHat: [], residuals: [], stateOrder: [] };
  }

  const y = validStates.map(st => data.states[st][outcomeKey]);
  
  if (predictorKeys.length === 0) {
    // No predictors selected
    const yMean = mean(y);
    const yHat = y.map(() => yMean);
    const residuals = y.map(yi => yi - yMean);
    return { rSquared: 0, yHat, residuals, stateOrder: validStates };
  }

  const X = validStates.map(st => 
    predictorKeys.map(key => data.states[st][key])
  );

  const result = fitOLS(X, y);
  return {
    rSquared: result.rSquared,
    yHat: result.yHat,
    residuals: result.residuals,
    stateOrder: validStates,
  };
}

/**
 * Compute individual R² for all predictors
 * @param {Object} data - State data
 * @param {string[]} allPredictorKeys - All available predictor keys
 * @param {string} outcomeKey - Outcome variable key
 * @returns {Object[]} Array of { key, label, r2 } sorted by R² descending
 */
export function computeAllIndividualR2(data, allPredictorKeys, outcomeKey) {
  const states = Object.keys(data.states);
  
  // Get valid outcome values
  const validStates = states.filter(st => data.states[st][outcomeKey] != null);
  const y = validStates.map(st => data.states[st][outcomeKey]);

  const results = allPredictorKeys.map(({ key, label }) => {
    // Filter states that have this predictor
    const statesWithPredictor = validStates.filter(st => data.states[st][key] != null);
    
    if (statesWithPredictor.length < 3) {
      return { key, label, r2: 0 };
    }

    const yFiltered = statesWithPredictor.map(st => data.states[st][outcomeKey]);
    const x = statesWithPredictor.map(st => data.states[st][key]);
    
    const r2 = individualR2(x, yFiltered);
    return { key, label, r2 };
  });

  // Sort by R² descending
  return results.sort((a, b) => b.r2 - a.r2);
}

/**
 * Compute marginal/unique R² for each predictor
 * - For unselected: how much R² would increase if added
 * - For selected: how much R² would decrease if removed (unique contribution)
 * @param {Object} data - State data
 * @param {string[]} selectedKeys - Currently selected predictor keys
 * @param {string[]} allPredictorKeys - All predictor key objects
 * @param {string} outcomeKey - Outcome variable key
 * @returns {Object} Map of key -> { value: number, isSelected: boolean }
 */
export function computeMarginalR2(data, selectedKeys, allPredictorKeys, outcomeKey) {
  const baseR2 = selectedKeys.length > 0 
    ? computeModelR2(data, selectedKeys, outcomeKey).rSquared 
    : 0;

  const marginals = {};
  
  for (const { key } of allPredictorKeys) {
    if (selectedKeys.includes(key)) {
      // Compute unique contribution: R² drop if this predictor is removed
      const keysWithout = selectedKeys.filter(k => k !== key);
      const r2Without = keysWithout.length > 0 
        ? computeModelR2(data, keysWithout, outcomeKey).rSquared 
        : 0;
      marginals[key] = { value: Math.max(0, baseR2 - r2Without), isSelected: true };
    } else {
      // Compute marginal gain: R² increase if this predictor is added
      const newKeys = [...selectedKeys, key];
      const newR2 = computeModelR2(data, newKeys, outcomeKey).rSquared;
      marginals[key] = { value: Math.max(0, newR2 - baseR2), isSelected: false };
    }
  }

  return marginals;
}
