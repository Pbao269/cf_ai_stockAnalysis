import { z } from 'zod';

/**
 * Individual catalyst
 */
export const Catalyst = z.strictObject({
  id: z.string().uuid(),
  symbol: z.string().min(1),
  type: z.enum(['earnings', 'product_launch', 'merger_acquisition', 'regulatory', 'management_change', 'partnership', 'expansion', 'restructuring', 'dividend_change', 'buyback', 'guidance_update', 'clinical_trial', 'approval', 'contract_win', 'patent', 'technology_breakthrough', 'market_expansion', 'cost_reduction', 'other']),
  title: z.string().min(1),
  description: z.string().optional(),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  timing: z.enum(['immediate', 'short_term', 'medium_term', 'long_term', 'uncertain']),
  price_impact_percent: z.number().optional(),
  price_impact_range: z.strictObject({
    low: z.number(),
    high: z.number(),
  }).optional(),
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  announcement_date: z.string().datetime().optional(),
  expected_date: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  source: z.string().optional(),
  analyst: z.string().optional(),
  tags: z.array(z.string()).optional(),
  related_catalysts: z.array(z.string().uuid()).optional(),
  status: z.enum(['upcoming', 'in_progress', 'completed', 'cancelled']).optional(),
});

/**
 * Catalyst sentiment analysis
 */
export const CatalystSentiment = z.strictObject({
  overall_sentiment: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']),
  sentiment_score: z.number().min(-1).max(1),
  sentiment_breakdown: z.strictObject({
    news_sentiment: z.number().min(-1).max(1).optional(),
    social_sentiment: z.number().min(-1).max(1).optional(),
    analyst_sentiment: z.number().min(-1).max(1).optional(),
    management_sentiment: z.number().min(-1).max(1).optional(),
  }).optional(),
  sentiment_trend: z.enum(['improving', 'deteriorating', 'stable', 'volatile']).optional(),
  sentiment_volatility: z.number().min(0).max(1).optional(),
  analyzed_at: z.string().datetime(),
  data_sources: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Catalyst analysis output
 */
export const CatalystOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  catalysts: z.array(Catalyst),
  sentiment: CatalystSentiment.optional(),
  summary: z.strictObject({
    total_catalysts: z.number().int().min(0),
    positive_catalysts: z.number().int().min(0),
    negative_catalysts: z.number().int().min(0),
    neutral_catalysts: z.number().int().min(0),
    high_impact_catalysts: z.number().int().min(0),
    medium_impact_catalysts: z.number().int().min(0),
    low_impact_catalysts: z.number().int().min(0),
    immediate_catalysts: z.number().int().min(0),
    short_term_catalysts: z.number().int().min(0),
    medium_term_catalysts: z.number().int().min(0),
    long_term_catalysts: z.number().int().min(0),
    expected_price_impact: z.number().optional(),
    price_impact_range: z.strictObject({
      low: z.number(),
      high: z.number(),
    }).optional(),
    risk_level: z.enum(['low', 'medium', 'high']),
    key_risks: z.array(z.string()),
    key_opportunities: z.array(z.string()),
  }),
  recommendations: z.strictObject({
    action: z.enum(['buy', 'hold', 'sell', 'avoid']),
    confidence: z.number().min(0).max(1),
    reasoning: z.array(z.string()),
    price_target: z.number().positive().optional(),
    time_horizon: z.string().optional(),
  }).optional(),
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional(),
});

export type CatalystType = z.infer<typeof Catalyst>;
export type CatalystSentimentType = z.infer<typeof CatalystSentiment>;
export type CatalystOutputType = z.infer<typeof CatalystOutput>;

// Validation functions
export const validateCatalyst = (data: unknown): CatalystType => {
  return Catalyst.parse(data);
};

export const validateCatalystSentiment = (data: unknown): CatalystSentimentType => {
  return CatalystSentiment.parse(data);
};

export const validateCatalystOutput = (data: unknown): CatalystOutputType => {
  return CatalystOutput.parse(data);
};

export const validateCatalystSafe = (data: unknown) => {
  return Catalyst.safeParse(data);
};

export const validateCatalystSentimentSafe = (data: unknown) => {
  return CatalystSentiment.safeParse(data);
};

export const validateCatalystOutputSafe = (data: unknown) => {
  return CatalystOutput.safeParse(data);
};
