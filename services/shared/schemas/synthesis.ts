import { z } from 'zod';

/**
 * Analysis components for synthesis
 */
export const AnalysisComponent = z.enum([
  'fundamental', 'technical', 'catalyst', 'dcf', 'screener', 'sentiment'
]);

/**
 * Confidence levels for analysis
 */
export const ConfidenceLevel = z.enum([
  'very_low', 'low', 'medium', 'high', 'very_high'
]);

/**
 * Investment recommendation actions
 */
export const RecommendationAction = z.enum([
  'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
]);

/**
 * Risk levels
 */
export const RiskLevel = z.enum([
  'very_low', 'low', 'medium', 'high', 'very_high'
]);

/**
 * Time horizons for investment
 */
export const TimeHorizon = z.enum([
  'very_short', 'short', 'medium', 'long', 'very_long'
]);

/**
 * Individual analysis input
 */
export const AnalysisInput = z.strictObject({
  component: AnalysisComponent,
  data: z.record(z.string(), z.unknown()), // flexible data structure
  confidence: ConfidenceLevel,
  weight: z.number().min(0).max(1), // importance weight in synthesis
  timestamp: z.string().datetime(),
  source: z.string().optional(),
  analyst: z.string().optional()
});

/**
 * Synthesis input combining multiple analyses
 */
export const SynthesisInput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  
  // Individual analysis components
  analyses: z.array(AnalysisInput).min(1),
  
  // User preferences and constraints
  user_preferences: z.strictObject({
    risk_tolerance: RiskLevel,
    time_horizon: TimeHorizon,
    investment_objective: z.enum(['growth', 'income', 'balanced', 'preservation']),
    sector_preferences: z.array(z.string()).optional(),
    sector_exclusions: z.array(z.string()).optional(),
    esg_preferences: z.boolean().optional(),
    liquidity_requirements: z.enum(['high', 'medium', 'low']).optional()
  }).optional(),
  
  // Market context
  market_context: z.strictObject({
    market_regime: z.enum(['bull', 'bear', 'sideways', 'volatile']).optional(),
    sector_rotation: z.enum(['growth_to_value', 'value_to_growth', 'defensive', 'cyclical']).optional(),
    economic_cycle: z.enum(['expansion', 'peak', 'contraction', 'trough']).optional(),
    interest_rate_environment: z.enum(['low', 'rising', 'high', 'falling']).optional(),
    inflation_environment: z.enum(['low', 'moderate', 'high', 'deflation']).optional()
  }).optional(),
  
  // Synthesis parameters
  synthesis_params: z.strictObject({
    consensus_threshold: z.number().min(0).max(1).optional(), // minimum agreement for consensus
    conflict_resolution: z.enum(['weighted_average', 'majority_vote', 'expert_override']).optional(),
    uncertainty_handling: z.enum(['conservative', 'neutral', 'aggressive']).optional(),
    time_decay_factor: z.number().min(0).max(1).optional() // how much to weight recent analyses
  }).optional(),
  
  // Metadata
  request_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  created_at: z.string().datetime().optional()
});

/**
 * Synthesis output
 */
export const SynthesisOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  
  // Overall recommendation
  recommendation: z.strictObject({
    action: RecommendationAction,
    confidence: ConfidenceLevel,
    conviction_score: z.number().min(0).max(100),
    
    // Price targets
    price_target: z.number().positive().optional(),
    price_target_range: z.strictObject({
      low: z.number().positive(),
      high: z.number().positive()
    }).optional(),
    
    // Time horizon
    time_horizon: TimeHorizon,
    expected_return: z.number().optional(),
    expected_return_range: z.strictObject({
      low: z.number(),
      high: z.number()
    }).optional()
  }),
  
  // Risk assessment
  risk_assessment: z.strictObject({
    overall_risk: RiskLevel,
    risk_score: z.number().min(0).max(100),
    
    // Risk breakdown
    risk_factors: z.array(z.strictObject({
      factor: z.string(),
      level: RiskLevel,
      impact: z.number().min(0).max(100),
      description: z.string()
    })),
    
    // Risk mitigation
    risk_mitigation: z.array(z.string()),
    
    // Downside protection
    downside_scenario: z.strictObject({
      probability: z.number().min(0).max(1),
      potential_loss: z.number().max(0),
      trigger_events: z.array(z.string())
    }).optional()
  }),
  
  // Analysis synthesis
  synthesis_summary: z.strictObject({
    consensus_score: z.number().min(0).max(100),
    agreement_level: z.enum(['high', 'medium', 'low']),
    
    // Key insights
    key_insights: z.array(z.string()),
    key_risks: z.array(z.string()),
    key_opportunities: z.array(z.string()),
    
    // Conflicting views
    conflicts: z.array(z.strictObject({
      component: AnalysisComponent,
      conflict_description: z.string(),
      resolution: z.string()
    })).optional(),
    
    // Supporting evidence
    supporting_evidence: z.array(z.strictObject({
      component: AnalysisComponent,
      evidence: z.string(),
      strength: ConfidenceLevel
    }))
  }),
  
  // Component analysis
  component_analysis: z.array(z.strictObject({
    component: AnalysisComponent,
    score: z.number().min(0).max(100),
    confidence: ConfidenceLevel,
    weight: z.number().min(0).max(1),
    summary: z.string(),
    key_points: z.array(z.string()),
    limitations: z.array(z.string()).optional()
  })),
  
  // Portfolio context
  portfolio_context: z.strictObject({
    correlation_with_portfolio: z.number().min(-1).max(1).optional(),
    diversification_benefit: z.number().min(0).max(100).optional(),
    sector_allocation_impact: z.number().optional(),
    position_size_recommendation: z.enum(['small', 'medium', 'large']).optional(),
    position_size_percentage: z.number().min(0).max(1).optional()
  }).optional(),
  
  // Implementation guidance
  implementation: z.strictObject({
    entry_strategy: z.string().optional(),
    exit_strategy: z.string().optional(),
    monitoring_points: z.array(z.string()),
    review_schedule: z.string().optional(),
    
    // Position management
    position_management: z.strictObject({
      initial_position_size: z.number().min(0).max(1).optional(),
      scaling_strategy: z.string().optional(),
      stop_loss_level: z.number().optional(),
      take_profit_level: z.number().optional()
    }).optional()
  }).optional(),
  
  // Metadata
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional(),
  
  // Quality metrics
  quality_metrics: z.strictObject({
    data_freshness: z.number().min(0).max(1),
    analysis_completeness: z.number().min(0).max(1),
    confidence_score: z.number().min(0).max(1),
    uncertainty_score: z.number().min(0).max(1)
  }).optional()
});

// Export inferred TypeScript types
export type AnalysisComponentType = z.infer<typeof AnalysisComponent>;
export type ConfidenceLevelType = z.infer<typeof ConfidenceLevel>;
export type RecommendationActionType = z.infer<typeof RecommendationAction>;
export type RiskLevelType = z.infer<typeof RiskLevel>;
export type TimeHorizonType = z.infer<typeof TimeHorizon>;
export type AnalysisInputType = z.infer<typeof AnalysisInput>;
export type SynthesisInputType = z.infer<typeof SynthesisInput>;
export type SynthesisOutputType = z.infer<typeof SynthesisOutput>;

// Export validation functions
export const validateAnalysisInput = (data: unknown): AnalysisInputType => {
  return AnalysisInput.parse(data);
};

export const validateSynthesisInput = (data: unknown): SynthesisInputType => {
  return SynthesisInput.parse(data);
};

export const validateSynthesisOutput = (data: unknown): SynthesisOutputType => {
  return SynthesisOutput.parse(data);
};

// Safe validation functions
export const validateAnalysisInputSafe = (data: unknown) => {
  return AnalysisInput.safeParse(data);
};

export const validateSynthesisInputSafe = (data: unknown) => {
  return SynthesisInput.safeParse(data);
};

export const validateSynthesisOutputSafe = (data: unknown) => {
  return SynthesisOutput.safeParse(data);
};

// Export partial schemas for updates
export const SynthesisInputUpdate = SynthesisInput.partial();
export type SynthesisInputUpdateType = z.infer<typeof SynthesisInputUpdate>;
