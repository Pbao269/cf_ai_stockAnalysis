import { describe, it, expect } from 'vitest';
import {
  DcfAssumptions,
  DcfBaseOutput,
  DcfBullOutput,
  DcfBearOutput,
  DcfSensitivities,
  DcfOutput,
  validateDcfAssumptions,
  validateDcfOutput,
  validateDcfSensitivities,
  validateDcfAssumptionsSafe,
  validateDcfOutputSafe,
  validateDcfSensitivitiesSafe,
  type DcfAssumptionsType,
  type DcfBaseOutputType,
  type DcfOutputType
} from '../dcf';

describe('DCF Schema', () => {
  describe('DcfAssumptions', () => {
    const validAssumptions: DcfAssumptionsType = {
      revenue_growth_years_1_5: 0.15,
      revenue_growth_years_6_10: 0.08,
      terminal_growth_rate: 0.03,
      ebitda_margin_current: 0.25,
      ebitda_margin_target: 0.30,
      margin_expansion_years: 5,
      tax_rate_current: 0.25,
      tax_rate_target: 0.25,
      capex_as_percent_revenue: 0.05,
      depreciation_as_percent_capex: 0.8,
      working_capital_as_percent_revenue: 0.02,
      risk_free_rate: 0.04,
      market_risk_premium: 0.06,
      beta: 1.2,
      cost_of_debt: 0.05,
      debt_to_equity_ratio: 0.3,
      terminal_multiple_method: 'perpetuity',
      terminal_ebitda_multiple: 15,
      scenario_name: 'Base Case',
      scenario_probability: 0.6,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'analyst-1'
    };

    it('should validate complete DCF assumptions', () => {
      expect(() => DcfAssumptions.parse(validAssumptions)).not.toThrow();
      expect(DcfAssumptions.parse(validAssumptions)).toEqual(validAssumptions);
    });

    it('should validate minimal DCF assumptions', () => {
      const minimalAssumptions = {
        revenue_growth_years_1_5: 0.15,
        revenue_growth_years_6_10: 0.08,
        terminal_growth_rate: 0.03,
        ebitda_margin_current: 0.25,
        ebitda_margin_target: 0.30,
        margin_expansion_years: 5,
        tax_rate_current: 0.25,
        tax_rate_target: 0.25,
        capex_as_percent_revenue: 0.05,
        depreciation_as_percent_capex: 0.8,
        working_capital_as_percent_revenue: 0.02,
        risk_free_rate: 0.04,
        market_risk_premium: 0.06,
        beta: 1.2,
        cost_of_debt: 0.05,
        debt_to_equity_ratio: 0.3,
        terminal_multiple_method: 'perpetuity'
      };

      expect(() => DcfAssumptions.parse(minimalAssumptions)).not.toThrow();
    });

    it('should reject revenue growth outside valid range', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        revenue_growth_years_1_5: 3.0 // too high
      };

      expect(() => DcfAssumptions.parse(invalidAssumptions)).toThrow();
    });

    it('should reject negative terminal growth rate', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        terminal_growth_rate: -0.01
      };

      expect(() => DcfAssumptions.parse(invalidAssumptions)).toThrow();
    });

    it('should reject margins outside 0-1 range', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        ebitda_margin_current: 1.5 // too high
      };

      expect(() => DcfAssumptions.parse(invalidAssumptions)).toThrow();
    });

    it('should reject invalid terminal multiple method', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        terminal_multiple_method: 'invalid_method'
      };

      expect(() => DcfAssumptions.parse(invalidAssumptions)).toThrow();
    });

    it('should reject scenario probability outside 0-1 range', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        scenario_probability: 1.5
      };

      expect(() => DcfAssumptions.parse(invalidAssumptions)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        created_at: 'invalid-date'
      };

      expect(() => DcfAssumptions.parse(invalidAssumptions)).toThrow();
    });
  });

  describe('DcfBaseOutput', () => {
    const validBaseOutput: DcfBaseOutputType = {
      enterprise_value: 2000000000000,
      equity_value: 1800000000000,
      price_per_share: 120.0,
      current_price: 100.0,
      upside_downside: 20.0,
      wacc: 0.08,
      terminal_value: 800000000000,
      terminal_value_percent: 0.4,
      projections: [
        {
          year: 1,
          revenue: 100000000000,
          ebitda: 25000000000,
          ebit: 20000000000,
          ebt: 18000000000,
          net_income: 13500000000,
          capex: 5000000000,
          depreciation: 4000000000,
          working_capital_change: 2000000000,
          free_cash_flow: 15000000000,
          discounted_fcf: 13888888889
        },
        {
          year: 2,
          revenue: 115000000000,
          ebitda: 28750000000,
          ebit: 23000000000,
          ebt: 20700000000,
          net_income: 15525000000,
          capex: 5750000000,
          depreciation: 4600000000,
          working_capital_change: 3000000000,
          free_cash_flow: 17250000000,
          discounted_fcf: 14791666667
        },
        {
          year: 3,
          revenue: 132250000000,
          ebitda: 33062500000,
          ebit: 26450000000,
          ebt: 23805000000,
          net_income: 17853750000,
          capex: 6612500000,
          depreciation: 5290000000,
          working_capital_change: 3450000000,
          free_cash_flow: 19837500000,
          discounted_fcf: 15750000000
        },
        {
          year: 4,
          revenue: 152087500000,
          ebitda: 38021875000,
          ebit: 30417500000,
          ebt: 27375750000,
          net_income: 20531812500,
          capex: 7604375000,
          depreciation: 6083500000,
          working_capital_change: 3967500000,
          free_cash_flow: 22813125000,
          discounted_fcf: 16750000000
        },
        {
          year: 5,
          revenue: 174900625000,
          ebitda: 43725156250,
          ebit: 34980062500,
          ebt: 31482056250,
          net_income: 23611542188,
          capex: 8745031250,
          depreciation: 6996012500,
          working_capital_change: 4562062500,
          free_cash_flow: 26233968750,
          discounted_fcf: 17850000000
        }
      ],
      terminal_year: {
        revenue: 188892675000,
        ebitda: 47223168750,
        ebit: 37778535000,
        net_income: 28333901250,
        free_cash_flow: 28333901250
      },
      sensitivity_revenue_growth: {
        low: 100.0,
        base: 120.0,
        high: 140.0
      },
      sensitivity_margins: {
        low: 110.0,
        base: 120.0,
        high: 130.0
      },
      sensitivity_wacc: {
        low: 130.0,
        base: 120.0,
        high: 110.0
      }
    };

    it('should validate complete DCF base output', () => {
      expect(() => DcfBaseOutput.parse(validBaseOutput)).not.toThrow();
      expect(DcfBaseOutput.parse(validBaseOutput)).toEqual(validBaseOutput);
    });

    it('should reject negative enterprise value', () => {
      const invalidOutput = {
        ...validBaseOutput,
        enterprise_value: -1000000000
      };

      expect(() => DcfBaseOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject WACC outside 0-1 range', () => {
      const invalidOutput = {
        ...validBaseOutput,
        wacc: 1.5
      };

      expect(() => DcfBaseOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject terminal value percent outside 0-1 range', () => {
      const invalidOutput = {
        ...validBaseOutput,
        terminal_value_percent: 1.5
      };

      expect(() => DcfBaseOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject projections array with wrong length', () => {
      const invalidOutput = {
        ...validBaseOutput,
        projections: validBaseOutput.projections.slice(0, 3) // only 3 years instead of 5
      };

      expect(() => DcfBaseOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject projection year outside 1-10 range', () => {
      const invalidOutput = {
        ...validBaseOutput,
        projections: [
          ...validBaseOutput.projections.slice(0, 4),
          {
            ...validBaseOutput.projections[4],
            year: 11 // invalid year
          }
        ]
      };

      expect(() => DcfBaseOutput.parse(invalidOutput)).toThrow();
    });
  });

  describe('DcfOutput', () => {
    const validDcfOutput: DcfOutputType = {
      symbol: 'AAPL',
      analysis_date: '2024-01-01T00:00:00Z',
      assumptions: {
        revenue_growth_years_1_5: 0.15,
        revenue_growth_years_6_10: 0.08,
        terminal_growth_rate: 0.03,
        ebitda_margin_current: 0.25,
        ebitda_margin_target: 0.30,
        margin_expansion_years: 5,
        tax_rate_current: 0.25,
        tax_rate_target: 0.25,
        capex_as_percent_revenue: 0.05,
        depreciation_as_percent_capex: 0.8,
        working_capital_as_percent_revenue: 0.02,
        risk_free_rate: 0.04,
        market_risk_premium: 0.06,
        beta: 1.2,
        cost_of_debt: 0.05,
        debt_to_equity_ratio: 0.3,
        terminal_multiple_method: 'perpetuity'
      },
      base_case: {
        enterprise_value: 2000000000000,
        equity_value: 1800000000000,
        price_per_share: 120.0,
        current_price: 100.0,
        upside_downside: 20.0,
        wacc: 0.08,
        terminal_value: 800000000000,
        terminal_value_percent: 0.4,
        projections: [
          {
            year: 1,
            revenue: 100000000000,
            ebitda: 25000000000,
            ebit: 20000000000,
            ebt: 18000000000,
            net_income: 13500000000,
            capex: 5000000000,
            depreciation: 4000000000,
            working_capital_change: 2000000000,
            free_cash_flow: 15000000000,
            discounted_fcf: 13888888889
          },
          {
            year: 2,
            revenue: 115000000000,
            ebitda: 28750000000,
            ebit: 23000000000,
            ebt: 20700000000,
            net_income: 15525000000,
            capex: 5750000000,
            depreciation: 4600000000,
            working_capital_change: 3000000000,
            free_cash_flow: 17250000000,
            discounted_fcf: 14791666667
          },
          {
            year: 3,
            revenue: 132250000000,
            ebitda: 33062500000,
            ebit: 26450000000,
            ebt: 23805000000,
            net_income: 17853750000,
            capex: 6612500000,
            depreciation: 5290000000,
            working_capital_change: 3450000000,
            free_cash_flow: 19837500000,
            discounted_fcf: 15750000000
          },
          {
            year: 4,
            revenue: 152087500000,
            ebitda: 38021875000,
            ebit: 30417500000,
            ebt: 27375750000,
            net_income: 20531812500,
            capex: 7604375000,
            depreciation: 6083500000,
            working_capital_change: 3967500000,
            free_cash_flow: 22813125000,
            discounted_fcf: 16750000000
          },
          {
            year: 5,
            revenue: 174900625000,
            ebitda: 43725156250,
            ebit: 34980062500,
            ebt: 31482056250,
            net_income: 23611542188,
            capex: 8745031250,
            depreciation: 6996012500,
            working_capital_change: 4562062500,
            free_cash_flow: 26233968750,
            discounted_fcf: 17850000000
          }
        ],
        terminal_year: {
          revenue: 188892675000,
          ebitda: 47223168750,
          ebit: 37778535000,
          net_income: 28333901250,
          free_cash_flow: 28333901250
        },
        sensitivity_revenue_growth: {
          low: 100.0,
          base: 120.0,
          high: 140.0
        },
        sensitivity_margins: {
          low: 110.0,
          base: 120.0,
          high: 130.0
        },
        sensitivity_wacc: {
          low: 130.0,
          base: 120.0,
          high: 110.0
        }
      },
      sensitivities: {
        revenue_growth_sensitivity: [
          { growth_rate: 0.10, price_per_share: 100.0, upside_downside: 0.0 },
          { growth_rate: 0.15, price_per_share: 120.0, upside_downside: 20.0 },
          { growth_rate: 0.20, price_per_share: 140.0, upside_downside: 40.0 }
        ],
        margin_sensitivity: [
          { ebitda_margin: 0.20, price_per_share: 110.0, upside_downside: 10.0 },
          { ebitda_margin: 0.25, price_per_share: 120.0, upside_downside: 20.0 },
          { ebitda_margin: 0.30, price_per_share: 130.0, upside_downside: 30.0 }
        ],
        wacc_sensitivity: [
          { wacc: 0.06, price_per_share: 130.0, upside_downside: 30.0 },
          { wacc: 0.08, price_per_share: 120.0, upside_downside: 20.0 },
          { wacc: 0.10, price_per_share: 110.0, upside_downside: 10.0 }
        ],
        terminal_growth_sensitivity: [
          { terminal_growth: 0.02, price_per_share: 110.0, upside_downside: 10.0 },
          { terminal_growth: 0.03, price_per_share: 120.0, upside_downside: 20.0 },
          { terminal_growth: 0.04, price_per_share: 130.0, upside_downside: 30.0 }
        ],
        two_way_sensitivity: [
          { revenue_growth: 0.10, ebitda_margin: 0.20, price_per_share: 100.0, upside_downside: 0.0 },
          { revenue_growth: 0.15, ebitda_margin: 0.25, price_per_share: 120.0, upside_downside: 20.0 },
          { revenue_growth: 0.20, ebitda_margin: 0.30, price_per_share: 140.0, upside_downside: 40.0 }
        ]
      },
      summary: {
        fair_value_range: {
          low: 100.0,
          high: 140.0,
          base: 120.0
        },
        probability_weighted_value: 120.0,
        confidence_level: 0.8,
        key_drivers: ['Revenue growth', 'Margin expansion', 'Terminal growth'],
        key_risks: ['Competition', 'Market saturation', 'Regulatory changes']
      },
      data_sources: ['fmp', 'sec'],
      last_updated: '2024-01-01T00:00:00Z',
      analyst: 'analyst-1',
      notes: 'Conservative assumptions used'
    };

    it('should validate complete DCF output', () => {
      expect(() => DcfOutput.parse(validDcfOutput)).not.toThrow();
      expect(DcfOutput.parse(validDcfOutput)).toEqual(validDcfOutput);
    });

    it('should reject empty symbol', () => {
      const invalidOutput = {
        ...validDcfOutput,
        symbol: ''
      };

      expect(() => DcfOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidOutput = {
        ...validDcfOutput,
        analysis_date: 'invalid-date'
      };

      expect(() => DcfOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject confidence level outside 0-1 range', () => {
      const invalidOutput = {
        ...validDcfOutput,
        summary: {
          ...validDcfOutput.summary,
          confidence_level: 1.5
        }
      };

      expect(() => DcfOutput.parse(invalidOutput)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validAssumptions: DcfAssumptionsType = {
      revenue_growth_years_1_5: 0.15,
      revenue_growth_years_6_10: 0.08,
      terminal_growth_rate: 0.03,
      ebitda_margin_current: 0.25,
      ebitda_margin_target: 0.30,
      margin_expansion_years: 5,
      tax_rate_current: 0.25,
      tax_rate_target: 0.25,
      capex_as_percent_revenue: 0.05,
      depreciation_as_percent_capex: 0.8,
      working_capital_as_percent_revenue: 0.02,
      risk_free_rate: 0.04,
      market_risk_premium: 0.06,
      beta: 1.2,
      cost_of_debt: 0.05,
      debt_to_equity_ratio: 0.3,
      terminal_multiple_method: 'perpetuity'
    };

    it('should validate DCF assumptions using validateDcfAssumptions', () => {
      expect(() => validateDcfAssumptions(validAssumptions)).not.toThrow();
      expect(validateDcfAssumptions(validAssumptions)).toEqual(validAssumptions);
    });

    it('should validate DCF assumptions using validateDcfAssumptionsSafe', () => {
      const result = validateDcfAssumptionsSafe(validAssumptions);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAssumptions);
      }
    });

    it('should return error for invalid DCF assumptions using validateDcfAssumptionsSafe', () => {
      const invalidAssumptions = {
        ...validAssumptions,
        revenue_growth_years_1_5: 3.0 // invalid value
      };

      const result = validateDcfAssumptionsSafe(invalidAssumptions);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary values for growth rates', () => {
      const assumptions = {
        revenue_growth_years_1_5: -1.0, // minimum value
        revenue_growth_years_6_10: 1.0, // maximum value
        terminal_growth_rate: 0.0, // minimum value
        ebitda_margin_current: 0.0, // minimum value
        ebitda_margin_target: 1.0, // maximum value
        margin_expansion_years: 1, // minimum value
        tax_rate_current: 0.0, // minimum value
        tax_rate_target: 0.5, // maximum value
        capex_as_percent_revenue: 0.0, // minimum value
        depreciation_as_percent_capex: 1.0, // maximum value
        working_capital_as_percent_revenue: -0.5, // minimum value
        risk_free_rate: 0.0, // minimum value
        market_risk_premium: 0.2, // maximum value
        beta: 0.0, // minimum value
        cost_of_debt: 0.0, // minimum value
        debt_to_equity_ratio: 0.0, // minimum value
        terminal_multiple_method: 'perpetuity'
      };

      expect(() => DcfAssumptions.parse(assumptions)).not.toThrow();
    });

    it('should handle both terminal multiple methods', () => {
      const perpetuityAssumptions = {
        revenue_growth_years_1_5: 0.15,
        revenue_growth_years_6_10: 0.08,
        terminal_growth_rate: 0.03,
        ebitda_margin_current: 0.25,
        ebitda_margin_target: 0.30,
        margin_expansion_years: 5,
        tax_rate_current: 0.25,
        tax_rate_target: 0.25,
        capex_as_percent_revenue: 0.05,
        depreciation_as_percent_capex: 0.8,
        working_capital_as_percent_revenue: 0.02,
        risk_free_rate: 0.04,
        market_risk_premium: 0.06,
        beta: 1.2,
        cost_of_debt: 0.05,
        debt_to_equity_ratio: 0.3,
        terminal_multiple_method: 'perpetuity'
      };

      const exitMultipleAssumptions = {
        ...perpetuityAssumptions,
        terminal_multiple_method: 'exit_multiple',
        terminal_ebitda_multiple: 15
      };

      expect(() => DcfAssumptions.parse(perpetuityAssumptions)).not.toThrow();
      expect(() => DcfAssumptions.parse(exitMultipleAssumptions)).not.toThrow();
    });
  });
});
