from flask import Flask, request, jsonify
import pandas as pd
import yfinance as yf
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Sector-specific P/E standards (2024 US market reality)
SECTOR_PE_STANDARDS = {
    'Technology': {'growth': 80, 'value': 30, 'average': 70.91},
    'Healthcare': {'growth': 120, 'value': 50, 'average': 102.94},
    'Consumer Defensive': {'growth': 60, 'value': 25, 'average': 42.37},
    'Communication Services': {'growth': 50, 'value': 20, 'average': 35.55},
    'Consumer Cyclical': {'growth': 60, 'value': 25, 'average': 38.18},
    'Real Estate': {'growth': 80, 'value': 30, 'average': 70.79},
    'Industrials': {'growth': 45, 'value': 20, 'average': 32.22},
    'Basic Materials': {'growth': 40, 'value': 18, 'average': 26.61},
    'Energy': {'growth': 35, 'value': 15, 'average': 26.29},
    'Financial Services': {'growth': 25, 'value': 15, 'average': 15.54}
}

@app.route('/screen', methods=['POST'])
def screen_stocks():
    try:
        data = request.json
        filters = data.get('filters', {})
        style_weights = data.get('style_weights', {})
        
        logger.info(f"Screening with filters: {filters}")
        
        # For MVP, return realistic mock data based on strategy
        # In production, this would integrate with finvizfinance
        results = get_mock_screener_results(filters, style_weights)
        
        return jsonify({
            'success': True,
            'data': results,
            'total_found': len(results),
            'filters_applied': filters,
            'sector_adjustments': get_sector_adjustments(filters)
        })
        
    except Exception as e:
        logger.error(f"Screening error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def get_mock_screener_results(filters: Dict[str, Any], style_weights: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate realistic mock screener results based on filters"""
    
    strategy = filters.get('strategy', 'balanced')
    sectors = filters.get('sectors', [])
    
    # Get sector-specific P/E standards
    sector_pe = get_sector_pe_standards(sectors, strategy)
    
    # Base stock universe with realistic 2024 data
    base_stocks = [
        # Technology Growth
        {'symbol': 'NVDA', 'name': 'NVIDIA Corporation', 'sector': 'Technology', 
         'market_cap': 1800000000000, 'price': 450.0, 'pe_ratio': 65.0, 'pb_ratio': 25.0,
         'dividend_yield': 0.1, 'beta': 1.8, 'revenue_growth': 0.25},
        
        {'symbol': 'AAPL', 'name': 'Apple Inc.', 'sector': 'Technology',
         'market_cap': 3000000000000, 'price': 180.0, 'pe_ratio': 28.0, 'pb_ratio': 8.5,
         'dividend_yield': 0.5, 'beta': 1.2, 'revenue_growth': 0.08},
        
        {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'sector': 'Technology',
         'market_cap': 2800000000000, 'price': 380.0, 'pe_ratio': 32.0, 'pb_ratio': 12.0,
         'dividend_yield': 0.7, 'beta': 0.9, 'revenue_growth': 0.12},
        
        # Healthcare Value
        {'symbol': 'JNJ', 'name': 'Johnson & Johnson', 'sector': 'Healthcare',
         'market_cap': 450000000000, 'price': 160.0, 'pe_ratio': 15.8, 'pb_ratio': 4.2,
         'dividend_yield': 3.2, 'beta': 0.7, 'revenue_growth': 0.04},
        
        {'symbol': 'PFE', 'name': 'Pfizer Inc.', 'sector': 'Healthcare',
         'market_cap': 180000000000, 'price': 32.0, 'pe_ratio': 12.5, 'pb_ratio': 1.8,
         'dividend_yield': 5.8, 'beta': 0.6, 'revenue_growth': -0.15},
        
        # Financial Services Value
        {'symbol': 'BRK.B', 'name': 'Berkshire Hathaway Inc.', 'sector': 'Financial Services',
         'market_cap': 750000000000, 'price': 350.0, 'pe_ratio': 12.5, 'pb_ratio': 1.4,
         'dividend_yield': 0.0, 'beta': 0.8, 'revenue_growth': 0.06},
        
        {'symbol': 'JPM', 'name': 'JPMorgan Chase & Co.', 'sector': 'Financial Services',
         'market_cap': 450000000000, 'price': 150.0, 'pe_ratio': 11.0, 'pb_ratio': 1.2,
         'dividend_yield': 2.8, 'beta': 1.1, 'revenue_growth': 0.08},
        
        # Consumer Defensive Income
        {'symbol': 'KO', 'name': 'The Coca-Cola Company', 'sector': 'Consumer Defensive',
         'market_cap': 280000000000, 'price': 65.0, 'pe_ratio': 24.0, 'pb_ratio': 10.5,
         'dividend_yield': 3.1, 'beta': 0.6, 'revenue_growth': 0.05},
        
        {'symbol': 'PG', 'name': 'Procter & Gamble Co.', 'sector': 'Consumer Defensive',
         'market_cap': 380000000000, 'price': 155.0, 'pe_ratio': 26.0, 'pb_ratio': 7.8,
         'dividend_yield': 2.5, 'beta': 0.5, 'revenue_growth': 0.03},
        
        # Energy Value
        {'symbol': 'XOM', 'name': 'Exxon Mobil Corporation', 'sector': 'Energy',
         'market_cap': 420000000000, 'price': 110.0, 'pe_ratio': 14.0, 'pb_ratio': 1.8,
         'dividend_yield': 3.8, 'beta': 1.3, 'revenue_growth': -0.05},
    ]
    
    # Filter stocks based on strategy and sectors
    filtered_stocks = base_stocks
    
    # Filter by sectors if specified
    if sectors:
        filtered_stocks = [stock for stock in filtered_stocks 
                          if stock['sector'] in sectors]
    
    # Filter by market cap preference
    market_cap_pref = filters.get('market_cap_preference')
    if market_cap_pref:
        if market_cap_pref == 'small':
            filtered_stocks = [s for s in filtered_stocks if s['market_cap'] < 2000000000]
        elif market_cap_pref == 'mid':
            filtered_stocks = [s for s in filtered_stocks if 2000000000 <= s['market_cap'] < 10000000000]
        elif market_cap_pref == 'large':
            filtered_stocks = [s for s in filtered_stocks if 10000000000 <= s['market_cap'] < 200000000000]
        elif market_cap_pref == 'mega':
            filtered_stocks = [s for s in filtered_stocks if s['market_cap'] >= 200000000000]
    
    # Filter by price max
    price_max = filters.get('price_max')
    if price_max:
        filtered_stocks = [s for s in filtered_stocks if s['price'] <= price_max]
    
    # Apply sector-aware scoring
    scored_stocks = []
    for stock in filtered_stocks:
        sector = stock['sector']
        sector_benchmark = SECTOR_PE_STANDARDS.get(sector, {'average': 30})
        
        # Calculate sector-relative scores
        pe_score = calculate_pe_score(stock['pe_ratio'], sector_benchmark['average'])
        growth_score = calculate_growth_score(stock['revenue_growth'])
        value_score = calculate_value_score(stock['pe_ratio'], stock['pb_ratio'], sector_benchmark)
        momentum_score = calculate_momentum_score(stock['beta'])
        dividend_score = calculate_dividend_score(stock['dividend_yield'])
        
        # Strategy-specific scoring
        if strategy == 'growth':
            overall_score = (growth_score * 0.4 + pe_score * 0.3 + momentum_score * 0.3)
        elif strategy == 'value':
            overall_score = (value_score * 0.5 + dividend_score * 0.3 + pe_score * 0.2)
        elif strategy == 'income':
            overall_score = (dividend_score * 0.6 + value_score * 0.3 + pe_score * 0.1)
        elif strategy == 'momentum':
            overall_score = (momentum_score * 0.5 + growth_score * 0.3 + pe_score * 0.2)
        else:  # balanced
            overall_score = (pe_score * 0.25 + growth_score * 0.25 + value_score * 0.20 + 
                           momentum_score * 0.15 + dividend_score * 0.15)
        
        stock_result = {
            'symbol': stock['symbol'],
            'name': stock['name'],
            'sector': stock['sector'],
            'market_cap': stock['market_cap'],
            'price': stock['price'],
            'pe_ratio': stock['pe_ratio'],
            'pb_ratio': stock['pb_ratio'],
            'dividend_yield': stock['dividend_yield'],
            'beta': stock['beta'],
            'revenue_growth': stock['revenue_growth'],
            'overall_score': round(overall_score, 2),
            'sector_pe_benchmark': sector_benchmark['average'],
            'pe_score': pe_score,
            'growth_score': growth_score,
            'value_score': value_score,
            'momentum_score': momentum_score,
            'dividend_score': dividend_score
        }
        
        scored_stocks.append(stock_result)
    
    # Sort by overall score and return top 5
    scored_stocks.sort(key=lambda x: x['overall_score'], reverse=True)
    return scored_stocks[:5]

def get_sector_pe_standards(sectors: List[str], strategy: str) -> Dict[str, float]:
    """Get P/E standards based on sectors and strategy"""
    if not sectors:
        # Default to overall market standards
        return {'growth': 50, 'value': 20, 'average': 30}
    
    # Use the most restrictive sector if multiple sectors
    sector_standards = []
    for sector in sectors:
        if sector in SECTOR_PE_STANDARDS:
            sector_standards.append(SECTOR_PE_STANDARDS[sector])
    
    if not sector_standards:
        return {'growth': 50, 'value': 20, 'average': 30}
    
    # Return the most conservative (lowest) P/E ratios
    return {
        'growth': min(s['growth'] for s in sector_standards),
        'value': min(s['value'] for s in sector_standards),
        'average': min(s['average'] for s in sector_standards)
    }

def calculate_pe_score(pe_ratio: float, sector_average: float) -> float:
    """Calculate P/E score relative to sector average"""
    if not pe_ratio or pe_ratio <= 0:
        return 50
    
    # Score based on how much below sector average
    if pe_ratio < sector_average * 0.7:
        return 90  # Significantly undervalued
    elif pe_ratio < sector_average * 0.9:
        return 75  # Moderately undervalued
    elif pe_ratio < sector_average * 1.1:
        return 60  # Fairly valued
    elif pe_ratio < sector_average * 1.3:
        return 40  # Moderately overvalued
    else:
        return 20  # Significantly overvalued

def calculate_growth_score(revenue_growth: float) -> float:
    """Calculate growth score"""
    if not revenue_growth:
        return 50
    
    growth_pct = revenue_growth * 100
    if growth_pct > 20:
        return 90
    elif growth_pct > 15:
        return 80
    elif growth_pct > 10:
        return 70
    elif growth_pct > 5:
        return 60
    else:
        return 40

def calculate_value_score(pe_ratio: float, pb_ratio: float, sector_pe: Dict[str, float]) -> float:
    """Calculate value score with sector awareness"""
    pe_score = calculate_pe_score(pe_ratio, sector_pe['average']) if pe_ratio else 50
    
    pb_score = 50
    if pb_ratio:
        if pb_ratio < 1.0:
            pb_score = 90
        elif pb_ratio < 1.5:
            pb_score = 75
        elif pb_ratio < 2.0:
            pb_score = 60
        elif pb_ratio < 3.0:
            pb_score = 40
        else:
            pb_score = 20
    
    return (pe_score + pb_score) / 2

def calculate_momentum_score(beta: float) -> float:
    """Calculate momentum score based on beta"""
    if not beta:
        return 50
    
    # Moderate beta (0.8-1.2) gets highest score
    if 0.8 <= beta <= 1.2:
        return 80
    elif 0.6 <= beta < 0.8 or 1.2 < beta <= 1.5:
        return 70
    elif 0.4 <= beta < 0.6 or 1.5 < beta <= 2.0:
        return 60
    else:
        return 40

def calculate_dividend_score(dividend_yield: float) -> float:
    """Calculate dividend score"""
    if not dividend_yield:
        return 30
    
    if dividend_yield > 4:
        return 90
    elif dividend_yield > 3:
        return 80
    elif dividend_yield > 2:
        return 70
    elif dividend_yield > 1:
        return 60
    else:
        return 40

def get_sector_adjustments(filters: Dict[str, Any]) -> Dict[str, Any]:
    """Get sector-specific adjustments applied"""
    sectors = filters.get('sectors', [])
    strategy = filters.get('strategy', 'balanced')
    
    adjustments = {}
    for sector in sectors:
        if sector in SECTOR_PE_STANDARDS:
            adjustments[sector] = {
                'pe_standards': SECTOR_PE_STANDARDS[sector],
                'strategy': strategy
            }
    
    return adjustments

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'python-screener',
        'sector_standards': len(SECTOR_PE_STANDARDS),
        'timestamp': pd.Timestamp.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
