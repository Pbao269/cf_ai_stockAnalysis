// Core Types for Stock Analysis Platform

export type AppMode = 'chat' | 'screener' | 'analysis';

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  score: number;
}

export interface ScreenerResult extends Stock {
  pe_ratio?: number;
  pb_ratio?: number;
  dividend_yield?: number;
  revenue_growth?: number;
  rationale: string;
  style_scores: {
    buffett?: number;
    lynch?: number;
    momentum?: number;
    deep_value?: number;
    dividend?: number;
  };
}

export interface StockAnalysis {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  marketCap: number;
  overview: AnalysisOverview;
  fundamentals: FundamentalsData;
  technical: TechnicalData;
  dcf: DCFData;
  dca: DCAData;
}

export interface AnalysisOverview {
  summary: string;
  bullPoints: string[];
  bearPoints: string[];
  keyRisks: string[];
  catalysts: Array<{
    event: string;
    date?: string;
    impact: 'low' | 'medium' | 'high';
  }>;
  week52High: number;
  week52Low: number;
  volume: number;
  avgVolume: number;
}

export interface FundamentalsData {
  pe_ratio?: number;
  pb_ratio?: number;
  ps_ratio?: number;
  roe?: number;
  roa?: number;
  debt_to_equity?: number;
  current_ratio?: number;
  gross_margin?: number;
  revenue_growth?: number;
  earnings_growth?: number;
  dividend_yield?: number;
}

export interface TechnicalData {
  trend: {
    short_term: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
    medium_term: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
    long_term: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
    strength: number;
  };
  indicators: {
    rsi: { value: number; signal: string; overbought: boolean; oversold: boolean };
    macd: { macd_line: number; signal_line: number; histogram: number; signal: string };
    sma_20?: number;
    sma_50?: number;
    sma_200?: number;
  };
  support_levels: number[];
  resistance_levels: number[];
  technical_score: number;
  technical_rating: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
}

export interface DCFData {
  fair_value: number;
  current_price: number;
  upside_downside: number;
  confidence_level: number;
  wacc: number;
  scenarios: {
    bull: { price: number; probability: number };
    base: { price: number; probability: number };
    bear: { price: number; probability: number };
  };
  key_drivers: string[];
  key_risks: string[];
}

export interface DCAData {
  recommended_strategy: string;
  frequency: string;
  entry_price_range: { low: number; high: number };
  strategies: Array<{
    name: string;
    total_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
  }>;
  risk_level: 'low' | 'medium' | 'high';
  position_size_recommendation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

export interface ScreenerFilters {
  sectors?: string[];
  market_cap_preference?: 'small' | 'mid' | 'large' | 'mega';
  pe_ratio?: { min?: number; max?: number };
  pb_ratio?: { min?: number; max?: number };
  dividend_yield?: { min?: number; max?: number };
  price?: { min?: number; max?: number };
  revenue_growth?: { min?: number };
  strategy?: 'growth' | 'value' | 'income' | 'momentum' | 'balanced';
}

