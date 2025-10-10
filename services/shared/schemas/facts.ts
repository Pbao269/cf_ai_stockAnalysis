import { z } from 'zod';

/**
 * Units for different types of metrics
 */
export const MetricUnit = z.enum([
  // Currency units
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  
  // Percentage units
  'percent', 'basis_points',
  
  // Ratio units
  'ratio', 'multiple',
  
  // Count units
  'count', 'shares', 'employees',
  
  // Time units
  'days', 'months', 'years', 'quarters',
  
  // Price units
  'price_per_share', 'price_per_unit',
  
  // Volume units
  'volume', 'turnover',
  
  // Score units
  'score', 'rating', 'grade',
  
  // Other
  'ratio_to_peers', 'percentile', 'rank'
]);

/**
 * Time periods for metrics
 */
export const MetricPeriod = z.enum([
  'daily', 'weekly', 'monthly', 'quarterly', 'yearly',
  'ytd', 'ttm', 'ltm', 'fiscal_year', 'calendar_year',
  'rolling_3m', 'rolling_6m', 'rolling_12m', 'rolling_24m',
  'instant', 'point_in_time'
]);

/**
 * Data sources for metrics
 */
export const DataSource = z.enum([
  'fmp',           // Financial Modeling Prep
  'alphavantage',  // Alpha Vantage
  'yfinance',      // Yahoo Finance
  'stooq',         // Stooq
  'bloomberg',     // Bloomberg
  'reuters',       // Reuters
  'sec',           // SEC filings
  'company',       // Company reports
  'calculated',    // Calculated metric
  'estimated',     // Estimated value
  'consensus',     // Analyst consensus
  'internal'       // Internal calculation
]);

/**
 * Individual fact/metric
 */
export const Fact = z.strictObject({
  // Core identification
  symbol: z.string().min(1),
  metric: z.string().min(1), // e.g., 'pe_ratio', 'market_cap', 'revenue'
  
  // Value and metadata
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  unit: MetricUnit,
  period: MetricPeriod,
  
  // Source and timing
  source: DataSource,
  timestamp: z.string().datetime(),
  
  // Additional context
  description: z.string().optional(),
  category: z.string().optional(), // e.g., 'valuation', 'growth', 'profitability'
  subcategory: z.string().optional(), // e.g., 'price_ratios', 'earnings_growth'
  
  // Quality indicators
  confidence: z.number().min(0).max(1).optional(), // 0-1 confidence score
  last_updated: z.string().datetime().optional(),
  data_age_days: z.number().int().min(0).optional(),
  
  // Comparison context
  peer_avg: z.number().optional(),
  peer_median: z.number().optional(),
  peer_percentile: z.number().min(0).max(100).optional(),
  historical_avg: z.number().optional(),
  historical_median: z.number().optional(),
  
  // Flags
  is_estimated: z.boolean().optional(),
  is_preliminary: z.boolean().optional(),
  is_restated: z.boolean().optional(),
  is_pro_forma: z.boolean().optional()
});

/**
 * Collection of facts keyed by metric name
 */
export const Facts = z.strictObject({
  symbol: z.string().min(1),
  facts: z.record(z.string(), Fact),
  
  // Collection metadata
  collected_at: z.string().datetime(),
  source_summary: z.record(DataSource, z.number().int().min(0)).optional(), // count per source
  data_freshness: z.strictObject({
    newest_timestamp: z.string().datetime(),
    oldest_timestamp: z.string().datetime(),
    avg_age_days: z.number().min(0)
  }).optional(),
  
  // Quality summary
  quality_score: z.number().min(0).max(1).optional(),
  completeness_score: z.number().min(0).max(1).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  
  // Categories summary
  categories: z.array(z.string()).optional(),
  metrics_count: z.number().int().min(0).optional()
});

/**
 * Fact collection request
 */
export const FactRequest = z.strictObject({
  symbol: z.string().min(1),
  metrics: z.array(z.string()).optional(), // specific metrics to fetch
  categories: z.array(z.string()).optional(), // categories to fetch
  sources: z.array(DataSource).optional(), // preferred sources
  max_age_days: z.number().int().min(0).optional(), // max age for cached data
  force_refresh: z.boolean().optional(),
  include_peer_data: z.boolean().optional(),
  include_historical: z.boolean().optional()
});

/**
 * Fact collection response
 */
export const FactResponse = z.strictObject({
  success: z.boolean(),
  facts: Facts.optional(),
  errors: z.array(z.strictObject({
    metric: z.string(),
    error: z.string(),
    code: z.string().optional()
  })).optional(),
  warnings: z.array(z.string()).optional(),
  metadata: z.strictObject({
    request_id: z.string().optional(),
    processing_time_ms: z.number().int().min(0).optional(),
    cache_hit: z.boolean().optional(),
    sources_used: z.array(DataSource).optional()
  }).optional()
});

// Export inferred TypeScript types
export type MetricUnitType = z.infer<typeof MetricUnit>;
export type MetricPeriodType = z.infer<typeof MetricPeriod>;
export type DataSourceType = z.infer<typeof DataSource>;
export type FactType = z.infer<typeof Fact>;
export type FactsType = z.infer<typeof Facts>;
export type FactRequestType = z.infer<typeof FactRequest>;
export type FactResponseType = z.infer<typeof FactResponse>;

// Export validation functions
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

// Safe validation functions
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
  value: number | string | boolean | null,
  unit: MetricUnitType,
  period: MetricPeriodType,
  source: DataSourceType,
  timestamp: string
): FactType => {
  return {
    symbol,
    metric,
    value,
    unit,
    period,
    source,
    timestamp
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
    collected_at
  };
};
