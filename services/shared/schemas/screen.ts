import { z } from 'zod';

/**
 * Metric comparison operators
 */
export const MetricOperator = z.enum([
  'gt',      // greater than
  'gte',     // greater than or equal
  'lt',      // less than
  'lte',     // less than or equal
  'eq',      // equal
  'ne',      // not equal
  'between', // between two values
  'in',      // in array of values
  'not_in'   // not in array of values
]);

/**
 * Metric rule for screening criteria
 */
export const MetricRule = z.strictObject({
  metric: z.string().min(1), // e.g., 'pe_ratio', 'market_cap', 'revenue_growth'
  operator: MetricOperator,
  value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]),
  weight: z.number().min(0).max(1).optional(), // importance weight for scoring
  description: z.string().optional()
});

/**
 * Style checklist for investment style validation
 */
export const StyleChecklist = z.strictObject({
  value_criteria: z.strictObject({
    pe_ratio_max: z.number().positive().optional(),
    pb_ratio_max: z.number().positive().optional(),
    peg_ratio_max: z.number().positive().optional(),
    dividend_yield_min: z.number().min(0).optional(),
    price_to_sales_max: z.number().positive().optional()
  }).optional(),
  
  growth_criteria: z.strictObject({
    revenue_growth_min: z.number().optional(),
    earnings_growth_min: z.number().optional(),
    eps_growth_min: z.number().optional(),
    sales_growth_min: z.number().optional(),
    peg_ratio_max: z.number().positive().optional()
  }).optional(),
  
  momentum_criteria: z.strictObject({
    price_momentum_3m_min: z.number().optional(),
    price_momentum_6m_min: z.number().optional(),
    price_momentum_12m_min: z.number().optional(),
    relative_strength_min: z.number().optional(),
    volume_trend: z.enum(['increasing', 'stable', 'decreasing']).optional()
  }).optional(),
  
  quality_criteria: z.strictObject({
    roe_min: z.number().optional(),
    roa_min: z.number().optional(),
    current_ratio_min: z.number().positive().optional(),
    debt_to_equity_max: z.number().min(0).optional(),
    interest_coverage_min: z.number().positive().optional(),
    credit_rating_min: z.string().optional()
  }).optional(),
  
  size_criteria: z.strictObject({
    market_cap_min: z.number().positive().optional(),
    market_cap_max: z.number().positive().optional(),
    float_min: z.number().positive().optional(),
    shares_outstanding_min: z.number().positive().optional()
  }).optional(),
  
  volatility_criteria: z.strictObject({
    beta_max: z.number().optional(),
    volatility_30d_max: z.number().min(0).optional(),
    volatility_90d_max: z.number().min(0).optional(),
    max_drawdown_max: z.number().min(0).optional()
  }).optional()
});

/**
 * Screen filters combining rules and style checks
 */
export const ScreenFilters = z.strictObject({
  rules: z.array(MetricRule).min(1),
  style_checklist: StyleChecklist.optional(),
  
  // Global filters
  sectors: z.array(z.string()).optional(),
  exclude_sectors: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  exchanges: z.array(z.string()).optional(),
  
  // Market filters
  market_cap_range: z.strictObject({
    min: z.number().positive().optional(),
    max: z.number().positive().optional()
  }).optional(),
  
  price_range: z.strictObject({
    min: z.number().positive().optional(),
    max: z.number().positive().optional()
  }).optional(),
  
  volume_range: z.strictObject({
    min: z.number().positive().optional(),
    max: z.number().positive().optional()
  }).optional(),
  
  // Exclusions
  exclude_penny_stocks: z.boolean().optional(),
  exclude_adrs: z.boolean().optional(),
  exclude_reits: z.boolean().optional(),
  exclude_etfs: z.boolean().optional(),
  exclude_closed_end_funds: z.boolean().optional(),
  exclude_otc: z.boolean().optional(),
  
  // Scoring and ranking
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  offset: z.number().int().min(0).optional()
});

/**
 * Screen hit result
 */
export const ScreenHit = z.strictObject({
  symbol: z.string().min(1),
  name: z.string().min(1),
  sector: z.string().optional(),
  industry: z.string().optional(),
  market_cap: z.number().positive().optional(),
  price: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  
  // Metrics that passed the screen
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  
  // Scoring information
  score: z.number().min(0).max(100).optional(),
  rank: z.number().int().positive().optional(),
  
  // Style classification
  style_scores: z.strictObject({
    value: z.number().min(0).max(100).optional(),
    growth: z.number().min(0).max(100).optional(),
    momentum: z.number().min(0).max(100).optional(),
    quality: z.number().min(0).max(100).optional(),
    size: z.number().min(0).max(100).optional(),
    volatility: z.number().min(0).max(100).optional()
  }).optional(),
  
  // Metadata
  last_updated: z.string().datetime().optional(),
  data_source: z.string().optional()
});

// Export inferred TypeScript types
export type MetricOperatorType = z.infer<typeof MetricOperator>;
export type MetricRuleType = z.infer<typeof MetricRule>;
export type StyleChecklistType = z.infer<typeof StyleChecklist>;
export type ScreenFiltersType = z.infer<typeof ScreenFilters>;
export type ScreenHitType = z.infer<typeof ScreenHit>;

// Export validation functions
export const validateScreenFilters = (data: unknown): ScreenFiltersType => {
  return ScreenFilters.parse(data);
};

export const validateScreenHit = (data: unknown): ScreenHitType => {
  return ScreenHit.parse(data);
};

export const validateScreenFiltersSafe = (data: unknown) => {
  return ScreenFilters.safeParse(data);
};

export const validateScreenHitSafe = (data: unknown) => {
  return ScreenHit.safeParse(data);
};

// Export partial schemas for updates
export const ScreenFiltersUpdate = ScreenFilters.partial();
export type ScreenFiltersUpdateType = z.infer<typeof ScreenFiltersUpdate>;
