import { z } from 'zod';

// =============================================================================
// CORE SCHEMAS FOR MVP STOCK ANALYSIS PLATFORM
// =============================================================================

/**
 * Investment Intent - parsed from natural language
 */
export const InvestmentIntent = z.strictObject({
  objective: z.enum(['growth', 'income', 'balanced', 'preservation']),
  risk_tolerance: z.enum(['conservative', 'moderate', 'aggressive']),
  horizon_years: z.number().int().min(1).max(30),
  sectors: z.array(z.string()).optional(),
  max_price: z.number().positive().optional(),
  min_market_cap: z.number().positive().optional(),
  filters: z.record(z.string(), z.any()).optional() // Additional parsed filters
});

export type InvestmentIntentType = z.infer<typeof InvestmentIntent>;

/**
 * Screener Result - top 5 stocks from FinViz
 */
export const ScreenerResult = z.strictObject({
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  market_cap: z.number().positive(),
  price: z.number().positive(),
  pe_ratio: z.number().optional(),
  revenue_growth: z.number().optional(),
  score: z.number().min(0).max(100),
  rationale: z.string()
});

export const ScreenerResults = z.strictObject({
  query: z.string(), // Original user query
  results: z.array(ScreenerResult).max(5),
  generated_at: z.string().datetime()
});

export type ScreenerResultType = z.infer<typeof ScreenerResult>;
export type ScreenerResultsType = z.infer<typeof ScreenerResults>;

/**
 * Stock Analysis - comprehensive analysis for one stock
 */
export const StockAnalysis = z.strictObject({
  symbol: z.string(),
  name: z.string(),
  
  // Basic info
  current_price: z.number().positive(),
  market_cap: z.number().positive(),
  sector: z.string(),
  
  // Fundamentals (from yfinance)
  fundamentals: z.strictObject({
    pe_ratio: z.number().optional(),
    pb_ratio: z.number().optional(),
    debt_to_equity: z.number().optional(),
    roe: z.number().optional(),
    revenue_growth: z.number().optional(),
    earnings_growth: z.number().optional(),
    dividend_yield: z.number().optional()
  }),
  
  // DCF Analysis
  dcf: z.strictObject({
    fair_value: z.number().positive(),
    upside_downside: z.number(), // percentage
    assumptions: z.strictObject({
      growth_rate: z.number(),
      discount_rate: z.number(),
      terminal_growth: z.number()
    })
  }),
  
  // Bull/Bear thesis
  bull_points: z.array(z.string()),
  bear_points: z.array(z.string()),
  
  // Catalysts
  catalysts: z.array(z.strictObject({
    event: z.string(),
    date: z.string().optional(),
    impact: z.enum(['low', 'medium', 'high'])
  })),
  
  // Technical analysis
  technicals: z.strictObject({
    trend: z.enum(['bullish', 'bearish', 'neutral']),
    support_levels: z.array(z.number()),
    resistance_levels: z.array(z.number()),
    rsi: z.number().optional(),
    recommendation: z.enum(['buy', 'hold', 'sell'])
  }),
  
  // Entry strategy
  entry_strategy: z.strictObject({
    recommended_action: z.enum(['buy_now', 'wait_for_dip', 'dca', 'avoid']),
    target_price: z.number().optional(),
    stop_loss: z.number().optional(),
    reasoning: z.string()
  }),
  
  generated_at: z.string().datetime(),
  disclaimer: z.string().default("AI-generated analysis, not investment advice")
});

export type StockAnalysisType = z.infer<typeof StockAnalysis>;

/**
 * API Response wrapper
 */
export const ApiResponse = z.strictObject({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime()
});

export type ApiResponseType = z.infer<typeof ApiResponse>;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export const validateIntent = (data: unknown): InvestmentIntentType => {
  return InvestmentIntent.parse(data);
};

export const validateScreenerResults = (data: unknown): ScreenerResultsType => {
  return ScreenerResults.parse(data);
};

export const validateStockAnalysis = (data: unknown): StockAnalysisType => {
  return StockAnalysis.parse(data);
};

export const validateApiResponse = (data: unknown): ApiResponseType => {
  return ApiResponse.parse(data);
};