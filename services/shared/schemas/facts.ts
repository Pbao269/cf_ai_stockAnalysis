import { z } from 'zod';

/**
 * Individual fact/metric
 */
export const Fact = z.strictObject({
  symbol: z.string().min(1),
  metric: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unit: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'percent', 'basis_points', 'ratio', 'multiple', 'count', 'shares', 'employees', 'days', 'months', 'years', 'quarters', 'price_per_share', 'price_per_unit', 'volume', 'turnover', 'score', 'rating', 'grade', 'ratio_to_peers', 'percentile', 'rank']).optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ytd', 'ttm', 'ltm', 'fiscal_year', 'calendar_year', 'rolling_3m', 'rolling_6m', 'rolling_12m', 'rolling_24m', 'instant', 'point_in_time']).optional(),
  source: z.enum(['fmp', 'alphavantage', 'yfinance', 'stooq', 'bloomberg', 'reuters', 'sec', 'company', 'calculated', 'estimated', 'consensus', 'internal']).optional(),
  timestamp: z.string().datetime().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  last_updated: z.string().datetime().optional(),
  data_age_days: z.number().int().min(0).optional(),
  peer_avg: z.number().optional(),
  peer_median: z.number().optional(),
  peer_percentile: z.number().min(0).max(100).optional(),
  historical_avg: z.number().optional(),
  historical_median: z.number().optional(),
  is_estimated: z.boolean().optional(),
  is_preliminary: z.boolean().optional(),
  is_restated: z.boolean().optional(),
  is_pro_forma: z.boolean().optional(),
});

/**
 * Collection of facts for a symbol
 */
export const Facts = z.strictObject({
  symbol: z.string().min(1),
  facts: z.record(z.string(), Fact),
  collected_at: z.string().datetime(),
  source_summary: z.record(z.string(), z.number().int().min(0)).optional(),
  data_freshness: z.strictObject({
    newest_timestamp: z.string().datetime(),
    oldest_timestamp: z.string().datetime(),
    avg_age_days: z.number().min(0),
  }).optional(),
  quality_score: z.number().min(0).max(1).optional(),
  completeness_score: z.number().min(0).max(1).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  categories: z.array(z.string()).optional(),
  metrics_count: z.number().int().min(0).optional(),
});

/**
 * Fact request
 */
export const FactRequest = z.strictObject({
  symbol: z.string().min(1),
  metrics: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  max_age_days: z.number().int().min(0).optional(),
  force_refresh: z.boolean().optional(),
  include_peer_data: z.boolean().optional(),
  include_historical: z.boolean().optional(),
});

/**
 * Fact response
 */
export const FactResponse = z.strictObject({
  success: z.boolean(),
  facts: Facts.optional(),
  errors: z.array(z.strictObject({
    metric: z.string(),
    error: z.string(),
    code: z.string().optional(),
  })).optional(),
  warnings: z.array(z.string()).optional(),
  metadata: z.strictObject({
    request_id: z.string().optional(),
    processing_time_ms: z.number().optional(),
    cache_hit: z.boolean().optional(),
    sources_used: z.array(z.string()).optional(),
  }).optional(),
});

export type FactType = z.infer<typeof Fact>;
export type FactsType = z.infer<typeof Facts>;
export type FactRequestType = z.infer<typeof FactRequest>;
export type FactResponseType = z.infer<typeof FactResponse>;

// Validation functions
export const validateFact = (data: unknown): FactType => {
  return Fact.parse(data);
};

export const validateFacts = (data: unknown): FactsType => {
  return Facts.parse(data);
};

export const validateFactRequest = (data: unknown): FactRequestType => {
  return FactRequest.parse(data);
};

export const validateFactResponse = (data: unknown): FactResponseType => {
  return FactResponse.parse(data);
};

export const validateFactSafe = (data: unknown) => {
  return Fact.safeParse(data);
};

export const validateFactsSafe = (data: unknown) => {
  return Facts.safeParse(data);
};

export const validateFactRequestSafe = (data: unknown) => {
  return FactRequest.safeParse(data);
};

export const validateFactResponseSafe = (data: unknown) => {
  return FactResponse.safeParse(data);
};

// Utility functions
export const createFact = (
  symbol: string,
  metric: string,
  value: string | number | boolean | null,
  unit?: string,
  period?: string,
  source?: string,
  timestamp?: string
): FactType => {
  return {
    symbol,
    metric,
    value,
    unit,
    period,
    source,
    timestamp,
  };
};

export const createFacts = (
  symbol: string,
  facts: Record<string, FactType>,
  collected_at: string
): FactsType => {
  return {
    symbol,
    facts,
    collected_at,
  };
};
