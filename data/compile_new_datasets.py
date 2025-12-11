"""
Compile single parent and religiosity data into state_data_raw.json format
"""
import json
import csv

# State name to USPS mapping
NAME_TO_USPS = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY", "Puerto Rico": "PR"
}

FIPS_TO_USPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "72": "PR"
}

# Parse single parent data from Census API
with open('census_single_parent_2022.json', 'r') as f:
    census_data = json.load(f)

single_parent_pct = {}
for row in census_data[1:]:  # Skip header
    name, total_hh, female_hh_no_spouse, fips = row
    usps = FIPS_TO_USPS.get(fips)
    if usps:
        total = int(total_hh)
        single = int(female_hh_no_spouse)
        pct = round(single / total * 100, 2) if total > 0 else None
        single_parent_pct[usps] = pct

# Parse religiosity data from Pew CSV
religiosity_high = {}
with open('pew_religiosity_2024.csv', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Skip header rows and parse data
for line in lines:
    parts = line.strip().split(',')
    if len(parts) >= 4 and parts[0] in NAME_TO_USPS:
        state_name = parts[0]
        usps = NAME_TO_USPS[state_name]
        try:
            high_relig = int(parts[3])  # "High religiousness" percentage
            religiosity_high[usps] = high_relig
        except (ValueError, IndexError):
            pass

# Output the compiled data
output = {
    "single_parent_household_pct_2022": {
        "dataset": "American Community Survey 1-Year Estimates",
        "source": "Census API B11001_006E/B11001_001E",
        "year": 2022,
        "description": "Female householder, no spouse present, as percentage of total households",
        "data": single_parent_pct
    },
    "religiosity_high_pct_2024": {
        "dataset": "Pew Research Center Religious Landscape Study",
        "source": "https://www.pewresearch.org/short-reads/2025/09/16/how-religious-is-your-state/",
        "year": "2023-2024",
        "description": "Percentage of adults with high religiousness score (based on prayer, belief in God, importance of religion, attendance)",
        "data": religiosity_high
    }
}

print(json.dumps(output, indent=2))
