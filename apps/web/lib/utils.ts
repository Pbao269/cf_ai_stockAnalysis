import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

export function formatCurrency(num: number, decimals: number = 2): string {
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatMarketCap(num: number): string {
  if (num >= 1e12) {
    return `$${(num / 1e12).toFixed(2)}T`;
  } else if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`;
  }
  return `$${num.toLocaleString()}`;
}

export function formatVolume(num: number): string {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  return num.toLocaleString();
}

export function formatPercentage(num: number, decimals: number = 2): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(decimals)}%`;
}

export function getChangeColor(change: number): string {
  if (change > 0) return 'text-success-600 dark:text-success-400';
  if (change < 0) return 'text-error-600 dark:text-error-400';
  return 'text-gray-600 dark:text-gray-400';
}

export function getTrendColor(trend: string): string {
  switch (trend.toLowerCase()) {
    case 'very_bullish':
    case 'bullish':
      return 'text-success-600 dark:text-success-400';
    case 'very_bearish':
    case 'bearish':
      return 'text-error-600 dark:text-error-400';
    case 'neutral':
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function getTrendBadgeColor(trend: string): string {
  switch (trend.toLowerCase()) {
    case 'very_bullish':
      return 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200';
    case 'bullish':
      return 'bg-success-50 text-success-700 dark:bg-success-900/50 dark:text-success-300';
    case 'very_bearish':
      return 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-200';
    case 'bearish':
      return 'bg-error-50 text-error-700 dark:bg-error-900/50 dark:text-error-300';
    case 'neutral':
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function classifyInput(input: string): 'ticker' | 'intent' {
  const trimmedInput = input.trim().toUpperCase();
  
  // Known ticker patterns
  const tickerPattern = /^[A-Z]{1,5}$/;
  const tickerWithAnalysis = /^[A-Z]{1,5}\s+(analysis|analyze|analysis|price|chart|technical|fundamental)$/i;
  
  // Common ticker symbols (major stocks)
  const commonTickers = new Set([
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC',
    'CRM', 'ADBE', 'PYPL', 'UBER', 'LYFT', 'SQ', 'ROKU', 'ZM', 'PTON', 'DOCU',
    'SPOT', 'TWTR', 'SNAP', 'PINS', 'SQ', 'SHOP', 'OKTA', 'CRWD', 'ZS', 'NET',
    'SNOW', 'PLTR', 'RBLX', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'UPST', 'OPEN', 'Z',
    'BRK.A', 'BRK.B', 'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'V', 'MA',
    'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN',
    'KO', 'PEP', 'WMT', 'PG', 'JNJ', 'HD', 'DIS', 'NKE', 'MCD', 'SBUX'
  ]);
  
  // Direct ticker analysis patterns
  if (tickerWithAnalysis.test(trimmedInput)) {
    return 'ticker';
  }
  
  // Pure ticker symbol (1-5 uppercase letters)
  if (tickerPattern.test(trimmedInput)) {
    // Additional validation: check if it's a known ticker or looks like one
    if (commonTickers.has(trimmedInput) || 
        (trimmedInput.length >= 2 && trimmedInput.length <= 5 && 
         /^[A-Z]+$/.test(trimmedInput))) {
      return 'ticker';
    }
  }
  
  // Intent patterns (natural language queries)
  const intentKeywords = [
    'find', 'search', 'look for', 'show me', 'recommend', 'suggest',
    'undervalued', 'overvalued', 'growth', 'value', 'dividend', 'momentum',
    'stocks', 'companies', 'sector', 'industry', 'portfolio', 'invest',
    'best', 'top', 'cheap', 'expensive', 'high', 'low', 'buy', 'sell',
    'analysis', 'research', 'screening', 'filter', 'criteria', 'metrics',
    'pe ratio', 'pb ratio', 'roe', 'roa', 'debt', 'revenue', 'earnings',
    'tech', 'healthcare', 'finance', 'energy', 'consumer', 'industrial',
    'small cap', 'mid cap', 'large cap', 'mega cap', 'blue chip'
  ];
  
  const lowerInput = input.toLowerCase();
  const hasIntentKeywords = intentKeywords.some(keyword => 
    lowerInput.includes(keyword)
  );
  
  // If it contains intent keywords, classify as intent
  if (hasIntentKeywords) {
    return 'intent';
  }
  
  // If it's a short string that could be a ticker, but not clearly intent
  if (trimmedInput.length <= 5 && /^[A-Z]+$/.test(trimmedInput)) {
    return 'ticker';
  }
  
  // Default to intent for longer, more complex queries
  return 'intent';
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

