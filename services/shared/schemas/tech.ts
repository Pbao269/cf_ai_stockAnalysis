import { z } from 'zod';

/**
 * Technical indicator types
 */
export const TechnicalIndicator = z.enum([
  'sma', 'ema', 'rsi', 'macd', 'bollinger_bands', 'stochastic',
  'williams_r', 'cci', 'atr', 'adx', 'obv', 'volume_profile',
  'support_resistance', 'trend_lines', 'fibonacci', 'pivot_points'
]);

/**
 * Technical signal strength
 */
export const SignalStrength = z.enum([
  'very_weak', 'weak', 'moderate', 'strong', 'very_strong'
]);

/**
 * Technical signal direction
 */
export const SignalDirection = z.enum([
  'very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'
]);

/**
 * Individual technical indicator result
 */
export const TechnicalIndicatorResult = z.strictObject({
  indicator: TechnicalIndicator,
  value: z.number(),
  signal: SignalDirection,
  strength: SignalStrength,
  
  // Additional indicator-specific data
  metadata: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  
  // Timeframe
  timeframe: z.string().optional(), // e.g., '1D', '1W', '1M'
  
  // Confidence
  confidence: z.number().min(0).max(1).optional()
});

/**
 * Price action analysis
 */
export const PriceAction = z.strictObject({
  current_price: z.number().positive(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().positive(),
  
  // Price changes
  daily_change: z.number(),
  daily_change_percent: z.number(),
  weekly_change: z.number().optional(),
  weekly_change_percent: z.number().optional(),
  monthly_change: z.number().optional(),
  monthly_change_percent: z.number().optional(),
  
  // Price levels
  support_levels: z.array(z.number()).optional(),
  resistance_levels: z.array(z.number()).optional(),
  
  // Patterns
  candlestick_pattern: z.string().optional(),
  chart_pattern: z.string().optional(),
  
  // Volume analysis
  volume_trend: z.enum(['increasing', 'decreasing', 'stable']).optional(),
  volume_vs_average: z.number().optional(), // ratio to average volume
  unusual_volume: z.boolean().optional()
});

/**
 * Trend analysis
 */
export const TrendAnalysis = z.strictObject({
  short_term_trend: SignalDirection,
  medium_term_trend: SignalDirection,
  long_term_trend: SignalDirection,
  
  // Trend strength
  trend_strength: z.number().min(0).max(1),
  
  // Trend duration
  trend_duration_days: z.number().int().min(0).optional(),
  
  // Trend changes
  trend_changes: z.array(z.strictObject({
    date: z.string().datetime(),
    from_trend: SignalDirection,
    to_trend: SignalDirection,
    strength: SignalStrength
  })).optional(),
  
  // Moving averages
  moving_averages: z.strictObject({
    sma_20: z.number().optional(),
    sma_50: z.number().optional(),
    sma_200: z.number().optional(),
    ema_12: z.number().optional(),
    ema_26: z.number().optional()
  }).optional()
});

/**
 * Momentum analysis
 */
export const MomentumAnalysis = z.strictObject({
  rsi: z.strictObject({
    value: z.number().min(0).max(100),
    signal: SignalDirection,
    strength: SignalStrength,
    overbought: z.boolean(),
    oversold: z.boolean()
  }).optional(),
  
  macd: z.strictObject({
    macd_line: z.number(),
    signal_line: z.number(),
    histogram: z.number(),
    signal: SignalDirection,
    strength: SignalStrength
  }).optional(),
  
  stochastic: z.strictObject({
    k_percent: z.number().min(0).max(100),
    d_percent: z.number().min(0).max(100),
    signal: SignalDirection,
    strength: SignalStrength
  }).optional(),
  
  williams_r: z.strictObject({
    value: z.number().min(-100).max(0),
    signal: SignalDirection,
    strength: SignalStrength
  }).optional()
});

/**
 * Volatility analysis
 */
export const VolatilityAnalysis = z.strictObject({
  atr: z.strictObject({
    value: z.number().positive(),
    percentile: z.number().min(0).max(100), // vs historical ATR
    signal: SignalDirection
  }).optional(),
  
  bollinger_bands: z.strictObject({
    upper_band: z.number(),
    middle_band: z.number(),
    lower_band: z.number(),
    bandwidth: z.number(),
    position: z.enum(['above_upper', 'upper_half', 'middle', 'lower_half', 'below_lower']),
    signal: SignalDirection
  }).optional(),
  
  volatility_percentile: z.number().min(0).max(100).optional(),
  implied_volatility: z.number().positive().optional()
});

/**
 * Complete technical analysis output
 */
export const TechOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  
  // Price action
  price_action: PriceAction,
  
  // Technical indicators
  indicators: z.array(TechnicalIndicatorResult),
  
  // Analysis components
  trend_analysis: TrendAnalysis,
  momentum_analysis: MomentumAnalysis.optional(),
  volatility_analysis: VolatilityAnalysis.optional(),
  
  // Overall technical score
  technical_score: z.number().min(0).max(100),
  technical_rating: z.enum(['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish']),
  
  // Summary
  summary: z.strictObject({
    key_signals: z.array(z.string()),
    key_levels: z.strictObject({
      support: z.array(z.number()),
      resistance: z.array(z.number())
    }).optional(),
    breakout_levels: z.array(z.number()).optional(),
    breakdown_levels: z.array(z.number()).optional(),
    
    // Recommendations
    short_term_outlook: SignalDirection,
    medium_term_outlook: SignalDirection,
    long_term_outlook: SignalDirection,
    
    // Risk assessment
    risk_level: z.enum(['low', 'medium', 'high']),
    key_risks: z.array(z.string()),
    key_opportunities: z.array(z.string())
  }),
  
  // Trading signals
  trading_signals: z.strictObject({
    entry_signals: z.array(z.strictObject({
      level: z.number(),
      strength: SignalStrength,
      reasoning: z.string()
    })).optional(),
    exit_signals: z.array(z.strictObject({
      level: z.number(),
      strength: SignalStrength,
      reasoning: z.string()
    })).optional(),
    stop_loss_levels: z.array(z.number()).optional(),
    take_profit_levels: z.array(z.number()).optional()
  }).optional(),
  
  // Metadata
  timeframe: z.string().optional(),
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional()
});

// Export inferred TypeScript types
export type TechnicalIndicatorType = z.infer<typeof TechnicalIndicator>;
export type SignalStrengthType = z.infer<typeof SignalStrength>;
export type SignalDirectionType = z.infer<typeof SignalDirection>;
export type TechnicalIndicatorResultType = z.infer<typeof TechnicalIndicatorResult>;
export type PriceActionType = z.infer<typeof PriceAction>;
export type TrendAnalysisType = z.infer<typeof TrendAnalysis>;
export type MomentumAnalysisType = z.infer<typeof MomentumAnalysis>;
export type VolatilityAnalysisType = z.infer<typeof VolatilityAnalysis>;
export type TechOutputType = z.infer<typeof TechOutput>;

// Export validation functions
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

// Safe validation functions
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
