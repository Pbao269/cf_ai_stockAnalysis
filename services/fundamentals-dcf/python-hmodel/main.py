"""
H-Model DCF - Morningstar Standard

Simplified DCF with linear growth decline.
Best for high-growth companies with predictable maturation.

Formula:
V₀ = [FCF₀ × (1+gₗ)] / (r-gₗ) + [FCF₀ × H × (gₕ-gₗ)] / (r-gₗ)

Where:
- gₕ = high growth rate (initial)
- gₗ = low/terminal growth rate
- H = half-life of growth period (years)
- r = WACC (discount rate)
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any
from datetime import datetime
import traceback
import requests
import os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Market constants
DEFAULT_RISK_FREE_RATE = 0.045
DEFAULT_MARKET_RISK_PREMIUM = 0.065
DEFAULT_TAX_RATE = 0.21


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'hmodel-dcf',
        'version': '1.0.0',
        'status': 'running',
        'model': 'H-Model DCF (Morningstar)',
        'description': 'Simplified DCF with linear growth decline',
        'endpoints': {
            'health': '/health',
            'hmodel': '/hmodel (POST)'
        },
        'timestamp': datetime.now().isoformat()
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'model': 'hmodel',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/hmodel', methods=['POST'])
def run_hmodel():
    """
    Run H-Model DCF valuation
    
    Request:
    {
        "ticker": "AAPL",
        "fundamentals": {...},
        "assumptions": {...}
    }
    
    Response:
    {
        "success": true,
        "data": {
            "price_per_share": 185.00,
            "enterprise_value": 3100000000000,
            ...
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
        
        logger.info(f"Running H-Model DCF for {ticker}")
        
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
        
        # Run H-Model calculation
        hmodel_result = calculate_hmodel(fundamentals, assumptions)
        
        return jsonify({
            'success': True,
            'data': hmodel_result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"H-Model error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


def calculate_hmodel(fundamentals: Dict[str, Any], assumptions: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate H-Model DCF valuation
    
    Core Formula:
    V₀ = PV_terminal + PV_excess_growth
    
    Where:
    PV_terminal = [FCF₀ × (1+gₗ)] / (r-gₗ)
    PV_excess_growth = [FCF₀ × H × (gₕ-gₗ)] / (r-gₗ)
    """
    logger.info(f"[H-Model] Starting calculation for {fundamentals['ticker']}")
    
    # Extract fundamentals
    fcf_current = fundamentals['free_cash_flow']
    current_price = fundamentals['current_price']
    shares_outstanding = fundamentals['shares_outstanding']
    cash = fundamentals['cash']
    total_debt = fundamentals['total_debt']
    market_cap = current_price * shares_outstanding
    
    # Extract assumptions
    g_high = assumptions['g_high']
    g_low = assumptions['g_low']
    H = assumptions['H']
    
    # Calculate WACC
    wacc = calculate_wacc(
        risk_free_rate=assumptions['risk_free_rate'],
        beta=assumptions['beta'],
        market_risk_premium=assumptions['market_risk_premium'],
        cost_of_debt=assumptions['cost_of_debt'],
        market_value_equity=market_cap,
        market_value_debt=total_debt,
        tax_rate=assumptions['tax_rate']
    )
    
    # Validate: g_low must be < WACC
    if g_low >= wacc:
        logger.warning(f"Terminal growth {g_low:.2%} >= WACC {wacc:.2%}, adjusting")
        g_low = wacc * 0.5
        assumptions['g_low'] = g_low
    
    # === H-MODEL FORMULA ===
    
    # Component 1: PV of terminal growth
    pv_terminal = (fcf_current * (1 + g_low)) / (wacc - g_low)
    
    # Component 2: PV of excess growth
    pv_excess_growth = (fcf_current * H * (g_high - g_low)) / (wacc - g_low)
    
    # Total enterprise value
    enterprise_value = pv_terminal + pv_excess_growth
    
    # Share buyback adjustment
    years_to_maturity = 2 * H  # Total years in model
    avg_buyback_rate = assumptions.get('annual_buyback_rate', 0)
    shares_reduction_factor = (1 - avg_buyback_rate) ** years_to_maturity
    shares_outstanding_adjusted = shares_outstanding * shares_reduction_factor
    
    # === EQUITY VALUE ===
    net_debt = total_debt - cash
    equity_value = enterprise_value - net_debt
    
    # === PRICE PER SHARE ===
    if shares_outstanding_adjusted <= 0:
        raise ValueError(f"Invalid adjusted shares: {shares_outstanding_adjusted}")
    
    price_per_share = equity_value / shares_outstanding_adjusted
    
    # Upside/Downside
    upside_downside = ((price_per_share - current_price) / current_price) * 100 if current_price > 0 else 0
    
    logger.info(f"[H-Model] Fair value: ${price_per_share:.2f}, Current: ${current_price:.2f}, "
               f"Upside: {upside_downside:.1f}%")
    
    # === SENSITIVITY ANALYSIS ===
    sensitivity_matrix = calculate_sensitivity(
        fcf_current=fcf_current,
        g_high=g_high,
        g_low=g_low,
        H=H,
        wacc=wacc,
        net_debt=net_debt,
        shares_outstanding=shares_outstanding_adjusted
    )
    
    return {
        'model': 'hmodel',
        'ticker': fundamentals['ticker'],
        'price_per_share': price_per_share,
        'current_price': current_price,
        'upside_downside': upside_downside,
        'enterprise_value': enterprise_value,
        'equity_value': equity_value,
        'net_debt': net_debt,
        'wacc': wacc,
        'pv_terminal': pv_terminal,
        'pv_excess_growth': pv_excess_growth,
        'pv_terminal_percent': pv_terminal / enterprise_value if enterprise_value > 0 else 0,
        'pv_excess_growth_percent': pv_excess_growth / enterprise_value if enterprise_value > 0 else 0,
        'fcf_current': fcf_current,
        'shares_outstanding_adjusted': shares_outstanding_adjusted,
        'shares_reduction': 1 - shares_reduction_factor,
        'assumptions': assumptions,
        'sensitivity_matrix': sensitivity_matrix,
        'calculation_date': datetime.now().isoformat()
    }


def calculate_wacc(risk_free_rate: float, beta: float, market_risk_premium: float,
                   cost_of_debt: float, market_value_equity: float, market_value_debt: float,
                   tax_rate: float) -> float:
    """Calculate WACC using CAPM"""
    cost_of_equity = risk_free_rate + (beta * market_risk_premium)
    total_value = market_value_equity + market_value_debt
    
    if total_value == 0:
        return cost_of_equity
    
    weight_equity = market_value_equity / total_value
    weight_debt = market_value_debt / total_value
    
    wacc = (weight_equity * cost_of_equity) + (weight_debt * cost_of_debt * (1 - tax_rate))
    
    logger.info(f"[WACC] CoE: {cost_of_equity:.2%}, WACC: {wacc:.2%}")
    
    return wacc


def calculate_sensitivity(fcf_current: float, g_high: float, g_low: float, H: float,
                         wacc: float, net_debt: float, shares_outstanding: float) -> list:
    """
    Two-way sensitivity: Growth vs WACC
    
    Returns matrix of fair values under different scenarios
    """
    sensitivity = []
    
    # Growth deltas: -2%, -1%, 0%, +1%, +2%
    growth_deltas = [-0.02, -0.01, 0, 0.01, 0.02]
    
    # WACC deltas: -1%, -0.5%, 0%, +0.5%, +1%
    wacc_deltas = [-0.01, -0.005, 0, 0.005, 0.01]
    
    for delta_g in growth_deltas:
        for delta_wacc in wacc_deltas:
            adj_g_high = g_high + delta_g
            adj_g_low = g_low + (delta_g / 2)  # Terminal grows less
            adj_wacc = wacc + delta_wacc
            
            # Ensure g_low < wacc
            if adj_g_low >= adj_wacc:
                adj_g_low = adj_wacc * 0.6
            
            # H-Model formula
            pv_term = (fcf_current * (1 + adj_g_low)) / (adj_wacc - adj_g_low)
            pv_excess = (fcf_current * H * (adj_g_high - adj_g_low)) / (adj_wacc - adj_g_low)
            ev = pv_term + pv_excess
            equity_value = ev - net_debt
            price = equity_value / shares_outstanding if shares_outstanding > 0 else 0
            
            sensitivity.append({
                'g_high': adj_g_high,
                'g_low': adj_g_low,
                'wacc': adj_wacc,
                'price': price
            })
    
    return sensitivity


def generate_assumptions(fundamentals: Dict[str, Any], custom: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generate H-Model assumptions from fundamentals"""
    custom = custom or {}
    
    # Historical growth
    revenue_cagr = fundamentals.get('revenue_cagr_3y', 0.08)
    fcf_cagr = fundamentals.get('fcf_cagr_3y', 0.08)
    historical_growth = max(revenue_cagr, fcf_cagr)
    
    # Beta
    beta = fundamentals.get('beta', 1.0)
    
    # Market cap stage
    market_cap = fundamentals['current_price'] * fundamentals['shares_outstanding']
    
    # Determine H (half-life) based on company size
    if market_cap > 1_000_000_000_000:  # >$1T
        H_default = 6
    elif market_cap > 100_000_000_000:  # >$100B
        H_default = 8
    else:
        H_default = 10
    
    # Debt metrics
    total_debt = fundamentals.get('total_debt', 0)
    operating_income = fundamentals.get('operating_income', 0)
    interest_expense = operating_income * 0.02
    cost_of_debt = interest_expense / total_debt if total_debt > 0 else 0.04
    cost_of_debt = max(0.03, min(0.10, cost_of_debt))
    
    # Buyback rate
    share_repurchases = fundamentals.get('share_repurchases', 0)
    market_cap_value = fundamentals['current_price'] * fundamentals['shares_outstanding']
    annual_buyback_rate = share_repurchases / market_cap_value if market_cap_value > 0 else 0
    
    assumptions = {
        # Growth parameters
        'g_high': min(historical_growth, 0.20),  # Cap at 20%
        'g_low': 0.030,  # 3% terminal
        'H': H_default,
        
        # WACC components
        'risk_free_rate': DEFAULT_RISK_FREE_RATE,
        'market_risk_premium': DEFAULT_MARKET_RISK_PREMIUM,
        'beta': beta,
        'cost_of_debt': cost_of_debt,
        'tax_rate': DEFAULT_TAX_RATE,
        
        # Share buybacks
        'annual_buyback_rate': annual_buyback_rate,
        
        # Metadata
        'model': 'H-Model DCF',
        'generated_at': datetime.now().isoformat()
    }
    
    # Override with custom
    assumptions.update(custom)
    
    return assumptions


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8085))
    app.run(host='0.0.0.0', port=port, debug=True)

