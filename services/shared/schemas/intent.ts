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
 * Investment style weights (must sum to 1.0)
 */
export const StyleWeights = z.strictObject({
  value: z.number().min(0).max(1),
  growth: z.number().min(0).max(1),
  momentum: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  size: z.number().min(0).max(1),
  volatility: z.number().min(0).max(1)
}).refine(
  (weights) => {
    const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
    return Math.abs(sum - 1.0) < 0.001; // Allow for floating point precision
  },
  {
    message: "Style weights must sum to 1.0"
  }
);

/**
 * Investment gates/criteria for filtering
 */
export const InvestmentGates = z.strictObject({
  min_market_cap: z.number().positive().optional(),
  max_market_cap: z.number().positive().optional(),
  min_volume: z.number().positive().optional(),
  min_price: z.number().positive().optional(),
  max_price: z.number().positive().optional(),
  sectors: z.array(z.string()).optional(),
  exclude_sectors: z.array(z.string()).optional(),
  min_dividend_yield: z.number().min(0).optional(),
  max_pe_ratio: z.number().positive().optional(),
  min_roe: z.number().optional(),
  min_revenue_growth: z.number().optional(),
  max_debt_to_equity: z.number().min(0).optional(),
  min_current_ratio: z.number().positive().optional(),
  esg_score_min: z.number().min(0).max(100).optional(),
  exclude_penny_stocks: z.boolean().optional(),
  exclude_adrs: z.boolean().optional(),
  exclude_reits: z.boolean().optional(),
  exclude_etfs: z.boolean().optional()
}).refine(
  (gates) => {
    if (gates.min_market_cap && gates.max_market_cap) {
      return gates.min_market_cap <= gates.max_market_cap;
    }
    if (gates.min_price && gates.max_price) {
      return gates.min_price <= gates.max_price;
    }
    return true;
  },
  {
    message: "Min values must be less than or equal to max values"
  }
);

/**
 * Main Intent schema for investment analysis
 */
export const Intent = z.strictObject({
  objective: InvestmentObjective,
  risk_tolerance: RiskTolerance,
  horizon_years: z.number().int().min(1).max(50),
  style_weights: StyleWeights,
  gates: InvestmentGates,
  // Optional metadata
  user_id: z.string().uuid().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

// Export inferred TypeScript types
export type InvestmentObjectiveType = z.infer<typeof InvestmentObjective>;
export type RiskToleranceType = z.infer<typeof RiskTolerance>;
export type StyleWeightsType = z.infer<typeof StyleWeights>;
export type InvestmentGatesType = z.infer<typeof InvestmentGates>;
export type IntentType = z.infer<typeof Intent>;

// Export validation functions
export const validateIntent = (data: unknown): IntentType => {
  return Intent.parse(data);
};

export const validateIntentSafe = (data: unknown) => {
  return Intent.safeParse(data);
};

// Export partial schemas for updates
export const IntentUpdate = Intent.partial();
export type IntentUpdateType = z.infer<typeof IntentUpdate>;
