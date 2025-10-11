import { z } from 'zod';

/**
 * Technical indicator result
 */
export const TechnicalIndicatorResult = z.strictObject({
  indicator: z.enum(['sma', 'ema', 'rsi', 'macd', 'bollinger_bands', 'stochastic', 'williams_r', 'cci', 'atr', 'adx', 'obv', 'volume_profile', 'support_resistance', 'trend_lines', 'fibonacci', 'pivot_points']),
  value: z.number(),
  signal: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  strength: z.enum(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']),
  metadata: z.record(z.string(), z.any()).optional(),
  timeframe: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Price action data
 */
export const PriceAction = z.strictObject({
  current_price: z.number().positive(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().positive(),
  daily_change: z.number(),
  daily_change_percent: z.number(),
  weekly_change: z.number().optional(),
  weekly_change_percent: z.number().optional(),
  monthly_change: z.number().optional(),
  monthly_change_percent: z.number().optional(),
  support_levels: z.array(z.number()).optional(),
  resistance_levels: z.array(z.number()).optional(),
  candlestick_pattern: z.string().optional(),
  chart_pattern: z.string().optional(),
  volume_trend: z.enum(['increasing', 'decreasing', 'stable']).optional(),
  volume_vs_average: z.number().optional(),
  unusual_volume: z.boolean().optional(),
});

/**
 * Trend analysis
 */
export const TrendAnalysis = z.strictObject({
  short_term_trend: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  medium_term_trend: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  long_term_trend: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  trend_strength: z.number().min(0).max(1),
  trend_duration_days: z.number().int().min(0).optional(),
  trend_changes: z.array(z.strictObject({
    date: z.string().datetime(),
    from_trend: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    to_trend: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    strength: z.enum(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']),
  })).optional(),
  moving_averages: z.strictObject({
    sma_20: z.number().optional(),
    sma_50: z.number().optional(),
    sma_200: z.number().optional(),
    ema_12: z.number().optional(),
    ema_26: z.number().optional(),
  }).optional(),
});

/**
 * Momentum analysis
 */
export const MomentumAnalysis = z.strictObject({
  rsi: z.strictObject({
    value: z.number().min(0).max(100),
    signal: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    strength: z.enum(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']),
    overbought: z.boolean(),
    oversold: z.boolean(),
  }),
  macd: z.strictObject({
    macd_line: z.number(),
    signal_line: z.number(),
    histogram: z.number(),
    signal: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    strength: z.enum(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']),
  }),
});

/**
 * Volatility analysis
 */
export const VolatilityAnalysis = z.strictObject({
  atr: z.strictObject({
    value: z.number(),
    percentile: z.number().min(0).max(100),
    signal: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  }),
  bollinger_bands: z.strictObject({
    upper_band: z.number(),
    middle_band: z.number(),
    lower_band: z.number(),
    bandwidth: z.number(),
    position: z.enum(['upper', 'middle', 'lower']),
    signal: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  }),
});

/**
 * Technical analysis output
 */
export const TechOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  price_action: PriceAction,
  indicators: z.array(TechnicalIndicatorResult),
  trend_analysis: TrendAnalysis,
  momentum_analysis: MomentumAnalysis.optional(),
  volatility_analysis: VolatilityAnalysis.optional(),
  technical_score: z.number().min(0).max(100),
  technical_rating: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  summary: z.strictObject({
    key_signals: z.array(z.string()),
    key_levels: z.strictObject({
      support: z.array(z.number()),
      resistance: z.array(z.number()),
    }),
    breakout_levels: z.array(z.number()).optional(),
    breakdown_levels: z.array(z.number()).optional(),
    short_term_outlook: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    medium_term_outlook: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    long_term_outlook: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
    risk_level: z.enum(['low', 'medium', 'high']),
    key_risks: z.array(z.string()),
    key_opportunities: z.array(z.string()),
  }),
  trading_signals: z.strictObject({
    entry_signals: z.array(z.strictObject({
      level: z.number(),
      strength: z.enum(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']),
      reasoning: z.string(),
    })),
    exit_signals: z.array(z.strictObject({
      level: z.number(),
      strength: z.enum(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']),
      reasoning: z.string(),
    })),
    stop_loss_levels: z.array(z.number()),
    take_profit_levels: z.array(z.number()),
  }).optional(),
  timeframe: z.string().optional(),
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional(),
});

export type TechnicalIndicatorResultType = z.infer<typeof TechnicalIndicatorResult>;
export type PriceActionType = z.infer<typeof PriceAction>;
export type TrendAnalysisType = z.infer<typeof TrendAnalysis>;
export type MomentumAnalysisType = z.infer<typeof MomentumAnalysis>;
export type VolatilityAnalysisType = z.infer<typeof VolatilityAnalysis>;
export type TechOutputType = z.infer<typeof TechOutput>;

// Validation functions
export const validateTechnicalIndicatorResult = (data: unknown): TechnicalIndicatorResultType => {
  return TechnicalIndicatorResult.parse(data);
};

export const validatePriceAction = (data: unknown): PriceActionType => {
  return PriceAction.parse(data);
};

export const validateTrendAnalysis = (data: unknown): TrendAnalysisType => {
  return TrendAnalysis.parse(data);
};

export const validateTechOutput = (data: unknown): TechOutputType => {
  return TechOutput.parse(data);
};

export const validateTechnicalIndicatorResultSafe = (data: unknown) => {
  return TechnicalIndicatorResult.safeParse(data);
};

export const validatePriceActionSafe = (data: unknown) => {
  return PriceAction.safeParse(data);
};

export const validateTrendAnalysisSafe = (data: unknown) => {
  return TrendAnalysis.safeParse(data);
};

export const validateTechOutputSafe = (data: unknown) => {
  return TechOutput.safeParse(data);
};
