"""
SOTP (Sum-of-the-Parts) Valuation Model

For diversified companies and conglomerates:
- Values each business segment independently
- Uses comparable company multiples
- Aggregates to total enterprise value
- Adds corporate adjustments (overhead, synergies, real options)

Best for: Apple, Amazon, Alphabet, Meta, Microsoft (multi-segment businesses)
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List, Optional
from datetime import datetime
import traceback
import requests
import os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Comparable company multiples by industry/segment type
COMPARABLE_MULTIPLES = {
    'hardware': {
        'ev_to_revenue': 3.5,
        'ev_to_ebitda': 12.0,
        'quality_premium': 0.15  # Premium for Apple-level quality
    },
    'services': {
        'ev_to_revenue': 7.5,
        'ev_to_ebitda': 22.0,
        'quality_premium': 0.20  # Premium for recurring revenue
    },
    'cloud': {
        'ev_to_revenue': 10.0,
        'ev_to_ebitda': 25.0,
        'quality_premium': 0.25  # Premium for high-margin SaaS
    },
    'advertising': {
        'ev_to_revenue': 5.0,
        'ev_to_ebitda': 15.0,
        'quality_premium': 0.10
    },
    'ecommerce': {
        'ev_to_revenue': 2.0,
        'ev_to_ebitda': 18.0,
        'quality_premium': 0.10
    },
    'default': {
        'ev_to_revenue': 4.0,
        'ev_to_ebitda': 14.0,
        'quality_premium': 0.10
    }
}


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'sotp-valuation',
        'version': '1.0.0',
        'status': 'running',
        'model': 'Sum-of-the-Parts (SOTP)',
        'description': 'Segment-based valuation for diversified companies',
        'endpoints': {
            'health': '/health',
            'sotp': '/sotp (POST)'
        },
        'timestamp': datetime.now().isoformat()
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'model': 'sotp',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/sotp', methods=['POST'])
def run_sotp():
    """
    Run SOTP valuation
    
    Request:
    {
        "ticker": "AAPL",
        "fundamentals": {...},  // Optional
        "assumptions": {...}     // Optional custom assumptions
    }
    
    Response:
    {
        "success": true,
        "data": {
            "price_per_share": 195.00,
            "enterprise_value": 3200000000000,
            "segment_values": [...],
            "corporate_adjustments": {...},
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
        
        logger.info(f"Running SOTP valuation for {ticker}")
        
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
        
        # Run SOTP calculation
        sotp_result = calculate_sotp(fundamentals, custom_assumptions)
        
        return jsonify({
            'success': True,
            'data': sotp_result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"SOTP error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


def calculate_sotp(fundamentals: Dict[str, Any], custom_assumptions: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Calculate SOTP valuation
    
    Steps:
    1. Get segment data (from fundamentals or templates)
    2. Classify each segment
    3. Apply comparable multiples
    4. Add quality premiums
    5. Aggregate segment values
    6. Add corporate adjustments
    7. Convert to equity value and price per share
    """
    logger.info(f"[SOTP] Starting calculation for {fundamentals['ticker']}")
    
    ticker = fundamentals['ticker']
    revenue = fundamentals['revenue']
    current_price = fundamentals['current_price']
    shares_outstanding = fundamentals['shares_outstanding']
    cash = fundamentals['cash']
    total_debt = fundamentals['total_debt']
    
    # Get segments (from fundamentals or templates)
    segments = fundamentals.get('revenue_by_segment', [])
    
    if not segments or len(segments) == 0:
        logger.warning(f"No segment data for {ticker}, falling back to single-segment SOTP")
        # Treat as single segment
        segments = [{
            'segment_name': 'Core Business',
            'revenue': revenue,
            'operating_income': fundamentals.get('operating_income', revenue * 0.25),
            'margin': fundamentals.get('operating_margin', 0.25)
        }]
    
    logger.info(f"[SOTP] Found {len(segments)} segments")
    
    # Value each segment
    segment_valuations = []
    total_segment_ev = 0
    
    for segment in segments:
        segment_name = segment['segment_name']
        segment_revenue = segment['revenue']
        segment_operating_income = segment['operating_income']
        segment_margin = segment['margin']
        
        # Classify segment to get multiples
        segment_type = classify_segment(segment_name, ticker)
        multiples = COMPARABLE_MULTIPLES.get(segment_type, COMPARABLE_MULTIPLES['default'])
        
        # Base valuation using EV/Revenue multiple
        ev_revenue_multiple = multiples['ev_to_revenue']
        base_ev = segment_revenue * ev_revenue_multiple
        
        # Quality adjustment
        quality_premium = multiples['quality_premium']
        
        # Margin premium: if segment margin > industry average, add premium
        industry_avg_margin = 0.20  # Assume 20% average
        if segment_margin > industry_avg_margin:
            margin_premium = min((segment_margin - industry_avg_margin) * 0.5, 0.15)  # Cap at +15%
        else:
            margin_premium = 0
        
        # Total adjustment
        total_premium = quality_premium + margin_premium
        adjusted_ev = base_ev * (1 + total_premium)
        
        total_segment_ev += adjusted_ev
        
        segment_valuations.append({
            'segment_name': segment_name,
            'segment_type': segment_type,
            'revenue': segment_revenue,
            'operating_income': segment_operating_income,
            'margin': segment_margin,
            'ev_revenue_multiple': ev_revenue_multiple,
            'base_ev': base_ev,
            'quality_premium': quality_premium,
            'margin_premium': margin_premium,
            'total_premium': total_premium,
            'adjusted_ev': adjusted_ev,
            'percent_of_total': 0  # Will calculate after total known
        })
        
        logger.info(f"[SOTP] {segment_name}: ${segment_revenue/1e9:.1f}B revenue → "
                   f"${adjusted_ev/1e9:.1f}B EV (multiple: {ev_revenue_multiple}x, premium: {total_premium:.1%})")
    
    # Calculate percentages
    for sv in segment_valuations:
        sv['percent_of_total'] = sv['adjusted_ev'] / total_segment_ev if total_segment_ev > 0 else 0
    
    # === CORPORATE ADJUSTMENTS ===
    
    # 1. Corporate overhead (negative adjustment)
    # Assume 1-2% of revenue for shared services costs
    corporate_overhead = -revenue * 0.015  # -1.5% of revenue
    
    # 2. Shared services value (positive adjustment)
    # Centralized functions create efficiency
    shared_services_value = revenue * 0.005  # +0.5% of revenue
    
    # 3. Real options value (R&D, growth initiatives)
    # For tech companies, assign value to future growth options
    market_cap = current_price * shares_outstanding
    real_options_value = market_cap * 0.05  # 5% of market cap for growth optionality
    
    corporate_adjustments = {
        'corporate_overhead': corporate_overhead,
        'shared_services_value': shared_services_value,
        'real_options_value': real_options_value,
        'total_adjustments': corporate_overhead + shared_services_value + real_options_value
    }
    
    logger.info(f"[SOTP] Corporate adjustments: ${corporate_adjustments['total_adjustments']/1e9:.1f}B")
    
    # === ENTERPRISE VALUE ===
    enterprise_value = total_segment_ev + corporate_adjustments['total_adjustments']
    
    # === EQUITY VALUE ===
    net_debt = total_debt - cash
    equity_value = enterprise_value - net_debt
    
    # === PRICE PER SHARE ===
    if shares_outstanding <= 0:
        raise ValueError(f"Invalid shares outstanding: {shares_outstanding}")
    
    price_per_share = equity_value / shares_outstanding
    
    # Upside/Downside
    upside_downside = ((price_per_share - current_price) / current_price) * 100 if current_price > 0 else 0
    
    logger.info(f"[SOTP] Fair value: ${price_per_share:.2f}, Current: ${current_price:.2f}, Upside: {upside_downside:.1f}%")
    
    return {
        'model': 'sotp',
        'ticker': ticker,
        'price_per_share': price_per_share,
        'current_price': current_price,
        'upside_downside': upside_downside,
        'enterprise_value': enterprise_value,
        'equity_value': equity_value,
        'net_debt': net_debt,
        'segment_valuations': segment_valuations,
        'total_segment_ev': total_segment_ev,
        'corporate_adjustments': corporate_adjustments,
        'segment_count': len(segments),
        'valuation_method': 'comparable_multiples',
        'calculation_date': datetime.now().isoformat()
    }


def classify_segment(segment_name: str, ticker: str) -> str:
    """
    Classify segment to determine appropriate multiples
    
    Returns: 'hardware', 'services', 'cloud', 'advertising', 'ecommerce', or 'default'
    """
    segment_lower = segment_name.lower()
    
    # Hardware/Products
    if any(word in segment_lower for word in ['iphone', 'mac', 'ipad', 'watch', 'wearable', 'device', 'hardware']):
        return 'hardware'
    
    # Services (high-margin, recurring)
    if any(word in segment_lower for word in ['service', 'subscription', 'cloud', 'saas', 'azure', 'aws', 'office 365']):
        # Differentiate cloud vs other services
        if any(word in segment_lower for word in ['cloud', 'azure', 'aws', 'gcp', 'compute', 'storage']):
            return 'cloud'
        return 'services'
    
    # Advertising
    if any(word in segment_lower for word in ['advertising', 'ads', 'search', 'youtube']):
        return 'advertising'
    
    # E-commerce
    if any(word in segment_lower for word in ['ecommerce', 'retail', 'online store', 'marketplace']):
        return 'ecommerce'
    
    # Ticker-specific classification
    if ticker == 'AAPL':
        if 'iphone' in segment_lower:
            return 'hardware'
        elif 'services' in segment_lower:
            return 'services'
        elif any(word in segment_lower for word in ['mac', 'ipad', 'wearable']):
            return 'hardware'
    
    elif ticker == 'MSFT':
        if any(word in segment_lower for word in ['azure', 'cloud', 'intelligent cloud']):
            return 'cloud'
        elif any(word in segment_lower for word in ['office', 'dynamics', 'productivity']):
            return 'services'
    
    elif ticker == 'GOOGL' or ticker == 'GOOG':
        if any(word in segment_lower for word in ['advertising', 'search', 'youtube']):
            return 'advertising'
        elif 'cloud' in segment_lower:
            return 'cloud'
    
    elif ticker == 'AMZN':
        if any(word in segment_lower for word in ['aws', 'cloud']):
            return 'cloud'
        elif any(word in segment_lower for word in ['online', 'retail', 'store']):
            return 'ecommerce'
    
    # Default
    return 'default'


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8084))
    app.run(host='0.0.0.0', port=port, debug=True)

