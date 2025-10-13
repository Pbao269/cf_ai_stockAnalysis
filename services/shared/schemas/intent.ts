import { z } from 'zod';

/**
 * Investment objective types
 */
export const InvestmentObjective = z.enum([
  'growth',
  'income', 
  'balanced',
  'preservation',
  'speculation'
]);

/**
 * Risk tolerance levels
 */
export const RiskTolerance = z.enum([
  'conservative',
  'moderate',
  'aggressive',
  'very_aggressive'
]);

/**
 * Style weights for investment preferences
 */
export const StyleWeights = z.strictObject({
  value: z.number().min(0).max(1),
  growth: z.number().min(0).max(1),
  momentum: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  size: z.number().min(0).max(1),
  volatility: z.number().min(0).max(1),
}).refine(data => Object.values(data).reduce((sum, weight) => sum + weight, 0) === 1, {
  message: "Style weights must sum to 1",
  path: ["style_weights"],
});

/**
 * Investment gates/filters
 */
export const InvestmentGates = z.strictObject({
  min_market_cap: z.number().positive().optional(),
  max_market_cap: z.number().positive().optional(),
  min_volume: z.number().positive().optional(),
  sectors: z.array(z.string()).optional(),
  exclude_sectors: z.array(z.string()).optional(),
  min_dividend_yield: z.number().min(0).optional(),
  max_pe_ratio: z.number().positive().optional(),
  exclude_penny_stocks: z.boolean().optional(),
  max_price: z.number().positive().optional(),
}).refine(data => !data.min_market_cap || !data.max_market_cap || data.min_market_cap <= data.max_market_cap, {
  message: "Min market cap cannot be greater than max market cap",
  path: ["min_market_cap"],
});

/**
 * Investment Intent - parsed from natural language
 */
export const Intent = z.strictObject({
  objective: InvestmentObjective,
  risk_tolerance: RiskTolerance,
  horizon_years: z.number().int().min(1).max(50),
  style_weights: StyleWeights,
  gates: InvestmentGates.optional(),
  
  // Source indicator to distinguish AI vs fallback responses
  source: z.enum(['AI', 'Fallback']).optional(),
  
  // Optional metadata
  user_id: z.string().uuid().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type InvestmentObjectiveType = z.infer<typeof InvestmentObjective>;
export type RiskToleranceType = z.infer<typeof RiskTolerance>;
export type StyleWeightsType = z.infer<typeof StyleWeights>;
export type InvestmentGatesType = z.infer<typeof InvestmentGates>;
export type IntentType = z.infer<typeof Intent>;

// Validation functions
export const validateIntent = (data: unknown): IntentType => {
  return Intent.parse(data);
};

export const validateIntentSafe = (data: unknown) => {
  return Intent.safeParse(data);
};

/**
 * Simplified intent for screener service integration
 */
export const SimplifiedIntent = z.strictObject({
  strategy: z.enum(['growth', 'value', 'income', 'momentum', 'balanced']),
  sectors: z.array(z.string()).optional(),
  market_cap_preference: z.enum(['small', 'mid', 'large', 'mega']).optional(),
  dividend_preference: z.enum(['none', 'low', 'moderate', 'high']).optional(),
  price_max: z.number().positive().optional(),
  risk_tolerance: RiskTolerance,
  horizon_years: z.number().int().min(1).max(50),
});

export type SimplifiedIntentType = z.infer<typeof SimplifiedIntent>;

/**
 * Convert full Intent to SimplifiedIntent for screener service
 */
export function convertIntentToSimplified(intent: IntentType): SimplifiedIntentType {
  // Map objective to strategy
  const strategyMap: Record<InvestmentObjectiveType, 'growth' | 'value' | 'income' | 'momentum' | 'balanced'> = {
    'growth': 'growth',
    'income': 'income',
    'preservation': 'value',
    'speculation': 'momentum',
    'balanced': 'balanced'
  };

  // Map style weights to market cap preference
  let marketCapPreference: 'small' | 'mid' | 'large' | 'mega' | undefined;
  if (intent.style_weights.size > 30) {
    marketCapPreference = 'small';
  } else if (intent.style_weights.size > 20) {
    marketCapPreference = 'mid';
  } else if (intent.style_weights.size > 10) {
    marketCapPreference = 'large';
  } else {
    marketCapPreference = 'mega';
  }

  // Map gates to dividend preference
  let dividendPreference: 'none' | 'low' | 'moderate' | 'high' | undefined;
  if (intent.gates?.min_dividend_yield) {
    const dividendYield = intent.gates.min_dividend_yield;
    if (dividendYield > 0.04) dividendPreference = 'high';
    else if (dividendYield > 0.025) dividendPreference = 'moderate';
    else if (dividendYield > 0.015) dividendPreference = 'low';
    else dividendPreference = 'none';
  }

  return {
    strategy: strategyMap[intent.objective],
    sectors: intent.gates?.sectors,
    market_cap_preference: marketCapPreference,
    dividend_preference: dividendPreference,
    price_max: intent.gates?.max_price,
    risk_tolerance: intent.risk_tolerance,
    horizon_years: intent.horizon_years
  };
}
