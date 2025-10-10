import { z } from 'zod';

/**
 * DCF assumptions for valuation
 */
export const DcfAssumptions = z.strictObject({
  // Revenue assumptions
  revenue_growth_years_1_5: z.number().min(-1).max(2), // -100% to 200%
  revenue_growth_years_6_10: z.number().min(-1).max(1), // -100% to 100%
  terminal_growth_rate: z.number().min(0).max(0.1), // 0% to 10%
  
  // Margin assumptions
  ebitda_margin_current: z.number().min(0).max(1), // 0% to 100%
  ebitda_margin_target: z.number().min(0).max(1), // 0% to 100%
  margin_expansion_years: z.number().int().min(1).max(20),
  
  // Tax assumptions
  tax_rate_current: z.number().min(0).max(0.5), // 0% to 50%
  tax_rate_target: z.number().min(0).max(0.5), // 0% to 50%
  
  // Capital assumptions
  capex_as_percent_revenue: z.number().min(0).max(1), // 0% to 100%
  depreciation_as_percent_capex: z.number().min(0).max(1), // 0% to 100%
  working_capital_as_percent_revenue: z.number().min(-0.5).max(0.5), // -50% to 50%
  
  // Discount rate assumptions
  risk_free_rate: z.number().min(0).max(0.2), // 0% to 20%
  market_risk_premium: z.number().min(0).max(0.2), // 0% to 20%
  beta: z.number().min(0).max(3), // 0 to 3
  cost_of_debt: z.number().min(0).max(0.3), // 0% to 30%
  debt_to_equity_ratio: z.number().min(0).max(2), // 0 to 2
  
  // Terminal value assumptions
  terminal_multiple_method: z.enum(['perpetuity', 'exit_multiple']),
  terminal_ebitda_multiple: z.number().min(1).max(50).optional(),
  
  // Scenario adjustments
  scenario_name: z.string().optional(),
  scenario_probability: z.number().min(0).max(1).optional(),
  
  // Metadata
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  created_by: z.string().optional()
});

/**
 * DCF output for base case
 */
export const DcfBaseOutput = z.strictObject({
  // Valuation results
  enterprise_value: z.number().positive(),
  equity_value: z.number().positive(),
  price_per_share: z.number().positive(),
  current_price: z.number().positive(),
  upside_downside: z.number(), // percentage
  
  // Key metrics
  wacc: z.number().min(0).max(1), // weighted average cost of capital
  terminal_value: z.number().positive(),
  terminal_value_percent: z.number().min(0).max(1), // % of enterprise value
  
  // Cash flow projections (5-year)
  projections: z.array(z.strictObject({
    year: z.number().int().min(1).max(10),
    revenue: z.number().positive(),
    ebitda: z.number(),
    ebit: z.number(),
    ebt: z.number(),
    net_income: z.number(),
    capex: z.number(),
    depreciation: z.number(),
    working_capital_change: z.number(),
    free_cash_flow: z.number(),
    discounted_fcf: z.number()
  })).length(5),
  
  // Terminal year projections
  terminal_year: z.strictObject({
    revenue: z.number().positive(),
    ebitda: z.number(),
    ebit: z.number(),
    net_income: z.number(),
    free_cash_flow: z.number()
  }),
  
  // Sensitivity ranges
  sensitivity_revenue_growth: z.strictObject({
    low: z.number(),
    base: z.number(),
    high: z.number()
  }),
  sensitivity_margins: z.strictObject({
    low: z.number(),
    base: z.number(),
    high: z.number()
  }),
  sensitivity_wacc: z.strictObject({
    low: z.number(),
    base: z.number(),
    high: z.number()
  })
});

/**
 * DCF output for bull case
 */
export const DcfBullOutput = DcfBaseOutput.extend({
  scenario_type: z.literal('bull'),
  assumptions_adjustment: z.strictObject({
    revenue_growth_adjustment: z.number(),
    margin_expansion_adjustment: z.number(),
    terminal_growth_adjustment: z.number(),
    wacc_adjustment: z.number()
  })
});

/**
 * DCF output for bear case
 */
export const DcfBearOutput = DcfBaseOutput.extend({
  scenario_type: z.literal('bear'),
  assumptions_adjustment: z.strictObject({
    revenue_growth_adjustment: z.number(),
    margin_expansion_adjustment: z.number(),
    terminal_growth_adjustment: z.number(),
    wacc_adjustment: z.number()
  })
});

/**
 * DCF sensitivities analysis
 */
export const DcfSensitivities = z.strictObject({
  // Revenue growth sensitivity
  revenue_growth_sensitivity: z.array(z.strictObject({
    growth_rate: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number()
  })),
  
  // Margin sensitivity
  margin_sensitivity: z.array(z.strictObject({
    ebitda_margin: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number()
  })),
  
  // WACC sensitivity
  wacc_sensitivity: z.array(z.strictObject({
    wacc: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number()
  })),
  
  // Terminal growth sensitivity
  terminal_growth_sensitivity: z.array(z.strictObject({
    terminal_growth: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number()
  })),
  
  // Two-way sensitivity (revenue growth vs margins)
  two_way_sensitivity: z.array(z.strictObject({
    revenue_growth: z.number(),
    ebitda_margin: z.number(),
    price_per_share: z.number(),
    upside_downside: z.number()
  }))
});

/**
 * Complete DCF output
 */
export const DcfOutput = z.strictObject({
  symbol: z.string().min(1),
  analysis_date: z.string().datetime(),
  
  // Assumptions used
  assumptions: DcfAssumptions,
  
  // Scenario outputs
  base_case: DcfBaseOutput,
  bull_case: DcfBullOutput.optional(),
  bear_case: DcfBearOutput.optional(),
  
  // Sensitivity analysis
  sensitivities: DcfSensitivities,
  
  // Summary metrics
  summary: z.strictObject({
    fair_value_range: z.strictObject({
      low: z.number(),
      high: z.number(),
      base: z.number()
    }),
    probability_weighted_value: z.number().optional(),
    confidence_level: z.number().min(0).max(1),
    key_drivers: z.array(z.string()),
    key_risks: z.array(z.string())
  }),
  
  // Metadata
  data_sources: z.array(z.string()),
  last_updated: z.string().datetime(),
  analyst: z.string().optional(),
  notes: z.string().optional()
});

// Export inferred TypeScript types
export type DcfAssumptionsType = z.infer<typeof DcfAssumptions>;
export type DcfBaseOutputType = z.infer<typeof DcfBaseOutput>;
export type DcfBullOutputType = z.infer<typeof DcfBullOutput>;
export type DcfBearOutputType = z.infer<typeof DcfBearOutput>;
export type DcfSensitivitiesType = z.infer<typeof DcfSensitivities>;
export type DcfOutputType = z.infer<typeof DcfOutput>;

// Export validation functions
export const validateDcfAssumptions = (data: unknown): DcfAssumptionsType => {
  return DcfAssumptions.parse(data);
};

export const validateDcfOutput = (data: unknown): DcfOutputType => {
  return DcfOutput.parse(data);
};

export const validateDcfSensitivities = (data: unknown): DcfSensitivitiesType => {
  return DcfSensitivities.parse(data);
};

// Safe validation functions
export const validateDcfAssumptionsSafe = (data: unknown) => {
  return DcfAssumptions.safeParse(data);
};

export const validateDcfOutputSafe = (data: unknown) => {
  return DcfOutput.safeParse(data);
};

export const validateDcfSensitivitiesSafe = (data: unknown) => {
  return DcfSensitivities.safeParse(data);
};

// Export partial schemas for updates
export const DcfAssumptionsUpdate = DcfAssumptions.partial();
export type DcfAssumptionsUpdateType = z.infer<typeof DcfAssumptionsUpdate>;
