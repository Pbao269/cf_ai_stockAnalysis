import { describe, it, expect } from 'vitest';
import {
  Catalyst,
  CatalystSentiment,
  CatalystOutput,
  validateCatalyst,
  validateCatalystSentiment,
  validateCatalystOutput,
  validateCatalystSafe,
  validateCatalystSentimentSafe,
  validateCatalystOutputSafe,
  type CatalystType,
  type CatalystSentimentType,
  type CatalystOutputType
} from '../catalyst';

describe('Catalyst Schema', () => {
  describe('Catalyst', () => {
    const validCatalyst: CatalystType = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'AAPL',
      type: 'earnings',
      title: 'Q4 Earnings Beat Expectations',
      description: 'Apple reported Q4 earnings that exceeded analyst expectations by 15%',
      impact: 'high',
      timing: 'immediate',
      price_impact_percent: 8.5,
      price_impact_range: {
        low: 5.0,
        high: 12.0
      },
      probability: 0.9,
      confidence: 0.85,
      announcement_date: '2024-01-15T16:00:00Z',
      expected_date: '2024-01-15T16:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      source: 'Company Press Release',
      analyst: 'analyst-1',
      tags: ['earnings', 'beat', 'guidance'],
      related_catalysts: ['123e4567-e89b-12d3-a456-426614174001'],
      status: 'completed'
    };

    it('should validate complete catalyst', () => {
      expect(() => Catalyst.parse(validCatalyst)).not.toThrow();
      expect(Catalyst.parse(validCatalyst)).toEqual(validCatalyst);
    });

    it('should validate minimal catalyst', () => {
      const minimalCatalyst = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'AAPL',
        type: 'earnings',
        title: 'Q4 Earnings',
        description: 'Earnings announcement',
        impact: 'medium',
        timing: 'short_term',
        probability: 0.8,
        confidence: 0.7,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      expect(() => Catalyst.parse(minimalCatalyst)).not.toThrow();
    });

    it('should reject invalid UUID format', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        id: 'invalid-uuid'
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        symbol: ''
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject invalid catalyst type', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        type: 'invalid_type'
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject invalid impact level', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        impact: 'invalid_impact'
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject invalid timing', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        timing: 'invalid_timing'
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject probability outside 0-1 range', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        probability: 1.5
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        confidence: -0.1
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        created_at: 'invalid-date'
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });

    it('should reject invalid status', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        status: 'invalid_status'
      };

      expect(() => Catalyst.parse(invalidCatalyst)).toThrow();
    });
  });

  describe('CatalystSentiment', () => {
    const validSentiment: CatalystSentimentType = {
      overall_sentiment: 'positive',
      sentiment_score: 0.7,
      sentiment_breakdown: {
        news_sentiment: 0.8,
        social_sentiment: 0.6,
        analyst_sentiment: 0.9,
        management_sentiment: 0.7
      },
      sentiment_trend: 'improving',
      sentiment_volatility: 0.3,
      analyzed_at: '2024-01-01T00:00:00Z',
      data_sources: ['news_api', 'twitter_api', 'analyst_reports'],
      confidence: 0.85
    };

    it('should validate complete catalyst sentiment', () => {
      expect(() => CatalystSentiment.parse(validSentiment)).not.toThrow();
      expect(CatalystSentiment.parse(validSentiment)).toEqual(validSentiment);
    });

    it('should validate minimal catalyst sentiment', () => {
      const minimalSentiment = {
        overall_sentiment: 'neutral',
        sentiment_score: 0.0,
        analyzed_at: '2024-01-01T00:00:00Z'
      };

      expect(() => CatalystSentiment.parse(minimalSentiment)).not.toThrow();
    });

    it('should reject invalid overall sentiment', () => {
      const invalidSentiment = {
        ...validSentiment,
        overall_sentiment: 'invalid_sentiment'
      };

      expect(() => CatalystSentiment.parse(invalidSentiment)).toThrow();
    });

    it('should reject sentiment score outside -1 to 1 range', () => {
      const invalidSentiment = {
        ...validSentiment,
        sentiment_score: 1.5
      };

      expect(() => CatalystSentiment.parse(invalidSentiment)).toThrow();
    });

    it('should reject sentiment breakdown scores outside -1 to 1 range', () => {
      const invalidSentiment = {
        ...validSentiment,
        sentiment_breakdown: {
          news_sentiment: 1.5
        }
      };

      expect(() => CatalystSentiment.parse(invalidSentiment)).toThrow();
    });

    it('should reject invalid sentiment trend', () => {
      const invalidSentiment = {
        ...validSentiment,
        sentiment_trend: 'invalid_trend'
      };

      expect(() => CatalystSentiment.parse(invalidSentiment)).toThrow();
    });

    it('should reject sentiment volatility outside 0-1 range', () => {
      const invalidSentiment = {
        ...validSentiment,
        sentiment_volatility: 1.5
      };

      expect(() => CatalystSentiment.parse(invalidSentiment)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidSentiment = {
        ...validSentiment,
        confidence: 1.5
      };

      expect(() => CatalystSentiment.parse(invalidSentiment)).toThrow();
    });
  });

  describe('CatalystOutput', () => {
    const validOutput: CatalystOutputType = {
      symbol: 'AAPL',
      analysis_date: '2024-01-01T00:00:00Z',
      catalysts: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          symbol: 'AAPL',
          type: 'earnings',
          title: 'Q4 Earnings Beat',
          description: 'Strong earnings beat',
          impact: 'high',
          timing: 'immediate',
          probability: 0.9,
          confidence: 0.85,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      sentiment: {
        overall_sentiment: 'positive',
        sentiment_score: 0.7,
        analyzed_at: '2024-01-01T00:00:00Z'
      },
      summary: {
        total_catalysts: 1,
        positive_catalysts: 1,
        negative_catalysts: 0,
        neutral_catalysts: 0,
        high_impact_catalysts: 1,
        medium_impact_catalysts: 0,
        low_impact_catalysts: 0,
        immediate_catalysts: 1,
        short_term_catalysts: 0,
        medium_term_catalysts: 0,
        long_term_catalysts: 0,
        expected_price_impact: 8.5,
        price_impact_range: {
          low: 5.0,
          high: 12.0
        },
        risk_level: 'medium',
        key_risks: ['Market volatility', 'Competition'],
        key_opportunities: ['Market expansion', 'Product innovation']
      },
      recommendations: {
        action: 'buy',
        confidence: 0.8,
        reasoning: ['Strong earnings beat', 'Positive sentiment'],
        price_target: 150.0,
        time_horizon: '3 months'
      },
      data_sources: ['company_reports', 'news_api'],
      last_updated: '2024-01-01T00:00:00Z',
      analyst: 'analyst-1',
      notes: 'Strong catalyst environment'
    };

    it('should validate complete catalyst output', () => {
      expect(() => CatalystOutput.parse(validOutput)).not.toThrow();
      expect(CatalystOutput.parse(validOutput)).toEqual(validOutput);
    });

    it('should validate minimal catalyst output', () => {
      const minimalOutput = {
        symbol: 'AAPL',
        analysis_date: '2024-01-01T00:00:00Z',
        catalysts: [],
        sentiment: {
          overall_sentiment: 'neutral',
          sentiment_score: 0.0,
          analyzed_at: '2024-01-01T00:00:00Z'
        },
        summary: {
          total_catalysts: 0,
          positive_catalysts: 0,
          negative_catalysts: 0,
          neutral_catalysts: 0,
          high_impact_catalysts: 0,
          medium_impact_catalysts: 0,
          low_impact_catalysts: 0,
          immediate_catalysts: 0,
          short_term_catalysts: 0,
          medium_term_catalysts: 0,
          long_term_catalysts: 0,
          risk_level: 'low',
          key_risks: [],
          key_opportunities: []
        },
        data_sources: [],
        last_updated: '2024-01-01T00:00:00Z'
      };

      expect(() => CatalystOutput.parse(minimalOutput)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidOutput = {
        ...validOutput,
        symbol: ''
      };

      expect(() => CatalystOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject negative catalyst counts', () => {
      const invalidOutput = {
        ...validOutput,
        summary: {
          ...validOutput.summary,
          total_catalysts: -1
        }
      };

      expect(() => CatalystOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject invalid risk level', () => {
      const invalidOutput = {
        ...validOutput,
        summary: {
          ...validOutput.summary,
          risk_level: 'invalid_risk'
        }
      };

      expect(() => CatalystOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject invalid recommendation action', () => {
      const invalidOutput = {
        ...validOutput,
        recommendations: {
          ...validOutput.recommendations!,
          action: 'invalid_action'
        }
      };

      expect(() => CatalystOutput.parse(invalidOutput)).toThrow();
    });

    it('should reject negative price target', () => {
      const invalidOutput = {
        ...validOutput,
        recommendations: {
          ...validOutput.recommendations!,
          price_target: -100.0
        }
      };

      expect(() => CatalystOutput.parse(invalidOutput)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validCatalyst: CatalystType = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'AAPL',
      type: 'earnings',
      title: 'Q4 Earnings',
      description: 'Earnings announcement',
      impact: 'medium',
      timing: 'short_term',
      probability: 0.8,
      confidence: 0.7,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    it('should validate catalyst using validateCatalyst', () => {
      expect(() => validateCatalyst(validCatalyst)).not.toThrow();
      expect(validateCatalyst(validCatalyst)).toEqual(validCatalyst);
    });

    it('should validate catalyst using validateCatalystSafe', () => {
      const result = validateCatalystSafe(validCatalyst);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validCatalyst);
      }
    });

    it('should return error for invalid catalyst using validateCatalystSafe', () => {
      const invalidCatalyst = {
        ...validCatalyst,
        symbol: '' // empty symbol
      };

      const result = validateCatalystSafe(invalidCatalyst);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all valid catalyst types', () => {
      const types = ['earnings', 'product_launch', 'merger_acquisition', 'regulatory', 'management_change', 'partnership', 'expansion', 'restructuring', 'dividend_change', 'buyback', 'guidance_update', 'clinical_trial', 'approval', 'contract_win', 'patent', 'technology_breakthrough', 'market_expansion', 'cost_reduction', 'other'];
      
      types.forEach(type => {
        const catalyst = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          symbol: 'AAPL',
          type,
          title: 'Test Catalyst',
          description: 'Test description',
          impact: 'medium',
          timing: 'short_term',
          probability: 0.8,
          confidence: 0.7,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        expect(() => Catalyst.parse(catalyst)).not.toThrow();
      });
    });

    it('should handle all valid impact levels', () => {
      const impacts = ['low', 'medium', 'high', 'critical'];
      
      impacts.forEach(impact => {
        const catalyst = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          symbol: 'AAPL',
          type: 'earnings',
          title: 'Test Catalyst',
          description: 'Test description',
          impact,
          timing: 'short_term',
          probability: 0.8,
          confidence: 0.7,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        expect(() => Catalyst.parse(catalyst)).not.toThrow();
      });
    });

    it('should handle all valid timing values', () => {
      const timings = ['immediate', 'short_term', 'medium_term', 'long_term', 'uncertain'];
      
      timings.forEach(timing => {
        const catalyst = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          symbol: 'AAPL',
          type: 'earnings',
          title: 'Test Catalyst',
          description: 'Test description',
          impact: 'medium',
          timing,
          probability: 0.8,
          confidence: 0.7,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        expect(() => Catalyst.parse(catalyst)).not.toThrow();
      });
    });

    it('should handle boundary probability and confidence values', () => {
      const catalyst = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'AAPL',
        type: 'earnings',
        title: 'Test Catalyst',
        description: 'Test description',
        impact: 'medium',
        timing: 'short_term',
        probability: 1.0, // maximum value
        confidence: 0.0, // minimum value
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      expect(() => Catalyst.parse(catalyst)).not.toThrow();
    });
  });
});
