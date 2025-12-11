# Gun Violence Heatmap

An interactive visualization exploring the relationship between gun violence rates and socioeconomic factors across U.S. states.

## Features

- **Interactive U.S. Heatmap**: Visualize firearm, homicide, and drug overdose mortality rates by state
- **Dynamic Confounder Adjustment**: Select socioeconomic factors to see how they explain state-to-state variations
- **Statistical Analysis**: View variance explained (R²) and how states' rankings change after adjustment
- **Rich Interactions**:
  - Click states for detailed information
  - Scatter plots showing relationships between variables
  - Compare multiple states side-by-side
  - Export visualizations as PNG
  - Keyboard navigation support
  - URL state sharing

## Data Sources

- **Mortality**: CDC NCHS VSRR provisional age-adjusted death rates, 12 months ending 2023 Q1
- **Demographics & Socioeconomics**: U.S. Census Bureau, ACS 2022 1-year
- **Health**: CDC BRFSS 2022
- **Gun Policy**: GIFFORDS Law Center Annual Gun Law Scorecard 2022
- **Gun Ownership**: RAND State-Level Household Gun Ownership
- **Additional Context**: Gini inequality (2019), Veteran population (2021), Single parent households (2022), Religiosity (2024)

## Technical Details

Built with vanilla JavaScript, D3.js for visualizations, and Tailwind CSS for styling. Uses OLS regression to model relationships and compute adjusted values (residuals).

## View Live

Visit the live site at: https://jjosh.github.io/gun-violence-heatmap/

## Local Development

```bash
# Install dependencies
npm install

# Generate processed data
python build_state_metrics.py

# Start development server
npm run dev
```

## License

MIT License
