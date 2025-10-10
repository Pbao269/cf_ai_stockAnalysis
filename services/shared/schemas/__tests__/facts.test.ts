import { describe, it, expect } from 'vitest';
import {
  Fact,
  Facts,
  FactRequest,
  FactResponse,
  validateFact,
  validateFacts,
  validateFactRequest,
  validateFactResponse,
  validateFactSafe,
  validateFactsSafe,
  validateFactRequestSafe,
  validateFactResponseSafe,
  createFact,
  createFacts,
  type FactType,
  type FactsType,
  type FactRequestType,
  type FactResponseType
} from '../facts';

describe('Facts Schema', () => {
  describe('Fact', () => {
    const validFact: FactType = {
      symbol: 'AAPL',
      metric: 'pe_ratio',
      value: 25.5,
      unit: 'ratio',
      period: 'ttm',
      source: 'fmp',
      timestamp: '2024-01-01T00:00:00Z',
      description: 'Price-to-earnings ratio',
      category: 'valuation',
      subcategory: 'price_ratios',
      confidence: 0.95,
      last_updated: '2024-01-01T00:00:00Z',
      data_age_days: 1,
      peer_avg: 22.3,
      peer_median: 21.8,
      peer_percentile: 75,
      historical_avg: 24.2,
      historical_median: 23.1,
      is_estimated: false,
      is_preliminary: false,
      is_restated: false,
      is_pro_forma: false
    };

    it('should validate complete fact', () => {
      expect(() => Fact.parse(validFact)).not.toThrow();
      expect(Fact.parse(validFact)).toEqual(validFact);
    });

    it('should validate minimal fact', () => {
      const minimalFact = {
        symbol: 'AAPL',
        metric: 'pe_ratio',
        value: 25.5,
        unit: 'ratio',
        period: 'ttm',
        source: 'fmp',
        timestamp: '2024-01-01T00:00:00Z'
      };

      expect(() => Fact.parse(minimalFact)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidFact = {
        ...validFact,
        symbol: ''
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject empty metric', () => {
      const invalidFact = {
        ...validFact,
        metric: ''
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject invalid unit', () => {
      const invalidFact = {
        ...validFact,
        unit: 'invalid_unit'
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject invalid period', () => {
      const invalidFact = {
        ...validFact,
        period: 'invalid_period'
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject invalid source', () => {
      const invalidFact = {
        ...validFact,
        source: 'invalid_source'
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidFact = {
        ...validFact,
        timestamp: 'invalid-date'
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidFact = {
        ...validFact,
        confidence: 1.5
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject negative data age', () => {
      const invalidFact = {
        ...validFact,
        data_age_days: -1
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should reject peer percentile outside 0-100 range', () => {
      const invalidFact = {
        ...validFact,
        peer_percentile: 150
      };

      expect(() => Fact.parse(invalidFact)).toThrow();
    });

    it('should accept null value', () => {
      const factWithNull = {
        ...validFact,
        value: null
      };

      expect(() => Fact.parse(factWithNull)).not.toThrow();
    });

    it('should accept boolean value', () => {
      const factWithBoolean = {
        ...validFact,
        value: true
      };

      expect(() => Fact.parse(factWithBoolean)).not.toThrow();
    });

    it('should accept string value', () => {
      const factWithString = {
        ...validFact,
        value: 'High'
      };

      expect(() => Fact.parse(factWithString)).not.toThrow();
    });
  });

  describe('Facts', () => {
    const validFacts: FactsType = {
      symbol: 'AAPL',
      facts: {
        pe_ratio: {
          symbol: 'AAPL',
          metric: 'pe_ratio',
          value: 25.5,
          unit: 'ratio',
          period: 'ttm',
          source: 'fmp',
          timestamp: '2024-01-01T00:00:00Z'
        },
        market_cap: {
          symbol: 'AAPL',
          metric: 'market_cap',
          value: 3000000000000,
          unit: 'USD',
          period: 'instant',
          source: 'fmp',
          timestamp: '2024-01-01T00:00:00Z'
        }
      },
      collected_at: '2024-01-01T00:00:00Z',
      source_summary: {
        fmp: 2,
        alphavantage: 0
      },
      data_freshness: {
        newest_timestamp: '2024-01-01T00:00:00Z',
        oldest_timestamp: '2024-01-01T00:00:00Z',
        avg_age_days: 1
      },
      quality_score: 0.95,
      completeness_score: 0.8,
      confidence_score: 0.9,
      categories: ['valuation', 'size'],
      metrics_count: 2
    };

    it('should validate complete facts collection', () => {
      expect(() => Facts.parse(validFacts)).not.toThrow();
      expect(Facts.parse(validFacts)).toEqual(validFacts);
    });

    it('should validate minimal facts collection', () => {
      const minimalFacts = {
        symbol: 'AAPL',
        facts: {},
        collected_at: '2024-01-01T00:00:00Z'
      };

      expect(() => Facts.parse(minimalFacts)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidFacts = {
        ...validFacts,
        symbol: ''
      };

      expect(() => Facts.parse(invalidFacts)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidFacts = {
        ...validFacts,
        collected_at: 'invalid-date'
      };

      expect(() => Facts.parse(invalidFacts)).toThrow();
    });

    it('should reject quality scores outside 0-1 range', () => {
      const invalidFacts = {
        ...validFacts,
        quality_score: 1.5
      };

      expect(() => Facts.parse(invalidFacts)).toThrow();
    });

    it('should reject negative metrics count', () => {
      const invalidFacts = {
        ...validFacts,
        metrics_count: -1
      };

      expect(() => Facts.parse(invalidFacts)).toThrow();
    });
  });

  describe('FactRequest', () => {
    const validRequest: FactRequestType = {
      symbol: 'AAPL',
      metrics: ['pe_ratio', 'market_cap'],
      categories: ['valuation'],
      sources: ['fmp', 'alphavantage'],
      max_age_days: 7,
      force_refresh: true,
      include_peer_data: true,
      include_historical: true
    };

    it('should validate complete fact request', () => {
      expect(() => FactRequest.parse(validRequest)).not.toThrow();
      expect(FactRequest.parse(validRequest)).toEqual(validRequest);
    });

    it('should validate minimal fact request', () => {
      const minimalRequest = {
        symbol: 'AAPL'
      };

      expect(() => FactRequest.parse(minimalRequest)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidRequest = {
        symbol: ''
      };

      expect(() => FactRequest.parse(invalidRequest)).toThrow();
    });

    it('should reject negative max age days', () => {
      const invalidRequest = {
        symbol: 'AAPL',
        max_age_days: -1
      };

      expect(() => FactRequest.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid sources', () => {
      const invalidRequest = {
        symbol: 'AAPL',
        sources: ['invalid_source']
      };

      expect(() => FactRequest.parse(invalidRequest)).toThrow();
    });
  });

  describe('FactResponse', () => {
    const validResponse: FactResponseType = {
      success: true,
      facts: {
        symbol: 'AAPL',
        facts: {
          pe_ratio: {
            symbol: 'AAPL',
            metric: 'pe_ratio',
            value: 25.5,
            unit: 'ratio',
            period: 'ttm',
            source: 'fmp',
            timestamp: '2024-01-01T00:00:00Z'
          }
        },
        collected_at: '2024-01-01T00:00:00Z'
      },
      errors: [
        {
          metric: 'market_cap',
          error: 'Data not available',
          code: 'DATA_UNAVAILABLE'
        }
      ],
      warnings: ['Some data may be stale'],
      metadata: {
        request_id: 'req-123',
        processing_time_ms: 150,
        cache_hit: false,
        sources_used: ['fmp']
      }
    };

    it('should validate complete fact response', () => {
      expect(() => FactResponse.parse(validResponse)).not.toThrow();
      expect(FactResponse.parse(validResponse)).toEqual(validResponse);
    });

    it('should validate minimal fact response', () => {
      const minimalResponse = {
        success: true
      };

      expect(() => FactResponse.parse(minimalResponse)).not.toThrow();
    });

    it('should validate error response', () => {
      const errorResponse = {
        success: false,
        errors: [
          {
            metric: 'pe_ratio',
            error: 'Invalid symbol'
          }
        ]
      };

      expect(() => FactResponse.parse(errorResponse)).not.toThrow();
    });

    it('should reject invalid success type', () => {
      const invalidResponse = {
        success: 'yes' // should be boolean
      };

      expect(() => FactResponse.parse(invalidResponse)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validFact: FactType = {
      symbol: 'AAPL',
      metric: 'pe_ratio',
      value: 25.5,
      unit: 'ratio',
      period: 'ttm',
      source: 'fmp',
      timestamp: '2024-01-01T00:00:00Z'
    };

    it('should validate fact using validateFact', () => {
      expect(() => validateFact(validFact)).not.toThrow();
      expect(validateFact(validFact)).toEqual(validFact);
    });

    it('should validate fact using validateFactSafe', () => {
      const result = validateFactSafe(validFact);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validFact);
      }
    });

    it('should return error for invalid fact using validateFactSafe', () => {
      const invalidFact = {
        ...validFact,
        symbol: '' // empty symbol
      };

      const result = validateFactSafe(invalidFact);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Utility Functions', () => {
    it('should create fact using createFact', () => {
      const fact = createFact(
        'AAPL',
        'pe_ratio',
        25.5,
        'ratio',
        'ttm',
        'fmp',
        '2024-01-01T00:00:00Z'
      );

      expect(fact.symbol).toBe('AAPL');
      expect(fact.metric).toBe('pe_ratio');
      expect(fact.value).toBe(25.5);
      expect(fact.unit).toBe('ratio');
      expect(fact.period).toBe('ttm');
      expect(fact.source).toBe('fmp');
      expect(fact.timestamp).toBe('2024-01-01T00:00:00Z');
    });

    it('should create facts collection using createFacts', () => {
      const fact1 = createFact('AAPL', 'pe_ratio', 25.5, 'ratio', 'ttm', 'fmp', '2024-01-01T00:00:00Z');
      const fact2 = createFact('AAPL', 'market_cap', 3000000000000, 'USD', 'instant', 'fmp', '2024-01-01T00:00:00Z');
      
      const facts = createFacts('AAPL', { pe_ratio: fact1, market_cap: fact2 }, '2024-01-01T00:00:00Z');

      expect(facts.symbol).toBe('AAPL');
      expect(Object.keys(facts.facts)).toHaveLength(2);
      expect(facts.facts.pe_ratio).toEqual(fact1);
      expect(facts.facts.market_cap).toEqual(fact2);
      expect(facts.collected_at).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all valid units', () => {
      const units = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'percent', 'basis_points', 'ratio', 'multiple', 'count', 'shares', 'employees', 'days', 'months', 'years', 'quarters', 'price_per_share', 'price_per_unit', 'volume', 'turnover', 'score', 'rating', 'grade', 'ratio_to_peers', 'percentile', 'rank'];
      
      units.forEach(unit => {
        const fact = {
          symbol: 'AAPL',
          metric: 'test_metric',
          value: 100,
          unit,
          period: 'instant',
          source: 'fmp',
          timestamp: '2024-01-01T00:00:00Z'
        };

        expect(() => Fact.parse(fact)).not.toThrow();
      });
    });

    it('should handle all valid periods', () => {
      const periods = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ytd', 'ttm', 'ltm', 'fiscal_year', 'calendar_year', 'rolling_3m', 'rolling_6m', 'rolling_12m', 'rolling_24m', 'instant', 'point_in_time'];
      
      periods.forEach(period => {
        const fact = {
          symbol: 'AAPL',
          metric: 'test_metric',
          value: 100,
          unit: 'USD',
          period,
          source: 'fmp',
          timestamp: '2024-01-01T00:00:00Z'
        };

        expect(() => Fact.parse(fact)).not.toThrow();
      });
    });

    it('should handle all valid sources', () => {
      const sources = ['fmp', 'alphavantage', 'yfinance', 'stooq', 'bloomberg', 'reuters', 'sec', 'company', 'calculated', 'estimated', 'consensus', 'internal'];
      
      sources.forEach(source => {
        const fact = {
          symbol: 'AAPL',
          metric: 'test_metric',
          value: 100,
          unit: 'USD',
          period: 'instant',
          source,
          timestamp: '2024-01-01T00:00:00Z'
        };

        expect(() => Fact.parse(fact)).not.toThrow();
      });
    });

    it('should handle floating point precision in confidence scores', () => {
      const fact = {
        symbol: 'AAPL',
        metric: 'pe_ratio',
        value: 25.5,
        unit: 'ratio',
        period: 'ttm',
        source: 'fmp',
        timestamp: '2024-01-01T00:00:00Z',
        confidence: 0.9999999999999999
      };

      expect(() => Fact.parse(fact)).not.toThrow();
    });
  });
});
