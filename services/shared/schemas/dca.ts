import { z } from 'zod';

/**
 * DCA strategy types
 */
export const DcaStrategyType = z.enum([
  'fixed_amount', 'fixed_shares', 'percentage_portfolio', 'volatility_based',
  'momentum_based', 'value_based', 'hybrid'
]);

/**
 * Entry timing strategies
 */
export const EntryTiming = z.enum([
  'immediate', 'dip_buying', 'momentum_breakout', 'support_level',
  'oversold_rsi', 'macd_crossover', 'volume_spike', 'news_catalyst'
]);

/**
 * Position sizing methods
 */
export const PositionSizing = z.enum([
  'fixed_amount', 'percentage_portfolio', 'volatility_adjusted',
  'kelly_criterion', 'risk_parity', 'equal_weight'
]);

/**
 * Strategy specification
 */
export const StrategySpec = z.strictObject({
  // Basic strategy parameters
  strategy_type: DcaStrategyType,
  entry_timing: EntryTiming,
  position_sizing: PositionSizing,
  
  // Investment parameters
  total_investment_amount: z.number().positive(),
  investment_period_months: z.number().int().min(1).max(120),
  frequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly']),
  
  // Position sizing parameters
  position_size_amount: z.number().positive().optional(),
  position_size_percentage: z.number().min(0).max(1).optional(),
  max_position_size: z.number().positive().optional(),
  min_position_size: z.number().positive().optional(),
  
  // Entry conditions
  entry_conditions: z.strictObject({
    price_threshold: z.number().positive().optional(),
    rsi_threshold: z.number().min(0).max(100).optional(),
    volume_multiplier: z.number().positive().optional(),
    volatility_threshold: z.number().positive().optional(),
    momentum_threshold: z.number().optional()
  }).optional(),
  
  // Risk management
  risk_management: z.strictObject({
    stop_loss_percentage: z.number().min(0).max(1).optional(),
    take_profit_percentage: z.number().min(0).max(10).optional(),
    max_drawdown_percentage: z.number().min(0).max(1).optional(),
    position_limit: z.number().int().positive().optional(),
    sector_limit_percentage: z.number().min(0).max(1).optional()
  }).optional(),
  
  // Rebalancing
  rebalancing: z.strictObject({
    frequency: z.enum(['monthly', 'quarterly', 'semi_annually', 'annually']).optional(),
    threshold_percentage: z.number().min(0).max(1).optional(),
    method: z.enum(['threshold', 'time_based', 'volatility_based']).optional()
  }).optional(),
  
  // Metadata
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  created_by: z.string().optional()
});

/**
 * Strategy performance metrics
 */
export const StrategyMetrics = z.strictObject({
  // Return metrics
  total_return: z.number(),
  annualized_return: z.number(),
  cumulative_return: z.number(),
  
  // Risk metrics
  volatility: z.number().min(0),
  sharpe_ratio: z.number(),
  sortino_ratio: z.number().optional(),
  max_drawdown: z.number().min(0),
  max_drawdown_duration_days: z.number().int().min(0),
  
  // Performance vs benchmarks
  alpha: z.number().optional(),
  beta: z.number().optional(),
  information_ratio: z.number().optional(),
  
  // Trade metrics
  total_trades: z.number().int().min(0),
  winning_trades: z.number().int().min(0),
  losing_trades: z.number().int().min(0),
  win_rate: z.number().min(0).max(1),
  average_win: z.number(),
  average_loss: z.number(),
  profit_factor: z.number().positive().optional(),
  
  // Portfolio metrics
  final_portfolio_value: z.number().positive(),
  total_invested: z.number().positive(),
  unrealized_pnl: z.number(),
  realized_pnl: z.number(),
  
  // Time-based metrics
  time_in_market_percentage: z.number().min(0).max(1),
  average_holding_period_days: z.number().int().min(0),
  
  // Risk-adjusted metrics
  calmar_ratio: z.number().optional(),
  sterling_ratio: z.number().optional(),
  burke_ratio: z.number().optional()
});

/**
 * Individual trade record
 */
export const TradeRecord = z.strictObject({
  trade_id: z.string().uuid(),
  symbol: z.string().min(1),
  trade_date: z.string().datetime(),
  trade_type: z.enum(['buy', 'sell']),
  
  // Trade details
  quantity: z.number().positive(),
  price: z.number().positive(),
  amount: z.number().positive(),
  
  // Trade context
  entry_reason: z.string().optional(),
  exit_reason: z.string().optional(),
  
  // Performance
  pnl: z.number().optional(),
  pnl_percentage: z.number().optional(),
  holding_period_days: z.number().int().min(0).optional(),
  
  // Fees and costs
  commission: z.number().min(0).optional(),
  fees: z.number().min(0).optional(),
  net_amount: z.number().optional()
});

/**
 * Portfolio snapshot
 */
export const PortfolioSnapshot = z.strictObject({
  date: z.string().datetime(),
  total_value: z.number().positive(),
  cash_balance: z.number().min(0),
  positions: z.array(z.strictObject({
    symbol: z.string().min(1),
    quantity: z.number().positive(),
    current_price: z.number().positive(),
    market_value: z.number().positive(),
    cost_basis: z.number().positive(),
    unrealized_pnl: z.number(),
    unrealized_pnl_percentage: z.number(),
    weight: z.number().min(0).max(1)
  })),
  
  // Portfolio metrics
  portfolio_metrics: z.strictObject({
    total_return: z.number(),
    daily_return: z.number(),
    volatility: z.number().min(0),
    beta: z.number().optional(),
    sharpe_ratio: z.number().optional()
  }).optional()
});

/**
 * Complete DCA strategy output
 */
export const DcaOutput = z.strictObject({
  symbol: z.string().min(1),
  strategy_id: z.string().uuid(),
  analysis_date: z.string().datetime(),
  
  // Strategy specification
  strategy_spec: StrategySpec,
  
  // Performance metrics
  metrics: StrategyMetrics,
  
  // Trade history
  trade_history: z.array(TradeRecord),
  
  // Portfolio snapshots (monthly)
  portfolio_snapshots: z.array(PortfolioSnapshot),
  
  // Analysis results
  analysis: z.strictObject({
    // Entry analysis
    entry_analysis: z.strictObject({
      recommended_entry_price: z.number().positive().optional(),
      entry_confidence: z.number().min(0).max(1).optional(),
      entry_reasons: z.array(z.string()),
      entry_risks: z.array(z.string())
    }).optional(),
    
    // Strategy effectiveness
    strategy_effectiveness: z.strictObject({
      vs_lump_sum: z.number().optional(), // performance vs lump sum investment
      vs_buy_hold: z.number().optional(), // performance vs buy and hold
      volatility_reduction: z.number().optional(),
      downside_protection: z.number().optional()
    }).optional(),
    
    // Risk analysis
    risk_analysis: z.strictObject({
      risk_level: z.enum(['low', 'medium', 'high']),
      key_risks: z.array(z.string()),
      risk_mitigation: z.array(z.string()),
      stress_test_results: z.record(z.string(), z.number()).optional()
    }).optional(),
    
    // Optimization suggestions
    optimization: z.strictObject({
      suggested_frequency: z.string().optional(),
      suggested_position_size: z.number().optional(),
      suggested_entry_timing: z.string().optional(),
      potential_improvements: z.array(z.string())
    }).optional()
  }),
  
  // Recommendations
  recommendations: z.strictObject({
    action: z.enum(['start_strategy', 'modify_strategy', 'pause_strategy', 'stop_strategy']),
    confidence: z.number().min(0).max(1),
    reasoning: z.array(z.string()),
    next_review_date: z.string().datetime().optional()
  }).optional(),
  
  // Metadata
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional()
});

// Export inferred TypeScript types
export type DcaStrategyTypeType = z.infer<typeof DcaStrategyType>;
export type EntryTimingType = z.infer<typeof EntryTiming>;
export type PositionSizingType = z.infer<typeof PositionSizing>;
export type StrategySpecType = z.infer<typeof StrategySpec>;
export type StrategyMetricsType = z.infer<typeof StrategyMetrics>;
export type TradeRecordType = z.infer<typeof TradeRecord>;
export type PortfolioSnapshotType = z.infer<typeof PortfolioSnapshot>;
export type DcaOutputType = z.infer<typeof DcaOutput>;

// Export validation functions
export const validateStrategySpec = (data: unknown): StrategySpecType => {
  return StrategySpec.parse(data);
};

export const validateStrategyMetrics = (data: unknown): StrategyMetricsType => {
  return StrategyMetrics.parse(data);
};

export const validateTradeRecord = (data: unknown): TradeRecordType => {
  return TradeRecord.parse(data);
};

export const validateDcaOutput = (data: unknown): DcaOutputType => {
  return DcaOutput.parse(data);
};

// Safe validation functions
export const validateStrategySpecSafe = (data: unknown) => {
  return StrategySpec.safeParse(data);
};

export const validateStrategyMetricsSafe = (data: unknown) => {
  return StrategyMetrics.safeParse(data);
};

export const validateTradeRecordSafe = (data: unknown) => {
  return TradeRecord.safeParse(data);
};

export const validateDcaOutputSafe = (data: unknown) => {
  return DcaOutput.safeParse(data);
};

// Export partial schemas for updates
export const StrategySpecUpdate = StrategySpec.partial();
export type StrategySpecUpdateType = z.infer<typeof StrategySpecUpdate>;
