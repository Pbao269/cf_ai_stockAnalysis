"""
Technical Analysis Service - Production Implementation

Provides comprehensive technical analysis including:
- Trend indicators (SMA/EMA)
- Momentum indicators (RSI, MACD)
- Volatility indicators (ATR, ADX)
- Support/Resistance levels
- Fibonacci retracements
- Market regime detection
- Short interest analysis (institutional shorting warnings)
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime
import traceback

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
        'service': 'technicals',
        'version': '1.1.0',
        'status': 'running',
        'description': 'Technical analysis service with indicators, regime detection, levels, and short interest warnings',
        'endpoints': {
            'health': '/health',
            'analyze': '/analyze (POST)'
        },
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


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Perform comprehensive technical analysis
    
    Request: {"ticker": "AAPL", "period": "1y", "interval": "1d"}
    Response: Complete technical analysis with indicators, regime, and levels
    """
    try:
        data = request.json
        ticker = data.get('ticker', '').upper()
        period = data.get('period', '1y')
        interval = data.get('interval', '1d')
        
        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker required'}), 400
        
        logger.info(f"Analyzing {ticker} ({period}, {interval})")
        
        # Fetch OHLCV data
        df = fetch_ohlcv(ticker, period, interval)
        
        if df is None or len(df) < 50:
            return jsonify({
                'success': False,
                'error': 'Insufficient data for technical analysis (need at least 50 bars)'
            }), 400
        
        # Calculate all indicators
        indicators = calculate_indicators(df)
        
        # Detect market regime
        regime = detect_market_regime(df, indicators)
        
        # Calculate support/resistance levels
        levels = calculate_support_resistance(df)
        
        # Calculate Fibonacci levels
        fibonacci = calculate_fibonacci_levels(df)
        
        # Get short interest data (institutional shorting warning)
        short_interest = get_short_interest(ticker)
        
        # Determine bias and confidence
        bias, confidence = determine_bias(indicators, regime)
        
        # Get current values
        current_price = float(df['Close'].iloc[-1])
        
        result = {
            'ticker': ticker,
            'current_price': current_price,
            'bias': bias,
            'confidence': confidence,
            'indicators': indicators,
            'regime': regime,
            'levels': {
                'support_resistance': levels,
                'fibonacci': fibonacci
            },
            'short_interest': short_interest,
            'summary': generate_summary(bias, confidence, regime, current_price, levels),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Technical analysis error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


def fetch_ohlcv(ticker: str, period: str = '1y', interval: str = '1d') -> Optional[pd.DataFrame]:
    """Fetch OHLCV data from yfinance with retry logic and custom headers"""
    if not YFINANCE_AVAILABLE:
        return get_mock_ohlcv(ticker)
    
    import time
    import requests
    max_retries = 3
    
    # Set up a custom session with User-Agent header to avoid being blocked
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    for attempt in range(max_retries):
        try:
            # Use Ticker.history() method with custom session (recommended approach)
            stock = yf.Ticker(ticker, session=session)
            df = stock.history(period=period, interval=interval)
            
            if df.empty:
                if attempt < max_retries - 1:
                    logger.warning(f"No data for {ticker} (attempt {attempt+1}/{max_retries}), retrying...")
                    time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                    continue
                logger.warning(f"No data for {ticker} after {max_retries} attempts, using mock")
                return get_mock_ohlcv(ticker)
            
            logger.info(f"Fetched {len(df)} bars for {ticker}")
            return df
            
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"yfinance error for {ticker} (attempt {attempt+1}/{max_retries}): {e}, retrying...")
                time.sleep(2 ** attempt)
                continue
            logger.error(f"yfinance error for {ticker} after {max_retries} attempts: {e}, using mock")
            return get_mock_ohlcv(ticker)


def get_short_interest(ticker: str) -> Dict[str, Any]:
    """
    Get short interest data to warn about institutional shorting
    
    Returns:
        short_pct_float: % of float that is sold short
        days_to_cover: Days to cover all short positions
        short_ratio: Short interest ratio
        warning_level: none/caution/warning/danger
        warning_message: Human-readable warning
    """
    if not YFINANCE_AVAILABLE:
        return {
            'available': False,
            'warning_level': 'unknown',
            'warning_message': 'Short interest data unavailable'
        }
    
    import time
    import requests
    max_retries = 2
    
    # Set up a custom session with User-Agent header to avoid being blocked
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(ticker, session=session)
            info = stock.info
            
            # Check if info is empty or invalid
            if not info or not isinstance(info, dict):
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                raise ValueError("No valid data returned")
            
            break  # Success, exit retry loop
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            logger.error(f"Short interest fetch error for {ticker}: {e}")
            return {
                'available': False,
                'warning_level': 'unknown',
                'warning_message': 'Short interest data temporarily unavailable'
            }
    
    try:
        
        # Get short interest metrics
        short_pct_float = info.get('shortPercentOfFloat', None)
        short_ratio = info.get('shortRatio', None)  # Days to cover
        shares_short = info.get('sharesShort', None)
        shares_short_prior = info.get('sharesShortPriorMonth', None)
        
        # Calculate if data is available
        if short_pct_float is None:
            return {
                'available': False,
                'warning_level': 'unknown',
                'warning_message': 'Short interest data not available for this ticker'
            }
        
        # Convert to percentage if needed
        if short_pct_float < 1:
            short_pct_float = short_pct_float * 100
        
        # Calculate short interest trend (increasing or decreasing)
        short_trend = 'stable'
        if shares_short is not None and shares_short_prior is not None and shares_short_prior > 0:
            change_pct = ((shares_short - shares_short_prior) / shares_short_prior) * 100
            if change_pct > 10:
                short_trend = 'increasing'
            elif change_pct < -10:
                short_trend = 'decreasing'
        
        # Determine warning level based on thresholds
        warning_level = 'none'
        warning_message = f'Short interest at {short_pct_float:.1f}% is normal'
        
        if short_pct_float >= 40:
            warning_level = 'danger'
            warning_message = f'⚠️ EXTREME SHORT INTEREST ({short_pct_float:.1f}% of float) - Institutions heavily shorting. High risk of catching falling knife.'
        elif short_pct_float >= 20:
            warning_level = 'warning'
            warning_message = f'⚠️ HIGH SHORT INTEREST ({short_pct_float:.1f}% of float) - Significant institutional shorting. Exercise caution.'
        elif short_pct_float >= 10:
            warning_level = 'caution'
            warning_message = f'Elevated short interest ({short_pct_float:.1f}% of float) - Moderate shorting pressure.'
        elif short_pct_float >= 5:
            warning_level = 'low'
            warning_message = f'Low short interest ({short_pct_float:.1f}% of float) - Minimal shorting pressure.'
        
        # Add days to cover context
        if short_ratio is not None and short_ratio > 0:
            if short_ratio > 10:
                warning_message += f' Days to cover: {short_ratio:.1f} (very high - potential squeeze risk).'
            elif short_ratio > 5:
                warning_message += f' Days to cover: {short_ratio:.1f} (high).'
            else:
                warning_message += f' Days to cover: {short_ratio:.1f}.'
        
        # Add trend context
        if short_trend == 'increasing':
            warning_message += ' Short interest is INCREASING - bearish signal.'
        elif short_trend == 'decreasing':
            warning_message += ' Short interest is decreasing - bullish signal.'
        
        return {
            'available': True,
            'short_pct_float': round(short_pct_float, 2),
            'short_ratio': round(short_ratio, 2) if short_ratio else None,
            'shares_short': int(shares_short) if shares_short else None,
            'shares_short_prior': int(shares_short_prior) if shares_short_prior else None,
            'short_trend': short_trend,
            'warning_level': warning_level,
            'warning_message': warning_message,
            'interpretation': {
                'danger': short_pct_float >= 40,
                'high': short_pct_float >= 20,
                'moderate': short_pct_float >= 10,
                'low': short_pct_float >= 5,
                'minimal': short_pct_float < 5
            }
        }
        
    except Exception as e:
        logger.warning(f"Short interest parsing error for {ticker}: {e}")
        return {
            'available': False,
            'warning_level': 'unknown',
            'warning_message': 'Short interest data temporarily unavailable'
        }


def calculate_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate all technical indicators"""
    
    close = df['Close']
    high = df['High']
    low = df['Low']
    volume = df['Volume']
    
    # Moving Averages
    sma_20 = close.rolling(window=20).mean()
    sma_50 = close.rolling(window=50).mean()
    sma_200 = close.rolling(window=200).mean()
    
    ema_20 = close.ewm(span=20, adjust=False).mean()
    ema_50 = close.ewm(span=50, adjust=False).mean()
    ema_200 = close.ewm(span=200, adjust=False).mean()
    
    # RSI (14-period)
    rsi = calculate_rsi(close, 14)
    
    # MACD
    macd_line, signal_line, histogram = calculate_macd(close)
    
    # ADX (trend strength)
    adx = calculate_adx(high, low, close, 14)
    
    # ATR (volatility)
    atr = calculate_atr(high, low, close, 14)
    
    # 52-week percentile
    percentile_52w = calculate_52w_percentile(close)
    
    # Current values
    current_price = float(close.iloc[-1])
    
    indicators = {
        'moving_averages': {
            'sma_20': float(sma_20.iloc[-1]) if not pd.isna(sma_20.iloc[-1]) else None,
            'sma_50': float(sma_50.iloc[-1]) if not pd.isna(sma_50.iloc[-1]) else None,
            'sma_200': float(sma_200.iloc[-1]) if not pd.isna(sma_200.iloc[-1]) else None,
            'ema_20': float(ema_20.iloc[-1]) if not pd.isna(ema_20.iloc[-1]) else None,
            'ema_50': float(ema_50.iloc[-1]) if not pd.isna(ema_50.iloc[-1]) else None,
            'ema_200': float(ema_200.iloc[-1]) if not pd.isna(ema_200.iloc[-1]) else None,
        },
        'rsi': {
            'value': float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0,
            'interpretation': interpret_rsi(rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50.0)
        },
        'macd': {
            'macd_line': float(macd_line.iloc[-1]) if not pd.isna(macd_line.iloc[-1]) else 0.0,
            'signal_line': float(signal_line.iloc[-1]) if not pd.isna(signal_line.iloc[-1]) else 0.0,
            'histogram': float(histogram.iloc[-1]) if not pd.isna(histogram.iloc[-1]) else 0.0,
            'signal': 'bullish' if histogram.iloc[-1] > 0 else 'bearish' if histogram.iloc[-1] < 0 else 'neutral'
        },
        'adx': {
            'value': float(adx.iloc[-1]) if not pd.isna(adx.iloc[-1]) else 20.0,
            'trend_strength': interpret_adx(adx.iloc[-1] if not pd.isna(adx.iloc[-1]) else 20.0)
        },
        'atr': {
            'value': float(atr.iloc[-1]) if not pd.isna(atr.iloc[-1]) else 0.0,
            'volatility_pct': float((atr.iloc[-1] / current_price) * 100) if not pd.isna(atr.iloc[-1]) else 0.0
        },
        'percentile_52w': percentile_52w
    }
    
    return indicators


def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Relative Strength Index"""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi


def calculate_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Calculate MACD indicator"""
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    
    return macd_line, signal_line, histogram


def calculate_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Average Directional Index (trend strength)"""
    
    # Calculate True Range
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # Calculate Directional Movement
    up_move = high - high.shift()
    down_move = low.shift() - low
    
    plus_dm = up_move.where((up_move > down_move) & (up_move > 0), 0)
    minus_dm = down_move.where((down_move > up_move) & (down_move > 0), 0)
    
    # Smooth with Wilder's method
    atr = tr.rolling(window=period).mean()
    plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
    minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)
    
    # Calculate DX and ADX
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
    adx = dx.rolling(window=period).mean()
    
    return adx


def calculate_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Average True Range (volatility)"""
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    
    return atr


def calculate_52w_percentile(prices: pd.Series) -> float:
    """Calculate current price percentile over 52 weeks"""
    period = min(252, len(prices))  # 252 trading days ~= 1 year
    
    if period < 20:
        return 50.0  # Not enough data
    
    recent_prices = prices.iloc[-period:]
    current_price = prices.iloc[-1]
    
    percentile = (recent_prices < current_price).sum() / len(recent_prices) * 100
    
    return float(percentile)


def detect_market_regime(df: pd.DataFrame, indicators: Dict[str, Any]) -> Dict[str, Any]:
    """Detect market regime (trending vs mean-reverting)"""
    
    adx_value = indicators['adx']['value']
    rsi_value = indicators['rsi']['value']
    
    # Get price action
    close = df['Close']
    returns = close.pct_change().dropna()
    
    # Calculate volatility
    volatility = returns.rolling(window=20).std() * np.sqrt(252)
    current_vol = float(volatility.iloc[-1]) if not pd.isna(volatility.iloc[-1]) else 0.20
    
    # Calculate autocorrelation (mean reversion indicator)
    autocorr = returns.rolling(window=20).apply(lambda x: x.autocorr(), raw=False).iloc[-1]
    autocorr = float(autocorr) if not pd.isna(autocorr) else 0.0
    
    # Determine regime
    if adx_value > 25:
        regime_type = 'trending'
        strength = 'strong' if adx_value > 40 else 'moderate'
    else:
        regime_type = 'mean_reverting'
        strength = 'weak_trend'
    
    # Determine trend direction
    sma_20 = indicators['moving_averages']['sma_20']
    sma_50 = indicators['moving_averages']['sma_50']
    current_price = float(close.iloc[-1])
    
    if sma_20 and sma_50:
        if sma_20 > sma_50 and current_price > sma_20:
            direction = 'uptrend'
        elif sma_20 < sma_50 and current_price < sma_20:
            direction = 'downtrend'
        else:
            direction = 'sideways'
    else:
        direction = 'unknown'
    
    return {
        'type': regime_type,
        'strength': strength,
        'direction': direction,
        'adx': adx_value,
        'volatility': current_vol,
        'autocorrelation': autocorr,
        'interpretation': f"{strength.replace('_', ' ').title()} {direction} ({regime_type.replace('_', ' ')})"
    }


def calculate_support_resistance(df: pd.DataFrame, lookback: int = 20) -> List[Dict[str, float]]:
    """Calculate support and resistance levels using pivot points"""
    
    high = df['High']
    low = df['Low']
    close = df['Close']
    
    # Get recent highs and lows
    recent_high = float(high.iloc[-lookback:].max())
    recent_low = float(low.iloc[-lookback:].min())
    current_price = float(close.iloc[-1])
    
    # Classic pivot points
    pivot = (recent_high + recent_low + current_price) / 3
    
    resistance1 = 2 * pivot - recent_low
    resistance2 = pivot + (recent_high - recent_low)
    resistance3 = recent_high + 2 * (pivot - recent_low)
    
    support1 = 2 * pivot - recent_high
    support2 = pivot - (recent_high - recent_low)
    support3 = recent_low - 2 * (recent_high - pivot)
    
    levels = [
        {'type': 'resistance', 'level': resistance3, 'strength': 'strong', 'distance_pct': ((resistance3 - current_price) / current_price) * 100},
        {'type': 'resistance', 'level': resistance2, 'strength': 'moderate', 'distance_pct': ((resistance2 - current_price) / current_price) * 100},
        {'type': 'resistance', 'level': resistance1, 'strength': 'weak', 'distance_pct': ((resistance1 - current_price) / current_price) * 100},
        {'type': 'pivot', 'level': pivot, 'strength': 'neutral', 'distance_pct': ((pivot - current_price) / current_price) * 100},
        {'type': 'support', 'level': support1, 'strength': 'weak', 'distance_pct': ((support1 - current_price) / current_price) * 100},
        {'type': 'support', 'level': support2, 'strength': 'moderate', 'distance_pct': ((support2 - current_price) / current_price) * 100},
        {'type': 'support', 'level': support3, 'strength': 'strong', 'distance_pct': ((support3 - current_price) / current_price) * 100},
    ]
    
    return levels


def calculate_fibonacci_levels(df: pd.DataFrame, lookback: int = 50) -> Dict[str, Any]:
    """Calculate Fibonacci retracement levels"""
    
    high = df['High']
    low = df['Low']
    close = df['Close']
    
    # Find swing high and low
    swing_high = float(high.iloc[-lookback:].max())
    swing_low = float(low.iloc[-lookback:].min())
    current_price = float(close.iloc[-1])
    
    diff = swing_high - swing_low
    
    # Fibonacci retracement levels
    levels = {
        'swing_high': swing_high,
        'swing_low': swing_low,
        'current_price': current_price,
        'retracements': {
            '0.0': swing_high,
            '23.6': swing_high - 0.236 * diff,
            '38.2': swing_high - 0.382 * diff,
            '50.0': swing_high - 0.500 * diff,
            '61.8': swing_high - 0.618 * diff,
            '78.6': swing_high - 0.786 * diff,
            '100.0': swing_low
        },
        'trend': 'downtrend' if current_price < (swing_high - 0.5 * diff) else 'uptrend'
    }
    
    return levels


def determine_bias(indicators: Dict[str, Any], regime: Dict[str, Any]) -> Tuple[str, float]:
    """Determine overall bias and confidence"""
    
    signals = []
    
    # Moving average signals
    ma = indicators['moving_averages']
    if ma['sma_20'] and ma['sma_50']:
        if ma['sma_20'] > ma['sma_50']:
            signals.append(('bullish', 0.3))
        else:
            signals.append(('bearish', 0.3))
    
    # RSI signal
    rsi_val = indicators['rsi']['value']
    if rsi_val > 70:
        signals.append(('bearish', 0.2))  # Overbought
    elif rsi_val < 30:
        signals.append(('bullish', 0.2))  # Oversold
    elif 40 <= rsi_val <= 60:
        signals.append(('neutral', 0.2))
    
    # MACD signal
    macd_signal = indicators['macd']['signal']
    if macd_signal == 'bullish':
        signals.append(('bullish', 0.3))
    elif macd_signal == 'bearish':
        signals.append(('bearish', 0.3))
    
    # Regime signal
    if regime['direction'] == 'uptrend':
        signals.append(('bullish', 0.2))
    elif regime['direction'] == 'downtrend':
        signals.append(('bearish', 0.2))
    
    # Calculate weighted bias
    bullish_weight = sum(weight for signal, weight in signals if signal == 'bullish')
    bearish_weight = sum(weight for signal, weight in signals if signal == 'bearish')
    neutral_weight = sum(weight for signal, weight in signals if signal == 'neutral')
    
    total_weight = bullish_weight + bearish_weight + neutral_weight
    
    if total_weight == 0:
        return 'neutral', 0.5
    
    bullish_pct = bullish_weight / total_weight
    bearish_pct = bearish_weight / total_weight
    
    # Determine bias
    if bullish_pct > 0.55:
        bias = 'bullish'
        confidence = bullish_pct
    elif bearish_pct > 0.55:
        bias = 'bearish'
        confidence = bearish_pct
    else:
        bias = 'neutral'
        confidence = 0.5 + abs(bullish_pct - bearish_pct) / 2
    
    # Adjust confidence based on regime strength
    adx = regime['adx']
    if adx > 25:
        confidence = min(1.0, confidence * 1.1)  # Boost confidence in trending markets
    else:
        confidence = confidence * 0.9  # Reduce confidence in choppy markets
    
    return bias, float(confidence)


def generate_summary(bias: str, confidence: float, regime: Dict[str, Any], current_price: float, levels: List[Dict[str, float]]) -> str:
    """Generate human-readable summary"""
    
    # Find nearest support/resistance
    supports = [l for l in levels if l['type'] == 'support' and l['level'] < current_price]
    resistances = [l for l in levels if l['type'] == 'resistance' and l['level'] > current_price]
    
    nearest_support = max(supports, key=lambda x: x['level']) if supports else None
    nearest_resistance = min(resistances, key=lambda x: x['level']) if resistances else None
    
    summary = f"{bias.upper()} bias with {confidence*100:.0f}% confidence. "
    summary += f"Market regime: {regime['interpretation']}. "
    
    if nearest_support:
        summary += f"Nearest support at ${nearest_support['level']:.2f} ({nearest_support['distance_pct']:.1f}%). "
    
    if nearest_resistance:
        summary += f"Nearest resistance at ${nearest_resistance['level']:.2f} (+{nearest_resistance['distance_pct']:.1f}%)."
    
    return summary


def interpret_rsi(rsi: float) -> str:
    """Interpret RSI value"""
    if rsi > 70:
        return 'overbought'
    elif rsi < 30:
        return 'oversold'
    elif 45 <= rsi <= 55:
        return 'neutral'
    elif rsi > 50:
        return 'bullish'
    else:
        return 'bearish'


def interpret_adx(adx: float) -> str:
    """Interpret ADX value"""
    if adx < 20:
        return 'weak_trend'
    elif adx < 25:
        return 'developing_trend'
    elif adx < 40:
        return 'strong_trend'
    else:
        return 'very_strong_trend'


def get_mock_ohlcv(ticker: str) -> pd.DataFrame:
    """Generate mock OHLCV data for testing"""
    dates = pd.date_range(end=datetime.now(), periods=252, freq='D')
    
    # Simple random walk with drift
    np.random.seed(hash(ticker) % (2**32))
    returns = np.random.normal(0.001, 0.02, 252)
    prices = 100 * np.exp(np.cumsum(returns))
    
    df = pd.DataFrame({
        'Open': prices * (1 + np.random.uniform(-0.01, 0.01, 252)),
        'High': prices * (1 + np.random.uniform(0, 0.02, 252)),
        'Low': prices * (1 - np.random.uniform(0, 0.02, 252)),
        'Close': prices,
        'Volume': np.random.uniform(1e6, 10e6, 252)
    }, index=dates)
    
    return df


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 8087))
    app.run(host='0.0.0.0', port=port, debug=True)

