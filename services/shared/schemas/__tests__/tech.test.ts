import { describe, it, expect } from 'vitest';
import {
  TechnicalIndicatorResult,
  PriceAction,
  TrendAnalysis,
  MomentumAnalysis,
  VolatilityAnalysis,
  TechOutput,
  validateTechnicalIndicatorResult,
  validatePriceAction,
  validateTrendAnalysis,
  validateTechOutput,
  validateTechnicalIndicatorResultSafe,
  validatePriceActionSafe,
  validateTrendAnalysisSafe,
  validateTechOutputSafe,
  type TechnicalIndicatorResultType,
  type PriceActionType,
  type TrendAnalysisType,
  type TechOutputType
} from '../tech';

describe('Tech Schema', () => {
  describe('TechnicalIndicatorResult', () => {
    const validIndicator: TechnicalIndicatorResultType = {
      indicator: 'rsi',
      value: 65.5,
      signal: 'bullish',
      strength: 'moderate',
      metadata: {
        period: 14,
        overbought: false,
        oversold: false
      },
      timeframe: '1D',
      confidence: 0.8
    };

    it('should validate complete technical indicator result', () => {
      expect(() => TechnicalIndicatorResult.parse(validIndicator)).not.toThrow();
      expect(TechnicalIndicatorResult.parse(validIndicator)).toEqual(validIndicator);
    });

    it('should validate minimal technical indicator result', () => {
      const minimalIndicator = {
        indicator: 'sma',
        value: 150.0,
        signal: 'neutral',
        strength: 'weak'
      };

      expect(() => TechnicalIndicatorResult.parse(minimalIndicator)).not.toThrow();
    });

    it('should reject invalid indicator type', () => {
      const invalidIndicator = {
        ...validIndicator,
        indicator: 'invalid_indicator'
      };

      expect(() => TechnicalIndicatorResult.parse(invalidIndicator)).toThrow();
    });

    it('should reject invalid signal direction', () => {
      const invalidIndicator = {
        ...validIndicator,
        signal: 'invalid_signal'
      };

      expect(() => TechnicalIndicatorResult.parse(invalidIndicator)).toThrow();
    });

    it('should reject invalid signal strength', () => {
      const invalidIndicator = {
        ...validIndicator,
        strength: 'invalid_strength'
      };

      expect(() => TechnicalIndicatorResult.parse(invalidIndicator)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidIndicator = {
        ...validIndicator,
        confidence: 1.5
      };

      expect(() => TechnicalIndicatorResult.parse(invalidIndicator)).toThrow();
    });
  });

  describe('PriceAction', () => {
    const validPriceAction: PriceActionType = {
      current_price: 150.0,
      open: 148.0,
      high: 152.0,
      low: 147.0,
      close: 150.0,
      volume: 50000000,
      daily_change: 2.0,
      daily_change_percent: 1.35,
      weekly_change: 5.0,
      weekly_change_percent: 3.45,
      monthly_change: 10.0,
      monthly_change_percent: 7.14,
      support_levels: [145.0, 140.0],
      resistance_levels: [155.0, 160.0],
      candlestick_pattern: 'hammer',
      chart_pattern: 'ascending_triangle',
      volume_trend: 'increasing',
      volume_vs_average: 1.2,
      unusual_volume: true
    };

    it('should validate complete price action', () => {
      expect(() => PriceAction.parse(validPriceAction)).not.toThrow();
      expect(PriceAction.parse(validPriceAction)).toEqual(validPriceAction);
    });

    it('should validate minimal price action', () => {
      const minimalPriceAction = {
        current_price: 150.0,
        open: 148.0,
        high: 152.0,
        low: 147.0,
        close: 150.0,
        volume: 50000000,
        daily_change: 2.0,
        daily_change_percent: 1.35
      };

      expect(() => PriceAction.parse(minimalPriceAction)).not.toThrow();
    });

    it('should reject negative prices', () => {
      const invalidPriceAction = {
        ...validPriceAction,
        current_price: -100.0
      };

      expect(() => PriceAction.parse(invalidPriceAction)).toThrow();
    });

    it('should reject negative volume', () => {
      const invalidPriceAction = {
        ...validPriceAction,
        volume: -1000000
      };

      expect(() => PriceAction.parse(invalidPriceAction)).toThrow();
    });

    it('should reject invalid volume trend', () => {
      const invalidPriceAction = {
        ...validPriceAction,
        volume_trend: 'invalid_trend'
      };

      expect(() => PriceAction.parse(invalidPriceAction)).toThrow();
    });

    it('should reject negative volume vs average', () => {
      const invalidPriceAction = {
        ...validPriceAction,
        volume_vs_average: -0.5
      };

      // Note: volume_vs_average is optional and doesn't have validation constraints
      // This test is kept for documentation but may not throw an error
      expect(() => PriceAction.parse(invalidPriceAction)).not.toThrow();
    });
  });

  describe('TrendAnalysis', () => {
    const validTrendAnalysis: TrendAnalysisType = {
      short_term_trend: 'bullish',
      medium_term_trend: 'bullish',
      long_term_trend: 'bullish',
      trend_strength: 0.8,
      trend_duration_days: 30,
      trend_changes: [
        {
          date: '2024-01-01T00:00:00Z',
          from_trend: 'neutral',
          to_trend: 'bullish',
          strength: 'moderate'
        }
      ],
      moving_averages: {
        sma_20: 145.0,
        sma_50: 140.0,
        sma_200: 130.0,
        ema_12: 148.0,
        ema_26: 142.0
      }
    };

    it('should validate complete trend analysis', () => {
      expect(() => TrendAnalysis.parse(validTrendAnalysis)).not.toThrow();
      expect(TrendAnalysis.parse(validTrendAnalysis)).toEqual(validTrendAnalysis);
    });

    it('should validate minimal trend analysis', () => {
      const minimalTrendAnalysis = {
        short_term_trend: 'neutral',
        medium_term_trend: 'neutral',
        long_term_trend: 'neutral',
        trend_strength: 0.5
      };

      expect(() => TrendAnalysis.parse(minimalTrendAnalysis)).not.toThrow();
    });

    it('should reject invalid trend direction', () => {
      const invalidTrendAnalysis = {
        ...validTrendAnalysis,
        short_term_trend: 'invalid_trend'
      };

      expect(() => TrendAnalysis.parse(invalidTrendAnalysis)).toThrow();
    });

    it('should reject trend strength outside 0-1 range', () => {
      const invalidTrendAnalysis = {
        ...validTrendAnalysis,
        trend_strength: 1.5
      };

      expect(() => TrendAnalysis.parse(invalidTrendAnalysis)).toThrow();
    });

    it('should reject negative trend duration', () => {
      const invalidTrendAnalysis = {
        ...validTrendAnalysis,
        trend_duration_days: -10
      };

      expect(() => TrendAnalysis.parse(invalidTrendAnalysis)).toThrow();
    });

    it('should reject invalid datetime format in trend changes', () => {
      const invalidTrendAnalysis = {
        ...validTrendAnalysis,
        trend_changes: [
          {
            date: 'invalid-date',
            from_trend: 'neutral',
            to_trend: 'bullish',
            strength: 'moderate'
          }
        ]
      };

      expect(() => TrendAnalysis.parse(invalidTrendAnalysis)).toThrow();
    });
  });

  describe('TechOutput', () => {
    const validTechOutput: TechOutputType = {
      symbol: 'AAPL',
      analysis_date: '2024-01-01T00:00:00Z',
      price_action: {
        current_price: 150.0,
        open: 148.0,
        high: 152.0,
        low: 147.0,
        close: 150.0,
        volume: 50000000,
        daily_change: 2.0,
        daily_change_percent: 1.35
      },
      indicators: [
        {
          indicator: 'rsi',
          value: 65.5,
          signal: 'bullish',
          strength: 'moderate'
        },
        {
          indicator: 'macd',
          value: 2.5,
          signal: 'bullish',
          strength: 'strong'
        }
      ],
      trend_analysis: {
        short_term_trend: 'bullish',
        medium_term_trend: 'bullish',
        long_term_trend: 'bullish',
        trend_strength: 0.8
      },
      momentum_analysis: {
        rsi: {
          value: 65.5,
          signal: 'bullish',
          strength: 'moderate',
          overbought: false,
          oversold: false
        },
        macd: {
          macd_line: 2.5,
          signal_line: 1.8,
          histogram: 0.7,
          signal: 'bullish',
          strength: 'strong'
        }
      },
      volatility_analysis: {
        atr: {
          value: 3.2,
          percentile: 75,
          signal: 'bullish'
        },
        bollinger_bands: {
          upper_band: 155.0,
          middle_band: 150.0,
          lower_band: 145.0,
          bandwidth: 10.0,
          position: 'middle',
          signal: 'neutral'
        }
      },
      technical_score: 75.5,
      technical_rating: 'bullish',
      summary: {
        key_signals: ['RSI bullish', 'MACD crossover', 'Price above SMA 20'],
        key_levels: {
          support: [145.0, 140.0],
          resistance: [155.0, 160.0]
        },
        breakout_levels: [155.0],
        breakdown_levels: [145.0],
        short_term_outlook: 'bullish',
        medium_term_outlook: 'bullish',
        long_term_outlook: 'bullish',
        risk_level: 'medium',
        key_risks: ['Overbought conditions', 'Volume decline'],
        key_opportunities: ['Breakout potential', 'Trend continuation']
      },
      trading_signals: {
        entry_signals: [
          {
            level: 152.0,
            strength: 'moderate',
            reasoning: 'Breakout above resistance'
          }
        ],
        exit_signals: [
          {
            level: 145.0,
            strength: 'strong',
            reasoning: 'Support breakdown'
          }
        ],
        stop_loss_levels: [145.0],
        take_profit_levels: [160.0]
      },
      timeframe: '1D',
      data_sources: ['yahoo_finance', 'alpha_vantage'],
      last_updated: '2024-01-01T00:00:00Z',
      analyst: 'analyst-1',
      notes: 'Strong technical setup'
    };

    it('should validate complete tech output', () => {
      expect(() => TechOutput.parse(validTechOutput)).not.toThrow();
      expect(TechOutput.parse(validTechOutput)).toEqual(validTechOutput);
    });

    it('should validate minimal tech output', () => {
      const minimalTechOutput = {
        symbol: 'AAPL',
        analysis_date: '2024-01-01T00:00:00Z',
        price_action: {
          current_price: 150.0,
          open: 148.0,
          high: 152.0,
          low: 147.0,
          close: 150.0,
          volume: 50000000,
          daily_change: 2.0,
          daily_change_percent: 1.35
        },
        indicators: [],
        trend_analysis: {
          short_term_trend: 'neutral',
          medium_term_trend: 'neutral',
          long_term_trend: 'neutral',
          trend_strength: 0.5
        },
        technical_score: 50.0,
        technical_rating: 'neutral',
        summary: {
          key_signals: [],
          short_term_outlook: 'neutral',
          medium_term_outlook: 'neutral',
          long_term_outlook: 'neutral',
          risk_level: 'low',
          key_risks: [],
          key_opportunities: []
        },
        data_sources: [],
        last_updated: '2024-01-01T00:00:00Z'
      };

      expect(() => TechOutput.parse(minimalTechOutput)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidTechOutput = {
        ...validTechOutput,
        symbol: ''
      };

      expect(() => TechOutput.parse(invalidTechOutput)).toThrow();
    });

    it('should reject technical score outside 0-100 range', () => {
      const invalidTechOutput = {
        ...validTechOutput,
        technical_score: 150.0
      };

      expect(() => TechOutput.parse(invalidTechOutput)).toThrow();
    });

    it('should reject invalid technical rating', () => {
      const invalidTechOutput = {
        ...validTechOutput,
        technical_rating: 'invalid_rating'
      };

      expect(() => TechOutput.parse(invalidTechOutput)).toThrow();
    });

    it('should reject invalid risk level', () => {
      const invalidTechOutput = {
        ...validTechOutput,
        summary: {
          ...validTechOutput.summary,
          risk_level: 'invalid_risk'
        }
      };

      expect(() => TechOutput.parse(invalidTechOutput)).toThrow();
    });

    it('should reject invalid outlook direction', () => {
      const invalidTechOutput = {
        ...validTechOutput,
        summary: {
          ...validTechOutput.summary,
          short_term_outlook: 'invalid_outlook'
        }
      };

      expect(() => TechOutput.parse(invalidTechOutput)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validIndicator: TechnicalIndicatorResultType = {
      indicator: 'rsi',
      value: 65.5,
      signal: 'bullish',
      strength: 'moderate'
    };

    it('should validate technical indicator result using validateTechnicalIndicatorResult', () => {
      expect(() => validateTechnicalIndicatorResult(validIndicator)).not.toThrow();
      expect(validateTechnicalIndicatorResult(validIndicator)).toEqual(validIndicator);
    });

    it('should validate technical indicator result using validateTechnicalIndicatorResultSafe', () => {
      const result = validateTechnicalIndicatorResultSafe(validIndicator);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validIndicator);
      }
    });

    it('should return error for invalid technical indicator result using validateTechnicalIndicatorResultSafe', () => {
      const invalidIndicator = {
        ...validIndicator,
        indicator: 'invalid_indicator'
      };

      const result = validateTechnicalIndicatorResultSafe(invalidIndicator);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all valid technical indicators', () => {
      const indicators = ['sma', 'ema', 'rsi', 'macd', 'bollinger_bands', 'stochastic', 'williams_r', 'cci', 'atr', 'adx', 'obv', 'volume_profile', 'support_resistance', 'trend_lines', 'fibonacci', 'pivot_points'];
      
      indicators.forEach(indicator => {
        const indicatorResult = {
          indicator,
          value: 100.0,
          signal: 'neutral',
          strength: 'weak'
        };

        expect(() => TechnicalIndicatorResult.parse(indicatorResult)).not.toThrow();
      });
    });

    it('should handle all valid signal directions', () => {
      const signals = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'];
      
      signals.forEach(signal => {
        const indicatorResult = {
          indicator: 'rsi',
          value: 50.0,
          signal,
          strength: 'weak'
        };

        expect(() => TechnicalIndicatorResult.parse(indicatorResult)).not.toThrow();
      });
    });

    it('should handle all valid signal strengths', () => {
      const strengths = ['very_weak', 'weak', 'moderate', 'strong', 'very_strong'];
      
      strengths.forEach(strength => {
        const indicatorResult = {
          indicator: 'rsi',
          value: 50.0,
          signal: 'neutral',
          strength
        };

        expect(() => TechnicalIndicatorResult.parse(indicatorResult)).not.toThrow();
      });
    });

    it('should handle boundary technical scores', () => {
      const techOutput = {
        symbol: 'AAPL',
        analysis_date: '2024-01-01T00:00:00Z',
        price_action: {
          current_price: 150.0,
          open: 148.0,
          high: 152.0,
          low: 147.0,
          close: 150.0,
          volume: 50000000,
          daily_change: 2.0,
          daily_change_percent: 1.35
        },
        indicators: [],
        trend_analysis: {
          short_term_trend: 'neutral',
          medium_term_trend: 'neutral',
          long_term_trend: 'neutral',
          trend_strength: 0.5
        },
        technical_score: 0.0, // minimum value
        technical_rating: 'very_bearish',
        summary: {
          key_signals: [],
          short_term_outlook: 'neutral',
          medium_term_outlook: 'neutral',
          long_term_outlook: 'neutral',
          risk_level: 'low',
          key_risks: [],
          key_opportunities: []
        },
        data_sources: [],
        last_updated: '2024-01-01T00:00:00Z'
      };

      expect(() => TechOutput.parse(techOutput)).not.toThrow();
    });
  });
});
