"""
Centralized Fundamentals Data Service

This service fetches and normalizes financial data for all DCF models.
Data sources:
1. yfinance for financials, cash flow, balance sheet
2. SEC EDGAR API for 10-K segment data

Returns comprehensive FundamentalsSnapshot used by all valuation models.
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List, Optional
import pandas as pd
from datetime import datetime
import traceback

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


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'fundamentals-data',
        'version': '2.0.0',
        'status': 'running',
        'description': 'Centralized data service for multi-model DCF valuation',
        'endpoints': {
            'health': '/health',
            'fundamentals': '/fundamentals (POST)',
            'segments': '/segments (POST)'
        },
        'data_sources': ['yfinance', 'sec_edgar'],
        'timestamp': datetime.now().isoformat()
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'yfinance_available': YFINANCE_AVAILABLE,
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


# Segment endpoint removed - segments are handled by SOTP model directly


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
        revenue = _safe_get(income_stmt, 'Total Revenue', 0)
        gross_profit = _safe_get(income_stmt, 'Gross Profit', 0)
        operating_income = _safe_get(income_stmt, 'Operating Income', 0)
        ebit = _safe_get(income_stmt, 'EBIT', operating_income)
        ebitda = _safe_get(income_stmt, 'EBITDA', 0)
        net_income = _safe_get(income_stmt, 'Net Income', 0)
        
        # === CASH FLOW STATEMENT ===
        operating_cash_flow = _safe_get(cashflow, 'Operating Cash Flow', 0)
        capex = abs(_safe_get(cashflow, 'Capital Expenditure', 0))
        free_cash_flow = operating_cash_flow - capex
        depreciation_amortization = abs(_safe_get(cashflow, 'Depreciation And Amortization', 0))
        
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
        # ROIC = NOPAT / Invested Capital
        invested_capital = equity + total_debt - cash
        nopat = ebit * 0.79  # Assume 21% tax rate
        roic = nopat / invested_capital if invested_capital > 0 else 0
        
        # ROAE = Net Income / Average Equity
        roae = info.get('returnOnEquity', net_income / equity if equity > 0 else 0)
        
        # Asset Turnover = Revenue / Total Assets
        total_assets = _safe_get(balance_sheet, 'Total Assets', 0)
        asset_turnover = revenue / total_assets if total_assets > 0 else 0
        
        # === MARKET/RISK METRICS ===
        beta = info.get('beta', 1.0)
        beta_5y = info.get('beta', 1.0)  # yfinance doesn't separate, use same
        
        # Calculate levered and unlevered beta
        debt_to_equity = total_debt / equity if equity > 0 else 0
        tax_rate = 0.21  # Corporate tax rate
        unlevered_beta = beta / (1 + (1 - tax_rate) * debt_to_equity) if debt_to_equity > 0 else beta
        levered_beta = beta
        
        # === CAPITAL ALLOCATION (Last 12 Months) ===
        dividends_paid = abs(_safe_get(cashflow, 'Dividends Paid', 0))
        
        # Share repurchases (from cash flow or calculated)
        share_repurchases = abs(_safe_get(cashflow, 'Repurchase Of Stock', 0))
        if share_repurchases == 0:
            # Estimate from share count change
            try:
                shares_change = stock.info.get('sharesOutstanding', 0) - \
                               stock.info.get('sharesOutstandingPrevious', 0)
                if shares_change < 0:  # Shares decreased = buyback
                    share_repurchases = abs(shares_change) * current_price
            except:
                pass
        
        net_share_issuance = _safe_get(cashflow, 'Issuance Of Stock', 0) - share_repurchases
        
        # === ANALYST DATA ===
        analyst_count = info.get('numberOfAnalystOpinions', 0)
        analyst_avg_target = info.get('targetMeanPrice', current_price)
        
        # Analyst ratings
        recommendations = info.get('recommendationKey', 'hold')
        analyst_ratings = {
            'buy': info.get('recommendationMean', 3.0),  # Approximation
            'hold': 0,
            'sell': 0
        }
        
        # === SEGMENT DATA - NOTE: Not included in common data service ===
        # Segment data is only needed for SOTP model
        # SOTP will fetch its own segment data (via templates or EDGAR)
        revenue_by_segment = []
        
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
            'revenue_by_segment': revenue_by_segment,
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
            
            # Metadata
            'data_source': 'yfinance',
            'fiscal_year_end': info.get('lastFiscalYearEnd', ''),
            'last_updated': datetime.now().isoformat()
        }
        
        logger.info(f"✅ Comprehensive snapshot for {ticker}: Revenue=${revenue/1e9:.2f}B, "
                   f"FCF=${free_cash_flow/1e9:.2f}B, Segments={len(revenue_by_segment)}")
        
        return snapshot
        
    except Exception as e:
        logger.warning(f"yfinance error for {ticker}: {e}, using mock")
        return get_mock_fundamentals_snapshot(ticker)


# Segment data functions removed - moved to SOTP model


def calculate_cagr(df: pd.DataFrame, metric: str, years: int) -> float:
    """Calculate CAGR for a metric over N years"""
    try:
        if metric not in df.index:
            return 0.08  # Default
        
        values = df.loc[metric].values
        if len(values) < years + 1:
            return 0.08
        
        ending_value = values[0]  # Most recent
        beginning_value = values[min(years, len(values) - 1)]
        
        if beginning_value <= 0 or pd.isna(ending_value) or pd.isna(beginning_value):
            return 0.08
        
        cagr = (ending_value / beginning_value) ** (1 / years) - 1
        
        return max(-0.5, min(0.5, cagr))  # Clamp
        
    except Exception:
        return 0.08


def calculate_fcf_cagr(cashflow_df: pd.DataFrame, years: int) -> float:
    """Calculate FCF CAGR"""
    try:
        ocf = cashflow_df.loc['Operating Cash Flow'].values if 'Operating Cash Flow' in cashflow_df.index else [0] * 10
        capex = cashflow_df.loc['Capital Expenditure'].values if 'Capital Expenditure' in cashflow_df.index else [0] * 10
        
        if len(ocf) < years + 1 or len(capex) < years + 1:
            return 0.08
        
        ending_fcf = ocf[0] - abs(capex[0])
        beginning_fcf = ocf[min(years, len(ocf) - 1)] - abs(capex[min(years, len(capex) - 1)])
        
        if beginning_fcf <= 0:
            return 0.08
        
        cagr = (ending_fcf / beginning_fcf) ** (1 / years) - 1
        return max(-0.5, min(0.5, cagr))
        
    except Exception:
        return 0.08


# EDGAR functions removed - moved to SOTP model


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


if __name__ == '__main__':
    port = 8082  # Different port from DCF
    app.run(host='0.0.0.0', port=port, debug=True)

