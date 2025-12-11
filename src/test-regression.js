/**
 * Test script for regression module
 * Run with: node src/test-regression.js
 */
import MLR from 'ml-regression-multivariate-linear';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple test helpers
function assertEqual(actual, expected, message, tolerance = 0.001) {
  const pass = Math.abs(actual - expected) < tolerance;
  if (pass) {
    console.log(`✓ ${message}`);
  } else {
    console.log(`✗ ${message}: expected ${expected}, got ${actual}`);
  }
  return pass;
}

function assertTrue(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
  } else {
    console.log(`✗ ${message}`);
  }
  return condition;
}

// Test 1: Basic OLS with known values
function testBasicOLS() {
  console.log('\n--- Test 1: Basic OLS ---');
  
  // Simple linear relationship: y = 2 + 3*x
  const X = [[1], [2], [3], [4], [5]];
  const Y = [[5], [8], [11], [14], [17]];
  
  const model = new MLR(X, Y);
  const predicted = X.map(x => model.predict(x)[0]);
  
  // Should predict perfectly
  assertEqual(predicted[0], 5, 'Predict x=1');
  assertEqual(predicted[4], 17, 'Predict x=5');
  
  // R² should be 1.0
  const yFlat = Y.map(y => y[0]);
  const yMean = yFlat.reduce((a, b) => a + b, 0) / yFlat.length;
  const ssTot = yFlat.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
  const ssRes = yFlat.reduce((sum, y, i) => sum + (y - predicted[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  
  assertEqual(r2, 1.0, 'R² should be 1.0 for perfect fit');
}

// Test 2: Multivariate regression
function testMultivariateOLS() {
  console.log('\n--- Test 2: Multivariate OLS ---');
  
  // y = 1 + 2*x1 + 3*x2
  const X = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 3],
  ];
  const Y = [[6], [8], [9], [11], [16]];
  
  const model = new MLR(X, Y);
  const predicted = X.map(x => model.predict(x)[0]);
  
  // Should predict correctly
  assertEqual(predicted[0], 6, 'Predict [1,1]');
  assertEqual(predicted[4], 16, 'Predict [3,3]');
}

// Test 3: Test with actual state data
function testWithStateData() {
  console.log('\n--- Test 3: State Data Regression ---');
  
  try {
    const dataPath = join(__dirname, '..', 'state_metrics_derived.json');
    const rawData = JSON.parse(readFileSync(dataPath, 'utf-8'));
    
    console.log(`Loaded ${Object.keys(rawData.states).length} states`);
    
    // Prepare data
    const states = Object.keys(rawData.states);
    const validStates = states.filter(st => {
      const s = rawData.states[st];
      return s.mortality_firearm_age_adj_12mo_ending_2023Q1 != null &&
             s.race_black_alone_2022 != null &&
             s.population_total_2022 != null &&
             s.population_total_2022 > 0;
    });
    
    console.log(`Valid states with firearm data: ${validStates.length}`);
    
    // Compute % Black
    const pctBlack = validStates.map(st => {
      const s = rawData.states[st];
      return (s.race_black_alone_2022 / s.population_total_2022) * 100;
    });
    
    const y = validStates.map(st => 
      rawData.states[st].mortality_firearm_age_adj_12mo_ending_2023Q1
    );
    
    // Fit model: firearm rate ~ % Black
    const X = pctBlack.map(p => [p]);
    const Y = y.map(yi => [yi]);
    
    const model = new MLR(X, Y);
    const predicted = X.map(x => model.predict(x)[0]);
    
    // Compute R²
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const ssRes = y.reduce((sum, yi, i) => sum + (yi - predicted[i]) ** 2, 0);
    const r2 = 1 - ssRes / ssTot;
    
    console.log(`R² for firearm rate ~ % Black: ${r2.toFixed(4)}`);
    assertTrue(r2 > 0.1, 'R² should be > 0.1 for % Black');
    assertTrue(r2 < 0.9, 'R² should be < 0.9 (not perfect)');
    
    // Compute residuals for a few states
    const residuals = y.map((yi, i) => yi - predicted[i]);
    
    console.log('\nSample residuals (actual - predicted):');
    for (let i = 0; i < 5; i++) {
      const st = validStates[i];
      const s = rawData.states[st];
      console.log(`  ${s.name}: actual=${y[i].toFixed(1)}, predicted=${predicted[i].toFixed(1)}, residual=${residuals[i].toFixed(1)}`);
    }
    
    // Test multivariate: firearm ~ % Black + poverty
    const validStates2 = validStates.filter(st => 
      rawData.states[st].poverty_rate_2022_pct != null
    );
    
    const X2 = validStates2.map(st => {
      const s = rawData.states[st];
      const pctB = (s.race_black_alone_2022 / s.population_total_2022) * 100;
      return [pctB, s.poverty_rate_2022_pct];
    });
    const Y2 = validStates2.map(st => 
      [rawData.states[st].mortality_firearm_age_adj_12mo_ending_2023Q1]
    );
    
    const model2 = new MLR(X2, Y2);
    const predicted2 = X2.map(x => model2.predict(x)[0]);
    const y2 = Y2.map(yi => yi[0]);
    
    const yMean2 = y2.reduce((a, b) => a + b, 0) / y2.length;
    const ssTot2 = y2.reduce((sum, yi) => sum + (yi - yMean2) ** 2, 0);
    const ssRes2 = y2.reduce((sum, yi, i) => sum + (yi - predicted2[i]) ** 2, 0);
    const r2_2 = 1 - ssRes2 / ssTot2;
    
    console.log(`\nR² for firearm rate ~ % Black + Poverty: ${r2_2.toFixed(4)}`);
    assertTrue(r2_2 >= r2, 'Adding poverty should not decrease R²');
    
  } catch (e) {
    console.log(`✗ Failed to load state data: ${e.message}`);
    console.log('  Run "python build_state_metrics.py" first');
  }
}

// Run all tests
console.log('=== Regression Tests ===');
testBasicOLS();
testMultivariateOLS();
testWithStateData();
console.log('\n=== Tests Complete ===');
