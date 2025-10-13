import { z } from 'zod';

/**
 * Sector-specific P/E standards for realistic 2024 US market conditions
 */
export const SectorPEStandards = z.strictObject({
  growth: z.number().positive(),
  value: z.number().positive(),
  average: z.number().positive(),
});

/**
 * Sector-aware filters for realistic screening
 */
export const SectorAwareFilters = z.strictObject({
  // Strategy with sector awareness
  strategy: z.enum(['growth', 'value', 'income', 'momentum', 'balanced']),
  sectors: z.array(z.string()).optional(),
  
  // Sector-specific P/E standards
  sector_pe_standards: z.record(z.string(), SectorPEStandards).optional(),
  
  // Market preferences
  market_cap_preference: z.enum(['small', 'mid', 'large', 'mega']).optional(),
  dividend_preference: z.enum(['none', 'low', 'moderate', 'high']).optional(),
  
  // Style scoring
  style_weights: z.any().optional(), // Will be defined later
  
  // Output control
  limit: z.number().int().min(1).max(100).default(5),
  include_rationale: z.boolean().default(true),
  include_sector_analysis: z.boolean().default(true),
});

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
 * Screen filters - supports both legacy and sector-aware formats
 */
export const ScreenFilters = z.strictObject({
  rules: z.array(MetricRule).min(1).optional(),
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
  
  // Sector-aware fields
  strategy: z.enum(['growth', 'value', 'income', 'momentum', 'balanced']).optional(),
  market_cap_preference: z.enum(['small', 'mid', 'large', 'mega']).optional(),
  dividend_preference: z.enum(['none', 'low', 'moderate', 'high']).optional(),
  sector_pe_standards: z.record(z.string(), SectorPEStandards).optional(),
  include_rationale: z.boolean().default(true),
  include_sector_analysis: z.boolean().default(true),
  price_max: z.number().positive().optional(),
});

/**
 * Enhanced ScreenHit with sector context and realistic scoring
 */
export const ScreenHit = z.strictObject({
  symbol: z.string().min(1),
  name: z.string().min(1),
  sector: z.string().optional(),
  industry: z.string().optional(),
  market_cap: z.number().optional(),
  price: z.number().optional(),
  
  // FinViz metrics
  pe_ratio: z.number().optional(),
  pb_ratio: z.number().optional(),
  dividend_yield: z.number().optional(),
  beta: z.number().optional(),
  
  // Sector-aware scoring
  overall_score: z.number().min(0).max(100),
  sector_pe_benchmark: z.number().optional(),
  sector_relative_score: z.number().min(0).max(100).optional(),
  
  style_scores: z.strictObject({
    buffett: z.number().min(0).max(100).optional(),
    lynch: z.number().min(0).max(100).optional(),
    momentum: z.number().min(0).max(100).optional(),
    deep_value: z.number().min(0).max(100).optional(),
    dividend: z.number().min(0).max(100).optional(),
  }),
  
  // Enhanced rationale with sector context
  rationale: z.string(),
  top_drivers: z.array(z.string()),
  sector_analysis: z.string().optional(),
  
  // Metadata
  data_source: z.string().default('finviz+yfinance'),
  last_updated: z.string().datetime(),
});

export type SectorPEStandardsType = z.infer<typeof SectorPEStandards>;
export type SectorAwareFiltersType = z.infer<typeof SectorAwareFilters>;
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
