"""
Compile Census API data into state_data_raw.json format
"""
import json

# State FIPS to USPS mapping
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

def parse_census_json(filepath):
    """Parse Census API JSON response into dict keyed by USPS code"""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    headers = data[0]
    result = {}
    for row in data[1:]:
        fips = row[-1]  # state FIPS is always last
        usps = FIPS_TO_USPS.get(fips)
        if usps:
            result[usps] = {headers[i]: row[i] for i in range(len(headers)-1)}
    return result

# Parse Gini coefficient data
gini_data = parse_census_json('census_gini_2019.json')
gini_by_state = {}
for usps, row in gini_data.items():
    gini = float(row.get('B19083_001E', 0))
    gini_by_state[usps] = gini

# Parse veteran data
vet_data = parse_census_json('census_veterans_count.json')
veteran_pct_by_state = {}
for usps, row in vet_data.items():
    vet_count = int(row.get('B21001_002E', 0))
    civ_pop = int(row.get('B21001_001E', 1))
    veteran_pct_by_state[usps] = round(vet_count / civ_pop * 100, 2) if civ_pop > 0 else None

# Output the compiled data
output = {
    "gini_coefficient_2019": {
        "dataset": "American Community Survey 5-Year Estimates",
        "source": "Census API B19083_001E",
        "year": 2019,
        "description": "Gini coefficient of income inequality (0=perfect equality, 1=perfect inequality)",
        "data": gini_by_state
    },
    "veteran_population_pct_2021": {
        "dataset": "American Community Survey 5-Year Estimates", 
        "source": "Census API B21001_002E/B21001_001E",
        "year": 2021,
        "description": "Veterans as percentage of civilian population 18+",
        "data": veteran_pct_by_state
    }
}

print(json.dumps(output, indent=2))
