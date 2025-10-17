import { z } from 'zod';

/**
 * DCF assumptions
 */
export const DcfAssumptions = z.strictObject({
  revenue_growth_years_1_5: z.number().min(-1).max(1),
  revenue_growth_years_6_10: z.number().min(-1).max(1),
  terminal_growth_rate: z.number().min(0).max(0.1),
  ebitda_margin_current: z.number().min(0).max(1),
  ebitda_margin_target: z.number().min(0).max(1),
  margin_expansion_years: z.number().int().min(1).max(10),
  tax_rate_current: z.number().min(0).max(0.5),
  tax_rate_target: z.number().min(0).max(0.5),
  capex_as_percent_revenue: z.number().min(0).max(1),
  depreciation_as_percent_capex: z.number().min(0).max(1),
  working_capital_as_percent_revenue: z.number().min(-0.5).max(0.5),
  risk_free_rate: z.number().min(0).max(0.2),
  market_risk_premium: z.number().min(0).max(0.2),
  beta: z.number().min(0).max(3),
  cost_of_debt: z.number().min(0).max(0.2),
  debt_to_equity_ratio: z.number().min(0).max(2),
  terminal_multiple_method: z.enum(['perpetuity', 'exit_multiple']),
  terminal_ebitda_multiple: z.number().positive().optional(),
  scenario_name: z.string().optional(),
  scenario_probability: z.number().min(0).max(1).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  created_by: z.string().optional(),
});

/**
 * DCF base output
 */
export const DcfBaseOutput = z.strictObject({
  enterprise_value: z.number().positive(),
  equity_value: z.number().positive(),
  price_per_share: z.number().positive(),
  current_price: z.number().positive(),
  upside_downside: z.number(),
  wacc: z.number().min(0).max(1),
  terminal_value: z.number().positive(),
  terminal_value_percent: z.number().min(0).max(1),
  projections: z.array(z.strictObject({
    year: z.number().int().min(1).max(10),
    revenue: z.number(),
    ebitda: z.number(),
    ebit: z.number(),
    ebt: z.number(),
    net_income: z.number(),
    capex: z.number(),
    depreciation: z.number(),
    working_capital_change: z.number(),
    free_cash_flow: z.number(),
    discounted_fcf: z.number(),
  })).length(5),
  terminal_year: z.strictObject({
    revenue: z.number(),
    ebitda: z.number(),
    ebit: z.number(),
    net_income: z.number(),
    free_cash_flow: z.number(),
  }),
  sensitivity_revenue_growth: z.strictObject({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
  sensitivity_margins: z.strictObject({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
  sensitivity_wacc: z.strictObject({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
});

/**
 * DCF bull output
 */
export const DcfBullOutput = DcfBaseOutput.extend({
  scenario_name: z.literal('bull_case'),
});

/**
 * DCF bear output
 */
export const DcfBearOutput = DcfBaseOutput.extend({
  scenario_name: z.literal('bear_case'),
});

/**
 * DCF sensitivities
 */
export const DcfSensitivities = z.strictObject({
  revenue_growth_sensitivity: z.array(z.strictObject({
    growth_rate: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number(),
  })),
  margin_sensitivity: z.array(z.strictObject({
    ebitda_margin: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number(),
  })),
  wacc_sensitivity: z.array(z.strictObject({
    wacc: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number(),
  })),
  terminal_growth_sensitivity: z.array(z.strictObject({
    terminal_growth: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number(),
  })),
  two_way_sensitivity: z.array(z.strictObject({
    revenue_growth: z.number(),
    ebitda_margin: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number(),
  })),
});

/**
 * Complete DCF output
 */
export const DcfOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  assumptions: DcfAssumptions,
  base_case: DcfBaseOutput,
  bull_case: DcfBullOutput.optional(),
  bear_case: DcfBearOutput.optional(),
  sensitivities: DcfSensitivities.optional(),
  summary: z.strictObject({
    fair_value_range: z.strictObject({
      low: z.number(),
      high: z.number(),
      base: z.number(),
    }),
    probability_weighted_value: z.number(),
    confidence_level: z.number().min(0).max(1),
    key_drivers: z.array(z.string()),
    key_risks: z.array(z.string()),
  }),
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional(),
});

export type DcfAssumptionsType = z.infer<typeof DcfAssumptions>;
export type DcfBaseOutputType = z.infer<typeof DcfBaseOutput>;
export type DcfBullOutputType = z.infer<typeof DcfBullOutput>;
export type DcfBearOutputType = z.infer<typeof DcfBearOutput>;
export type DcfSensitivitiesType = z.infer<typeof DcfSensitivities>;
export type DcfOutputType = z.infer<typeof DcfOutput>;

// Validation functions
export const validateDcfAssumptions = (data: unknown): DcfAssumptionsType => {
  return DcfAssumptions.parse(data);
};

export const validateDcfOutput = (data: unknown): DcfOutputType => {
  return DcfOutput.parse(data);
};

export const validateDcfSensitivities = (data: unknown): DcfSensitivitiesType => {
  return DcfSensitivities.parse(data);
};

export const validateDcfAssumptionsSafe = (data: unknown) => {
  return DcfAssumptions.safeParse(data);
};

export const validateDcfOutputSafe = (data: unknown) => {
  return DcfOutput.safeParse(data);
};

export const validateDcfSensitivitiesSafe = (data: unknown) => {
  return DcfSensitivities.safeParse(data);
};

// ================= Unified wire-level schemas (Python → Worker) =================

export const ConfidenceFactorSchema = z.strictObject({
  factor: z.string(),
  impact: z.number(),
  description: z.string(),
});
export type ConfidenceFactor = z.infer<typeof ConfidenceFactorSchema>;

export const UnifiedIndividualValuationSchema = z.strictObject({
  model: z.string(),
  model_name: z.string().optional(),
  price_per_share: z.number(),
  price_per_share_original: z.number().optional(),
  enterprise_value: z.number().optional(),
  upside_downside: z.number().optional(),
  wacc: z.number().optional(),
  assumptions: z.any().optional(),
  projections: z.array(z.any()).optional(),
  sanity_cap_applied: z.string().optional(),
  healthcare_cap_applied: z.string().optional(),
});

export const UnifiedConsensusValuationSchema = z.strictObject({
  weighted_fair_value: z.number(),
  simple_average: z.number(),
  range: z.strictObject({
    low: z.number(),
    high: z.number(),
  }),
  upside_to_weighted: z.number(),
  confidence_score: z.number(),
  confidence_level: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  confidence_factors: z.strictObject({
    score: z.number(),
    level: z.string(),
    factors: z.array(ConfidenceFactorSchema),
    interpretation: z.string(),
  }),
  weighting_method: z.strictObject({
    description: z.string(),
    rationale: z.string(),
    hmodel_weight: z.number().nullable(),
    stage3_weight: z.number().nullable(),
  }),
  method: z.string().optional(),
});

export const UnifiedDcfResponseSchema = z.object({
  individual_valuations: z.array(UnifiedIndividualValuationSchema),
  consensus_valuation: UnifiedConsensusValuationSchema,
  recommendation: z.string().optional(),
}).passthrough();

export type UnifiedIndividualValuationType = z.infer<typeof UnifiedIndividualValuationSchema>;
export type UnifiedConsensusValuationType = z.infer<typeof UnifiedConsensusValuationSchema>;
export type UnifiedDcfResponseType = z.infer<typeof UnifiedDcfResponseSchema>;
