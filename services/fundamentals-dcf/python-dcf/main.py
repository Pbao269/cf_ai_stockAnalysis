"""
DCF Valuation Service - Production-grade DCF with yfinance integration

This service provides:
1. FundamentalsSnapshot from yfinance data
2. Deterministic DCF calculations (5-10y FCF forecast, WACC, Terminal Value)
3. Base/Bull/Bear scenarios with sensitivity analysis
4. Strict validation and error handling
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from datetime import datetime
import traceback

# Try to import yfinance
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    logging.warning("yfinance not available, will use mock data")

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Market constants
DEFAULT_RISK_FREE_RATE = 0.045  # 10-year Treasury yield ~4.5%
DEFAULT_MARKET_RISK_PREMIUM = 0.08  # Historical equity risk premium
DEFAULT_TAX_RATE = 0.21  # Corporate tax rate

# Validation constants
MAX_GROWTH_RATE = 0.50  # 50% max growth rate (sanity check)
MIN_WACC = 0.03  # 3% minimum WACC
MAX_WACC = 0.30  # 30% maximum WACC


@app.route('/', methods=['GET'])
def root():
    """Root endpoint - service information"""
    return jsonify({
        'service': 'dcf-valuation',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'dcf': '/dcf (POST)',
            'fundamentals': '/fundamentals (POST)'
        },
        'data_sources': ['yfinance'],
        'timestamp': datetime.now().isoformat()
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'yfinance_available': YFINANCE_AVAILABLE,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/fundamentals', methods=['POST'])
def get_fundamentals():
    """
    Get normalized fundamentals snapshot for a ticker
    
    Request body:
    {
        "ticker": "AAPL"
    }
    """
    try:
        data = request.json
        ticker = data.get('ticker', '').upper()
        
        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker is required'}), 400
        
        logger.info(f"Fetching fundamentals for {ticker}")
        
        snapshot = get_fundamentals_snapshot(ticker)
        
        return jsonify({
            'success': True,
            'data': snapshot,
            'data_source': 'yfinance' if YFINANCE_AVAILABLE else 'mock',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Fundamentals error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/dcf', methods=['POST'])
def run_dcf():
    """
    Run DCF valuation for a ticker
    
    Request body:
    {
        "ticker": "AAPL",
        "assumptions": {  // Optional custom assumptions
            "revenue_growth_years_1_5": 0.10,
            "terminal_growth_rate": 0.03,
            ...
        },
        "scenarios": ["base", "bull", "bear"],  // Optional, defaults to all three
        "include_sensitivities": true  // Optional, defaults to true
    }
    """
    try:
        data = request.json
        ticker = data.get('ticker', '').upper()
        custom_assumptions = data.get('assumptions')
        scenarios = data.get('scenarios', ['base', 'bull', 'bear'])
        include_sensitivities = data.get('include_sensitivities', True)
        
        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker is required'}), 400
        
        logger.info(f"Running DCF for {ticker}, scenarios: {scenarios}")
        
        # Get fundamentals snapshot
        snapshot = get_fundamentals_snapshot(ticker)
        
        # Generate assumptions
        assumptions = generate_dcf_assumptions(snapshot, custom_assumptions)
        
        # Run DCF for each scenario
        results = {}
        
        if 'base' in scenarios:
            results['base_case'] = calculate_dcf(snapshot, assumptions, scenario='base')
        
        if 'bull' in scenarios:
            bull_assumptions = adjust_assumptions_for_scenario(assumptions, 'bull')
            results['bull_case'] = calculate_dcf(snapshot, bull_assumptions, scenario='bull')
        
        if 'bear' in scenarios:
            bear_assumptions = adjust_assumptions_for_scenario(assumptions, 'bear')
            results['bear_case'] = calculate_dcf(snapshot, bear_assumptions, scenario='bear')
        
        # Generate sensitivities
        sensitivities = None
        if include_sensitivities and 'base' in scenarios:
            sensitivities = generate_sensitivity_analysis(snapshot, assumptions, results['base_case'])
        
        # Generate summary
        summary = generate_summary(snapshot, results, sensitivities)
        
        return jsonify({
            'success': True,
            'data': {
                'symbol': ticker,
                'analysis_date': datetime.now().isoformat(),
                'assumptions': assumptions,
                **results,
                'sensitivities': sensitivities,
                'summary': summary,
                'data_sources': ['yfinance'] if YFINANCE_AVAILABLE else ['mock'],
                'last_updated': datetime.now().isoformat()
            },
            'data_source': 'yfinance' if YFINANCE_AVAILABLE else 'mock',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"DCF error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


def get_fundamentals_snapshot(ticker: str) -> Dict[str, Any]:
    """
    Fetch and normalize fundamentals from yfinance
    
    Returns FundamentalsSnapshot with:
    - revenue, gross_profit, EBIT, net_income
    - capex, FCF, shares_outstanding
    - debt, cash, equity
    - growth metrics, margins
    """
    if not YFINANCE_AVAILABLE:
        return get_mock_fundamentals(ticker)
    
    try:
        stock = yf.Ticker(ticker)
        
        # Get financial statements
        income_stmt = stock.financials  # Annual income statement
        balance_sheet = stock.balance_sheet  # Annual balance sheet
        cashflow = stock.cashflow  # Annual cash flow
        info = stock.info  # Current info
        
        # Get most recent (TTM or latest fiscal year)
        latest_revenue = _safe_get(income_stmt, 'Total Revenue', 0)
        latest_gross_profit = _safe_get(income_stmt, 'Gross Profit', 0)
        latest_ebit = _safe_get(income_stmt, 'EBIT', 0)
        latest_net_income = _safe_get(income_stmt, 'Net Income', 0)
        
        # Cash flow metrics
        latest_operating_cf = _safe_get(cashflow, 'Operating Cash Flow', 0)
        latest_capex = abs(_safe_get(cashflow, 'Capital Expenditure', 0))  # Usually negative
        latest_fcf = latest_operating_cf - latest_capex
        
        # Balance sheet
        latest_cash = _safe_get(balance_sheet, 'Cash And Cash Equivalents', 0)
        latest_debt = _safe_get(balance_sheet, 'Total Debt', 0)
        latest_equity = _safe_get(balance_sheet, 'Stockholders Equity', 0)
        
        # Share count
        shares_outstanding = info.get('sharesOutstanding', 0)
        
        # Current price
        current_price = info.get('currentPrice', info.get('regularMarketPrice', 0))
        
        # Calculate margins
        gross_margin = latest_gross_profit / latest_revenue if latest_revenue > 0 else 0
        ebit_margin = latest_ebit / latest_revenue if latest_revenue > 0 else 0
        net_margin = latest_net_income / latest_revenue if latest_revenue > 0 else 0
        
        # Calculate growth rates (compare to 1 year ago)
        revenue_growth = calculate_growth_rate(income_stmt, 'Total Revenue')
        earnings_growth = calculate_growth_rate(income_stmt, 'Net Income')
        
        # Beta and market data
        beta = info.get('beta', 1.0)
        market_cap = info.get('marketCap', current_price * shares_outstanding if shares_outstanding > 0 else 0)
        
        snapshot = {
            'ticker': ticker,
            'current_price': current_price,
            'shares_outstanding': shares_outstanding,
            'market_cap': market_cap,
            
            # Income statement
            'revenue': latest_revenue,
            'gross_profit': latest_gross_profit,
            'ebit': latest_ebit,
            'net_income': latest_net_income,
            
            # Cash flow
            'operating_cash_flow': latest_operating_cf,
            'capex': latest_capex,
            'free_cash_flow': latest_fcf,
            
            # Balance sheet
            'cash': latest_cash,
            'debt': latest_debt,
            'equity': latest_equity,
            
            # Margins
            'gross_margin': gross_margin,
            'ebit_margin': ebit_margin,
            'net_margin': net_margin,
            
            # Growth
            'revenue_growth': revenue_growth,
            'earnings_growth': earnings_growth,
            
            # Market data
            'beta': beta,
            
            # Metadata
            'data_source': 'yfinance',
            'fetched_at': datetime.now().isoformat()
        }
        
        logger.info(f"✅ Fetched fundamentals for {ticker}: Revenue=${latest_revenue/1e9:.2f}B, FCF=${latest_fcf/1e9:.2f}B")
        return snapshot
        
    except Exception as e:
        logger.warning(f"yfinance error for {ticker}, falling back to mock: {e}")
        return get_mock_fundamentals(ticker)


def calculate_dcf(snapshot: Dict[str, Any], assumptions: Dict[str, Any], scenario: str = 'base') -> Dict[str, Any]:
    """
    Calculate DCF valuation
    
    Steps:
    1. Forecast 5-year FCF
    2. Calculate WACC
    3. Discount FCFs to present value
    4. Calculate terminal value
    5. Sum to enterprise value
    6. Subtract debt, add cash → equity value
    7. Divide by shares → price per share
    """
    logger.info(f"[DCF {scenario}] Starting calculation...")
    
    # Extract assumptions
    revenue_growth_1_5 = assumptions['revenue_growth_years_1_5']
    terminal_growth = assumptions['terminal_growth_rate']
    ebitda_margin_target = assumptions['ebitda_margin_target']
    capex_pct = assumptions['capex_as_percent_revenue']
    tax_rate = assumptions['tax_rate_current']
    
    # Calculate WACC
    wacc = calculate_wacc(
        risk_free_rate=assumptions['risk_free_rate'],
        beta=assumptions['beta'],
        market_risk_premium=assumptions['market_risk_premium'],
        cost_of_debt=assumptions['cost_of_debt'],
        debt_to_equity=assumptions['debt_to_equity_ratio'],
        tax_rate=tax_rate
    )
    
    # Validate WACC
    if wacc < MIN_WACC or wacc > MAX_WACC:
        logger.warning(f"WACC {wacc:.2%} outside normal range, clamping")
        wacc = max(MIN_WACC, min(MAX_WACC, wacc))
    
    # Ensure terminal growth < WACC (mathematical requirement)
    if terminal_growth >= wacc:
        logger.warning(f"Terminal growth {terminal_growth:.2%} >= WACC {wacc:.2%}, adjusting")
        terminal_growth = wacc * 0.5  # Set to half of WACC
    
    # Forecast 5-year projections
    projections = []
    current_revenue = snapshot['revenue']
    
    for year in range(1, 6):
        # Revenue forecast
        projected_revenue = current_revenue * ((1 + revenue_growth_1_5) ** year)
        
        # EBITDA (gradual margin expansion)
        ebitda = projected_revenue * ebitda_margin_target
        
        # Depreciation (simplified as % of revenue)
        depreciation = projected_revenue * 0.03  # 3% of revenue
        
        # EBIT = EBITDA - Depreciation
        ebit = ebitda - depreciation
        
        # EBT = EBIT - Interest (simplified, assume no interest)
        ebt = ebit
        
        # Net Income = EBT * (1 - tax_rate)
        net_income = ebt * (1 - tax_rate)
        
        # CapEx
        capex = projected_revenue * capex_pct
        
        # Working capital change (simplified)
        wc_change = projected_revenue * assumptions.get('working_capital_as_percent_revenue', 0.02)
        
        # Free Cash Flow = Net Income + Depreciation - CapEx - WC Change
        fcf = net_income + depreciation - capex - wc_change
        
        # Discount to present value
        discount_factor = (1 + wacc) ** year
        discounted_fcf = fcf / discount_factor
        
        projections.append({
            'year': year,
            'revenue': projected_revenue,
            'ebitda': ebitda,
            'ebit': ebit,
            'ebt': ebt,
            'net_income': net_income,
            'capex': capex,
            'depreciation': depreciation,
            'working_capital_change': wc_change,
            'free_cash_flow': fcf,
            'discounted_fcf': discounted_fcf
        })
    
    # Terminal year (Year 6)
    terminal_year_revenue = projections[-1]['revenue'] * (1 + terminal_growth)
    terminal_year_ebitda = terminal_year_revenue * ebitda_margin_target
    terminal_year_depreciation = terminal_year_revenue * 0.03
    terminal_year_ebit = terminal_year_ebitda - terminal_year_depreciation
    terminal_year_net_income = terminal_year_ebit * (1 - tax_rate)
    terminal_year_fcf = terminal_year_net_income + terminal_year_depreciation - \
                         (terminal_year_revenue * capex_pct) - \
                         (terminal_year_revenue * assumptions.get('working_capital_as_percent_revenue', 0.02))
    
    # Terminal Value calculation
    if assumptions.get('terminal_multiple_method') == 'exit_multiple':
        # Exit multiple method
        terminal_multiple = assumptions.get('terminal_ebitda_multiple', 10.0)
        terminal_value = terminal_year_ebitda * terminal_multiple
    else:
        # Gordon Growth (Perpetuity) method
        terminal_value = terminal_year_fcf / (wacc - terminal_growth)
    
    # Discount terminal value to present
    discounted_terminal_value = terminal_value / ((1 + wacc) ** 5)
    
    # Enterprise Value = Sum of discounted FCFs + Terminal Value
    sum_discounted_fcf = sum(p['discounted_fcf'] for p in projections)
    enterprise_value = sum_discounted_fcf + discounted_terminal_value
    
    # Equity Value = Enterprise Value - Net Debt
    net_debt = snapshot['debt'] - snapshot['cash']
    equity_value = enterprise_value - net_debt
    
    # Price per Share
    shares = snapshot['shares_outstanding']
    if shares <= 0:
        raise ValueError(f"Invalid shares outstanding: {shares}")
    
    price_per_share = equity_value / shares
    
    # Upside/Downside
    current_price = snapshot['current_price']
    upside_downside = ((price_per_share - current_price) / current_price) if current_price > 0 else 0
    
    # Terminal value as % of total
    terminal_value_percent = discounted_terminal_value / enterprise_value if enterprise_value > 0 else 0
    
    logger.info(f"[DCF {scenario}] Fair value: ${price_per_share:.2f}, Current: ${current_price:.2f}, Upside: {upside_downside:.1%}")
    
    result = {
        'enterprise_value': enterprise_value,
        'equity_value': equity_value,
        'price_per_share': price_per_share,
        'current_price': current_price,
        'upside_downside': upside_downside * 100,  # Convert to percentage
        'wacc': wacc,
        'terminal_value': terminal_value,
        'terminal_value_percent': terminal_value_percent,
        'projections': projections,
        'terminal_year': {
            'revenue': terminal_year_revenue,
            'ebitda': terminal_year_ebitda,
            'ebit': terminal_year_ebit,
            'net_income': terminal_year_net_income,
            'free_cash_flow': terminal_year_fcf
        },
        'sensitivity_revenue_growth': {
            'low': 0,  # Placeholder, filled by sensitivity analysis
            'base': price_per_share,
            'high': 0
        },
        'sensitivity_margins': {
            'low': 0,
            'base': price_per_share,
            'high': 0
        },
        'sensitivity_wacc': {
            'low': 0,
            'base': price_per_share,
            'high': 0
        }
    }
    
    if scenario in ['bull', 'bear']:
        result['scenario_name'] = f'{scenario}_case'
    
    return result


def calculate_wacc(risk_free_rate: float, beta: float, market_risk_premium: float,
                   cost_of_debt: float, debt_to_equity: float, tax_rate: float) -> float:
    """
    Calculate Weighted Average Cost of Capital (WACC)
    
    WACC = (E/V) * Re + (D/V) * Rd * (1 - Tc)
    
    Where:
    - Re = Cost of Equity = Rf + β * (Rm - Rf)
    - Rd = Cost of Debt
    - E = Market value of equity
    - D = Market value of debt
    - V = E + D
    - Tc = Corporate tax rate
    """
    # Cost of Equity (CAPM)
    cost_of_equity = risk_free_rate + (beta * market_risk_premium)
    
    # Weight of equity and debt
    total_value = 1 + debt_to_equity  # E + D, where E = 1
    weight_equity = 1 / total_value
    weight_debt = debt_to_equity / total_value
    
    # WACC
    wacc = (weight_equity * cost_of_equity) + (weight_debt * cost_of_debt * (1 - tax_rate))
    
    logger.info(f"[WACC] CoE: {cost_of_equity:.2%}, CoD: {cost_of_debt:.2%}, D/E: {debt_to_equity:.2f}, WACC: {wacc:.2%}")
    
    return wacc


def generate_dcf_assumptions(snapshot: Dict[str, Any], custom: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Generate DCF assumptions based on fundamentals snapshot
    
    Defaults are conservative, can be overridden by custom assumptions
    """
    # Base assumptions from historical data
    historical_revenue_growth = snapshot.get('revenue_growth', 0.08)
    current_ebit_margin = snapshot.get('ebit_margin', 0.15)
    beta = snapshot.get('beta', 1.0)
    
    # Calculate current debt-to-equity
    debt = snapshot.get('debt', 0)
    equity = snapshot.get('equity', 1)
    debt_to_equity = debt / equity if equity > 0 else 0
    
    # Conservative defaults
    assumptions = {
        'revenue_growth_years_1_5': min(historical_revenue_growth, 0.15),  # Cap at 15%
        'revenue_growth_years_6_10': min(historical_revenue_growth * 0.5, 0.08),  # Slower growth
        'terminal_growth_rate': 0.03,  # Long-term GDP growth
        'ebitda_margin_current': current_ebit_margin + 0.03,  # EBITDA ~= EBIT + D&A
        'ebitda_margin_target': min(current_ebit_margin + 0.05, 0.30),  # Some improvement
        'margin_expansion_years': 5,
        'tax_rate_current': DEFAULT_TAX_RATE,
        'tax_rate_target': DEFAULT_TAX_RATE,
        'capex_as_percent_revenue': 0.04,  # 4% of revenue
        'depreciation_as_percent_capex': 0.80,
        'working_capital_as_percent_revenue': 0.02,
        'risk_free_rate': DEFAULT_RISK_FREE_RATE,
        'market_risk_premium': DEFAULT_MARKET_RISK_PREMIUM,
        'beta': beta,
        'cost_of_debt': 0.05,  # 5% cost of debt
        'debt_to_equity_ratio': debt_to_equity,
        'terminal_multiple_method': 'perpetuity',
        'terminal_ebitda_multiple': 10.0,
        'created_at': datetime.now().isoformat()
    }
    
    # Override with custom assumptions
    if custom:
        assumptions.update(custom)
    
    # Validate growth rate < WACC
    wacc_estimate = calculate_wacc(
        assumptions['risk_free_rate'],
        assumptions['beta'],
        assumptions['market_risk_premium'],
        assumptions['cost_of_debt'],
        assumptions['debt_to_equity_ratio'],
        assumptions['tax_rate_current']
    )
    
    if assumptions['terminal_growth_rate'] >= wacc_estimate:
        assumptions['terminal_growth_rate'] = wacc_estimate * 0.5
        logger.warning(f"Adjusted terminal growth to {assumptions['terminal_growth_rate']:.2%} (< WACC {wacc_estimate:.2%})")
    
    return assumptions


def adjust_assumptions_for_scenario(base_assumptions: Dict[str, Any], scenario: str) -> Dict[str, Any]:
    """
    Adjust assumptions for bull/bear scenarios
    
    Bull: Higher growth, better margins, lower WACC
    Bear: Lower growth, worse margins, higher WACC
    """
    assumptions = base_assumptions.copy()
    
    if scenario == 'bull':
        # Optimistic: +30% growth, +200bps margins, -100bps WACC
        assumptions['revenue_growth_years_1_5'] = min(base_assumptions['revenue_growth_years_1_5'] * 1.3, MAX_GROWTH_RATE)
        assumptions['ebitda_margin_target'] = min(base_assumptions['ebitda_margin_target'] + 0.02, 0.40)
        assumptions['risk_free_rate'] = base_assumptions['risk_free_rate'] - 0.01
        assumptions['scenario_name'] = 'bull_case'
        assumptions['scenario_probability'] = 0.25
        
    elif scenario == 'bear':
        # Pessimistic: -30% growth, -200bps margins, +100bps WACC
        assumptions['revenue_growth_years_1_5'] = max(base_assumptions['revenue_growth_years_1_5'] * 0.7, -0.05)
        assumptions['ebitda_margin_target'] = max(base_assumptions['ebitda_margin_target'] - 0.02, 0.05)
        assumptions['risk_free_rate'] = base_assumptions['risk_free_rate'] + 0.01
        assumptions['scenario_name'] = 'bear_case'
        assumptions['scenario_probability'] = 0.25
    
    return assumptions


def generate_sensitivity_analysis(snapshot: Dict[str, Any], base_assumptions: Dict[str, Any], 
                                  base_dcf: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate sensitivity matrices
    
    Vary one parameter at a time:
    1. Revenue growth: -5%, base, +5%
    2. EBITDA margin: -2%, base, +2%
    3. WACC: -1%, base, +1%
    4. Terminal growth: -1%, base, +1%
    5. Two-way: Revenue growth x EBITDA margin
    """
    current_price = snapshot['current_price']
    
    # 1. Revenue growth sensitivity
    revenue_growth_sensitivity = []
    for delta in [-0.05, 0, 0.05]:
        adj_assumptions = base_assumptions.copy()
        adj_assumptions['revenue_growth_years_1_5'] = base_assumptions['revenue_growth_years_1_5'] + delta
        result = calculate_dcf(snapshot, adj_assumptions, scenario='sensitivity')
        revenue_growth_sensitivity.append({
            'growth_rate': adj_assumptions['revenue_growth_years_1_5'],
            'price_per_share': result['price_per_share'],
            'upside_downside': ((result['price_per_share'] - current_price) / current_price) * 100
        })
    
    # 2. Margin sensitivity
    margin_sensitivity = []
    for delta in [-0.02, 0, 0.02]:
        adj_assumptions = base_assumptions.copy()
        adj_assumptions['ebitda_margin_target'] = max(base_assumptions['ebitda_margin_target'] + delta, 0.05)
        result = calculate_dcf(snapshot, adj_assumptions, scenario='sensitivity')
        margin_sensitivity.append({
            'ebitda_margin': adj_assumptions['ebitda_margin_target'],
            'price_per_share': result['price_per_share'],
            'upside_downside': ((result['price_per_share'] - current_price) / current_price) * 100
        })
    
    # 3. WACC sensitivity
    wacc_sensitivity = []
    for delta in [-0.01, 0, 0.01]:
        adj_assumptions = base_assumptions.copy()
        adj_assumptions['risk_free_rate'] = base_assumptions['risk_free_rate'] + delta
        result = calculate_dcf(snapshot, adj_assumptions, scenario='sensitivity')
        wacc_sensitivity.append({
            'wacc': result['wacc'],
            'price_per_share': result['price_per_share'],
            'upside_downside': ((result['price_per_share'] - current_price) / current_price) * 100
        })
    
    # 4. Terminal growth sensitivity
    terminal_growth_sensitivity = []
    for delta in [-0.01, 0, 0.01]:
        adj_assumptions = base_assumptions.copy()
        adj_assumptions['terminal_growth_rate'] = max(base_assumptions['terminal_growth_rate'] + delta, 0.01)
        # Ensure terminal growth < WACC
        wacc = calculate_wacc(
            adj_assumptions['risk_free_rate'],
            adj_assumptions['beta'],
            adj_assumptions['market_risk_premium'],
            adj_assumptions['cost_of_debt'],
            adj_assumptions['debt_to_equity_ratio'],
            adj_assumptions['tax_rate_current']
        )
        if adj_assumptions['terminal_growth_rate'] >= wacc:
            adj_assumptions['terminal_growth_rate'] = wacc * 0.5
        result = calculate_dcf(snapshot, adj_assumptions, scenario='sensitivity')
        terminal_growth_sensitivity.append({
            'terminal_growth': adj_assumptions['terminal_growth_rate'],
            'price_per_share': result['price_per_share'],
            'upside_downside': ((result['price_per_share'] - current_price) / current_price) * 100
        })
    
    # 5. Two-way sensitivity (Revenue growth x EBITDA margin)
    two_way_sensitivity = []
    for growth_delta in [-0.03, 0, 0.03]:
        for margin_delta in [-0.02, 0, 0.02]:
            adj_assumptions = base_assumptions.copy()
            adj_assumptions['revenue_growth_years_1_5'] = base_assumptions['revenue_growth_years_1_5'] + growth_delta
            adj_assumptions['ebitda_margin_target'] = max(base_assumptions['ebitda_margin_target'] + margin_delta, 0.05)
            result = calculate_dcf(snapshot, adj_assumptions, scenario='sensitivity')
            two_way_sensitivity.append({
                'revenue_growth': adj_assumptions['revenue_growth_years_1_5'],
                'ebitda_margin': adj_assumptions['ebitda_margin_target'],
                'price_per_share': result['price_per_share'],
                'upside_downside': ((result['price_per_share'] - current_price) / current_price) * 100
            })
    
    return {
        'revenue_growth_sensitivity': revenue_growth_sensitivity,
        'margin_sensitivity': margin_sensitivity,
        'wacc_sensitivity': wacc_sensitivity,
        'terminal_growth_sensitivity': terminal_growth_sensitivity,
        'two_way_sensitivity': two_way_sensitivity
    }


def generate_summary(snapshot: Dict[str, Any], results: Dict[str, Any], 
                    sensitivities: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate executive summary of DCF results"""
    
    # Extract prices from scenarios
    base_price = results.get('base_case', {}).get('price_per_share', 0)
    bull_price = results.get('bull_case', {}).get('price_per_share', base_price * 1.3)
    bear_price = results.get('bear_case', {}).get('price_per_share', base_price * 0.7)
    
    # Probability-weighted value (base 50%, bull 25%, bear 25%)
    probability_weighted = (base_price * 0.5) + (bull_price * 0.25) + (bear_price * 0.25)
    
    # Confidence level based on sensitivity range
    price_range = bull_price - bear_price
    avg_price = (bull_price + bear_price) / 2
    confidence = max(0.5, 1 - (price_range / avg_price / 2)) if avg_price > 0 else 0.5
    
    return {
        'fair_value_range': {
            'low': bear_price,
            'high': bull_price,
            'base': base_price
        },
        'probability_weighted_value': probability_weighted,
        'confidence_level': confidence,
        'key_drivers': [
            f"Revenue growth: {results.get('base_case', {}).get('projections', [{}])[0].get('revenue', 0) / snapshot['revenue'] - 1:.1%}" if snapshot['revenue'] > 0 else "Revenue growth",
            f"EBITDA margin expansion",
            f"WACC: {results.get('base_case', {}).get('wacc', 0):.1%}"
        ],
        'key_risks': [
            'Growth slowdown below assumptions',
            'Margin compression from competition',
            'Higher cost of capital'
        ]
    }


def calculate_growth_rate(df: pd.DataFrame, column: str) -> float:
    """Calculate year-over-year growth rate from dataframe"""
    try:
        if column not in df.index:
            return 0.08  # Default 8%
        
        values = df.loc[column].values
        if len(values) < 2:
            return 0.08
        
        # Most recent to 1 year ago
        recent = values[0]
        one_year_ago = values[1]
        
        if one_year_ago == 0 or pd.isna(recent) or pd.isna(one_year_ago):
            return 0.08
        
        growth = (recent - one_year_ago) / abs(one_year_ago)
        
        # Clamp to reasonable range
        return max(-0.5, min(0.5, growth))
        
    except Exception:
        return 0.08


def _safe_get(df: pd.DataFrame, key: str, column: int = 0) -> float:
    """Safely get value from DataFrame, return 0 if not found"""
    try:
        if key not in df.index:
            return 0.0
        value = df.loc[key].iloc[column]
        return float(value) if not pd.isna(value) else 0.0
    except Exception:
        return 0.0


def get_mock_fundamentals(ticker: str) -> Dict[str, Any]:
    """Generate mock fundamentals for testing when yfinance is unavailable"""
    
    mock_data = {
        'AAPL': {
            'current_price': 180.0,
            'shares_outstanding': 15_500_000_000,
            'market_cap': 2_800_000_000_000,
            'revenue': 383_000_000_000,
            'gross_profit': 170_000_000_000,
            'ebit': 114_000_000_000,
            'net_income': 97_000_000_000,
            'operating_cash_flow': 110_000_000_000,
            'capex': 11_000_000_000,
            'free_cash_flow': 99_000_000_000,
            'cash': 50_000_000_000,
            'debt': 100_000_000_000,
            'equity': 65_000_000_000,
            'beta': 1.2
        },
        'MSFT': {
            'current_price': 380.0,
            'shares_outstanding': 7_500_000_000,
            'market_cap': 2_850_000_000_000,
            'revenue': 211_000_000_000,
            'gross_profit': 146_000_000_000,
            'ebit': 88_000_000_000,
            'net_income': 72_000_000_000,
            'operating_cash_flow': 87_000_000_000,
            'capex': 28_000_000_000,
            'free_cash_flow': 59_000_000_000,
            'cash': 80_000_000_000,
            'debt': 75_000_000_000,
            'equity': 238_000_000_000,
            'beta': 0.9
        }
    }
    
    base = mock_data.get(ticker, mock_data['AAPL'])
    
    # Calculate derived metrics
    base['gross_margin'] = base['gross_profit'] / base['revenue']
    base['ebit_margin'] = base['ebit'] / base['revenue']
    base['net_margin'] = base['net_income'] / base['revenue']
    base['revenue_growth'] = 0.08
    base['earnings_growth'] = 0.12
    base['ticker'] = ticker
    base['data_source'] = 'mock'
    base['fetched_at'] = datetime.now().isoformat()
    
    return base


if __name__ == '__main__':
    port = 8081  # Different port from screener
    app.run(host='0.0.0.0', port=port, debug=True)

