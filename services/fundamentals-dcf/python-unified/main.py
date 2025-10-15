"""
Unified DCF Service - Multi-Model Valuation

This service combines:
1. Fundamentals data fetching (from python-data)
2. 3-Stage DCF model (from python-3stage) 
3. H-Model DCF (from python-hmodel)

All models run in a single service with unified endpoints.
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List, Optional
import pandas as pd
from datetime import datetime
import traceback
import requests
import os

# Try to import yfinance
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    logging.warning("yfinance not available")

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
        'service': 'unified-dcf',
        'version': '1.0.0',
        'status': 'running',
        'description': 'Unified DCF service with data fetching, 3-stage, and H-model',
        'endpoints': {
            'health': '/health',
            'fundamentals': '/fundamentals (POST)',
            'dcf': '/dcf (POST) - 3-Stage DCF',
            'hmodel': '/hmodel (POST) - H-Model DCF',
            'unified': '/unified (POST) - Both models combined'
        },
        'data_sources': ['yfinance', 'mock'],
        'models': ['3-stage', 'h-model'],
        'timestamp': datetime.now().isoformat()
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'yfinance_available': YFINANCE_AVAILABLE,
        'models': ['3-stage', 'h-model'],
        'timestamp': datetime.now().isoformat()
    })


@app.route('/fundamentals', methods=['POST'])
def get_fundamentals():
    """
    Get comprehensive fundamentals snapshot
    
    Request: {"ticker": "AAPL"}
    Response: Complete FundamentalsSnapshot
    """
    try:
        data = request.json
        ticker = data.get('ticker', '').upper()
        
        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker required'}), 400
        
        logger.info(f"Fetching comprehensive fundamentals for {ticker}")
        
        snapshot = fetch_fundamentals_snapshot(ticker)
        
        return jsonify({
            'success': True,
            'data': snapshot,
            'data_source': 'yfinance' if YFINANCE_AVAILABLE else 'mock',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Fundamentals error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/dcf', methods=['POST'])
def run_3stage_dcf():
    """
    Run 3-Stage DCF valuation
    
    Request:
    {
        "ticker": "AAPL",
        "fundamentals": {...},  // Optional - will fetch if not provided
        "assumptions": {...}     // Optional custom assumptions
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
            fundamentals = fetch_fundamentals_snapshot(ticker)
        
        # Generate assumptions
        assumptions = generate_3stage_assumptions(fundamentals, custom_assumptions)
        
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
            fundamentals = fetch_fundamentals_snapshot(ticker)
        
        # Generate assumptions
        assumptions = generate_hmodel_assumptions(fundamentals, custom_assumptions)
        
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


@app.route('/unified', methods=['POST'])
def run_unified_dcf():
    """
    Run both 3-Stage and H-Model DCF in parallel
    
    Request:
    {
        "ticker": "AAPL",
        "fundamentals": {...},  // Optional
        "assumptions": {...}     // Optional
    }
    
    Response:
    {
        "success": true,
        "data": {
            "ticker": "AAPL",
            "current_price": 180.0,
            "individual_valuations": [
                {"model": "3stage", "price_per_share": 185.0, ...},
                {"model": "hmodel", "price_per_share": 182.0, ...}
            ],
            "consensus_valuation": {
                "weighted_fair_value": 183.5,
                "simple_average": 183.5,
                "range": {"low": 182.0, "high": 185.0}
            }
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
        
        logger.info(f"Running unified DCF for {ticker}")
        
        # Get fundamentals if not provided
        if not fundamentals:
            fundamentals = fetch_fundamentals_snapshot(ticker)
        
        # Run both models in parallel
        results = []
        
        # 3-Stage DCF
        try:
            assumptions_3stage = generate_3stage_assumptions(fundamentals, custom_assumptions)
            result_3stage = calculate_3stage_dcf(fundamentals, assumptions_3stage)
            results.append({
                'model': '3stage',
                'model_name': '3-Stage DCF (Goldman Sachs)',
                'result': result_3stage
            })
        except Exception as e:
            logger.error(f"3-Stage DCF failed: {e}")
        
        # H-Model DCF
        try:
            assumptions_hmodel = generate_hmodel_assumptions(fundamentals, custom_assumptions)
            result_hmodel = calculate_hmodel(fundamentals, assumptions_hmodel)
            results.append({
                'model': 'hmodel',
                'model_name': 'H-Model DCF (Morningstar)',
                'result': result_hmodel
            })
        except Exception as e:
            logger.error(f"H-Model DCF failed: {e}")
        
        if not results:
            raise Exception("Both DCF models failed")
        
        # Calculate consensus
        prices = [r['result']['price_per_share'] for r in results]
        weighted_fair_value = sum(prices) / len(prices)  # Simple average for now
        simple_average = weighted_fair_value
        range_low = min(prices)
        range_high = max(prices)
        
        current_price = fundamentals['current_price']
        upside_to_weighted = ((weighted_fair_value - current_price) / current_price) * 100
        
        # Generate recommendation
        recommendation = generate_recommendation(upside_to_weighted)
        
        # Prepare analyst consensus data
        analyst_consensus = None
        analyst_avg_target = fundamentals.get('analyst_avg_target', 0)
        analyst_count = fundamentals.get('analyst_count', 0)
        
        if analyst_avg_target > 0 and analyst_count > 0:
            gap_vs_weighted = analyst_avg_target - weighted_fair_value
            gap_vs_weighted_pct = (gap_vs_weighted / current_price) * 100 if current_price > 0 else 0
            
            analyst_consensus = {
                'average_target_price': analyst_avg_target,
                'analyst_count': analyst_count,
                'gap_vs_weighted': gap_vs_weighted,
                'gap_vs_weighted_pct': gap_vs_weighted_pct,
                'analyst_ratings': fundamentals.get('analyst_ratings', {}),
                'analyst_revenue_growth_1y': fundamentals.get('analyst_revenue_growth_1y', 0),
                'analyst_revenue_growth_3y': fundamentals.get('analyst_revenue_growth_3y', 0)
            }
        
        unified_result = {
            'ticker': ticker,
            'current_price': current_price,
            'individual_valuations': [
                {
                    'model': r['model'],
                    'model_name': r['model_name'],
                    'price_per_share': r['result']['price_per_share'],
                    'enterprise_value': r['result']['enterprise_value'],
                    'upside_downside': r['result']['upside_downside'],
                    'wacc': r['result']['wacc'],
                    'assumptions': r['result']['assumptions'],
                    'projections': r['result'].get('projections', [])
                }
                for r in results
            ],
            'consensus_valuation': {
                'weighted_fair_value': weighted_fair_value,
                'simple_average': simple_average,
                'range': {
                    'low': range_low,
                    'high': range_high
                },
                'upside_to_weighted': upside_to_weighted,
                'method': 'Equal weight average of available models'
            },
            'recommendation': recommendation,
            'timestamp': datetime.now().isoformat()
        }
        
        # Add analyst consensus if available
        if analyst_consensus:
            unified_result['analyst_consensus'] = analyst_consensus
        
        return jsonify({
            'success': True,
            'data': unified_result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Unified DCF error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


@app.route('/scenarios', methods=['POST'])
def run_scenarios():
    """Run Base/Bull/Bear scenarios and return probability-weighted result."""
    try:
        data = request.json
        ticker = (data or {}).get('ticker', '').upper()
        custom = (data or {}).get('assumptions', {})
        probs = (data or {}).get('probabilities', {'base': 0.6, 'bull': 0.2, 'bear': 0.2})

        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker required'}), 400

        fundamentals = (data or {}).get('fundamentals')
        if not fundamentals:
            fundamentals = fetch_fundamentals_snapshot(ticker)

        base_assump = generate_3stage_assumptions(fundamentals, custom)
        bull_assump = dict(base_assump)
        bear_assump = dict(base_assump)

        # Bull tweaks (more growth, higher margin, slightly higher exit multiple)
        bull_assump['stage1_revenue_growth'] = min(base_assump['stage1_revenue_growth'] * 1.25, 0.30)
        bull_assump['stage2_ending_growth'] = min(base_assump['stage2_ending_growth'] * 1.25, 0.12)
        bull_assump['ebitda_margin_target'] = min(base_assump['ebitda_margin_target'] * 1.05, 0.65)
        bull_assump['exit_multiple_ev_ebitda'] = (base_assump.get('exit_multiple_ev_ebitda') or 10.0) * 1.2

        # Bear tweaks (less growth, lower margin, lower exit multiple)
        bear_assump['stage1_revenue_growth'] = max(base_assump['stage1_revenue_growth'] * 0.7, 0.02)
        bear_assump['stage2_ending_growth'] = max(base_assump['stage2_ending_growth'] * 0.7, 0.01)
        bear_assump['ebitda_margin_target'] = max(base_assump['ebitda_margin_target'] * 0.9, base_assump['ebitda_margin_current'])
        bear_assump['exit_multiple_ev_ebitda'] = max(5.0, (base_assump.get('exit_multiple_ev_ebitda') or 10.0) * 0.8)

        scenarios = {
            'base': base_assump,
            'bull': bull_assump,
            'bear': bear_assump
        }

        results = {}
        for name, assump in scenarios.items():
            try:
                results[name] = calculate_3stage_dcf(fundamentals, assump)
            except Exception as e:
                logger.error(f"Scenario {name} failed: {e}")
                results[name] = None

        # Probability-weighted fair value (ignore missing)
        total_weight = 0.0
        weighted_value = 0.0
        for name, res in results.items():
            p = float(probs.get(name, 0.0))
            if res and p > 0:
                weighted_value += res['price_per_share'] * p
                total_weight += p
        weighted_fair_value = weighted_value / total_weight if total_weight > 0 else None

        return jsonify({
            'success': True,
            'data': {
                'ticker': ticker,
                'scenarios': results,
                'probabilities': probs,
                'weighted_fair_value': weighted_fair_value
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Scenarios error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# FUNDAMENTALS DATA FETCHING (from python-data)
# ============================================================================

def fetch_fundamentals_snapshot(ticker: str) -> Dict[str, Any]:
    """
    Fetch comprehensive fundamentals snapshot from yfinance
    
    Returns all data needed for 3-stage, SOTP, and H-Model DCF
    """
    if not YFINANCE_AVAILABLE:
        return get_mock_fundamentals_snapshot(ticker)
    
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        # Financial statements
        income_stmt = stock.financials  # Annual
        balance_sheet = stock.balance_sheet
        cashflow = stock.cashflow
        
        # Get quarterly for TTM calculation
        income_stmt_q = stock.quarterly_financials
        cashflow_q = stock.quarterly_cashflow
        
        # === COMPANY IDENTIFIERS ===
        company_name = info.get('longName', ticker)
        sector = info.get('sector', 'Unknown')
        industry = info.get('industry', 'Unknown')
        
        # === CURRENT MARKET DATA ===
        current_price = info.get('currentPrice', info.get('regularMarketPrice', 0))
        shares_outstanding = info.get('sharesOutstanding', 0)
        market_cap = info.get('marketCap', current_price * shares_outstanding if shares_outstanding > 0 else 0)
        
        # === INCOME STATEMENT (TTM) ===
        # Calculate TTM from quarterly data for most accurate recent figures
        revenue = calculate_ttm(income_stmt_q, 'Total Revenue')
        gross_profit = calculate_ttm(income_stmt_q, 'Gross Profit')
        operating_income = calculate_ttm(income_stmt_q, 'Operating Income')
        ebit = calculate_ttm(income_stmt_q, 'EBIT', operating_income)
        ebitda = calculate_ttm(income_stmt_q, 'EBITDA', 0)
        net_income = calculate_ttm(income_stmt_q, 'Net Income', 0)
        
        # Fallback to annual data if quarterly TTM fails
        if revenue <= 0:
            revenue = _safe_get(income_stmt, 'Total Revenue', 0)
            gross_profit = _safe_get(income_stmt, 'Gross Profit', 0)
            operating_income = _safe_get(income_stmt, 'Operating Income', 0)
            ebit = _safe_get(income_stmt, 'EBIT', operating_income)
            ebitda = _safe_get(income_stmt, 'EBITDA', 0)
            net_income = _safe_get(income_stmt, 'Net Income', 0)
            logger.warning(f"[{ticker}] Using annual data as TTM fallback")
        else:
            logger.info(f"[{ticker}] Using TTM data: Revenue=${revenue/1e6:.1f}M")
        
        # === IMPROVED EBITDA CALCULATION ===
        # If EBITDA is missing but we have EBIT and D&A, calculate it
        if ebitda == 0 and ebit != 0:
            depreciation_amortization = abs(_safe_get(cashflow, 'Depreciation And Amortization', 0))
            if depreciation_amortization > 0:
                ebitda = ebit + depreciation_amortization
                logger.info(f"[{ticker}] Calculated EBITDA from EBIT + D&A: {ebitda:,.0f}")
        
        # If EBITDA is still 0 but we have net income, estimate from net income
        if ebitda == 0 and net_income != 0:
            # Rough estimate: EBITDA ≈ Net Income * 1.5 (assuming taxes, interest, D&A)
            ebitda = net_income * 1.5
            logger.info(f"[{ticker}] Estimated EBITDA from Net Income: {ebitda:,.0f}")
        
        # === IMPROVED OPERATING INCOME CALCULATION ===
        # If Operating Income is missing but we have EBIT, use EBIT
        if operating_income == 0 and ebit != 0:
            operating_income = ebit
            logger.info(f"[{ticker}] Using EBIT as Operating Income: {operating_income:,.0f}")
        
        # If Operating Income is still 0 but we have net income, estimate
        if operating_income == 0 and net_income != 0:
            # Rough estimate: Operating Income ≈ Net Income * 1.3 (assuming taxes and interest)
            operating_income = net_income * 1.3
            logger.info(f"[{ticker}] Estimated Operating Income from Net Income: {operating_income:,.0f}")
        
        # === CASH FLOW STATEMENT (TTM) ===
        # Calculate TTM from quarterly data for most accurate recent figures
        operating_cash_flow = calculate_ttm(cashflow_q, 'Operating Cash Flow')
        capex = abs(calculate_ttm(cashflow_q, 'Capital Expenditure', 0))
        free_cash_flow = operating_cash_flow - capex
        depreciation_amortization = abs(calculate_ttm(cashflow_q, 'Depreciation And Amortization', 0))
        
        # Fallback to annual data if quarterly TTM fails
        if operating_cash_flow <= 0:
            operating_cash_flow = _safe_get(cashflow, 'Operating Cash Flow', 0)
            capex = abs(_safe_get(cashflow, 'Capital Expenditure', 0))
            free_cash_flow = operating_cash_flow - capex
            depreciation_amortization = abs(_safe_get(cashflow, 'Depreciation And Amortization', 0))
            logger.warning(f"[{ticker}] Using annual cash flow data as TTM fallback")
        else:
            logger.info(f"[{ticker}] Using TTM cash flow: OCF=${operating_cash_flow/1e6:.1f}M, FCF=${free_cash_flow/1e6:.1f}M")
        
        # === BALANCE SHEET ===
        cash = _safe_get(balance_sheet, 'Cash And Cash Equivalents', 0)
        short_term_investments = _safe_get(balance_sheet, 'Short Term Investments', 0)
        total_debt = _safe_get(balance_sheet, 'Total Debt', 0)
        long_term_debt = _safe_get(balance_sheet, 'Long Term Debt', 0)
        equity = _safe_get(balance_sheet, 'Stockholders Equity', 0)
        
        # Working capital components
        current_assets = _safe_get(balance_sheet, 'Current Assets', 0)
        current_liabilities = _safe_get(balance_sheet, 'Current Liabilities', 0)
        working_capital = current_assets - current_liabilities
        
        # === HISTORICAL GROWTH (3-5 years) ===
        revenue_cagr_3y = calculate_cagr(income_stmt, 'Total Revenue', 3)
        revenue_cagr_5y = calculate_cagr(income_stmt, 'Total Revenue', 5)
        earnings_cagr_3y = calculate_cagr(income_stmt, 'Net Income', 3)
        fcf_cagr_3y = calculate_fcf_cagr(cashflow, 3)
        
        # === MARGINS ===
        gross_margin = gross_profit / revenue if revenue > 0 else 0
        operating_margin = operating_income / revenue if revenue > 0 else 0
        ebitda_margin = ebitda / revenue if revenue > 0 else 0
        net_margin = net_income / revenue if revenue > 0 else 0
        fcf_margin = free_cash_flow / revenue if revenue > 0 else 0
        
        # === EFFICIENCY METRICS ===
        invested_capital = equity + total_debt
        nopat = ebit * 0.79  # Assume 21% tax rate
        roic = nopat / invested_capital if invested_capital > 0 else 0
        
        if roic == 0:
            roic = info.get('returnOnAssets', 0) * 1.3
        
        roae = info.get('returnOnEquity', net_income / equity if equity > 0 else 0)
        
        total_assets = _safe_get(balance_sheet, 'Total Assets', 0)
        asset_turnover = revenue / total_assets if total_assets > 0 else 0
        
        # === WORKING CAPITAL DAYS (best-effort from statements) ===
        days_profile = estimate_working_capital_days(income_stmt, balance_sheet)

        # === MARKET/RISK METRICS ===
        beta = info.get('beta', 1.0)
        beta_5y = info.get('beta', 1.0)
        
        debt_to_equity = total_debt / equity if equity > 0 else 0
        tax_rate = 0.21
        unlevered_beta = beta / (1 + (1 - tax_rate) * debt_to_equity) if debt_to_equity > 0 else beta
        levered_beta = beta
        
        # === CAPITAL ALLOCATION ===
        dividends_paid = abs(_safe_get(cashflow, 'Dividends Paid', 0))
        share_repurchases = abs(_safe_get(cashflow, 'Repurchase Of Stock', 0))
        
        if share_repurchases == 0:
            try:
                shares_change = stock.info.get('sharesOutstanding', 0) - \
                               stock.info.get('sharesOutstandingPrevious', 0)
                if shares_change < 0:
                    share_repurchases = abs(shares_change) * current_price
            except:
                pass
        
        net_share_issuance = _safe_get(cashflow, 'Issuance Of Stock', 0) - share_repurchases
        
        # === ANALYST DATA ===
        analyst_count = info.get('numberOfAnalystOpinions', 0)
        analyst_avg_target = info.get('targetMeanPrice', current_price)
        
        recommendations = info.get('recommendationKey', 'hold')
        analyst_ratings = {
            'buy': info.get('recommendationMean', 3.0),
            'hold': 0,
            'sell': 0
        }
        
        # Forward estimates
        analyst_revenue_growth_1y = 0
        analyst_revenue_growth_3y = 0
        try:
            analyst_revenue_growth_1y = info.get('revenueGrowth', revenue_cagr_3y)
            earnings_growth = info.get('earningsGrowth', revenue_cagr_3y)
            
            if earnings_growth < -0.05 or earnings_growth > 0.50:
                logger.warning(f"[{ticker}] Suspicious analyst growth: {earnings_growth:.1%}, using historical instead")
                analyst_revenue_growth_3y = revenue_cagr_3y
            else:
                analyst_revenue_growth_3y = earnings_growth
            
            if analyst_avg_target > current_price:
                implied_upside = (analyst_avg_target - current_price) / current_price
                implied_annual_growth = implied_upside / 1.5
                
                if implied_upside > 0.10:
                    analyst_revenue_growth_3y = max(
                        analyst_revenue_growth_3y,
                        implied_annual_growth * 0.6 + revenue_cagr_3y * 0.4
                    )
            
            analyst_revenue_growth_3y = min(analyst_revenue_growth_3y, revenue_cagr_3y * 2.0)
            
        except Exception as e:
            logger.warning(f"[{ticker}] Analyst data extraction failed: {e}")
            analyst_revenue_growth_1y = revenue_cagr_3y
            analyst_revenue_growth_3y = revenue_cagr_3y
        
        # === MOAT ASSESSMENT ===
        moat_score = assess_economic_moat(
            roic=roic,
            gross_margin=gross_margin,
            revenue_cagr_3y=revenue_cagr_3y,
            fcf_margin=fcf_margin
        )
        
        # === CAPEX ANALYSIS ===
        capex_growth_rate = calculate_cagr(cashflow, 'Capital Expenditure', 3)
        capex_accelerating = abs(capex_growth_rate) > 0.20
        capex_to_revenue_ratio = capex / revenue if revenue > 0 else 0
        
        # === BUILD SNAPSHOT ===
        snapshot = {
            # Company Identifiers
            'ticker': ticker,
            'company_name': company_name,
            'sector': sector,
            'industry': industry,
            
            # Current Market Data
            'current_price': current_price,
            'shares_outstanding': shares_outstanding,
            'market_cap': market_cap,
            
            # Income Statement
            'revenue': revenue,
            'revenue_by_segment': [],  # Not included in unified service
            'gross_profit': gross_profit,
            'operating_income': operating_income,
            'ebit': ebit,
            'ebitda': ebitda,
            'net_income': net_income,
            
            # Cash Flow
            'operating_cash_flow': operating_cash_flow,
            'capex': capex,
            'free_cash_flow': free_cash_flow,
            'depreciation_amortization': depreciation_amortization,
            
            # Balance Sheet
            'cash': cash,
            'short_term_investments': short_term_investments,
            'total_debt': total_debt,
            'long_term_debt': long_term_debt,
            'equity': equity,
            'working_capital': working_capital,
            
            # Historical Growth
            'revenue_cagr_3y': revenue_cagr_3y,
            'revenue_cagr_5y': revenue_cagr_5y,
            'earnings_cagr_3y': earnings_cagr_3y,
            'fcf_cagr_3y': fcf_cagr_3y,
            
            # Margins
            'gross_margin': gross_margin,
            'operating_margin': operating_margin,
            'ebitda_margin': ebitda_margin,
            'net_margin': net_margin,
            'fcf_margin': fcf_margin,
            
            # Efficiency Metrics
            'roic': roic,
            'roae': roae,
            'asset_turnover': asset_turnover,
            
            # Working capital days
            'dso_days': days_profile['dso'],
            'dio_days': days_profile['dio'],
            'dpo_days': days_profile['dpo'],
            
            # Market/Risk Metrics
            'beta': beta,
            'beta_5y': beta_5y,
            'levered_beta': levered_beta,
            'unlevered_beta': unlevered_beta,
            
            # Capital Allocation
            'dividends_paid': dividends_paid,
            'share_repurchases': share_repurchases,
            'net_share_issuance': net_share_issuance,
            
            # Analyst Data
            'analyst_count': analyst_count,
            'analyst_avg_target': analyst_avg_target,
            'analyst_ratings': analyst_ratings,
            'analyst_revenue_growth_1y': analyst_revenue_growth_1y,
            'analyst_revenue_growth_3y': analyst_revenue_growth_3y,
            
            # Moat Assessment
            'economic_moat': moat_score['moat'],
            'moat_strength_score': moat_score['score'],
            'moat_factors': moat_score['factors'],
            
            # CapEx Analysis
            'capex_growth_rate_3y': capex_growth_rate,
            'capex_accelerating': capex_accelerating,
            'capex_to_revenue_ratio': capex_to_revenue_ratio,
            
            # Metadata
            'data_source': 'yfinance',
            'fiscal_year_end': info.get('lastFiscalYearEnd', ''),
            'last_updated': datetime.now().isoformat()
        }
        
        # === DATA VALIDATION ===
        data_quality_issues = []
        if revenue <= 0:
            data_quality_issues.append("Revenue is zero or negative")
        if abs(revenue_cagr_3y) > 1.0:  # More than 100% growth/decline
            data_quality_issues.append(f"Extreme revenue growth: {revenue_cagr_3y:.1%}")
        if ebitda_margin < -0.5:  # More than 50% negative margin
            data_quality_issues.append(f"Extreme negative EBITDA margin: {ebitda_margin:.1%}")
        
        if data_quality_issues:
            logger.warning(f"[{ticker}] Data quality issues: {'; '.join(data_quality_issues)}")
        
        logger.info(f"✅ Comprehensive snapshot for {ticker}: Revenue=${revenue/1e6:.1f}M, "
                   f"FCF=${free_cash_flow/1e6:.1f}M, Growth={revenue_cagr_3y:.1%}")
        
        return snapshot
        
    except Exception as e:
        logger.warning(f"yfinance error for {ticker}: {e}, using mock")
        return get_mock_fundamentals_snapshot(ticker)


def calculate_cagr(df: pd.DataFrame, metric: str, years: int) -> float:
    """Calculate CAGR for a metric over N years"""
    try:
        if metric not in df.index:
            logger.warning(f"Metric {metric} not found in DataFrame")
            return 0.03  # Return 3% (GDP growth) for missing data - professional standard
        
        values = df.loc[metric].values
        if len(values) < years + 1:
            logger.warning(f"Insufficient data for {years}-year CAGR: {len(values)} periods available")
            return 0.03  # Return 3% (GDP growth) for insufficient data - professional standard
        
        # yfinance data is typically sorted with most recent first (index 0)
        # But let's be safe and check the data
        ending_value = values[0]
        beginning_value = values[min(years, len(values) - 1)]
        
        # Validate data quality
        if beginning_value <= 0 or pd.isna(ending_value) or pd.isna(beginning_value):
            logger.warning(f"Invalid data for CAGR: ending={ending_value}, beginning={beginning_value}")
            return 0.03  # Return 3% (GDP growth) for invalid data - professional standard
        
        # Additional validation: check if values are reasonable
        if ending_value < beginning_value * 0.1:  # More than 90% decline
            logger.warning(f"Extreme decline detected: {ending_value} vs {beginning_value}")
        
        cagr = (ending_value / beginning_value) ** (1 / years) - 1
        
        # Log the calculation for debugging
        logger.info(f"CAGR calculation: {ending_value:,.0f} / {beginning_value:,.0f} ^ (1/{years}) - 1 = {cagr:.1%}")
        
        # Only cap extreme negative values, allow high growth
        return max(-0.9, cagr)
        
    except Exception as e:
        logger.error(f"CAGR calculation failed: {e}")
        return 0.03  # Return 3% (GDP growth) for calculation errors - professional standard


def calculate_fcf_cagr(cashflow_df: pd.DataFrame, years: int) -> float:
    """Calculate FCF CAGR"""
    try:
        ocf = cashflow_df.loc['Operating Cash Flow'].values if 'Operating Cash Flow' in cashflow_df.index else [0] * 10
        capex = cashflow_df.loc['Capital Expenditure'].values if 'Capital Expenditure' in cashflow_df.index else [0] * 10
        
        if len(ocf) < years + 1 or len(capex) < years + 1:
            return 0.03  # Return 3% (GDP growth) for insufficient data - professional standard
        
        ending_fcf = ocf[0] - abs(capex[0])
        beginning_fcf = ocf[min(years, len(ocf) - 1)] - abs(capex[min(years, len(capex) - 1)])
        
        if beginning_fcf <= 0:
            return 0.03  # Return 3% (GDP growth) for negative beginning FCF - professional standard
        
        cagr = (ending_fcf / beginning_fcf) ** (1 / years) - 1
        # Only cap extreme negative values, allow high growth
        return max(-0.9, cagr)
        
    except Exception:
        return 0.03  # Return 3% (GDP growth) for calculation errors - professional standard


def estimate_working_capital_days(income_stmt: pd.DataFrame, balance_sheet: pd.DataFrame) -> Dict[str, float]:
    """Estimate DSO/DIO/DPO from financial statements when available.
    Returns defaults if insufficient data.
    """
    try:
        revenue_series = income_stmt.loc['Total Revenue'].values if 'Total Revenue' in income_stmt.index else []
        revenue_ttm = revenue_series[0] if len(revenue_series) > 0 else 0
        cogs = income_stmt.loc['Cost Of Revenue'].values[0] if 'Cost Of Revenue' in income_stmt.index else 0

        ar = balance_sheet.loc['Accounts Receivable'].values[0] if 'Accounts Receivable' in balance_sheet.index else 0
        inventory = balance_sheet.loc['Inventory'].values[0] if 'Inventory' in balance_sheet.index else 0
        ap = balance_sheet.loc['Accounts Payable'].values[0] if 'Accounts Payable' in balance_sheet.index else 0

        # Avoid divide by zero; use conservative defaults when missing
        if revenue_ttm <= 0:
            return {'dso': 45.0, 'dio': 60.0, 'dpo': 45.0}

        daily_revenue = revenue_ttm / 365.0
        daily_cogs = (cogs if cogs and cogs > 0 else revenue_ttm * 0.6) / 365.0

        dso = float(ar / daily_revenue) if daily_revenue > 0 and ar > 0 else 45.0
        dio = float(inventory / daily_cogs) if daily_cogs > 0 and inventory > 0 else 60.0
        dpo = float(ap / daily_cogs) if daily_cogs > 0 and ap > 0 else 45.0

        # Clamp to reasonable bounds
        dso = max(10.0, min(120.0, dso))
        dio = max(10.0, min(180.0, dio))
        dpo = max(10.0, min(120.0, dpo))

        return {'dso': dso, 'dio': dio, 'dpo': dpo}
    except Exception:
        return {'dso': 45.0, 'dio': 60.0, 'dpo': 45.0}


def calculate_working_capital_change_from_days(
    revenue_current: float,
    revenue_prev: float,
    cogs_margin: float,
    dso_days: float,
    dio_days: float,
    dpo_days: float
) -> Dict[str, float]:
    """Compute change in working capital using DSO/DIO/DPO.
    Returns component deltas and total delta.
    """
    # Derive COGS from revenue and margin
    cogs_current = max(0.0, revenue_current * cogs_margin)
    cogs_prev = max(0.0, revenue_prev * cogs_margin)

    daily_rev_curr = revenue_current / 365.0
    daily_rev_prev = revenue_prev / 365.0
    daily_cogs_curr = cogs_current / 365.0
    daily_cogs_prev = cogs_prev / 365.0

    ar_curr = dso_days * daily_rev_curr
    ar_prev = dso_days * daily_rev_prev
    inv_curr = dio_days * daily_cogs_curr
    inv_prev = dio_days * daily_cogs_prev
    ap_curr = dpo_days * daily_cogs_curr
    ap_prev = dpo_days * daily_cogs_prev

    delta_ar = ar_curr - ar_prev
    delta_inv = inv_curr - inv_prev
    delta_ap = ap_curr - ap_prev

    delta_nwc = (delta_ar + delta_inv) - delta_ap
    return {
        'delta_ar': delta_ar,
        'delta_inventory': delta_inv,
        'delta_ap': delta_ap,
        'delta_nwc': delta_nwc
    }


def calculate_terminal_value_exit_multiple(terminal_ebitda: float, exit_multiple: float) -> float:
    """Terminal value via Exit Multiple method (EV/EBITDA)."""
    exit_multiple = max(3.0, min(30.0, float(exit_multiple or 10.0)))
    return terminal_ebitda * exit_multiple


def validate_terminal_growth(terminal_growth: float, wacc: float) -> float:
    """Ensure terminal growth is realistic and less than WACC; allow higher terminal growth for high-growth companies."""
    if wacc <= 0:
        return min(0.08, max(0.0, terminal_growth))  # Increased from 5% to 8%
    if terminal_growth >= wacc:
        return wacc * 0.7  # Increased from 50% to 70% of WACC
    return max(0.0, min(0.08, terminal_growth))  # Increased from 5% to 8%


def get_sector_profile(sector: str) -> Dict[str, Any]:
    """Return sector profile with typical characteristics used for adjustments."""
    s = (sector or '').lower()
    profiles = {
        'technology': {
            'category': 'high_growth',
            'capex_min': 0.03,
            'dso': 45.0, 'dio': 20.0, 'dpo': 40.0,
            'exit_multiple_range': (10.0, 20.0),
            'terminal_growth_cap': 0.045
        },
        'healthcare': {
            'category': 'defensive',
            'capex_min': 0.04,
            'dso': 60.0, 'dio': 50.0, 'dpo': 55.0,
            'exit_multiple_range': (9.0, 14.0),
            'terminal_growth_cap': 0.04
        },
        'consumer defensive': {
            'category': 'defensive',
            'capex_min': 0.04,
            'dso': 35.0, 'dio': 40.0, 'dpo': 45.0,
            'exit_multiple_range': (8.0, 12.0),
            'terminal_growth_cap': 0.035
        },
        'communication services': {
            'category': 'mixed',
            'capex_min': 0.05,
            'dso': 40.0, 'dio': 25.0, 'dpo': 45.0,
            'exit_multiple_range': (8.0, 13.0),
            'terminal_growth_cap': 0.04
        },
        'consumer cyclical': {
            'category': 'cyclical',
            'capex_min': 0.04,
            'dso': 40.0, 'dio': 50.0, 'dpo': 50.0,
            'exit_multiple_range': (7.0, 12.0),
            'terminal_growth_cap': 0.035
        },
        'industrials': {
            'category': 'cyclical',
            'capex_min': 0.05,
            'dso': 45.0, 'dio': 55.0, 'dpo': 50.0,
            'exit_multiple_range': (7.0, 11.0),
            'terminal_growth_cap': 0.035
        },
        'basic materials': {
            'category': 'cyclical',
            'capex_min': 0.06,
            'dso': 45.0, 'dio': 70.0, 'dpo': 55.0,
            'exit_multiple_range': (6.0, 10.0),
            'terminal_growth_cap': 0.03
        },
        'energy': {
            'category': 'cyclical',
            'capex_min': 0.07,
            'dso': 35.0, 'dio': 80.0, 'dpo': 60.0,
            'exit_multiple_range': (4.0, 8.0),
            'terminal_growth_cap': 0.03
        },
        'utilities': {
            'category': 'regulated',
            'capex_min': 0.08,
            'dso': 30.0, 'dio': 30.0, 'dpo': 45.0,
            'exit_multiple_range': (6.0, 9.0),
            'terminal_growth_cap': 0.025
        },
        'financial services': {
            'category': 'regulated',
            'capex_min': 0.02,
            'dso': 30.0, 'dio': 15.0, 'dpo': 30.0,
            'exit_multiple_range': (6.0, 10.0),
            'terminal_growth_cap': 0.03
        }
    }
    # Fallback default profile
    for key, profile in profiles.items():
        if key in s:
            return profile
    return {
        'category': 'general',
        'capex_min': 0.04,
        'dso': 45.0, 'dio': 60.0, 'dpo': 45.0,
        'exit_multiple_range': (7.0, 12.0),
        'terminal_growth_cap': 0.035
    }


def apply_industry_adjustments(fundamentals: Dict[str, Any], assumptions: Dict[str, Any]) -> Dict[str, Any]:
    """Adjust assumptions based on sector characteristics; attach notes explaining changes."""
    sector = fundamentals.get('sector', '')
    profile = get_sector_profile(sector)
    notes: List[str] = []

    # Working capital days
    assumptions['dso_days'] = assumptions.get('dso_days', profile['dso'])
    assumptions['dio_days'] = assumptions.get('dio_days', profile['dio'])
    assumptions['dpo_days'] = assumptions.get('dpo_days', profile['dpo'])
    notes.append(f"Working capital days set for {sector or 'General'} sector")

    # CapEx floor
    if assumptions['capex_percent_revenue'] < profile['capex_min']:
        assumptions['capex_percent_revenue'] = profile['capex_min']
        notes.append(f"CapEx raised to sector floor {profile['capex_min']:.1%}")

    # Terminal growth cap vs sector
    if assumptions['terminal_growth'] > profile['terminal_growth_cap']:
        assumptions['terminal_growth'] = profile['terminal_growth_cap']
        notes.append(f"Terminal growth capped at {profile['terminal_growth_cap']:.1%} for sector")

    # High growth sectors: allow modestly higher target margin
    if profile['category'] == 'high_growth':
        assumptions['ebitda_margin_target'] = min(0.7, assumptions['ebitda_margin_target'] * 1.05)
        notes.append("EBITDA margin target nudged up for high-growth sector")

    # Regulated sectors: reduce market risk premium a bit, lower terminal growth
    if profile['category'] == 'regulated':
        assumptions['market_risk_premium'] = max(0.05, assumptions['market_risk_premium'] - 0.005)
        assumptions['terminal_growth'] = min(assumptions['terminal_growth'], profile['terminal_growth_cap'])
        notes.append("Adjusted risk premium and terminal growth for regulated sector")

    assumptions.setdefault('industry_notes', notes)
    return assumptions


def get_exit_multiple_validation(sector: str, chosen_multiple: float) -> Dict[str, Any]:
    """Compare exit multiple against sector range and return validation info."""
    profile = get_sector_profile(sector)
    low, high = profile['exit_multiple_range']
    within = low <= (chosen_multiple or 0) <= high
    message = f"Exit multiple {chosen_multiple:.1f}x within sector range {low:.1f}-{high:.1f}x" if within else \
              f"Exit multiple {chosen_multiple:.1f}x outside sector range {low:.1f}-{high:.1f}x"
    provenance = {
        'source': 'heuristic_sector_ranges',
        'vintage': datetime.now().strftime('%Y-%m'),
        'note': 'Replace with external dataset (e.g., Damodaran) for stricter validation.'
    }
    return {'within_range': within, 'range_low': low, 'range_high': high, 'message': message, 'provenance': provenance}

def calculate_ttm(df: pd.DataFrame, metric: str, fallback: float = 0.0) -> float:
    """Calculate Trailing Twelve Months (TTM) from quarterly data"""
    try:
        if df is None or df.empty or metric not in df.index:
            return fallback
        
        # Get the last 4 quarters of data
        values = df.loc[metric].values
        if len(values) < 4:
            # If less than 4 quarters, sum what we have
            ttm_value = sum(v for v in values if not pd.isna(v) and v != 0)
        else:
            # Sum last 4 quarters
            ttm_value = sum(v for v in values[:4] if not pd.isna(v) and v != 0)
        
        return float(ttm_value) if ttm_value > 0 else fallback
        
    except Exception as e:
        logger.warning(f"TTM calculation failed for {metric}: {e}")
        return fallback


def _safe_get(df: pd.DataFrame, key: str, column: int = 0) -> float:
    """Safely get value from DataFrame"""
    try:
        if key not in df.index:
            return 0.0
        value = df.loc[key].iloc[column]
        return float(value) if not pd.isna(value) else 0.0
    except Exception:
        return 0.0


def get_mock_fundamentals_snapshot(ticker: str) -> Dict[str, Any]:
    """Mock data for testing"""
    
    mock_data = {
        'AAPL': {
            'current_price': 180.0,
            'shares_outstanding': 15_500_000_000,
            'market_cap': 2_800_000_000_000,
            'revenue': 383_000_000_000,
            'gross_profit': 170_000_000_000,
            'ebit': 114_000_000_000,
            'ebitda': 120_000_000_000,
            'net_income': 97_000_000_000,
            'operating_cash_flow': 110_000_000_000,
            'capex': 11_000_000_000,
            'free_cash_flow': 99_000_000_000,
            'cash': 50_000_000_000,
            'total_debt': 100_000_000_000,
            'equity': 65_000_000_000,
            'revenue_cagr_3y': 0.08,
            'revenue_cagr_5y': 0.09,
            'fcf_cagr_3y': 0.12,
            'beta': 1.2,
        }
    }
    
    base = mock_data.get(ticker, mock_data['AAPL'])
    
    # Calculate derived metrics
    base.update({
        'ticker': ticker,
        'company_name': f'{ticker} Inc.',
        'sector': 'Technology',
        'industry': 'Consumer Electronics',
        'revenue_by_segment': [],
        'operating_income': base.get('ebit', 0),
        'depreciation_amortization': base['revenue'] * 0.03,
        'short_term_investments': base['cash'] * 0.5,
        'long_term_debt': base['total_debt'] * 0.9,
        'working_capital': base['revenue'] * 0.15,
        'earnings_cagr_3y': 0.12,
        'gross_margin': base['gross_profit'] / base['revenue'],
        'operating_margin': base['ebit'] / base['revenue'],
        'ebitda_margin': base['ebitda'] / base['revenue'],
        'net_margin': base['net_income'] / base['revenue'],
        'fcf_margin': base['free_cash_flow'] / base['revenue'],
        'roic': 0.25,
        'roae': 0.45,
        'asset_turnover': 1.1,
        'beta_5y': base['beta'],
        'levered_beta': base['beta'],
        'unlevered_beta': base['beta'] * 0.85,
        'dividends_paid': 15_000_000_000,
        'share_repurchases': 85_000_000_000,
        'net_share_issuance': -85_000_000_000,
        'analyst_count': 45,
        'analyst_avg_target': 200.0,
        'analyst_ratings': {'buy': 30, 'hold': 12, 'sell': 3},
        'data_source': 'mock',
        'fiscal_year_end': '2023-09-30',
        'last_updated': datetime.now().isoformat()
    })
    
    return base


def assess_economic_moat(roic: float, gross_margin: float, revenue_cagr_3y: float, fcf_margin: float) -> Dict[str, Any]:
    """Assess economic moat strength based on fundamental metrics"""
    score = 0
    factors = []
    
    # ROIC test (40 points max)
    if roic > 0.20:
        score += 40
        factors.append(f'Exceptional ROIC ({roic*100:.1f}%)')
    elif roic > 0.15:
        score += 30
        factors.append(f'Strong ROIC ({roic*100:.1f}%)')
    elif roic > 0.10:
        score += 20
        factors.append(f'Good ROIC ({roic*100:.1f}%)')
    
    # Gross Margin test (30 points max)
    if gross_margin > 0.70:
        score += 30
        factors.append(f'Premium pricing power ({gross_margin*100:.1f}% gross margin)')
    elif gross_margin > 0.60:
        score += 25
        factors.append(f'Strong pricing power ({gross_margin*100:.1f}% gross margin)')
    elif gross_margin > 0.45:
        score += 15
        factors.append(f'Good margins ({gross_margin*100:.1f}%)')
    
    # FCF Margin test (20 points max)
    if fcf_margin > 0.25:
        score += 20
        factors.append(f'Exceptional cash generation ({fcf_margin*100:.1f}% FCF margin)')
    elif fcf_margin > 0.15:
        score += 15
        factors.append(f'Strong cash generation ({fcf_margin*100:.1f}% FCF margin)')
    elif fcf_margin > 0.10:
        score += 10
        factors.append(f'Solid cash generation ({fcf_margin*100:.1f}% FCF margin)')
    
    # Revenue Growth Stability (10 points max)
    if revenue_cagr_3y > 0.15 and revenue_cagr_3y < 0.30:
        score += 10
        factors.append(f'Sustainable growth ({revenue_cagr_3y*100:.1f}% CAGR)')
    elif revenue_cagr_3y > 0.08:
        score += 5
        factors.append(f'Steady growth ({revenue_cagr_3y*100:.1f}% CAGR)')
    
    # Determine moat category
    if score >= 70:
        moat = 'wide'
    elif score >= 45:
        moat = 'narrow'
    else:
        moat = 'none'
    
    return {
        'moat': moat,
        'score': score,
        'factors': factors
    }


# ============================================================================
# 3-STAGE DCF MODEL (from python-3stage)
# ============================================================================

def calculate_3stage_dcf(fundamentals: Dict[str, Any], assumptions: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate 3-Stage DCF valuation"""
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
    # Improved NWC modeling via DSO/DIO/DPO; fall back to simple percent if unavailable
    use_days_based_nwc = assumptions.get('use_days_based_nwc', True)
    dso_days = assumptions.get('dso_days', 45.0)
    dio_days = assumptions.get('dio_days', 60.0)
    dpo_days = assumptions.get('dpo_days', 45.0)
    nwc_pct = assumptions.get('nwc_percent_revenue', 0.02)
    da_pct = assumptions['depreciation_percent_revenue']
    annual_buyback_rate = max(0.0, min(0.1, float(assumptions.get('annual_buyback_rate', 0.0))))
    annual_debt_paydown_rate = max(0.0, min(0.2, float(assumptions.get('annual_debt_paydown_rate', 0.0))))
    exit_multiple = assumptions.get('exit_multiple_ev_ebitda')
    terminal_method = assumptions.get('terminal_method', 'gordon')  # 'gordon' | 'exit_multiple' | 'both'
    
    # Calculate WACC
    wacc_static = calculate_wacc(
        risk_free_rate=assumptions['risk_free_rate'],
        beta=assumptions['beta'],
        market_risk_premium=assumptions['market_risk_premium'],
        cost_of_debt=assumptions['cost_of_debt'],
        market_value_equity=current_price * shares_outstanding,
        market_value_debt=total_debt,
        tax_rate=tax_rate
    )
    wacc = maybe_calculate_dynamic_wacc(
        base_wacc=wacc_static,
        assumptions=assumptions,
        market_value_equity=current_price * shares_outstanding,
        market_value_debt=total_debt
    )
    
    # Validate terminal growth < WACC
    validated_terminal_growth = validate_terminal_growth(terminal_growth, wacc)
    if abs(validated_terminal_growth - terminal_growth) > 1e-9:
        logger.warning(f"Terminal growth {terminal_growth:.2%} adjusted to {validated_terminal_growth:.2%} vs WACC {wacc:.2%}")
        terminal_growth = validated_terminal_growth
        assumptions['terminal_growth'] = terminal_growth
    
    # === STAGE 1: High Growth (Years 1-5) ===
    projections = []
    current_revenue = revenue
    cogs_margin = max(0.0, min(0.95, 1.0 - fundamentals.get('gross_margin', 0.4)))
    current_shares = shares_outstanding
    current_debt = total_debt
    
    for year in range(1, 6):
        # PROFESSIONAL STANDARD: Logarithmic growth decay (high growth cannot compound indefinitely)
        # Instead of constant growth, apply decay factor each year
        if stage1_growth > 0.25:  # Only apply decay for high-growth companies
            # Decay factor: Year 1 = 100%, Year 2 = 90%, Year 3 = 81%, etc.
            decay_factor = 0.92 ** (year - 1)  # 8% decay per year
            effective_growth = stage1_growth * decay_factor
            logger.info(f"[Growth Decay] Year {year}: {stage1_growth:.1%} → {effective_growth:.1%} (decay: {decay_factor:.1%})")
        else:
            effective_growth = stage1_growth
        
        # Revenue projection with decayed growth
        if year == 1:
            projected_revenue = current_revenue * (1 + effective_growth)
        else:
            projected_revenue = projections[year - 2]['revenue'] * (1 + effective_growth)
        
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
        
        # Change in NWC (days-based preferred)
        prior_year_revenue = current_revenue * ((1 + stage1_growth) ** (year - 1))
        if use_days_based_nwc:
            wc = calculate_working_capital_change_from_days(
                revenue_current=projected_revenue,
                revenue_prev=prior_year_revenue,
                cogs_margin=cogs_margin,
                dso_days=dso_days,
                dio_days=dio_days,
                dpo_days=dpo_days
            )
            nwc_change = wc['delta_nwc']
        else:
            revenue_change = projected_revenue - prior_year_revenue
            nwc_change = revenue_change * nwc_pct
        
        # Free Cash Flow = NOPAT + D&A - CapEx - ΔNWC
        fcf = nopat + depreciation - capex - nwc_change
        
        # Discount to present value
        discount_factor = (1 + wacc) ** year
        pv_fcf = fcf / discount_factor
        
        # Shares buyback impact (reduce shares outstanding)
        current_shares = current_shares * (1.0 - annual_buyback_rate)

        # Debt paydown (reduce outstanding debt)
        current_debt = current_debt * (1.0 - annual_debt_paydown_rate)

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
            'pv_fcf': pv_fcf,
            'shares_outstanding': current_shares,
            'total_debt': current_debt
        })
    
    # === STAGE 2: Transition (Years 6-10) ===
    year_5_revenue = projections[4]['revenue']
    
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
        if use_days_based_nwc:
            wc = calculate_working_capital_change_from_days(
                revenue_current=projected_revenue,
                revenue_prev=prior_revenue,
                cogs_margin=cogs_margin,
                dso_days=dso_days,
                dio_days=dio_days,
                dpo_days=dpo_days
            )
            nwc_change = wc['delta_nwc']
        else:
            revenue_change = projected_revenue - prior_revenue
            nwc_change = revenue_change * nwc_pct
        
        # Free Cash Flow
        fcf = nopat + depreciation - capex - nwc_change
        
        # Discount to present value
        discount_factor = (1 + wacc) ** year
        pv_fcf = fcf / discount_factor
        
        # Shares buyback and debt paydown continue
        current_shares = current_shares * (1.0 - annual_buyback_rate)
        current_debt = current_debt * (1.0 - annual_debt_paydown_rate)

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
            'growth_rate': current_growth,
            'shares_outstanding': current_shares,
            'total_debt': current_debt
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
    if use_days_based_nwc:
        wc_terminal = calculate_working_capital_change_from_days(
            revenue_current=year_11_revenue,
            revenue_prev=year_10_revenue,
            cogs_margin=cogs_margin,
            dso_days=dso_days,
            dio_days=dio_days,
            dpo_days=dpo_days
        )
        terminal_nwc_change = wc_terminal['delta_nwc']
    else:
        terminal_nwc_change = (year_11_revenue - year_10_revenue) * nwc_pct
    terminal_fcf = terminal_nopat + terminal_depreciation - terminal_capex - terminal_nwc_change
    
    # HANDLE NEGATIVE TERMINAL FCF: Use conservative floor
    if terminal_fcf <= 0:
        logger.warning(f"[3-Stage DCF] Negative terminal FCF ${terminal_fcf/1e6:.1f}M - using revenue-based floor")
        terminal_fcf = year_11_revenue * 0.05  # 5% of revenue as conservative floor
        logger.info(f"[3-Stage DCF] Using terminal FCF floor: ${terminal_fcf/1e6:.1f}M")
    
    # Terminal Value methods
    tv_gordon = terminal_fcf / (wacc - terminal_growth)
    tv_exit_multiple = None
    if terminal_method in ('exit_multiple', 'both'):
        tv_exit_multiple = calculate_terminal_value_exit_multiple(terminal_ebitda, exit_multiple or 10.0)
    # Validate chosen exit multiple vs sector norms
    exit_multiple_validation = None
    if tv_exit_multiple is not None:
        exit_multiple_validation = get_exit_multiple_validation(
            fundamentals.get('sector', ''), float(exit_multiple or 10.0)
        )
    if terminal_method == 'gordon':
        terminal_value = tv_gordon
    elif terminal_method == 'exit_multiple':
        terminal_value = tv_exit_multiple if tv_exit_multiple is not None else tv_gordon
    else:  # both -> average for headline, include details
        if tv_exit_multiple is None:
            terminal_value = tv_gordon
        else:
            terminal_value = (tv_gordon + tv_exit_multiple) / 2.0
    
    # Discount terminal value to present (Year 0)
    pv_terminal_value = terminal_value / ((1 + wacc) ** 10)
    
    # === ENTERPRISE VALUE ===
    sum_pv_fcf = sum(p['pv_fcf'] for p in projections)
    enterprise_value = sum_pv_fcf + pv_terminal_value
    
    # Terminal value as % of EV
    terminal_value_percent = pv_terminal_value / enterprise_value if enterprise_value > 0 else 0
    terminal_dominance_warning = None
    
    # PROFESSIONAL STANDARD: Terminal value haircut if too dominant
    if terminal_value_percent > 0.80:
        logger.warning(f"[Terminal Value Check] Terminal value {terminal_value_percent:.1%} of EV is too high (>80%)")
        logger.warning(f"[Terminal Value Check] Applying 20% haircut to terminal value for conservatism")
        pv_terminal_value *= 0.80
        enterprise_value = sum_pv_fcf + pv_terminal_value
        terminal_value_percent = pv_terminal_value / enterprise_value if enterprise_value > 0 else 0
        terminal_dominance_warning = "Terminal value >80% of EV; 20% haircut applied for conservatism."
    elif terminal_value_percent > 0.75:
        terminal_dominance_warning = "Terminal value exceeds 75% of EV; review growth/WACC/forecast horizon."
    
    # === EQUITY VALUE ===
    # Use last updated debt and shares after dynamics
    net_debt = current_debt - cash
    equity_value = enterprise_value - net_debt
    
    # === PRICE PER SHARE ===
    final_shares = max(1.0, current_shares)
    if final_shares <= 0:
        raise ValueError(f"Invalid shares outstanding: {final_shares}")

    price_per_share = equity_value / final_shares
    
    # PROFESSIONAL STANDARD: Market cap reality check
    implied_market_cap = price_per_share * final_shares
    max_reasonable_market_cap = 5_000_000_000_000  # $5T is absolute maximum
    
    if implied_market_cap > max_reasonable_market_cap:
        logger.warning(f"[Market Cap Check] Implied market cap ${implied_market_cap/1e12:.2f}T exceeds reasonable maximum ${max_reasonable_market_cap/1e12:.1f}T")
        scale_factor = max_reasonable_market_cap / implied_market_cap
        price_per_share *= scale_factor
        logger.warning(f"[Market Cap Check] Scaling down fair value by {(1-scale_factor)*100:.1f}% to ${price_per_share:.2f}")
    
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
        'terminal_methods': {
            'gordon_growth': tv_gordon,
            'exit_multiple': tv_exit_multiple,
            'method_used': terminal_method,
            'exit_multiple_validation': exit_multiple_validation
        },
        'warnings': {
            'terminal_dominance': terminal_dominance_warning
        },
        'calculation_date': datetime.now().isoformat()
    }


def generate_3stage_assumptions(fundamentals: Dict[str, Any], custom: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generate 3-Stage DCF assumptions from fundamentals"""
    custom = custom or {}
    
    # === GROWTH EXPECTATIONS ===
    historical_growth = fundamentals.get('revenue_cagr_3y', 0.03)  # Use 3% (GDP growth) - professional standard
    analyst_growth_3y = fundamentals.get('analyst_revenue_growth_3y', historical_growth)
    
    # Weight: 40% historical, 60% forward
    blended_growth = historical_growth * 0.4 + analyst_growth_3y * 0.6
    
    # === LAW OF LARGE NUMBERS: Size-based growth constraints ===
    market_cap = fundamentals.get('market_cap', 0)
    revenue = fundamentals.get('revenue', 0)
    
    # Professional Standard: Larger companies cannot sustain high growth
    if market_cap > 3_000_000_000_000:  # >$3T (AAPL, MSFT, NVDA)
        max_sustainable_growth = 0.15  # 15% max
        logger.info(f"[Growth Constraint] Mega-cap >$3T: capping growth at 15%")
    elif market_cap > 1_000_000_000_000:  # >$1T
        max_sustainable_growth = 0.20  # 20% max
        logger.info(f"[Growth Constraint] Large-cap >$1T: capping growth at 20%")
    elif market_cap > 500_000_000_000:  # >$500B
        max_sustainable_growth = 0.25  # 25% max
        logger.info(f"[Growth Constraint] Large-cap >$500B: capping growth at 25%")
    elif market_cap > 100_000_000_000:  # >$100B
        max_sustainable_growth = 0.35  # 35% max
        logger.info(f"[Growth Constraint] Mid-large cap >$100B: capping growth at 35%")
    elif market_cap > 10_000_000_000:  # >$10B
        max_sustainable_growth = 0.50  # 50% max
        logger.info(f"[Growth Constraint] Mid-cap >$10B: capping growth at 50%")
    else:  # <$10B (small caps, growth stage)
        max_sustainable_growth = 1.0  # 100% max (allow high growth for small companies)
        logger.info(f"[Growth Constraint] Small-cap <$10B: allowing up to 100% growth")
    
    # Apply constraint
    stage1_growth = min(blended_growth, max_sustainable_growth)
    
    if blended_growth > max_sustainable_growth:
        logger.warning(f"[Growth Constraint] Blended {blended_growth:.1%} capped at {max_sustainable_growth:.1%} due to market cap ${market_cap/1e9:.1f}B")
    
    logger.info(f"[Assumptions] Historical growth: {historical_growth:.1%}, "
               f"Analyst growth: {analyst_growth_3y:.1%}, "
               f"Blended: {stage1_growth:.1%}")
    
    # === MARGIN EXPECTATIONS WITH MEAN REVERSION ===
    current_ebitda_margin = fundamentals.get('ebitda_margin', 0.20)
    sector = fundamentals.get('sector', 'Technology')
    
    # Professional Standard: Sector-based margin targets (mean reversion)
    sector_margin_targets = {
        'Technology': 0.30,
        'Healthcare': 0.20,
        'Financial Services': 0.25,
        'Consumer Defensive': 0.15,
        'Consumer Cyclical': 0.12,
        'Industrials': 0.15,
        'Energy': 0.18,
        'Utilities': 0.22,
        'Real Estate': 0.35,
        'Communication Services': 0.25,
        'Basic Materials': 0.18
    }
    sector_target = sector_margin_targets.get(sector, 0.25)
    
    # HANDLE ZERO/NEGATIVE MARGINS: Use sector-appropriate targets
    if current_ebitda_margin <= 0:
        logger.warning(f"[Margin Validation] Zero/negative EBITDA margin {current_ebitda_margin:.1%} detected")
        logger.warning(f"[Margin Validation] Using sector-appropriate target for {sector}")
        current_ebitda_margin = 0.05  # Start at 5%
        margin_target = sector_target
    # MEAN REVERSION: High margins revert down, low margins improve
    elif current_ebitda_margin > sector_target * 1.5:  # 50% above sector
        # High margins face competitive pressure - revert DOWN
        margin_target = current_ebitda_margin * 0.95  # Decline 5%
        logger.info(f"[Margin Mean Reversion] High margin {current_ebitda_margin:.1%} > sector {sector_target:.1%}, reverting DOWN to {margin_target:.1%}")
    elif current_ebitda_margin > sector_target:
        # Above sector average - maintain or slight decline
        margin_target = max(current_ebitda_margin * 0.98, sector_target)  # Slight decline
        logger.info(f"[Margin Mean Reversion] Above-average margin {current_ebitda_margin:.1%}, maintaining near current")
    else:
        # Below sector average - improve towards sector norm
        margin_target = min(current_ebitda_margin * 1.10, sector_target)  # Improve 10% max
        logger.info(f"[Margin Mean Reversion] Below-average margin {current_ebitda_margin:.1%}, improving towards sector {sector_target:.1%}")
    
    logger.info(f"[Assumptions] EBITDA margin: {current_ebitda_margin:.1%} → {margin_target:.1%}")
    
    # === MOAT ASSESSMENT ===
    moat = fundamentals.get('economic_moat', 'none')
    
    # Moat-adjusted terminal growth
    if moat == 'wide':
        terminal_growth = 0.045
    elif moat == 'narrow':
        terminal_growth = 0.038
    else:
        terminal_growth = 0.030
    
    logger.info(f"[Assumptions] Moat: {moat}, Terminal growth: {terminal_growth:.1%}")
    
    # === CAPEX MODELING ===
    capex_accelerating = fundamentals.get('capex_accelerating', False)
    capex_to_revenue = fundamentals.get('capex_to_revenue_ratio', 0.04)
    
    # HANDLE EXTREME CAPEX: Cap at reasonable levels for growth companies
    if capex_to_revenue > 0.50:  # More than 50% of revenue
        logger.warning(f"[CapEx Validation] Extreme CapEx ratio {capex_to_revenue:.1%} detected")
        logger.warning(f"[CapEx Validation] This indicates heavy growth investment phase")
        logger.warning(f"[CapEx Validation] Capping at 15% for steady-state projection")
        capex_to_revenue = 0.15  # Cap at 15% for projection purposes
    
    if capex_accelerating:
        capex_pct = max(capex_to_revenue, 0.06)
    else:
        capex_pct = max(capex_to_revenue, 0.04)
    
    logger.info(f"[Assumptions] CapEx: {capex_pct:.1%} of revenue "
               f"({'accelerating' if capex_accelerating else 'stable'})")
    
    # === WACC COMPONENTS ===
    beta = fundamentals.get('beta', 1.0)
    
    # PROFESSIONAL STANDARD: Cap beta at reasonable levels
    # Extreme betas indicate data quality issues or unsustainable volatility
    original_beta = beta
    if beta > 2.5:
        logger.warning(f"[Beta Validation] Extreme beta {beta:.2f} detected, capping at 2.5")
        beta = 2.5
    elif beta < 0.3:
        logger.warning(f"[Beta Validation] Unusually low beta {beta:.2f} detected, flooring at 0.3")
        beta = 0.3
    
    # Consider using industry-adjusted beta for extreme cases
    if original_beta > 2.0:
        industry_beta = 1.2  # Technology sector average
        adjusted_beta = beta * 0.33 + industry_beta * 0.67  # 67% weight to industry
        logger.info(f"[Beta Validation] Adjusting extreme beta {original_beta:.2f} → {adjusted_beta:.2f} using industry average")
        beta = adjusted_beta
    
    total_debt = fundamentals.get('total_debt', 0)
    operating_income = fundamentals.get('operating_income', 0)
    interest_expense = operating_income * 0.02
    cost_of_debt = interest_expense / total_debt if total_debt > 0 else 0.04
    cost_of_debt = max(0.03, min(0.10, cost_of_debt))
    
    # === Working capital days (estimate from statements when possible) ===
    dso_dio_dpo = {'dso': 45.0, 'dio': 60.0, 'dpo': 45.0}
    try:
        # Attempt to estimate from yfinance dataframes if available in fundamentals
        # Not stored directly; fall back to heuristics based on margins/sector behavior
        if fundamentals.get('gross_margin', 0.4) > 0.6:
            dso_dio_dpo = {'dso': 40.0, 'dio': 30.0, 'dpo': 50.0}
        elif fundamentals.get('gross_margin', 0.4) < 0.3:
            dso_dio_dpo = {'dso': 55.0, 'dio': 70.0, 'dpo': 45.0}
    except Exception:
        pass

    # === BUILD ASSUMPTIONS ===
    assumptions = {
        # Stage 1: High Growth (Years 1-5)
        'stage1_revenue_growth': stage1_growth,
        'stage1_years': 5,
        
        # Stage 2: Transition (Years 6-10)
        'stage2_starting_growth': stage1_growth,
        'stage2_ending_growth': max(terminal_growth + 0.01, stage1_growth * 0.4),
        'stage2_years': 5,
        
        # Terminal
        'terminal_growth': terminal_growth,
        
        # Margins
        'ebitda_margin_current': current_ebitda_margin,
        'ebitda_margin_target': margin_target,
        
        # CapEx & Working Capital
        'capex_percent_revenue': capex_pct,
        'nwc_percent_revenue': 0.02,
        'depreciation_percent_revenue': 0.03,
        # Working capital modeling
        'use_days_based_nwc': True,
        'dso_days': dso_dio_dpo['dso'],
        'dio_days': dso_dio_dpo['dio'],
        'dpo_days': dso_dio_dpo['dpo'],
        
        # WACC components
        'risk_free_rate': DEFAULT_RISK_FREE_RATE,
        'market_risk_premium': DEFAULT_MARKET_RISK_PREMIUM,
        'beta': beta,
        'cost_of_debt': cost_of_debt,
        'tax_rate': DEFAULT_TAX_RATE,
        
        # Capital structure dynamics (simple), can be overridden
        'annual_buyback_rate': min(0.03, max(0.0, fundamentals.get('share_repurchases', 0) / (fundamentals.get('market_cap', 0) or 1))),
        'annual_debt_paydown_rate': 0.05 if total_debt > 0 else 0.0,
        
        # Terminal value options
        'terminal_method': 'both',
        'exit_multiple_ev_ebitda': 10.0,
        
        # Moat & Analyst Context
        'economic_moat': moat,
        'moat_score': fundamentals.get('moat_strength_score', 0),
        'analyst_revenue_growth_3y': analyst_growth_3y,
        'historical_revenue_growth_3y': historical_growth,
        
        # Metadata
        'model': '3-stage DCF (Enhanced)',
        'generated_at': datetime.now().isoformat()
    }
    
    # Override with custom
    assumptions.update(custom)

    # Apply sector/industry adjustments and attach notes
    assumptions = apply_industry_adjustments(fundamentals, assumptions)
    
    return assumptions


# ============================================================================
# H-MODEL DCF (from python-hmodel)
# ============================================================================

def calculate_hmodel(fundamentals: Dict[str, Any], assumptions: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate H-Model DCF valuation"""
    logger.info(f"[H-Model] Starting calculation for {fundamentals['ticker']}")
    
    # Extract fundamentals
    fcf_current = fundamentals['free_cash_flow']
    
    # HANDLE NEGATIVE FCF: Use alternative valuation approach
    if fcf_current <= 0:
        logger.warning(f"[H-Model] Negative FCF ${fcf_current/1e6:.1f}M detected - using revenue-based proxy")
        # Use revenue * target FCF margin as proxy
        revenue = fundamentals['revenue']
        target_fcf_margin = 0.10  # Conservative 10% target
        fcf_current = revenue * target_fcf_margin
        logger.info(f"[H-Model] Using proxy FCF: ${fcf_current/1e6:.1f}M (Revenue ${revenue/1e6:.1f}M × {target_fcf_margin:.0%})")
    
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
    
    # Validate: g_low must < WACC
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
    years_to_maturity = 2 * H
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


def generate_hmodel_assumptions(fundamentals: Dict[str, Any], custom: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generate H-Model assumptions from fundamentals"""
    custom = custom or {}
    
    # Historical growth
    revenue_cagr = fundamentals.get('revenue_cagr_3y', 0.03)  # Use 3% (GDP growth) - professional standard
    fcf_cagr = fundamentals.get('fcf_cagr_3y', 0.03)  # Use 3% (GDP growth) - professional standard
    historical_growth = max(revenue_cagr, fcf_cagr)
    
    # Beta with validation
    beta = fundamentals.get('beta', 1.0)
    
    # PROFESSIONAL STANDARD: Cap beta at reasonable levels
    original_beta = beta
    if beta > 2.5:
        logger.warning(f"[H-Model Beta Validation] Extreme beta {beta:.2f} detected, capping at 2.5")
        beta = 2.5
    elif beta < 0.3:
        logger.warning(f"[H-Model Beta Validation] Unusually low beta {beta:.2f} detected, flooring at 0.3")
        beta = 0.3
    
    # Consider using industry-adjusted beta for extreme cases
    if original_beta > 2.0:
        industry_beta = 1.2  # Technology sector average
        adjusted_beta = beta * 0.33 + industry_beta * 0.67  # 67% weight to industry
        logger.info(f"[H-Model Beta Validation] Adjusting extreme beta {original_beta:.2f} → {adjusted_beta:.2f} using industry average")
        beta = adjusted_beta
    
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
        'g_high': min(historical_growth, 1.0),  # Cap at 100% for sanity
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


def calculate_sensitivity(fcf_current: float, g_high: float, g_low: float, H: float,
                         wacc: float, net_debt: float, shares_outstanding: float) -> list:
    """Two-way sensitivity: Growth vs WACC"""
    sensitivity = []
    
    # Growth deltas: -2%, -1%, 0%, +1%, +2%
    growth_deltas = [-0.02, -0.01, 0, 0.01, 0.02]
    
    # WACC deltas: -1%, -0.5%, 0%, +0.5%, +1%
    wacc_deltas = [-0.01, -0.005, 0, 0.005, 0.01]
    
    for delta_g in growth_deltas:
        for delta_wacc in wacc_deltas:
            adj_g_high = g_high + delta_g
            adj_g_low = g_low + (delta_g / 2)
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


# ============================================================================
# SHARED UTILITIES
# ============================================================================

def calculate_wacc(risk_free_rate: float, beta: float, market_risk_premium: float,
                   cost_of_debt: float, market_value_equity: float, market_value_debt: float,
                   tax_rate: float) -> float:
    """Calculate WACC using CAPM"""
    cost_of_equity = risk_free_rate + (beta * market_risk_premium)
    total_value = market_value_equity + market_value_debt
    
    if total_value == 0:
        logger.warning("Total value is 0, using 100% equity WACC")
        return cost_of_equity
    
    weight_equity = market_value_equity / total_value
    weight_debt = market_value_debt / total_value
    
    wacc = (weight_equity * cost_of_equity) + (weight_debt * cost_of_debt * (1 - tax_rate))
    
    # PROFESSIONAL STANDARD: Cap WACC at reasonable levels
    if wacc > 0.25:  # 25% is already very high
        logger.warning(f"[WACC Validation] Extreme WACC {wacc:.2%} detected (likely due to high beta)")
        logger.warning(f"[WACC Validation] Beta: {beta:.2f}, CoE: {cost_of_equity:.2%}")
        logger.warning(f"[WACC Validation] Capping WACC at 25% for valuation stability")
        wacc = 0.25
    elif wacc < 0.05:  # Less than 5% is unrealistically low
        logger.warning(f"[WACC Validation] Unusually low WACC {wacc:.2%} detected, flooring at 5%")
        wacc = 0.05
    
    logger.info(f"[WACC] CoE: {cost_of_equity:.2%}, CoD: {cost_of_debt:.2%}, "
               f"E/V: {weight_equity:.1%}, D/V: {weight_debt:.1%}, WACC: {wacc:.2%}")
    
    return wacc


def maybe_calculate_dynamic_wacc(base_wacc: float, assumptions: Dict[str, Any],
                                 market_value_equity: float, market_value_debt: float) -> float:
    """Optionally adjust WACC slightly over time based on leverage if enabled.
    This is a light-touch approach; default is to keep WACC static for stability.
    """
    if not assumptions.get('enable_dynamic_wacc'):
        return base_wacc
    total_value = market_value_equity + market_value_debt
    if total_value <= 0:
        return base_wacc
    leverage = market_value_debt / total_value
    # Shift WACC by small band around base (±50 bps) based on leverage drift from 30%
    adjustment = (leverage - 0.30) * 0.01  # 1% per 100% change in leverage
    adjusted = max(0.0, base_wacc + adjustment)
    return adjusted


def generate_recommendation(upside: float) -> str:
    """Generate buy/sell recommendation from upside %"""
    if upside > 20:
        return 'STRONG BUY'
    elif upside > 10:
        return 'BUY'
    elif upside > -5:
        return 'HOLD'
    elif upside > -15:
        return 'SELL'
    else:
        return 'STRONG SELL'


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8086))
    app.run(host='0.0.0.0', port=port, debug=True)
