import { z } from 'zod';

/**
 * Metric rule for screening
 */
export const MetricRule = z.strictObject({
  metric: z.string().min(1),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'between', 'in', 'not_in']),
  value: z.union([z.number(), z.string(), z.array(z.number()), z.array(z.string())]),
  weight: z.number().min(0).max(1).optional(),
  description: z.string().optional(),
});

/**
 * Style checklist for screening
 */
export const StyleChecklist = z.strictObject({
  value_criteria: z.strictObject({
    pe_ratio_max: z.number().positive().optional(),
    pb_ratio_max: z.number().positive().optional(),
    dividend_yield_min: z.number().min(0).optional(),
  }).optional(),
  
  growth_criteria: z.strictObject({
    revenue_growth_min: z.number().min(0).optional(),
    earnings_growth_min: z.number().min(0).optional(),
  }).optional(),
  
  momentum_criteria: z.strictObject({
    price_momentum_3m_min: z.number().optional(),
    volume_trend: z.enum(['increasing', 'decreasing', 'stable']).optional(),
  }).optional(),
  
  quality_criteria: z.strictObject({
    roe_min: z.number().min(0).optional(),
    current_ratio_min: z.number().positive().optional(),
  }).optional(),
  
  size_criteria: z.strictObject({
    market_cap_min: z.number().positive().optional(),
    market_cap_max: z.number().positive().optional(),
  }).optional(),
  
  volatility_criteria: z.strictObject({
    beta_max: z.number().positive().optional(),
    volatility_30d_max: z.number().min(0).optional(),
  }).optional(),
});

/**
 * Screen filters
 */
export const ScreenFilters = z.strictObject({
  rules: z.array(MetricRule).min(1),
  style_checklist: StyleChecklist.optional(),
  sectors: z.array(z.string()).optional(),
  exclude_sectors: z.array(z.string()).optional(),
  market_cap_range: z.strictObject({
    min: z.number().positive(),
    max: z.number().positive(),
  }).optional(),
  exclude_penny_stocks: z.boolean().optional(),
  limit: z.number().int().min(1).max(10000).default(100),
  offset: z.number().int().min(0).default(0),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
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
  metrics: z.record(z.string(), z.number().nullable()).optional(),
  score: z.number().min(0).max(100).optional(),
  rank: z.number().int().positive().optional(),
  style_scores: z.strictObject({
    value: z.number().min(0).max(100).optional(),
    growth: z.number().min(0).max(100).optional(),
    momentum: z.number().min(0).max(100).optional(),
    quality: z.number().min(0).max(100).optional(),
    size: z.number().min(0).max(100).optional(),
    volatility: z.number().min(0).max(100).optional(),
  }).optional(),
  last_updated: z.string().datetime().optional(),
  data_source: z.string().optional(),
});

export type MetricRuleType = z.infer<typeof MetricRule>;
export type StyleChecklistType = z.infer<typeof StyleChecklist>;
export type ScreenFiltersType = z.infer<typeof ScreenFilters>;
export type ScreenHitType = z.infer<typeof ScreenHit>;

// Validation functions
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
