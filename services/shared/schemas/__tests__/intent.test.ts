import { describe, it, expect } from 'vitest';
import {
  Intent,
  StyleWeights,
  InvestmentGates,
  validateIntent,
  validateIntentSafe,
  type IntentType,
  type StyleWeightsType,
  type InvestmentGatesType
} from '../intent';

describe('Intent Schema', () => {
  describe('StyleWeights', () => {
    it('should validate correct style weights that sum to 1.0', () => {
      const validWeights: StyleWeightsType = {
        value: 0.3,
        growth: 0.2,
        momentum: 0.15,
        quality: 0.2,
        size: 0.1,
        volatility: 0.05
      };

      expect(() => StyleWeights.parse(validWeights)).not.toThrow();
      expect(StyleWeights.parse(validWeights)).toEqual(validWeights);
    });

    it('should reject style weights that do not sum to 1.0', () => {
      const invalidWeights = {
        value: 0.3,
        growth: 0.2,
        momentum: 0.15,
        quality: 0.2,
        size: 0.1,
        volatility: 0.1 // Sum = 1.05
      };

      expect(() => StyleWeights.parse(invalidWeights)).toThrow();
    });

    it('should reject negative style weights', () => {
      const invalidWeights = {
        value: -0.1,
        growth: 0.2,
        momentum: 0.15,
        quality: 0.2,
        size: 0.1,
        volatility: 0.45
      };

      expect(() => StyleWeights.parse(invalidWeights)).toThrow();
    });

    it('should reject style weights greater than 1.0', () => {
      const invalidWeights = {
        value: 1.1,
        growth: 0.2,
        momentum: 0.15,
        quality: 0.2,
        size: 0.1,
        volatility: 0.25
      };

      expect(() => StyleWeights.parse(invalidWeights)).toThrow();
    });
  });

  describe('InvestmentGates', () => {
    it('should validate correct investment gates', () => {
      const validGates: InvestmentGatesType = {
        min_market_cap: 1000000000,
        max_market_cap: 10000000000,
        min_volume: 1000000,
        sectors: ['Technology', 'Healthcare'],
        exclude_sectors: ['Energy'],
        min_dividend_yield: 0.02,
        max_pe_ratio: 25,
        exclude_penny_stocks: true
      };

      expect(() => InvestmentGates.parse(validGates)).not.toThrow();
      expect(InvestmentGates.parse(validGates)).toEqual(validGates);
    });

    it('should reject gates where min > max', () => {
      const invalidGates = {
        min_market_cap: 10000000000,
        max_market_cap: 1000000000 // min > max
      };

      expect(() => InvestmentGates.parse(invalidGates)).toThrow();
    });

    it('should reject negative values for positive-only fields', () => {
      const invalidGates = {
        min_market_cap: -1000000,
        min_volume: -1000,
        min_price: -10
      };

      expect(() => InvestmentGates.parse(invalidGates)).toThrow();
    });

    it('should allow optional fields to be undefined', () => {
      const minimalGates = {};

      expect(() => InvestmentGates.parse(minimalGates)).not.toThrow();
    });
  });

  describe('Intent', () => {
    const validIntent: IntentType = {
      objective: 'growth',
      risk_tolerance: 'moderate',
      horizon_years: 5,
      style_weights: {
        value: 0.3,
        growth: 0.2,
        momentum: 0.15,
        quality: 0.2,
        size: 0.1,
        volatility: 0.05
      },
      gates: {
        min_market_cap: 1000000000,
        sectors: ['Technology']
      }
    };

    it('should validate a complete intent', () => {
      expect(() => Intent.parse(validIntent)).not.toThrow();
      expect(Intent.parse(validIntent)).toEqual(validIntent);
    });

    it('should reject invalid objective', () => {
      const invalidIntent = {
        ...validIntent,
        objective: 'invalid_objective'
      };

      expect(() => Intent.parse(invalidIntent)).toThrow();
    });

    it('should reject invalid risk tolerance', () => {
      const invalidIntent = {
        ...validIntent,
        risk_tolerance: 'invalid_risk'
      };

      expect(() => Intent.parse(invalidIntent)).toThrow();
    });

    it('should reject horizon_years outside valid range', () => {
      const invalidIntent = {
        ...validIntent,
        horizon_years: 0 // too low
      };

      expect(() => Intent.parse(invalidIntent)).toThrow();

      const invalidIntent2 = {
        ...validIntent,
        horizon_years: 51 // too high
      };

      expect(() => Intent.parse(invalidIntent2)).toThrow();
    });

    it('should accept optional metadata fields', () => {
      const intentWithMetadata = {
        ...validIntent,
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      expect(() => Intent.parse(intentWithMetadata)).not.toThrow();
    });

    it('should reject invalid UUID format', () => {
      const invalidIntent = {
        ...validIntent,
        user_id: 'invalid-uuid'
      };

      expect(() => Intent.parse(invalidIntent)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidIntent = {
        ...validIntent,
        created_at: 'invalid-date'
      };

      expect(() => Intent.parse(invalidIntent)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validIntent: IntentType = {
      objective: 'growth',
      risk_tolerance: 'moderate',
      horizon_years: 5,
      style_weights: {
        value: 0.3,
        growth: 0.2,
        momentum: 0.15,
        quality: 0.2,
        size: 0.1,
        volatility: 0.05
      },
      gates: {}
    };

    it('should validate intent using validateIntent function', () => {
      expect(() => validateIntent(validIntent)).not.toThrow();
      expect(validateIntent(validIntent)).toEqual(validIntent);
    });

    it('should validate intent using validateIntentSafe function', () => {
      const result = validateIntentSafe(validIntent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validIntent);
      }
    });

    it('should return error for invalid intent using validateIntentSafe', () => {
      const invalidIntent = {
        ...validIntent,
        objective: 'invalid'
      };

      const result = validateIntentSafe(invalidIntent);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle floating point precision in style weights', () => {
      const weightsWithPrecision = {
        value: 0.3333333333333333,
        growth: 0.3333333333333333,
        momentum: 0.3333333333333333,
        quality: 0,
        size: 0,
        volatility: 0
      };

      expect(() => StyleWeights.parse(weightsWithPrecision)).not.toThrow();
    });

    it('should handle empty gates object', () => {
      const intentWithEmptyGates = {
        objective: 'growth',
        risk_tolerance: 'moderate',
        horizon_years: 5,
        style_weights: {
          value: 0.3,
          growth: 0.2,
          momentum: 0.15,
          quality: 0.2,
          size: 0.1,
          volatility: 0.05
        },
        gates: {}
      };

      expect(() => Intent.parse(intentWithEmptyGates)).not.toThrow();
    });

    it('should handle all valid objectives', () => {
      const objectives = ['growth', 'income', 'balanced', 'preservation', 'speculation'];
      
      objectives.forEach(objective => {
        const intent = {
          objective,
          risk_tolerance: 'moderate',
          horizon_years: 5,
          style_weights: {
            value: 0.3,
            growth: 0.2,
            momentum: 0.15,
            quality: 0.2,
            size: 0.1,
            volatility: 0.05
          },
          gates: {}
        };

        expect(() => Intent.parse(intent)).not.toThrow();
      });
    });

    it('should handle all valid risk tolerances', () => {
      const riskTolerances = ['conservative', 'moderate', 'aggressive', 'very_aggressive'];
      
      riskTolerances.forEach(riskTolerance => {
        const intent = {
          objective: 'growth',
          risk_tolerance: riskTolerance,
          horizon_years: 5,
          style_weights: {
            value: 0.3,
            growth: 0.2,
            momentum: 0.15,
            quality: 0.2,
            size: 0.1,
            volatility: 0.05
          },
          gates: {}
        };

        expect(() => Intent.parse(intent)).not.toThrow();
      });
    });
  });
});
