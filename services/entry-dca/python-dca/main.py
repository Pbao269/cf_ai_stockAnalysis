"""
Entry & DCA Strategy Backtesting Service - Production Implementation

Implements and backtests 5 DCA strategies:
1. Lump-sum (baseline)
2. Fixed-interval DCA (weekly/monthly)
3. ATR-weighted DCA
4. Drawdown-tiered DCA
5. Fibonacci scale-in DCA

Returns comprehensive metrics: CAGR, volatility, max drawdown, MAR ratio, time under water
"""

import logging
from flask import Flask, request, jsonify
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
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
        'service': 'entry-dca',
        'version': '1.0.0',
        'status': 'running',
        'description': 'DCA strategy backtesting with 5 strategies',
        'strategies': ['lump_sum', 'fixed_dca', 'atr_weighted', 'drawdown_tiered', 'fibonacci_scalein'],
        'endpoints': {
            'health': '/health',
            'backtest': '/backtest (POST)'
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


@app.route('/backtest', methods=['POST'])
def backtest():
    """
    Backtest DCA strategies
    
    Request: {
        "ticker": "AAPL",
        "capital": 10000,
        "period": "1y",
        "risk_tolerance": "moderate"
    }
    Response: Backtested strategies with metrics and recommendation
    """
    try:
        data = request.json
        ticker = data.get('ticker', '').upper()
        capital = float(data.get('capital', 10000))
        period = data.get('period', '1y')
        risk_tolerance = data.get('risk_tolerance', 'moderate')  # conservative, moderate, aggressive
        
        if not ticker:
            return jsonify({'success': False, 'error': 'Ticker required'}), 400
        
        if capital <= 0:
            return jsonify({'success': False, 'error': 'Capital must be positive'}), 400
        
        logger.info(f"Backtesting {ticker} with ${capital} over {period}")
        
        # Fetch OHLCV data
        df = fetch_ohlcv(ticker, period)
        
        if df is None or len(df) < 20:
            return jsonify({
                'success': False,
                'error': 'Insufficient data for backtesting (need at least 20 bars)'
            }), 400
        
        # Run all strategies
        strategies_results = run_all_strategies(df, capital)
        
        # Rank strategies
        ranked = rank_strategies(strategies_results, risk_tolerance)
        
        # Generate recommendation
        recommendation = generate_recommendation(ranked, risk_tolerance, df, capital)
        
        result = {
            'ticker': ticker,
            'capital': capital,
            'period': period,
            'risk_tolerance': risk_tolerance,
            'backtest_period': {
                'start': df.index[0].isoformat(),
                'end': df.index[-1].isoformat(),
                'days': len(df)
            },
            'strategies': ranked,
            'recommendation': recommendation,
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Backtest error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc() if app.debug else None
        }), 500


def fetch_ohlcv(ticker: str, period: str = '1y') -> Optional[pd.DataFrame]:
    """Fetch OHLCV data from yfinance"""
    if not YFINANCE_AVAILABLE:
        return get_mock_ohlcv(ticker, period)
    
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval='1d')
        
        if df.empty:
            logger.warning(f"No data for {ticker}, using mock")
            return get_mock_ohlcv(ticker, period)
        
        logger.info(f"Fetched {len(df)} bars for {ticker}")
        return df
        
    except Exception as e:
        logger.error(f"yfinance error: {e}, using mock")
        return get_mock_ohlcv(ticker, period)


def run_all_strategies(df: pd.DataFrame, capital: float) -> List[Dict[str, Any]]:
    """Run all 5 DCA strategies"""
    
    results = []
    
    # Strategy 1: Lump-sum (baseline)
    results.append(backtest_lump_sum(df, capital))
    
    # Strategy 2: Fixed-interval DCA (weekly)
    results.append(backtest_fixed_dca(df, capital, interval='weekly'))
    
    # Strategy 3: Fixed-interval DCA (monthly)
    results.append(backtest_fixed_dca(df, capital, interval='monthly'))
    
    # Strategy 4: ATR-weighted DCA
    results.append(backtest_atr_weighted(df, capital))
    
    # Strategy 5: Drawdown-tiered DCA
    results.append(backtest_drawdown_tiered(df, capital))
    
    # Strategy 6: Fibonacci scale-in
    results.append(backtest_fibonacci_scalein(df, capital))
    
    return results


def backtest_lump_sum(df: pd.DataFrame, capital: float) -> Dict[str, Any]:
    """Strategy 1: Lump-sum buy on day 0"""
    
    entry_price = df['Close'].iloc[0]
    shares = capital / entry_price
    
    portfolio_values = df['Close'] * shares
    
    metrics = calculate_metrics(portfolio_values, capital)
    
    return {
        'name': 'Lump Sum',
        'strategy_id': 'lump_sum',
        'description': 'Buy all shares on day zero',
        'metrics': metrics,
        'trades': 1,
        'avg_entry_price': entry_price
    }


def backtest_fixed_dca(df: pd.DataFrame, capital: float, interval: str = 'weekly') -> Dict[str, Any]:
    """Strategy 2: Fixed-interval DCA (weekly or monthly)"""
    
    # Determine buy days
    if interval == 'weekly':
        buy_days = list(range(0, len(df), 5))  # Every 5 trading days ~= weekly
        name = 'Fixed DCA (Weekly)'
    else:  # monthly
        buy_days = list(range(0, len(df), 21))  # Every 21 trading days ~= monthly
        name = 'Fixed DCA (Monthly)'
    
    if len(buy_days) == 0:
        buy_days = [0]
    
    amount_per_buy = capital / len(buy_days)
    
    shares = 0
    total_spent = 0
    portfolio_values = []
    
    for i in range(len(df)):
        if i in buy_days and total_spent < capital:
            buy_amount = min(amount_per_buy, capital - total_spent)
            shares += buy_amount / df['Close'].iloc[i]
            total_spent += buy_amount
        
        portfolio_values.append(shares * df['Close'].iloc[i])
    
    portfolio_values = pd.Series(portfolio_values, index=df.index)
    metrics = calculate_metrics(portfolio_values, capital)
    
    avg_entry_price = total_spent / shares if shares > 0 else 0
    
    return {
        'name': name,
        'strategy_id': f'fixed_dca_{interval}',
        'description': f'Equal amounts every {interval}',
        'metrics': metrics,
        'trades': len(buy_days),
        'avg_entry_price': avg_entry_price
    }


def backtest_atr_weighted(df: pd.DataFrame, capital: float) -> Dict[str, Any]:
    """Strategy 3: ATR-weighted DCA (buy more when volatility is low)"""
    
    # Calculate ATR
    atr = calculate_atr(df)
    
    # Inverse ATR for weighting (lower ATR = higher weight)
    atr_inv = 1 / (atr + 0.01)  # Add small constant to avoid division by zero
    
    # Normalize weights
    weights = atr_inv / atr_inv.sum()
    
    shares = 0
    total_spent = 0
    portfolio_values = []
    
    for i in range(len(df)):
        buy_amount = capital * weights.iloc[i]
        
        if total_spent < capital:
            actual_buy = min(buy_amount, capital - total_spent)
            shares += actual_buy / df['Close'].iloc[i]
            total_spent += actual_buy
        
        portfolio_values.append(shares * df['Close'].iloc[i])
    
    portfolio_values = pd.Series(portfolio_values, index=df.index)
    metrics = calculate_metrics(portfolio_values, capital)
    
    avg_entry_price = total_spent / shares if shares > 0 else 0
    
    return {
        'name': 'ATR-Weighted DCA',
        'strategy_id': 'atr_weighted',
        'description': 'Buy more when volatility (ATR) is low',
        'metrics': metrics,
        'trades': len(df),
        'avg_entry_price': avg_entry_price
    }


def backtest_drawdown_tiered(df: pd.DataFrame, capital: float) -> Dict[str, Any]:
    """Strategy 4: Drawdown-tiered DCA (buy more at -10/-20/-30% dips)"""
    
    # Start with small position
    initial_buy = capital * 0.2
    shares = initial_buy / df['Close'].iloc[0]
    total_spent = initial_buy
    
    peak_price = df['Close'].iloc[0]
    portfolio_values = []
    
    # Allocation tiers
    tier_10_allocation = capital * 0.25  # 25% at -10%
    tier_20_allocation = capital * 0.30  # 30% at -20%
    tier_30_allocation = capital * 0.25  # 25% at -30%
    
    tier_10_used = 0
    tier_20_used = 0
    tier_30_used = 0
    
    for i in range(len(df)):
        current_price = df['Close'].iloc[i]
        
        # Update peak
        if current_price > peak_price:
            peak_price = current_price
        
        # Calculate drawdown
        drawdown = (current_price - peak_price) / peak_price
        
        # Buy on dips
        if drawdown <= -0.30 and tier_30_used < tier_30_allocation:
            buy_amount = min(tier_30_allocation - tier_30_used, capital - total_spent)
            if buy_amount > 0:
                shares += buy_amount / current_price
                total_spent += buy_amount
                tier_30_used += buy_amount
        
        elif drawdown <= -0.20 and tier_20_used < tier_20_allocation:
            buy_amount = min(tier_20_allocation - tier_20_used, capital - total_spent)
            if buy_amount > 0:
                shares += buy_amount / current_price
                total_spent += buy_amount
                tier_20_used += buy_amount
        
        elif drawdown <= -0.10 and tier_10_used < tier_10_allocation:
            buy_amount = min(tier_10_allocation - tier_10_used, capital - total_spent)
            if buy_amount > 0:
                shares += buy_amount / current_price
                total_spent += buy_amount
                tier_10_used += buy_amount
        
        portfolio_values.append(shares * current_price)
    
    portfolio_values = pd.Series(portfolio_values, index=df.index)
    metrics = calculate_metrics(portfolio_values, capital)
    
    avg_entry_price = total_spent / shares if shares > 0 else 0
    trades = 1 + (tier_10_used > 0) + (tier_20_used > 0) + (tier_30_used > 0)
    
    return {
        'name': 'Drawdown-Tiered DCA',
        'strategy_id': 'drawdown_tiered',
        'description': 'Buy more at -10%/-20%/-30% dips',
        'metrics': metrics,
        'trades': trades,
        'avg_entry_price': avg_entry_price
    }


def backtest_fibonacci_scalein(df: pd.DataFrame, capital: float) -> Dict[str, Any]:
    """Strategy 5: Fibonacci scale-in (0.382/0.618 weighting across correction)"""
    
    # Identify correction period (first 50% of data)
    correction_end = len(df) // 2
    
    # Fibonacci allocation weights
    fib_382_allocation = capital * 0.382
    fib_618_allocation = capital * 0.618
    
    shares = 0
    total_spent = 0
    portfolio_values = []
    
    fib_382_spent = 0
    fib_618_spent = 0
    
    for i in range(len(df)):
        current_price = df['Close'].iloc[i]
        
        # First 38.2% of correction period - lighter buying
        if i < correction_end * 0.382 and fib_382_spent < fib_382_allocation:
            buy_amount = min(
                fib_382_allocation / (correction_end * 0.382),
                fib_382_allocation - fib_382_spent,
                capital - total_spent
            )
            if buy_amount > 0:
                shares += buy_amount / current_price
                total_spent += buy_amount
                fib_382_spent += buy_amount
        
        # Next 61.8% of correction period - heavier buying
        elif correction_end * 0.382 <= i < correction_end and fib_618_spent < fib_618_allocation:
            buy_amount = min(
                fib_618_allocation / (correction_end * 0.618),
                fib_618_allocation - fib_618_spent,
                capital - total_spent
            )
            if buy_amount > 0:
                shares += buy_amount / current_price
                total_spent += buy_amount
                fib_618_spent += buy_amount
        
        portfolio_values.append(shares * current_price)
    
    portfolio_values = pd.Series(portfolio_values, index=df.index)
    metrics = calculate_metrics(portfolio_values, capital)
    
    avg_entry_price = total_spent / shares if shares > 0 else 0
    
    return {
        'name': 'Fibonacci Scale-In',
        'strategy_id': 'fibonacci_scalein',
        'description': 'Scale in with 38.2%/61.8% Fibonacci weighting',
        'metrics': metrics,
        'trades': correction_end,
        'avg_entry_price': avg_entry_price
    }


def calculate_metrics(portfolio_values: pd.Series, initial_capital: float) -> Dict[str, float]:
    """Calculate comprehensive performance metrics"""
    
    final_value = portfolio_values.iloc[-1]
    total_return = (final_value - initial_capital) / initial_capital
    
    # Calculate CAGR
    years = len(portfolio_values) / 252  # Assuming 252 trading days per year
    cagr = (final_value / initial_capital) ** (1 / years) - 1 if years > 0 else 0
    
    # Calculate volatility (annualized)
    returns = portfolio_values.pct_change().dropna()
    volatility = returns.std() * np.sqrt(252)
    
    # Calculate maximum drawdown
    peak = portfolio_values.expanding(min_periods=1).max()
    drawdown = (portfolio_values - peak) / peak
    max_drawdown = drawdown.min()
    
    # Calculate MAR ratio (CAGR / abs(max_drawdown))
    mar_ratio = cagr / abs(max_drawdown) if max_drawdown < 0 else cagr * 10
    
    # Calculate time under water (% of time below previous peak)
    under_water = (portfolio_values < peak).sum() / len(portfolio_values)
    
    # Sharpe ratio (assuming 4% risk-free rate)
    excess_returns = returns - (0.04 / 252)
    sharpe_ratio = (excess_returns.mean() / excess_returns.std()) * np.sqrt(252) if excess_returns.std() > 0 else 0
    
    return {
        'final_value': float(final_value),
        'total_return': float(total_return),
        'total_return_pct': float(total_return * 100),
        'cagr': float(cagr),
        'cagr_pct': float(cagr * 100),
        'volatility': float(volatility),
        'volatility_pct': float(volatility * 100),
        'max_drawdown': float(max_drawdown),
        'max_drawdown_pct': float(max_drawdown * 100),
        'mar_ratio': float(mar_ratio),
        'time_under_water': float(under_water),
        'time_under_water_pct': float(under_water * 100),
        'sharpe_ratio': float(sharpe_ratio)
    }


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculate Average True Range"""
    high = df['High']
    low = df['Low']
    close = df['Close']
    
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    
    # Fill initial NaN values with first valid value
    atr = atr.fillna(method='bfill')
    
    return atr


def rank_strategies(strategies: List[Dict[str, Any]], risk_tolerance: str) -> List[Dict[str, Any]]:
    """Rank strategies based on risk tolerance"""
    
    # Define weighting based on risk tolerance
    if risk_tolerance == 'conservative':
        weights = {
            'mar_ratio': 0.3,
            'max_drawdown': 0.3,  # Lower is better (negative values)
            'sharpe_ratio': 0.2,
            'cagr': 0.2
        }
    elif risk_tolerance == 'aggressive':
        weights = {
            'cagr': 0.4,
            'total_return': 0.3,
            'mar_ratio': 0.2,
            'sharpe_ratio': 0.1
        }
    else:  # moderate
        weights = {
            'mar_ratio': 0.35,
            'cagr': 0.25,
            'sharpe_ratio': 0.25,
            'max_drawdown': 0.15
        }
    
    # Calculate composite scores
    for strategy in strategies:
        m = strategy['metrics']
        
        # Normalize metrics (higher is better)
        score = 0
        score += weights.get('mar_ratio', 0) * min(m['mar_ratio'], 10) / 10
        score += weights.get('cagr', 0) * max(0, min(m['cagr'], 1))
        score += weights.get('sharpe_ratio', 0) * max(0, min(m['sharpe_ratio'], 3)) / 3
        score += weights.get('max_drawdown', 0) * (1 + max(-1, m['max_drawdown']))  # Convert negative to 0-1
        score += weights.get('total_return', 0) * max(0, min(m['total_return'], 2)) / 2
        
        strategy['score'] = float(score)
        strategy['rank'] = 0  # Will be set below
    
    # Sort by score
    strategies.sort(key=lambda x: x['score'], reverse=True)
    
    # Assign ranks
    for i, strategy in enumerate(strategies):
        strategy['rank'] = i + 1
    
    return strategies


def generate_recommendation(strategies: List[Dict[str, Any]], risk_tolerance: str, df: pd.DataFrame, capital: float) -> Dict[str, Any]:
    """Generate human-readable recommendation"""
    
    best_strategy = strategies[0]
    
    # Calculate implementation plan
    plan = generate_implementation_plan(best_strategy, df, capital)
    
    return {
        'best_strategy': {
            'name': best_strategy['name'],
            'strategy_id': best_strategy['strategy_id'],
            'reason': f"Best {risk_tolerance} strategy with MAR ratio of {best_strategy['metrics']['mar_ratio']:.2f}"
        },
        'expected_metrics': {
            'return': f"{best_strategy['metrics']['total_return_pct']:.1f}%",
            'cagr': f"{best_strategy['metrics']['cagr_pct']:.1f}%",
            'max_drawdown': f"{best_strategy['metrics']['max_drawdown_pct']:.1f}%",
            'sharpe_ratio': f"{best_strategy['metrics']['sharpe_ratio']:.2f}"
        },
        'implementation_plan': plan,
        'alternative': {
            'name': strategies[1]['name'] if len(strategies) > 1 else None,
            'reason': f"Second best with score {strategies[1]['score']:.3f}" if len(strategies) > 1 else None
        }
    }


def generate_implementation_plan(strategy: Dict[str, Any], df: pd.DataFrame, capital: float) -> str:
    """Generate human-readable implementation plan"""
    
    strategy_id = strategy['strategy_id']
    current_price = df['Close'].iloc[-1]
    
    if strategy_id == 'lump_sum':
        shares = capital / current_price
        return f"Buy {shares:.2f} shares immediately at current price ${current_price:.2f} (total: ${capital:,.2f})"
    
    elif 'fixed_dca_weekly' in strategy_id:
        weeks = 12  # 3 months
        amount_per_week = capital / weeks
        shares_per_week = amount_per_week / current_price
        return f"Buy {shares_per_week:.2f} shares every week for {weeks} weeks (${amount_per_week:,.2f} per week)"
    
    elif 'fixed_dca_monthly' in strategy_id:
        months = 6
        amount_per_month = capital / months
        shares_per_month = amount_per_month / current_price
        return f"Buy {shares_per_month:.2f} shares every month for {months} months (${amount_per_month:,.2f} per month)"
    
    elif strategy_id == 'atr_weighted':
        return f"Monitor ATR volatility daily. Buy more when ATR is below average (lower volatility = higher allocation). Total budget: ${capital:,.2f}"
    
    elif strategy_id == 'drawdown_tiered':
        return f"Initial buy: ${capital*0.2:,.2f} now. Then buy ${capital*0.25:,.2f} at -10% dip, ${capital*0.30:,.2f} at -20%, ${capital*0.25:,.2f} at -30%"
    
    elif strategy_id == 'fibonacci_scalein':
        correction_days = 60  # Assume 60-day correction
        fib_382_amount = capital * 0.382
        fib_618_amount = capital * 0.618
        return f"Scale in over {correction_days} days: ${fib_382_amount:,.2f} in first 23 days (lighter), ${fib_618_amount:,.2f} in next 37 days (heavier)"
    
    return "Custom implementation required"


def get_mock_ohlcv(ticker: str, period: str = '1y') -> pd.DataFrame:
    """Generate mock OHLCV data for testing"""
    
    # Determine number of days
    period_days = {
        '1mo': 21,
        '3mo': 63,
        '6mo': 126,
        '1y': 252,
        '2y': 504,
        '5y': 1260
    }
    days = period_days.get(period, 252)
    
    dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
    
    # Simple random walk with drift
    np.random.seed(hash(ticker) % (2**32))
    returns = np.random.normal(0.0005, 0.02, days)
    prices = 100 * np.exp(np.cumsum(returns))
    
    df = pd.DataFrame({
        'Open': prices * (1 + np.random.uniform(-0.01, 0.01, days)),
        'High': prices * (1 + np.random.uniform(0, 0.02, days)),
        'Low': prices * (1 - np.random.uniform(0, 0.02, days)),
        'Close': prices,
        'Volume': np.random.uniform(1e6, 10e6, days)
    }, index=dates)
    
    return df


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 8088))
    app.run(host='0.0.0.0', port=port, debug=True)

