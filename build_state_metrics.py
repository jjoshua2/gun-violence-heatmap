import json
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError, HTTPError


ROOT = Path(__file__).resolve().parent
RAW_PATH = ROOT / "state_data_raw.json"
DERIVED_PATH = ROOT / "state_metrics_derived.json"

# FIPS -> basic state metadata (50 states + DC + PR)
STATE_META = {
    "01": {"usps": "AL", "name": "Alabama"},
    "02": {"usps": "AK", "name": "Alaska"},
    "04": {"usps": "AZ", "name": "Arizona"},
    "05": {"usps": "AR", "name": "Arkansas"},
    "06": {"usps": "CA", "name": "California"},
    "08": {"usps": "CO", "name": "Colorado"},
    "09": {"usps": "CT", "name": "Connecticut"},
    "10": {"usps": "DE", "name": "Delaware"},
    "11": {"usps": "DC", "name": "District of Columbia"},
    "12": {"usps": "FL", "name": "Florida"},
    "13": {"usps": "GA", "name": "Georgia"},
    "15": {"usps": "HI", "name": "Hawaii"},
    "16": {"usps": "ID", "name": "Idaho"},
    "17": {"usps": "IL", "name": "Illinois"},
    "18": {"usps": "IN", "name": "Indiana"},
    "19": {"usps": "IA", "name": "Iowa"},
    "20": {"usps": "KS", "name": "Kansas"},
    "21": {"usps": "KY", "name": "Kentucky"},
    "22": {"usps": "LA", "name": "Louisiana"},
    "23": {"usps": "ME", "name": "Maine"},
    "24": {"usps": "MD", "name": "Maryland"},
    "25": {"usps": "MA", "name": "Massachusetts"},
    "26": {"usps": "MI", "name": "Michigan"},
    "27": {"usps": "MN", "name": "Minnesota"},
    "28": {"usps": "MS", "name": "Mississippi"},
    "29": {"usps": "MO", "name": "Missouri"},
    "30": {"usps": "MT", "name": "Montana"},
    "31": {"usps": "NE", "name": "Nebraska"},
    "32": {"usps": "NV", "name": "Nevada"},
    "33": {"usps": "NH", "name": "New Hampshire"},
    "34": {"usps": "NJ", "name": "New Jersey"},
    "35": {"usps": "NM", "name": "New Mexico"},
    "36": {"usps": "NY", "name": "New York"},
    "37": {"usps": "NC", "name": "North Carolina"},
    "38": {"usps": "ND", "name": "North Dakota"},
    "39": {"usps": "OH", "name": "Ohio"},
    "40": {"usps": "OK", "name": "Oklahoma"},
    "41": {"usps": "OR", "name": "Oregon"},
    "42": {"usps": "PA", "name": "Pennsylvania"},
    "44": {"usps": "RI", "name": "Rhode Island"},
    "45": {"usps": "SC", "name": "South Carolina"},
    "46": {"usps": "SD", "name": "South Dakota"},
    "47": {"usps": "TN", "name": "Tennessee"},
    "48": {"usps": "TX", "name": "Texas"},
    "49": {"usps": "UT", "name": "Utah"},
    "50": {"usps": "VT", "name": "Vermont"},
    "51": {"usps": "VA", "name": "Virginia"},
    "53": {"usps": "WA", "name": "Washington"},
    "54": {"usps": "WV", "name": "West Virginia"},
    "55": {"usps": "WI", "name": "Wisconsin"},
    "56": {"usps": "WY", "name": "Wyoming"},
    "72": {"usps": "PR", "name": "Puerto Rico"},
}


BRFSS_HEAVY_DRINKING_URL = (
    "https://data.cdc.gov/resource/dttw-5yxu.json"
    "?year=2022"
    "&topic=Heavy%20Drinking"
    "&break_out=Overall"
    "&break_out_category=Overall"
    "&data_value_type=Crude%20Prevalence"
    "&response=Meet%20criteria%20for%20heavy%20drinking"
    "&$limit=60"
)

BRFSS_DEPRESSION_URL = (
    "https://data.cdc.gov/resource/dttw-5yxu.json"
    "?year=2022"
    "&topic=Depression"
    "&break_out=Overall"
    "&break_out_category=Overall"
    "&data_value_type=Crude%20Prevalence"
    "&response=Yes"
    "&$limit=60"
)


def cdc_rate_key(state_name: str) -> str:
    """Convert a state name to the corresponding VSRR rate_* field name."""
    return "rate_" + state_name.lower().replace(" ", "_")


def safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load_raw() -> dict:
    with RAW_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_brfss_heavy_drinking() -> dict:
    """Return mapping USPS -> crude prevalence (float) for heavy drinking, 2022.

    If the request fails (offline, rate limited, etc.), returns an empty dict and
    leaves the alcohol metric as null in the derived output.
    """
    try:
        with urlopen(BRFSS_HEAVY_DRINKING_URL) as resp:
            rows = json.load(resp)
    except (URLError, HTTPError):
        rows = []

    result = {}
    for row in rows:
        code = row.get("locationabbr")
        value = row.get("data_value")
        if not code or value in (None, ""):
            continue
        val = safe_float(value)
        if val is not None:
            result[code] = val
    return result


def load_brfss_depression() -> dict:
    """Return mapping USPS -> crude prevalence (float) for depression, 2022.

    Metric: adults who answer "Yes" to "Ever told you that you have a form of
    depression?" (questionid=ADDEPEV3), Overall, crude prevalence.
    """
    try:
        with urlopen(BRFSS_DEPRESSION_URL) as resp:
            rows = json.load(resp)
    except (URLError, HTTPError):
        rows = []

    result = {}
    for row in rows:
        code = row.get("locationabbr")
        value = row.get("data_value")
        if not code or value in (None, ""):
            continue
        val = safe_float(value)
        if val is not None:
            result[code] = val
    return result


def build_state_metrics() -> dict:
    raw = load_raw()

    income_rows = raw["acs_2022_median_household_income"]["data"]
    race_rows = raw["acs_2022_race_B02001_subset"]["data"]
    subject_rows = raw["acs_2022_subject_socioeconomic"]["data"]

    # Build lookups by FIPS code
    income_by_fips = {row[2]: row for row in income_rows[1:]}
    race_by_fips = {row[5]: row for row in race_rows[1:]}
    subject_by_fips = {row[4]: row for row in subject_rows[1:]}

    firearm = raw["vsrr_2023Q1_firearm_related_injury_age_adjusted_death_rates"]["data"]
    homicide = raw["vsrr_2023Q1_homicide_age_adjusted_death_rates"]["data"]
    overdose = raw["vsrr_2023Q1_drug_overdose_age_adjusted_death_rates"]["data"]

    # Giffords Gun Law Scorecard 2022
    giffords_data = raw.get("giffords_gun_law_scorecard_2022", {}).get("data", {})

    # Gun ownership by state (RAND)
    gun_ownership_data = raw.get("gun_ownership_by_state_rand", {}).get("data", {})

    # Gini coefficient (income inequality)
    gini_data = raw.get("gini_coefficient_2019", {}).get("data", {})

    # Veteran population percentage
    veteran_data = raw.get("veteran_population_pct_2021", {}).get("data", {})

    # Single parent household percentage
    single_parent_data = raw.get("single_parent_household_pct_2022", {}).get("data", {})

    # Religiosity (high) percentage
    religiosity_data = raw.get("religiosity_high_pct_2024", {}).get("data", {})

    brfss_heavy = load_brfss_heavy_drinking()
    brfss_depression = load_brfss_depression()

    states = {}

    for fips, meta in STATE_META.items():
        income_row = income_by_fips.get(fips)
        race_row = race_by_fips.get(fips)
        subject_row = subject_by_fips.get(fips)
        if income_row is None or race_row is None or subject_row is None:
            # Should not happen for 50 states + DC + PR, but guard anyway.
            continue

        name = meta["name"]
        usps = meta["usps"]

        income = safe_int(income_row[1])
        total_pop = safe_int(race_row[1])
        white = safe_int(race_row[2])
        black = safe_int(race_row[3])
        asian = safe_int(race_row[4])

        # Socio-economic percentages from ACS subject tables (all in percent).
        poverty_pct = safe_float(subject_row[1])
        bachelors_pct = safe_float(subject_row[2])
        unemployment_pct = safe_float(subject_row[3])

        key = cdc_rate_key(name)

        def get_rate(src: dict):
            val = src.get(key)
            if val in (None, ""):
                return None
            return safe_float(val)

        firearm_rate = get_rate(firearm)
        homicide_rate = get_rate(homicide)
        overdose_rate = get_rate(overdose)

        heavy_drinking = brfss_heavy.get(usps)
        depression = brfss_depression.get(usps)

        # Giffords Gun Law Scorecard
        giffords_state = giffords_data.get(usps, {})
        giffords_grade = giffords_state.get("grade")
        giffords_rank = giffords_state.get("rank")

        # Gun ownership (RAND)
        gun_ownership_pct = gun_ownership_data.get(usps)

        # Gini coefficient (income inequality)
        gini_coefficient = gini_data.get(usps)

        # Veteran population percentage
        veteran_pct = veteran_data.get(usps)

        # Single parent household percentage
        single_parent_pct = single_parent_data.get(usps)

        # Religiosity (high) percentage
        religiosity_high = religiosity_data.get(usps)

        states[usps] = {
            "name": name,
            "fips": fips,
            "income_median_household_2022": income,
            "population_total_2022": total_pop,
            "race_white_alone_2022": white,
            "race_black_alone_2022": black,
            "race_asian_alone_2022": asian,
            "poverty_rate_2022_pct": poverty_pct,
            "education_bachelors_or_higher_2022_pct": bachelors_pct,
            "unemployment_rate_2022_pct": unemployment_pct,
            "mortality_firearm_age_adj_12mo_ending_2023Q1": firearm_rate,
            "mortality_homicide_age_adj_12mo_ending_2023Q1": homicide_rate,
            "mortality_overdose_age_adj_12mo_ending_2023Q1": overdose_rate,
            "heavy_drinking_prevalence_2022_crude": heavy_drinking,
            "depression_prevalence_2022_crude": depression,
            "giffords_gun_law_grade_2022": giffords_grade,
            "giffords_gun_law_rank_2022": giffords_rank,
            "gun_ownership_household_pct": gun_ownership_pct,
            "gini_coefficient_2019": gini_coefficient,
            "veteran_population_pct_2021": veteran_pct,
            "single_parent_household_pct_2022": single_parent_pct,
            "religiosity_high_pct_2024": religiosity_high,
        }

    derived = {
        "meta": {
            "description": "Per-state metrics for visualization, derived from state_data_raw.json and BRFSS API.",
            "income_source": "acs_2022_median_household_income",
            "race_source": "acs_2022_race_B02001_subset",
            "socioeconomic_source": "acs_2022_subject_socioeconomic",
            "mortality_source": "NCHS - VSRR Quarterly provisional estimates for selected indicators (489q-934x)",
            "heavy_drinking_source": "BRFSS Prevalence Data (dttw-5yxu), Heavy Drinking, 2022, Overall, Crude Prevalence, response=Meet criteria for heavy drinking",
            "depression_source": "BRFSS Prevalence Data (dttw-5yxu), Depression, 2022, Overall, Crude Prevalence, response=Yes",
            "giffords_source": "GIFFORDS Law Center Annual Gun Law Scorecard 2022 (https://giffords.org/lawcenter/resources/scorecard2022/)",
            "gun_ownership_source": "RAND State-Level Estimates of Household Firearm Ownership (TL354, Schell et al. 2020)",
            "notes": [
                "Mortality rates are age-adjusted deaths per 100,000 for the 12 months ending with 2023 Q1 (provisional).",
                "Heavy drinking prevalence is percent of adults meeting CDC BRFSS heavy drinking definition in 2022.",
                "Depression prevalence is percent of adults who report ever having been told they have a form of depression (BRFSS, 2022).",
                "Puerto Rico will have ACS metrics; mortality/alcohol metrics may be null depending on source coverage.",
                "Giffords gun law grades range from A (strongest) to F (weakest); rank 1 is strongest, 50 is weakest.",
                "Gun ownership is estimated % of adults living in households with firearms (RAND, data through 2016).",
            ],
        },
        "states": states,
    }

    return derived


def main() -> None:
    derived = build_state_metrics()
    with DERIVED_PATH.open("w", encoding="utf-8") as f:
        json.dump(derived, f, indent=2, sort_keys=True)
    print(f"Wrote {DERIVED_PATH} with {len(derived['states'])} states.")


if __name__ == "__main__":
    main()
