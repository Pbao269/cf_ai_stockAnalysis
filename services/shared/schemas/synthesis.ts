import { z } from 'zod';

/**
 * Analysis input for synthesis
 */
export const AnalysisInput = z.strictObject({
  component: z.enum(['fundamental', 'technical', 'catalyst', 'dcf', 'screener', 'sentiment']),
  data: z.record(z.string(), z.any()),
  confidence: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
  weight: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
  source: z.string().optional(),
  analyst: z.string().optional(),
});

/**
 * Synthesis input - combines all analysis components
 */
export const SynthesisInput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  analyses: z.array(AnalysisInput).min(1),
  user_preferences: z.strictObject({
    risk_tolerance: z.enum(['conservative', 'moderate', 'aggressive']),
    time_horizon: z.enum(['short', 'medium', 'long']),
    investment_objective: z.enum(['growth', 'income', 'balanced', 'preservation']),
    sector_preferences: z.array(z.string()).optional(),
    sector_exclusions: z.array(z.string()).optional(),
    esg_preferences: z.boolean().optional(),
    liquidity_requirements: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
  market_context: z.strictObject({
    market_regime: z.enum(['bull', 'bear', 'sideways', 'volatile']),
    sector_rotation: z.enum(['growth_to_value', 'value_to_growth', 'defensive', 'cyclical']).optional(),
    economic_cycle: z.enum(['expansion', 'peak', 'recession', 'recovery']).optional(),
    interest_rate_environment: z.enum(['rising', 'falling', 'stable']).optional(),
    inflation_environment: z.enum(['high', 'moderate', 'low', 'deflation']).optional(),
  }).optional(),
  synthesis_params: z.strictObject({
    consensus_threshold: z.number().min(0).max(1),
    conflict_resolution: z.enum(['weighted_average', 'majority_vote', 'expert_override', 'conservative']),
    uncertainty_handling: z.enum(['conservative', 'optimistic', 'neutral']),
    time_decay_factor: z.number().min(0).max(1),
  }).optional(),
  request_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

/**
 * Synthesis output - final recommendation
 */
export const SynthesisOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  recommendation: z.strictObject({
    action: z.enum(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']),
    confidence: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
    conviction_score: z.number().min(0).max(100),
    price_target: z.number().positive().optional(),
    price_target_range: z.strictObject({
      low: z.number().positive(),
      high: z.number().positive(),
    }).optional(),
    time_horizon: z.enum(['very_short', 'short', 'medium', 'long', 'very_long']),
    expected_return: z.number().optional(),
    expected_return_range: z.strictObject({
      low: z.number(),
      high: z.number(),
    }).optional(),
  }),
  risk_assessment: z.strictObject({
    overall_risk: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
    risk_score: z.number().min(0).max(100),
    risk_factors: z.array(z.strictObject({
      factor: z.string(),
      level: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
      impact: z.number().min(0).max(100),
      description: z.string(),
    })),
    risk_mitigation: z.array(z.string()),
    downside_scenario: z.strictObject({
      probability: z.number().min(0).max(1),
      potential_loss: z.number().max(0),
      trigger_events: z.array(z.string()),
    }).optional(),
  }),
  synthesis_summary: z.strictObject({
    consensus_score: z.number().min(0).max(100),
    agreement_level: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
    key_insights: z.array(z.string()),
    conflicts: z.array(z.strictObject({
      component: z.string(),
      conflict_description: z.string(),
      resolution: z.string(),
    })),
    supporting_evidence: z.array(z.strictObject({
      component: z.string(),
      evidence: z.string(),
      strength: z.enum(['weak', 'moderate', 'strong']),
    })),
  }),
  component_analysis: z.array(z.strictObject({
    component: z.enum(['fundamental', 'technical', 'catalyst', 'dcf', 'screener', 'sentiment']),
    score: z.number().min(0).max(100),
    confidence: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
    weight: z.number().min(0).max(1),
    summary: z.string(),
    key_points: z.array(z.string()),
    limitations: z.array(z.string()).optional(),
  })),
  portfolio_context: z.strictObject({
    correlation_with_portfolio: z.number().min(-1).max(1).optional(),
    diversification_benefit: z.number().min(0).max(100).optional(),
    sector_allocation_impact: z.number().optional(),
    position_size_recommendation: z.enum(['small', 'medium', 'large']).optional(),
    position_size_percentage: z.number().min(0).max(1).optional(),
  }).optional(),
  implementation: z.strictObject({
    entry_strategy: z.string().optional(),
    exit_strategy: z.string().optional(),
    monitoring_points: z.array(z.string()).optional(),
    review_schedule: z.string().optional(),
    position_management: z.strictObject({
      initial_position_size: z.number().min(0).max(1).optional(),
      scaling_strategy: z.string().optional(),
      stop_loss_level: z.number().optional(),
      take_profit_level: z.number().optional(),
    }).optional(),
  }).optional(),
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional(),
  quality_metrics: z.strictObject({
    data_freshness: z.number().min(0).max(1).optional(),
    analysis_completeness: z.number().min(0).max(1).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    uncertainty_score: z.number().min(0).max(1).optional(),
  }).optional(),
});

export type AnalysisInputType = z.infer<typeof AnalysisInput>;
export type SynthesisInputType = z.infer<typeof SynthesisInput>;
export type SynthesisOutputType = z.infer<typeof SynthesisOutput>;

// Validation functions
export const validateAnalysisInput = (data: unknown): AnalysisInputType => {
  return AnalysisInput.parse(data);
};

export const validateSynthesisInput = (data: unknown): SynthesisInputType => {
  return SynthesisInput.parse(data);
};

export const validateSynthesisOutput = (data: unknown): SynthesisOutputType => {
  return SynthesisOutput.parse(data);
};

export const validateAnalysisInputSafe = (data: unknown) => {
  return AnalysisInput.safeParse(data);
};

export const validateSynthesisInputSafe = (data: unknown) => {
  return SynthesisInput.safeParse(data);
};

export const validateSynthesisOutputSafe = (data: unknown) => {
  return SynthesisOutput.safeParse(data);
};
