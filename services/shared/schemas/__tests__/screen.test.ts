import { describe, it, expect } from 'vitest';
import {
  MetricRule,
  StyleChecklist,
  ScreenFilters,
  ScreenHit,
  validateScreenFilters,
  validateScreenHit,
  validateScreenFiltersSafe,
  validateScreenHitSafe,
  type MetricRuleType,
  type StyleChecklistType,
  type ScreenFiltersType,
  type ScreenHitType
} from '../screen';

describe('Screen Schema', () => {
  describe('MetricRule', () => {
    it('should validate correct metric rule', () => {
      const validRule: MetricRuleType = {
        metric: 'pe_ratio',
        operator: 'lt',
        value: 25,
        weight: 0.8,
        description: 'PE ratio less than 25'
      };

      expect(() => MetricRule.parse(validRule)).not.toThrow();
      expect(MetricRule.parse(validRule)).toEqual(validRule);
    });

    it('should validate between operator with array value', () => {
      const validRule = {
        metric: 'market_cap',
        operator: 'between',
        value: [1000000000, 10000000000]
      };

      expect(() => MetricRule.parse(validRule)).not.toThrow();
    });

    it('should validate in operator with array value', () => {
      const validRule = {
        metric: 'sector',
        operator: 'in',
        value: ['Technology', 'Healthcare', 'Finance']
      };

      expect(() => MetricRule.parse(validRule)).not.toThrow();
    });

    it('should reject invalid operator', () => {
      const invalidRule = {
        metric: 'pe_ratio',
        operator: 'invalid_operator',
        value: 25
      };

      expect(() => MetricRule.parse(invalidRule)).toThrow();
    });

    it('should reject weight outside 0-1 range', () => {
      const invalidRule = {
        metric: 'pe_ratio',
        operator: 'lt',
        value: 25,
        weight: 1.5 // invalid weight
      };

      expect(() => MetricRule.parse(invalidRule)).toThrow();
    });

    it('should allow optional fields to be undefined', () => {
      const minimalRule = {
        metric: 'pe_ratio',
        operator: 'lt',
        value: 25
      };

      expect(() => MetricRule.parse(minimalRule)).not.toThrow();
    });
  });

  describe('StyleChecklist', () => {
    it('should validate complete style checklist', () => {
      const validChecklist: StyleChecklistType = {
        value_criteria: {
          pe_ratio_max: 20,
          pb_ratio_max: 2,
          dividend_yield_min: 0.03
        },
        growth_criteria: {
          revenue_growth_min: 0.1,
          earnings_growth_min: 0.15
        },
        momentum_criteria: {
          price_momentum_3m_min: 0.05,
          volume_trend: 'increasing'
        },
        quality_criteria: {
          roe_min: 0.15,
          current_ratio_min: 1.5
        },
        size_criteria: {
          market_cap_min: 1000000000,
          market_cap_max: 50000000000
        },
        volatility_criteria: {
          beta_max: 1.2,
          volatility_30d_max: 0.3
        }
      };

      expect(() => StyleChecklist.parse(validChecklist)).not.toThrow();
      expect(StyleChecklist.parse(validChecklist)).toEqual(validChecklist);
    });

    it('should validate empty style checklist', () => {
      const emptyChecklist = {};

      expect(() => StyleChecklist.parse(emptyChecklist)).not.toThrow();
    });

    it('should reject negative values for positive-only fields', () => {
      const invalidChecklist = {
        value_criteria: {
          pe_ratio_max: -10 // invalid negative value
        }
      };

      expect(() => StyleChecklist.parse(invalidChecklist)).toThrow();
    });

    it('should reject invalid volume trend', () => {
      const invalidChecklist = {
        momentum_criteria: {
          volume_trend: 'invalid_trend'
        }
      };

      expect(() => StyleChecklist.parse(invalidChecklist)).toThrow();
    });
  });

  describe('ScreenFilters', () => {
    const validFilters: ScreenFiltersType = {
      rules: [
        {
          metric: 'pe_ratio',
          operator: 'lt',
          value: 25
        },
        {
          metric: 'market_cap',
          operator: 'gte',
          value: 1000000000
        }
      ],
      style_checklist: {
        value_criteria: {
          pe_ratio_max: 20
        }
      },
      sectors: ['Technology', 'Healthcare'],
      exclude_sectors: ['Energy'],
      market_cap_range: {
        min: 1000000000,
        max: 10000000000
      },
      exclude_penny_stocks: true,
      limit: 100
    };

    it('should validate complete screen filters', () => {
      expect(() => ScreenFilters.parse(validFilters)).not.toThrow();
      expect(ScreenFilters.parse(validFilters)).toEqual(validFilters);
    });

    it('should reject empty rules array', () => {
      const invalidFilters = {
        rules: []
      };

      expect(() => ScreenFilters.parse(invalidFilters)).toThrow();
    });

    it('should reject limit greater than 10000', () => {
      const invalidFilters = {
        rules: [{ metric: 'pe_ratio', operator: 'lt', value: 25 }],
        limit: 15000
      };

      expect(() => ScreenFilters.parse(invalidFilters)).toThrow();
    });

    it('should reject negative offset', () => {
      const invalidFilters = {
        rules: [{ metric: 'pe_ratio', operator: 'lt', value: 25 }],
        offset: -10
      };

      expect(() => ScreenFilters.parse(invalidFilters)).toThrow();
    });

    it('should reject invalid sort order', () => {
      const invalidFilters = {
        rules: [{ metric: 'pe_ratio', operator: 'lt', value: 25 }],
        sort_order: 'invalid_order'
      };

      expect(() => ScreenFilters.parse(invalidFilters)).toThrow();
    });

    it('should validate minimal screen filters', () => {
      const minimalFilters = {
        rules: [{ metric: 'pe_ratio', operator: 'lt', value: 25 }]
      };

      expect(() => ScreenFilters.parse(minimalFilters)).not.toThrow();
    });
  });

  describe('ScreenHit', () => {
    const validHit: ScreenHitType = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      market_cap: 3000000000000,
      price: 150.0,
      volume: 50000000,
      metrics: {
        pe_ratio: 25.5,
        market_cap: 3000000000000,
        revenue_growth: 0.08
      },
      score: 85.5,
      rank: 1,
      style_scores: {
        value: 60,
        growth: 80,
        momentum: 70,
        quality: 90,
        size: 95,
        volatility: 40
      },
      last_updated: '2024-01-01T00:00:00Z',
      data_source: 'fmp'
    };

    it('should validate complete screen hit', () => {
      expect(() => ScreenHit.parse(validHit)).not.toThrow();
      expect(ScreenHit.parse(validHit)).toEqual(validHit);
    });

    it('should validate minimal screen hit', () => {
      const minimalHit = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        metrics: {}
      };

      expect(() => ScreenHit.parse(minimalHit)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidHit = {
        symbol: '',
        name: 'Apple Inc.',
        metrics: {}
      };

      expect(() => ScreenHit.parse(invalidHit)).toThrow();
    });

    it('should reject empty name', () => {
      const invalidHit = {
        symbol: 'AAPL',
        name: '',
        metrics: {}
      };

      expect(() => ScreenHit.parse(invalidHit)).toThrow();
    });

    it('should reject negative market cap', () => {
      const invalidHit = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        market_cap: -1000000,
        metrics: {}
      };

      expect(() => ScreenHit.parse(invalidHit)).toThrow();
    });

    it('should reject score outside 0-100 range', () => {
      const invalidHit = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        score: 150,
        metrics: {}
      };

      expect(() => ScreenHit.parse(invalidHit)).toThrow();
    });

    it('should reject negative rank', () => {
      const invalidHit = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        rank: -1,
        metrics: {}
      };

      expect(() => ScreenHit.parse(invalidHit)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidHit = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        last_updated: 'invalid-date',
        metrics: {}
      };

      expect(() => ScreenHit.parse(invalidHit)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validFilters: ScreenFiltersType = {
      rules: [{ metric: 'pe_ratio', operator: 'lt', value: 25 }]
    };

    const validHit: ScreenHitType = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      metrics: {}
    };

    it('should validate screen filters using validateScreenFilters', () => {
      expect(() => validateScreenFilters(validFilters)).not.toThrow();
      expect(validateScreenFilters(validFilters)).toEqual(validFilters);
    });

    it('should validate screen hit using validateScreenHit', () => {
      expect(() => validateScreenHit(validHit)).not.toThrow();
      expect(validateScreenHit(validHit)).toEqual(validHit);
    });

    it('should validate screen filters using validateScreenFiltersSafe', () => {
      const result = validateScreenFiltersSafe(validFilters);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validFilters);
      }
    });

    it('should validate screen hit using validateScreenHitSafe', () => {
      const result = validateScreenHitSafe(validHit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validHit);
      }
    });

    it('should return error for invalid screen filters using validateScreenFiltersSafe', () => {
      const invalidFilters = {
        rules: [] // empty rules array
      };

      const result = validateScreenFiltersSafe(invalidFilters);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should return error for invalid screen hit using validateScreenHitSafe', () => {
      const invalidHit = {
        symbol: '', // empty symbol
        name: 'Apple Inc.',
        metrics: {}
      };

      const result = validateScreenHitSafe(invalidHit);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all valid operators', () => {
      const operators = ['gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'between', 'in', 'not_in'];
      
      operators.forEach(operator => {
        const rule = {
          metric: 'test_metric',
          operator,
          value: operator === 'between' ? [1, 10] : operator === 'in' ? ['a', 'b'] : 5
        };

        expect(() => MetricRule.parse(rule)).not.toThrow();
      });
    });

    it('should handle mixed value types in metrics', () => {
      const ruleWithStringValue = {
        metric: 'sector',
        operator: 'eq',
        value: 'Technology'
      };

      const ruleWithNumberValue = {
        metric: 'pe_ratio',
        operator: 'lt',
        value: 25
      };

      const ruleWithArrayValue = {
        metric: 'sectors',
        operator: 'in',
        value: ['Tech', 'Healthcare']
      };

      expect(() => MetricRule.parse(ruleWithStringValue)).not.toThrow();
      expect(() => MetricRule.parse(ruleWithNumberValue)).not.toThrow();
      expect(() => MetricRule.parse(ruleWithArrayValue)).not.toThrow();
    });

    it('should handle style scores at boundaries', () => {
      const hitWithBoundaryScores = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        metrics: {},
        style_scores: {
          value: 0,
          growth: 100,
          momentum: 50,
          quality: 0,
          size: 100,
          volatility: 0
        }
      };

      expect(() => ScreenHit.parse(hitWithBoundaryScores)).not.toThrow();
    });
  });
});
