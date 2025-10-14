"""
3-Stage DCF Model - Goldman Sachs / JP Morgan Standard

This model implements institutional-grade 3-stage DCF valuation:
- Stage 1: High Growth (Years 1-5)
- Stage 2: Transition (Years 6-10)
- Stage 3: Terminal Perpetuity

All calculations are deterministic (no LLM).
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List
from datetime import datetime
import traceback
import requests

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Market constants
DEFAULT_RISK_FREE_RATE = 0.045  # 10-year Treasury ~4.5%
DEFAULT_MARKET_RISK_PREMIUM = 0.065  # Historical ERP ~6.5%
DEFAULT_TAX_RATE = 0.21  # US corporate tax rate
DEFAULT_TERMINAL_GROWTH = 0.035  # 3.5% long-term GDP+ growth


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'service': '3-stage-dcf',
        'version': '1.0.0',
        'status': 'running',
        'model': 'Goldman Sachs 3-Stage DCF',
        'description': 'Institutional-grade DCF with 10-year projections',
        'endpoints': {
            'health': '/health',
            'dcf': '/dcf (POST)'
        },
        'timestamp': datetime.now().isoformat()
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'model': '3-stage-dcf',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/dcf', methods=['POST'])
def run_dcf():
    """
    Run 3-Stage DCF valuation
    
    Request:
    {
        "ticker": "AAPL",
        "fundamentals": {...},  // Optional - will fetch if not provided
        "assumptions": {...}     // Optional custom assumptions
    }
    
    Response:
    {
        "success": true,
        "data": {
            "price_per_share": 180.00,
            "enterprise_value": 3000000000000,
            "upside_downside": 15.5,
            "wacc": 0.089,
            "projections": [...],
            "assumptions": {...}
        }
    }
    """
    try:
        data = request.json
        ticker = data.get('ticker', '').upper()
        fundamentals = data.get('fundamentals')
        custom_assumptions = data.get('assumptions', {})
        
        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker required'}), 400
        
        logger.info(f"Running 3-Stage DCF for {ticker}")
        
        # Get fundamentals if not provided
        if not fundamentals:
            data_service_url = os.environ.get('DATA_SERVICE_URL', 'http://localhost:8082')
            response = requests.post(
                f"{data_service_url}/fundamentals",
                json={'ticker': ticker},
                timeout=10
            )
            if response.status_code != 200:
                raise ValueError(f"Failed to fetch fundamentals: {response.text}")
            
            result = response.json()
            if not result.get('success'):
                raise ValueError(f"Data service error: {result.get('error')}")
            
            fundamentals = result['data']
        
        # Generate assumptions
        assumptions = generate_assumptions(fundamentals, custom_assumptions)
        
        # Run 3-stage DCF calculation
        dcf_result = calculate_3stage_dcf(fundamentals, assumptions)
        
        return jsonify({
            'success': True,
            'data': dcf_result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"3-Stage DCF error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


def calculate_3stage_dcf(fundamentals: Dict[str, Any], assumptions: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate 3-Stage DCF valuation
    
    Formula:
    1. Project FCF for 10 years (Stage 1: years 1-5, Stage 2: years 6-10)
    2. Calculate WACC
    3. Discount FCFs to present value
    4. Calculate terminal value (perpetuity)
    5. Sum to enterprise value
    6. Adjust for net debt → equity value → price per share
    """
    logger.info(f"[3-Stage DCF] Starting calculation for {fundamentals['ticker']}")
    
    # Extract fundamentals
    revenue = fundamentals['revenue']
    ebitda_margin_current = fundamentals['ebitda_margin']
    current_price = fundamentals['current_price']
    shares_outstanding = fundamentals['shares_outstanding']
    cash = fundamentals['cash']
    total_debt = fundamentals['total_debt']
    
    # Extract assumptions
    stage1_growth = assumptions['stage1_revenue_growth']
    stage2_ending_growth = assumptions['stage2_ending_growth']
    terminal_growth = assumptions['terminal_growth']
    ebitda_margin_target = assumptions['ebitda_margin_target']
    tax_rate = assumptions['tax_rate']
    capex_pct = assumptions['capex_percent_revenue']
    nwc_pct = assumptions['nwc_percent_revenue']
    da_pct = assumptions['depreciation_percent_revenue']
    
    # Calculate WACC
    wacc = calculate_wacc(
        risk_free_rate=assumptions['risk_free_rate'],
        beta=assumptions['beta'],
        market_risk_premium=assumptions['market_risk_premium'],
        cost_of_debt=assumptions['cost_of_debt'],
        market_value_equity=current_price * shares_outstanding,
        market_value_debt=total_debt,
        tax_rate=tax_rate
    )
    
    # Validate terminal growth < WACC
    if terminal_growth >= wacc:
        logger.warning(f"Terminal growth {terminal_growth:.2%} >= WACC {wacc:.2%}, adjusting")
        terminal_growth = wacc * 0.5
        assumptions['terminal_growth'] = terminal_growth
    
    # === STAGE 1: High Growth (Years 1-5) ===
    projections = []
    current_revenue = revenue
    
    for year in range(1, 6):
        # Revenue projection
        projected_revenue = current_revenue * ((1 + stage1_growth) ** year)
        
        # EBITDA (linear margin expansion to target)
        margin_progress = year / 5.0
        ebitda_margin = ebitda_margin_current + (ebitda_margin_target - ebitda_margin_current) * margin_progress
        ebitda = projected_revenue * ebitda_margin
        
        # Depreciation & Amortization
        depreciation = projected_revenue * da_pct
        
        # EBIT = EBITDA - D&A
        ebit = ebitda - depreciation
        
        # NOPAT = EBIT * (1 - tax_rate)
        nopat = ebit * (1 - tax_rate)
        
        # CapEx
        capex = projected_revenue * capex_pct
        
        # Change in NWC
        revenue_change = projected_revenue - (current_revenue * ((1 + stage1_growth) ** (year - 1)))
        nwc_change = revenue_change * nwc_pct
        
        # Free Cash Flow = NOPAT + D&A - CapEx - ΔNWC
        fcf = nopat + depreciation - capex - nwc_change
        
        # Discount to present value
        discount_factor = (1 + wacc) ** year
        pv_fcf = fcf / discount_factor
        
        projections.append({
            'year': year,
            'stage': 1,
            'revenue': projected_revenue,
            'ebitda': ebitda,
            'ebitda_margin': ebitda_margin,
            'ebit': ebit,
            'nopat': nopat,
            'depreciation': depreciation,
            'capex': capex,
            'nwc_change': nwc_change,
            'free_cash_flow': fcf,
            'discount_factor': discount_factor,
            'pv_fcf': pv_fcf
        })
    
    # === STAGE 2: Transition (Years 6-10) ===
    year_5_revenue = projections[4]['revenue']
    
    # Growth declines linearly from stage1_growth to stage2_ending_growth
    for year in range(6, 11):
        year_in_stage2 = year - 5
        growth_decline_progress = year_in_stage2 / 5.0
        current_growth = stage1_growth - (stage1_growth - stage2_ending_growth) * growth_decline_progress
        
        # Revenue projection
        if year == 6:
            projected_revenue = year_5_revenue * (1 + current_growth)
        else:
            prior_year_revenue = projections[year - 2]['revenue']
            projected_revenue = prior_year_revenue * (1 + current_growth)
        
        # EBITDA margin stabilizes at target
        ebitda_margin = ebitda_margin_target
        ebitda = projected_revenue * ebitda_margin
        
        # Depreciation & Amortization
        depreciation = projected_revenue * da_pct
        
        # EBIT
        ebit = ebitda - depreciation
        
        # NOPAT
        nopat = ebit * (1 - tax_rate)
        
        # CapEx
        capex = projected_revenue * capex_pct
        
        # Change in NWC
        prior_revenue = projections[year - 2]['revenue']
        revenue_change = projected_revenue - prior_revenue
        nwc_change = revenue_change * nwc_pct
        
        # Free Cash Flow
        fcf = nopat + depreciation - capex - nwc_change
        
        # Discount to present value
        discount_factor = (1 + wacc) ** year
        pv_fcf = fcf / discount_factor
        
        projections.append({
            'year': year,
            'stage': 2,
            'revenue': projected_revenue,
            'ebitda': ebitda,
            'ebitda_margin': ebitda_margin,
            'ebit': ebit,
            'nopat': nopat,
            'depreciation': depreciation,
            'capex': capex,
            'nwc_change': nwc_change,
            'free_cash_flow': fcf,
            'discount_factor': discount_factor,
            'pv_fcf': pv_fcf,
            'growth_rate': current_growth
        })
    
    # === STAGE 3: Terminal Value (Perpetuity) ===
    year_10_revenue = projections[9]['revenue']
    year_11_revenue = year_10_revenue * (1 + terminal_growth)
    
    # Terminal year FCF
    terminal_ebitda = year_11_revenue * ebitda_margin_target
    terminal_depreciation = year_11_revenue * da_pct
    terminal_ebit = terminal_ebitda - terminal_depreciation
    terminal_nopat = terminal_ebit * (1 - tax_rate)
    terminal_capex = year_11_revenue * capex_pct
    terminal_nwc_change = (year_11_revenue - year_10_revenue) * nwc_pct
    terminal_fcf = terminal_nopat + terminal_depreciation - terminal_capex - terminal_nwc_change
    
    # Gordon Growth formula: TV = FCF / (WACC - g)
    terminal_value = terminal_fcf / (wacc - terminal_growth)
    
    # Discount terminal value to present (Year 0)
    pv_terminal_value = terminal_value / ((1 + wacc) ** 10)
    
    # === ENTERPRISE VALUE ===
    sum_pv_fcf = sum(p['pv_fcf'] for p in projections)
    enterprise_value = sum_pv_fcf + pv_terminal_value
    
    # Terminal value as % of EV
    terminal_value_percent = pv_terminal_value / enterprise_value if enterprise_value > 0 else 0
    
    # === EQUITY VALUE ===
    net_debt = total_debt - cash
    equity_value = enterprise_value - net_debt
    
    # === PRICE PER SHARE ===
    if shares_outstanding <= 0:
        raise ValueError(f"Invalid shares outstanding: {shares_outstanding}")
    
    price_per_share = equity_value / shares_outstanding
    
    # Upside/Downside
    upside_downside = ((price_per_share - current_price) / current_price) * 100 if current_price > 0 else 0
    
    logger.info(f"[3-Stage DCF] Fair value: ${price_per_share:.2f}, Current: ${current_price:.2f}, Upside: {upside_downside:.1%}")
    
    return {
        'model': '3stage',
        'ticker': fundamentals['ticker'],
        'price_per_share': price_per_share,
        'current_price': current_price,
        'upside_downside': upside_downside,
        'enterprise_value': enterprise_value,
        'equity_value': equity_value,
        'net_debt': net_debt,
        'wacc': wacc,
        'terminal_value': terminal_value,
        'pv_terminal_value': pv_terminal_value,
        'terminal_value_percent': terminal_value_percent,
        'terminal_fcf': terminal_fcf,
        'sum_pv_fcf_10y': sum_pv_fcf,
        'projections': projections,
        'terminal_year': {
            'year': 11,
            'revenue': year_11_revenue,
            'ebitda': terminal_ebitda,
            'ebit': terminal_ebit,
            'nopat': terminal_nopat,
            'fcf': terminal_fcf,
            'growth_rate': terminal_growth
        },
        'assumptions': assumptions,
        'calculation_date': datetime.now().isoformat()
    }


def calculate_wacc(risk_free_rate: float, beta: float, market_risk_premium: float,
                   cost_of_debt: float, market_value_equity: float, market_value_debt: float,
                   tax_rate: float) -> float:
    """
    Calculate WACC using CAPM
    
    WACC = (E/V) × Re + (D/V) × Rd × (1 - Tc)
    
    Where:
    - Re = Cost of Equity = Rf + β × (Rm - Rf)
    - Rd = Cost of Debt
    - E = Market value of equity
    - D = Market value of debt
    - V = E + D
    - Tc = Tax rate
    """
    # Cost of Equity (CAPM)
    cost_of_equity = risk_free_rate + (beta * market_risk_premium)
    
    # Total value
    total_value = market_value_equity + market_value_debt
    
    if total_value == 0:
        logger.warning("Total value is 0, using 100% equity WACC")
        return cost_of_equity
    
    # Weights
    weight_equity = market_value_equity / total_value
    weight_debt = market_value_debt / total_value
    
    # WACC
    wacc = (weight_equity * cost_of_equity) + (weight_debt * cost_of_debt * (1 - tax_rate))
    
    logger.info(f"[WACC] CoE: {cost_of_equity:.2%}, CoD: {cost_of_debt:.2%}, "
               f"E/V: {weight_equity:.1%}, D/V: {weight_debt:.1%}, WACC: {wacc:.2%}")
    
    return wacc


def generate_assumptions(fundamentals: Dict[str, Any], custom: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Generate DCF assumptions from fundamentals
    
    Conservative defaults based on historical data
    """
    custom = custom or {}
    
    # Historical growth
    historical_growth = fundamentals.get('revenue_cagr_3y', 0.08)
    
    # Current margins
    current_ebitda_margin = fundamentals.get('ebitda_margin', 0.20)
    
    # Beta
    beta = fundamentals.get('beta', 1.0)
    
    # Debt metrics
    total_debt = fundamentals.get('total_debt', 0)
    equity = fundamentals.get('equity', 1)
    
    # Cost of debt (rough estimate)
    operating_income = fundamentals.get('operating_income', 0)
    interest_expense = operating_income * 0.02  # Assume 2% of operating income
    cost_of_debt = interest_expense / total_debt if total_debt > 0 else 0.04
    cost_of_debt = max(0.03, min(0.10, cost_of_debt))  # Clamp to 3-10%
    
    # Default assumptions
    assumptions = {
        # Stage 1: High Growth (Years 1-5)
        'stage1_revenue_growth': min(historical_growth, 0.15),  # Cap at 15%
        'stage1_years': 5,
        
        # Stage 2: Transition (Years 6-10)
        'stage2_starting_growth': min(historical_growth, 0.15),
        'stage2_ending_growth': max(0.04, historical_growth * 0.5),  # Mature growth
        'stage2_years': 5,
        
        # Terminal
        'terminal_growth': DEFAULT_TERMINAL_GROWTH,
        
        # Margins
        'ebitda_margin_current': current_ebitda_margin,
        'ebitda_margin_target': min(current_ebitda_margin * 1.1, 0.40),  # +10% improvement, cap at 40%
        
        # CapEx & Working Capital
        'capex_percent_revenue': 0.04,  # 4% of revenue
        'nwc_percent_revenue': 0.02,  # 2% of revenue change
        'depreciation_percent_revenue': 0.03,  # 3% of revenue
        
        # WACC components
        'risk_free_rate': DEFAULT_RISK_FREE_RATE,
        'market_risk_premium': DEFAULT_MARKET_RISK_PREMIUM,
        'beta': beta,
        'cost_of_debt': cost_of_debt,
        'tax_rate': DEFAULT_TAX_RATE,
        
        # Metadata
        'model': '3-stage DCF',
        'generated_at': datetime.now().isoformat()
    }
    
    # Override with custom
    assumptions.update(custom)
    
    return assumptions


import os

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8083))
    app.run(host='0.0.0.0', port=port, debug=True)

