## Data Update Guide (DCF Service)

Purpose: Help you decide WHEN to refresh static/semi-static inputs that the DCF models rely on, and WHERE to change them in the code.

### Quick Summary (What to update and how often)

- Annual (Yearly):
  - Sector EV/EBITDA ranges used to validate exit multiples
  - Sector profiles (capex floors, DSO/DIO/DPO heuristics, terminal growth caps)
  - Long-run GDP/inflation anchor used to cap terminal growth
  - Action: Update ranges and caps in `get_sector_profile(...)` and review `validate_terminal_growth(...)` in `main.py`.

- Monthly (or whenever macro changes):
  - Risk-free rate (10Y Treasury proxy)
  - Implied/assumed Equity Risk Premium (ERP)
  - Action: Update defaults in `DEFAULT_RISK_FREE_RATE` and `DEFAULT_MARKET_RISK_PREMIUM` in `main.py` or pass per-request assumptions.

- Quarterly/Seasonal (on new company filings):
  - Working capital days (DSO/DIO/DPO) inferred from statements
  - Company fundamentals (revenue, margins, debt, cash, shares)
  - Action: No code change needed—endpoints pull fresh via yfinance. If you persist/cached data elsewhere, refresh those caches each quarter.

- Weekly/Daily (market-driven):
  - Price, market cap, beta, analyst targets
  - Action: No code change needed—these are fetched on demand. If you cache responses, set an appropriate TTL.

### Authoritative Sources to Use

- Sector multiples and ERP: annual/monthly datasets (e.g., Damodaran) or internal research files. Record the “as-of” month/year.
- Risk-free rate: current 10Y Treasury (UST) yield.
- Macro caps for terminal growth: use long-run real GDP + inflation in your primary market.

### Where to Update in Code (main.py)

- Sector ranges and profiles:
  - Function: `get_sector_profile(sector: str)`
  - What: `exit_multiple_range`, `capex_min`, `dso/dio/dpo`, `terminal_growth_cap`
  - Also see: `get_exit_multiple_validation(...)` for the validation message and provenance

- Terminal growth sanity:
  - Function: `validate_terminal_growth(...)`
  - Ensure it remains strictly below WACC and within macro caps

- Macro defaults:
  - Constants: `DEFAULT_RISK_FREE_RATE`, `DEFAULT_MARKET_RISK_PREMIUM`, `DEFAULT_TAX_RATE`
  - Used by: `generate_3stage_assumptions(...)` and WACC calculations

- Provenance (recommended):
  - Function: `get_exit_multiple_validation(...)`
  - Field: `provenance` includes `source` and `vintage`; update these when you refresh datasets

### Operational Checklist

1) Annual refresh (start of year or when new study publishes):
   - [ ] Download latest sector EV/EBITDA multiples dataset
   - [ ] Update ranges in `get_sector_profile(...)`
   - [ ] Update macro anchors (GDP/inflation) if changed materially
   - [ ] Set `provenance.vintage` (YYYY-MM) in `get_exit_multiple_validation(...)`

2) Monthly refresh (or on macro shifts):
   - [ ] Set `DEFAULT_RISK_FREE_RATE` to current 10Y yield
   - [ ] Update `DEFAULT_MARKET_RISK_PREMIUM` if using monthly ERP series

3) Quarterly (post 10-Q/10-K):
   - [ ] If you cache fundamentals, purge caches so `fetch_fundamentals_snapshot(...)` re-pulls
   - [ ] Optional: sanity-check DSO/DIO/DPO changes if sector norms shifted

4) Ad-hoc (material company/sector events):
   - [ ] Adjust sector profile caps/floors if structural changes occur (e.g., regulation, commodity regime shift)

### Tips

- If you need institutional rigor, store sector ranges in an external JSON/DB with an explicit `asOf` field and load them at runtime instead of hardcoding.
- Always compare both terminal value methods. A large discrepancy is a signal to revisit multiples, terminal growth, or forecast horizon.
- Watch the `warnings.terminal_dominance` flag in responses; if it trips, consider extending the explicit forecast period or tightening assumptions.


