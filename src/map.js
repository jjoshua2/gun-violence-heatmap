/**
 * D3.js map rendering module
 */
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// US TopoJSON URL (from unpkg CDN)
const US_TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json';

let usTopology = null;
let statesGeoJSON = null;
let svg = null;
let g = null;
let colorScale = null;
let currentData = null;

/**
 * Initialize the map
 */
export async function initMap() {
  // Load US topology
  usTopology = await d3.json(US_TOPO_URL);
  statesGeoJSON = topojson.feature(usTopology, usTopology.objects.states);

  // Set up SVG
  const container = document.getElementById('map-container');
  const width = container.clientWidth;
  const height = width * 0.625; // Aspect ratio for US map

  svg = d3.select('#map')
    .attr('viewBox', `0 0 975 610`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  g = svg.append('g');

  // Draw state paths
  g.selectAll('path.state')
    .data(statesGeoJSON.features)
    .join('path')
    .attr('class', 'state')
    .attr('d', d3.geoPath())
    .attr('fill', '#374151')
    .attr('data-fips', d => d.id);

  return statesGeoJSON;
}

/**
 * FIPS code to state abbreviation mapping
 */
const FIPS_TO_USPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

/**
 * Get state abbreviation from FIPS code
 */
export function fipsToUsps(fips) {
  // Pad FIPS to 2 digits
  const padded = String(fips).padStart(2, '0');
  return FIPS_TO_USPS[padded] || null;
}

/**
 * Update map colors based on data values
 * @param {Object} stateData - State metrics data
 * @param {Object} values - Map of USPS code -> value to display
 * @param {string} mode - 'sequential' | 'diverging'
 * @param {Object} options - Additional options
 */
export function updateMapColors(stateData, values, mode = 'sequential', options = {}) {
  currentData = { stateData, values, mode, options };

  const vals = Object.values(values).filter(v => v != null && !isNaN(v));
  
  if (vals.length === 0) {
    g.selectAll('path.state').attr('fill', '#374151');
    return;
  }

  let domain, range;
  
  if (mode === 'diverging') {
    // Diverging scale centered at 0
    const maxAbs = Math.max(Math.abs(d3.min(vals)), Math.abs(d3.max(vals)));
    domain = [-maxAbs, 0, maxAbs];
    range = ['#22c55e', '#fbbf24', '#ef4444']; // green -> yellow -> red
    colorScale = d3.scaleLinear().domain(domain).range(range).clamp(true);
    
    // Update legend
    updateLegend(-maxAbs, maxAbs, 'Residual (deaths per 100k)', 'diverging');
  } else {
    // Sequential scale
    const min = d3.min(vals);
    const max = d3.max(vals);
    domain = [min, max];
    range = ['#fef3c7', '#f59e0b', '#dc2626']; // light yellow -> orange -> red
    colorScale = d3.scaleLinear().domain([min, (min + max) / 2, max]).range(range).clamp(true);
    
    // Update legend
    updateLegend(min, max, options.label || 'Deaths per 100k', 'sequential');
  }

  // Update state fills
  g.selectAll('path.state')
    .transition()
    .duration(300)
    .attr('fill', d => {
      const usps = fipsToUsps(d.id);
      if (!usps || values[usps] == null) return '#374151';
      return colorScale(values[usps]);
    });
}

/**
 * Update the legend
 */
function updateLegend(min, max, label, type) {
  document.getElementById('legend-min').textContent = min.toFixed(1);
  document.getElementById('legend-max').textContent = max.toFixed(1);
  document.getElementById('legend-label').textContent = label;
  
  const gradient = document.getElementById('legend-gradient');
  gradient.className = type === 'diverging' ? 'h-4 w-64 rounded diverging' : 'h-4 w-64 rounded sequential';
  
  if (type === 'diverging') {
    gradient.style.background = 'linear-gradient(to right, #22c55e, #fbbf24, #ef4444)';
  } else {
    gradient.style.background = 'linear-gradient(to right, #fef3c7, #f59e0b, #dc2626)';
  }
}

/**
 * Set up tooltip handlers
 * @param {Object} stateData - Full state data object
 * @param {Function} getTooltipContent - Function to generate tooltip HTML
 * @param {Function} onClick - Optional callback when state is clicked
 */
export function setupTooltips(stateData, getTooltipContent, onClick = null) {
  const tooltip = d3.select('#tooltip');

  g.selectAll('path.state')
    .on('mouseover', function(event, d) {
      const usps = fipsToUsps(d.id);
      if (!usps || !stateData.states[usps]) return;

      const state = stateData.states[usps];
      const content = getTooltipContent(usps, state);
      
      tooltip
        .html(content)
        .style('left', (event.offsetX + 10) + 'px')
        .style('top', (event.offsetY - 10) + 'px')
        .classed('hidden', false);

      d3.select(this).raise();
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', (event.offsetX + 10) + 'px')
        .style('top', (event.offsetY - 10) + 'px');
    })
    .on('mouseout', function() {
      tooltip.classed('hidden', true);
    })
    .on('click', function(event, d) {
      if (!onClick) return;
      const usps = fipsToUsps(d.id);
      if (!usps || !stateData.states[usps]) return;
      onClick(usps, stateData.states[usps]);
    });
}

/**
 * Highlight specific states
 * @param {string[]} uspsArray - Array of state USPS codes to highlight
 */
export function highlightStates(uspsArray) {
  g.selectAll('path.state')
    .classed('highlighted', d => {
      const usps = fipsToUsps(d.id);
      return uspsArray.includes(usps);
    });
}

/**
 * Clear all highlights
 */
export function clearHighlights() {
  g.selectAll('path.state').classed('highlighted', false);
}
