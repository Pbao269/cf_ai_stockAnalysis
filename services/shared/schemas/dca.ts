import { z } from 'zod';

/**
 * DCA strategy specification
 */
export const StrategySpec = z.strictObject({
  strategy_type: z.enum(['fixed_amount', 'fixed_shares', 'percentage_portfolio', 'volatility_based', 'momentum_based', 'value_based', 'hybrid']),
  entry_timing: z.enum(['immediate', 'dip_buying', 'momentum_breakout', 'support_level', 'oversold_rsi', 'macd_crossover', 'volume_spike', 'news_catalyst']),
  position_sizing: z.enum(['fixed_amount', 'percentage_portfolio', 'volatility_adjusted', 'kelly_criterion', 'risk_parity', 'equal_weight']),
  total_investment_amount: z.number().positive(),
  investment_period_months: z.number().int().min(1).max(120),
  frequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly']),
  position_size_amount: z.number().positive().optional(),
  position_size_percentage: z.number().min(0).max(1).optional(),
  max_position_size: z.number().positive().optional(),
  min_position_size: z.number().positive().optional(),
  entry_conditions: z.strictObject({
    price_threshold: z.number().positive().optional(),
    rsi_threshold: z.number().min(0).max(100).optional(),
    volume_multiplier: z.number().positive().optional(),
    volatility_threshold: z.number().min(0).optional(),
    momentum_threshold: z.number().optional(),
  }).optional(),
  risk_management: z.strictObject({
    stop_loss_percentage: z.number().min(0).max(1).optional(),
    take_profit_percentage: z.number().min(0).max(1).optional(),
    max_drawdown_percentage: z.number().min(0).max(1).optional(),
    position_limit: z.number().int().positive().optional(),
    sector_limit_percentage: z.number().min(0).max(1).optional(),
  }).optional(),
  rebalancing: z.strictObject({
    frequency: z.string().optional(),
    threshold_percentage: z.number().min(0).max(1).optional(),
    method: z.enum(['threshold', 'calendar', 'volatility']).optional(),
  }).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().optional(),
});

/**
 * Strategy performance metrics
 */
export const StrategyMetrics = z.strictObject({
  total_return: z.number(),
  annualized_return: z.number(),
  cumulative_return: z.number(),
  volatility: z.number().min(0),
  sharpe_ratio: z.number(),
  sortino_ratio: z.number().optional(),
  max_drawdown: z.number().min(0),
  max_drawdown_duration_days: z.number().int().min(0),
  alpha: z.number().optional(),
  beta: z.number().optional(),
  information_ratio: z.number().optional(),
  total_trades: z.number().int().min(0),
  winning_trades: z.number().int().min(0),
  losing_trades: z.number().int().min(0),
  win_rate: z.number().min(0).max(1),
  average_win: z.number(),
  average_loss: z.number(),
  profit_factor: z.number().min(0),
  final_portfolio_value: z.number().positive(),
  total_invested: z.number().positive(),
  unrealized_pnl: z.number(),
  realized_pnl: z.number(),
  time_in_market_percentage: z.number().min(0).max(1),
  average_holding_period_days: z.number().int().min(0),
  calmar_ratio: z.number().optional(),
  sterling_ratio: z.number().optional(),
  burke_ratio: z.number().optional(),
});

/**
 * Individual trade record
 */
export const TradeRecord = z.strictObject({
  trade_id: z.string().uuid(),
  symbol: z.string().min(1),
  trade_date: z.string().datetime(),
  trade_type: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  amount: z.number().positive(),
  entry_reason: z.string().optional(),
  exit_reason: z.string().optional(),
  pnl: z.number(),
  pnl_percentage: z.number(),
  holding_period_days: z.number().int().min(0),
  commission: z.number().min(0),
  fees: z.number().min(0),
  net_amount: z.number(),
});

/**
 * Portfolio snapshot
 */
export const PortfolioSnapshot = z.strictObject({
  date: z.string().datetime(),
  total_value: z.number().positive(),
  cash_balance: z.number().min(0),
  positions: z.array(z.strictObject({
    symbol: z.string(),
    quantity: z.number(),
    current_price: z.number().positive(),
    market_value: z.number().positive(),
    cost_basis: z.number().positive(),
    unrealized_pnl: z.number(),
    unrealized_pnl_percentage: z.number(),
    weight: z.number().min(0).max(1),
  })),
});

/**
 * Complete DCA analysis output
 */
export const DcaOutput = z.strictObject({
  symbol: z.string().min(1),
  strategy_id: z.string().uuid(),
  analysis_date: z.string().datetime(),
  strategy_spec: StrategySpec,
  metrics: StrategyMetrics,
  trade_history: z.array(TradeRecord),
  portfolio_snapshots: z.array(PortfolioSnapshot),
  analysis: z.strictObject({
    entry_analysis: z.strictObject({
      recommended_entry_price: z.number().positive().optional(),
      entry_confidence: z.number().min(0).max(1).optional(),
      entry_reasons: z.array(z.string()),
      entry_risks: z.array(z.string()),
    }).optional(),
    strategy_effectiveness: z.strictObject({
      vs_lump_sum: z.number().optional(),
      vs_buy_hold: z.number().optional(),
      volatility_reduction: z.number().optional(),
      downside_protection: z.number().optional(),
    }).optional(),
    risk_analysis: z.strictObject({
      risk_level: z.enum(['low', 'medium', 'high']),
      key_risks: z.array(z.string()),
      risk_mitigation: z.array(z.string()),
      stress_test_results: z.record(z.string(), z.number()).optional(),
    }).optional(),
    optimization: z.strictObject({
      suggested_frequency: z.string().optional(),
      suggested_position_size: z.number().optional(),
      suggested_entry_timing: z.string().optional(),
      potential_improvements: z.array(z.string()),
    }).optional(),
  }),
  recommendations: z.strictObject({
    action: z.enum(['start_strategy', 'modify_strategy', 'pause_strategy', 'stop_strategy']),
    confidence: z.number().min(0).max(1),
    reasoning: z.array(z.string()),
    next_review_date: z.string().datetime().optional(),
  }).optional(),
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional(),
});

export type StrategySpecType = z.infer<typeof StrategySpec>;
export type StrategyMetricsType = z.infer<typeof StrategyMetrics>;
export type TradeRecordType = z.infer<typeof TradeRecord>;
export type PortfolioSnapshotType = z.infer<typeof PortfolioSnapshot>;
export type DcaOutputType = z.infer<typeof DcaOutput>;

// Validation functions
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
