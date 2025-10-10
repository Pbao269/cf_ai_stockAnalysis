import { describe, it, expect } from 'vitest';
import {
  StrategySpec,
  StrategyMetrics,
  TradeRecord,
  PortfolioSnapshot,
  DcaOutput,
  validateStrategySpec,
  validateStrategyMetrics,
  validateTradeRecord,
  validateDcaOutput,
  validateStrategySpecSafe,
  validateStrategyMetricsSafe,
  validateTradeRecordSafe,
  validateDcaOutputSafe,
  type StrategySpecType,
  type StrategyMetricsType,
  type TradeRecordType,
  type DcaOutputType
} from '../dca';

describe('DCA Schema', () => {
  describe('StrategySpec', () => {
    const validStrategySpec: StrategySpecType = {
      strategy_type: 'fixed_amount',
      entry_timing: 'dip_buying',
      position_sizing: 'fixed_amount',
      total_investment_amount: 100000,
      investment_period_months: 12,
      frequency: 'monthly',
      position_size_amount: 8333.33,
      position_size_percentage: 0.083,
      max_position_size: 10000,
      min_position_size: 5000,
      entry_conditions: {
        price_threshold: 150.0,
        rsi_threshold: 30,
        volume_multiplier: 1.5,
        volatility_threshold: 0.3,
        momentum_threshold: -0.05
      },
      risk_management: {
        stop_loss_percentage: 0.1,
        take_profit_percentage: 0.2,
        max_drawdown_percentage: 0.15,
        position_limit: 10,
        sector_limit_percentage: 0.3
      },
      rebalancing: {
        frequency: 'quarterly',
        threshold_percentage: 0.05,
        method: 'threshold'
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user-1'
    };

    it('should validate complete strategy spec', () => {
      expect(() => StrategySpec.parse(validStrategySpec)).not.toThrow();
      expect(StrategySpec.parse(validStrategySpec)).toEqual(validStrategySpec);
    });

    it('should validate minimal strategy spec', () => {
      const minimalStrategySpec = {
        strategy_type: 'fixed_amount',
        entry_timing: 'immediate',
        position_sizing: 'fixed_amount',
        total_investment_amount: 10000,
        investment_period_months: 6,
        frequency: 'weekly'
      };

      expect(() => StrategySpec.parse(minimalStrategySpec)).not.toThrow();
    });

    it('should reject invalid strategy type', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        strategy_type: 'invalid_type'
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject invalid entry timing', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        entry_timing: 'invalid_timing'
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject invalid position sizing', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        position_sizing: 'invalid_sizing'
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject negative total investment amount', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        total_investment_amount: -10000
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject investment period outside valid range', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        investment_period_months: 0 // too low
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();

      const invalidStrategySpec2 = {
        ...validStrategySpec,
        investment_period_months: 121 // too high
      };

      expect(() => StrategySpec.parse(invalidStrategySpec2)).toThrow();
    });

    it('should reject invalid frequency', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        frequency: 'invalid_frequency'
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject negative position size', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        position_size_amount: -1000
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject position size percentage outside 0-1 range', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        position_size_percentage: 1.5
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        created_at: 'invalid-date'
      };

      expect(() => StrategySpec.parse(invalidStrategySpec)).toThrow();
    });
  });

  describe('StrategyMetrics', () => {
    const validStrategyMetrics: StrategyMetricsType = {
      total_return: 0.15,
      annualized_return: 0.12,
      cumulative_return: 0.15,
      volatility: 0.18,
      sharpe_ratio: 0.67,
      sortino_ratio: 0.85,
      max_drawdown: 0.08,
      max_drawdown_duration_days: 45,
      alpha: 0.03,
      beta: 0.95,
      information_ratio: 0.25,
      total_trades: 24,
      winning_trades: 18,
      losing_trades: 6,
      win_rate: 0.75,
      average_win: 0.05,
      average_loss: -0.03,
      profit_factor: 1.67,
      final_portfolio_value: 115000,
      total_invested: 100000,
      unrealized_pnl: 5000,
      realized_pnl: 10000,
      time_in_market_percentage: 0.95,
      average_holding_period_days: 15,
      calmar_ratio: 1.88,
      sterling_ratio: 1.25,
      burke_ratio: 1.15
    };

    it('should validate complete strategy metrics', () => {
      expect(() => StrategyMetrics.parse(validStrategyMetrics)).not.toThrow();
      expect(StrategyMetrics.parse(validStrategyMetrics)).toEqual(validStrategyMetrics);
    });

    it('should validate minimal strategy metrics', () => {
      const minimalMetrics = {
        total_return: 0.1,
        annualized_return: 0.08,
        cumulative_return: 0.1,
        volatility: 0.15,
        sharpe_ratio: 0.5,
        max_drawdown: 0.05,
        max_drawdown_duration_days: 30,
        total_trades: 10,
        winning_trades: 7,
        losing_trades: 3,
        win_rate: 0.7,
        average_win: 0.03,
        average_loss: -0.02,
        final_portfolio_value: 110000,
        total_invested: 100000,
        unrealized_pnl: 0,
        realized_pnl: 10000,
        time_in_market_percentage: 0.9,
        average_holding_period_days: 20
      };

      expect(() => StrategyMetrics.parse(minimalMetrics)).not.toThrow();
    });

    it('should reject negative volatility', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        volatility: -0.1
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject negative max drawdown', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        max_drawdown: -0.05
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject negative max drawdown duration', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        max_drawdown_duration_days: -10
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject negative trade counts', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        total_trades: -5
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject win rate outside 0-1 range', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        win_rate: 1.5
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject negative profit factor', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        profit_factor: -1.0
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject negative portfolio values', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        final_portfolio_value: -1000
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject time in market percentage outside 0-1 range', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        time_in_market_percentage: 1.5
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });

    it('should reject negative average holding period', () => {
      const invalidMetrics = {
        ...validStrategyMetrics,
        average_holding_period_days: -5
      };

      expect(() => StrategyMetrics.parse(invalidMetrics)).toThrow();
    });
  });

  describe('TradeRecord', () => {
    const validTradeRecord: TradeRecordType = {
      trade_id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'AAPL',
      trade_date: '2024-01-01T00:00:00Z',
      trade_type: 'buy',
      quantity: 100,
      price: 150.0,
      amount: 15000.0,
      entry_reason: 'DCA strategy execution',
      exit_reason: 'Take profit target reached',
      pnl: 1500.0,
      pnl_percentage: 0.10,
      holding_period_days: 30,
      commission: 9.99,
      fees: 0.0,
      net_amount: 15009.99
    };

    it('should validate complete trade record', () => {
      expect(() => TradeRecord.parse(validTradeRecord)).not.toThrow();
      expect(TradeRecord.parse(validTradeRecord)).toEqual(validTradeRecord);
    });

    it('should validate minimal trade record', () => {
      const minimalTradeRecord = {
        trade_id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'AAPL',
        trade_date: '2024-01-01T00:00:00Z',
        trade_type: 'buy',
        quantity: 100,
        price: 150.0,
        amount: 15000.0
      };

      expect(() => TradeRecord.parse(minimalTradeRecord)).not.toThrow();
    });

    it('should reject invalid UUID format', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        trade_id: 'invalid-uuid'
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        symbol: ''
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject invalid trade type', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        trade_type: 'invalid_type'
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject negative quantity', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        quantity: -100
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject negative price', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        price: -150.0
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject negative amount', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        amount: -15000.0
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject negative holding period', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        holding_period_days: -5
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject negative commission', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        commission: -5.0
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });

    it('should reject negative fees', () => {
      const invalidTradeRecord = {
        ...validTradeRecord,
        fees: -1.0
      };

      expect(() => TradeRecord.parse(invalidTradeRecord)).toThrow();
    });
  });

  describe('DcaOutput', () => {
    const validDcaOutput: DcaOutputType = {
      symbol: 'AAPL',
      strategy_id: '123e4567-e89b-12d3-a456-426614174000',
      analysis_date: '2024-01-01T00:00:00Z',
      strategy_spec: {
        strategy_type: 'fixed_amount',
        entry_timing: 'dip_buying',
        position_sizing: 'fixed_amount',
        total_investment_amount: 100000,
        investment_period_months: 12,
        frequency: 'monthly'
      },
      metrics: {
        total_return: 0.15,
        annualized_return: 0.12,
        cumulative_return: 0.15,
        volatility: 0.18,
        sharpe_ratio: 0.67,
        max_drawdown: 0.08,
        max_drawdown_duration_days: 45,
        total_trades: 24,
        winning_trades: 18,
        losing_trades: 6,
        win_rate: 0.75,
        average_win: 0.05,
        average_loss: -0.03,
        final_portfolio_value: 115000,
        total_invested: 100000,
        unrealized_pnl: 5000,
        realized_pnl: 10000,
        time_in_market_percentage: 0.95,
        average_holding_period_days: 15
      },
      trade_history: [
        {
          trade_id: '123e4567-e89b-12d3-a456-426614174001',
          symbol: 'AAPL',
          trade_date: '2024-01-01T00:00:00Z',
          trade_type: 'buy',
          quantity: 100,
          price: 150.0,
          amount: 15000.0
        }
      ],
      portfolio_snapshots: [
        {
          date: '2024-01-01T00:00:00Z',
          total_value: 100000,
          cash_balance: 85000,
          positions: [
            {
              symbol: 'AAPL',
              quantity: 100,
              current_price: 150.0,
              market_value: 15000,
              cost_basis: 15000,
              unrealized_pnl: 0,
              unrealized_pnl_percentage: 0,
              weight: 0.15
            }
          ]
        }
      ],
      analysis: {
        entry_analysis: {
          recommended_entry_price: 145.0,
          entry_confidence: 0.8,
          entry_reasons: ['RSI oversold', 'Support level'],
          entry_risks: ['Market volatility']
        },
        strategy_effectiveness: {
          vs_lump_sum: 0.05,
          vs_buy_hold: 0.02,
          volatility_reduction: 0.15,
          downside_protection: 0.20
        },
        risk_analysis: {
          risk_level: 'medium',
          key_risks: ['Market crash', 'Liquidity issues'],
          risk_mitigation: ['Stop losses', 'Position sizing'],
          stress_test_results: {
            '2008_crisis': -0.15,
            'covid_crash': -0.08
          }
        },
        optimization: {
          suggested_frequency: 'bi_weekly',
          suggested_position_size: 5000,
          suggested_entry_timing: 'momentum_based',
          potential_improvements: ['Dynamic sizing', 'Volatility adjustment']
        }
      },
      recommendations: {
        action: 'start_strategy',
        confidence: 0.8,
        reasoning: ['Strong historical performance', 'Risk management'],
        next_review_date: '2024-04-01T00:00:00Z'
      },
      data_sources: ['yahoo_finance', 'alpha_vantage'],
      last_updated: '2024-01-01T00:00:00Z',
      analyst: 'analyst-1',
      notes: 'Conservative DCA strategy'
    };

    it('should validate complete DCA output', () => {
      expect(() => DcaOutput.parse(validDcaOutput)).not.toThrow();
      expect(DcaOutput.parse(validDcaOutput)).toEqual(validDcaOutput);
    });

    it('should validate minimal DCA output', () => {
      const minimalDcaOutput = {
        symbol: 'AAPL',
        strategy_id: '123e4567-e89b-12d3-a456-426614174000',
        analysis_date: '2024-01-01T00:00:00Z',
        strategy_spec: {
          strategy_type: 'fixed_amount',
          entry_timing: 'immediate',
          position_sizing: 'fixed_amount',
          total_investment_amount: 10000,
          investment_period_months: 6,
          frequency: 'weekly'
        },
        metrics: {
          total_return: 0.1,
          annualized_return: 0.08,
          cumulative_return: 0.1,
          volatility: 0.15,
          sharpe_ratio: 0.5,
          max_drawdown: 0.05,
          max_drawdown_duration_days: 30,
          total_trades: 10,
          winning_trades: 7,
          losing_trades: 3,
          win_rate: 0.7,
          average_win: 0.03,
          average_loss: -0.02,
          final_portfolio_value: 11000,
          total_invested: 10000,
          unrealized_pnl: 0,
          realized_pnl: 1000,
          time_in_market_percentage: 0.9,
          average_holding_period_days: 20
        },
        analysis: {
          risk_analysis: {
            risk_level: 'medium',
            key_risks: [],
            risk_mitigation: []
          }
        },
        trade_history: [],
        portfolio_snapshots: [],
        data_sources: [],
        last_updated: '2024-01-01T00:00:00Z'
      };

      expect(() => DcaOutput.parse(minimalDcaOutput)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidDcaOutput = {
        ...validDcaOutput,
        symbol: ''
      };

      expect(() => DcaOutput.parse(invalidDcaOutput)).toThrow();
    });

    it('should reject invalid UUID format for strategy ID', () => {
      const invalidDcaOutput = {
        ...validDcaOutput,
        strategy_id: 'invalid-uuid'
      };

      expect(() => DcaOutput.parse(invalidDcaOutput)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidDcaOutput = {
        ...validDcaOutput,
        analysis_date: 'invalid-date'
      };

      expect(() => DcaOutput.parse(invalidDcaOutput)).toThrow();
    });

    it('should reject invalid recommendation action', () => {
      const invalidDcaOutput = {
        ...validDcaOutput,
        recommendations: {
          ...validDcaOutput.recommendations!,
          action: 'invalid_action'
        }
      };

      expect(() => DcaOutput.parse(invalidDcaOutput)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidDcaOutput = {
        ...validDcaOutput,
        recommendations: {
          ...validDcaOutput.recommendations!,
          confidence: 1.5
        }
      };

      expect(() => DcaOutput.parse(invalidDcaOutput)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validStrategySpec: StrategySpecType = {
      strategy_type: 'fixed_amount',
      entry_timing: 'immediate',
      position_sizing: 'fixed_amount',
      total_investment_amount: 10000,
      investment_period_months: 6,
      frequency: 'weekly'
    };

    it('should validate strategy spec using validateStrategySpec', () => {
      expect(() => validateStrategySpec(validStrategySpec)).not.toThrow();
      expect(validateStrategySpec(validStrategySpec)).toEqual(validStrategySpec);
    });

    it('should validate strategy spec using validateStrategySpecSafe', () => {
      const result = validateStrategySpecSafe(validStrategySpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validStrategySpec);
      }
    });

    it('should return error for invalid strategy spec using validateStrategySpecSafe', () => {
      const invalidStrategySpec = {
        ...validStrategySpec,
        strategy_type: 'invalid_type'
      };

      const result = validateStrategySpecSafe(invalidStrategySpec);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all valid strategy types', () => {
      const strategyTypes = ['fixed_amount', 'fixed_shares', 'percentage_portfolio', 'volatility_based', 'momentum_based', 'value_based', 'hybrid'];
      
      strategyTypes.forEach(strategyType => {
        const strategySpec = {
          strategy_type: strategyType,
          entry_timing: 'immediate',
          position_sizing: 'fixed_amount',
          total_investment_amount: 10000,
          investment_period_months: 6,
          frequency: 'weekly'
        };

        expect(() => StrategySpec.parse(strategySpec)).not.toThrow();
      });
    });

    it('should handle all valid entry timings', () => {
      const entryTimings = ['immediate', 'dip_buying', 'momentum_breakout', 'support_level', 'oversold_rsi', 'macd_crossover', 'volume_spike', 'news_catalyst'];
      
      entryTimings.forEach(entryTiming => {
        const strategySpec = {
          strategy_type: 'fixed_amount',
          entry_timing: entryTiming,
          position_sizing: 'fixed_amount',
          total_investment_amount: 10000,
          investment_period_months: 6,
          frequency: 'weekly'
        };

        expect(() => StrategySpec.parse(strategySpec)).not.toThrow();
      });
    });

    it('should handle all valid position sizing methods', () => {
      const positionSizings = ['fixed_amount', 'percentage_portfolio', 'volatility_adjusted', 'kelly_criterion', 'risk_parity', 'equal_weight'];
      
      positionSizings.forEach(positionSizing => {
        const strategySpec = {
          strategy_type: 'fixed_amount',
          entry_timing: 'immediate',
          position_sizing: positionSizing,
          total_investment_amount: 10000,
          investment_period_months: 6,
          frequency: 'weekly'
        };

        expect(() => StrategySpec.parse(strategySpec)).not.toThrow();
      });
    });

    it('should handle all valid frequencies', () => {
      const frequencies = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly'];
      
      frequencies.forEach(frequency => {
        const strategySpec = {
          strategy_type: 'fixed_amount',
          entry_timing: 'immediate',
          position_sizing: 'fixed_amount',
          total_investment_amount: 10000,
          investment_period_months: 6,
          frequency
        };

        expect(() => StrategySpec.parse(strategySpec)).not.toThrow();
      });
    });

    it('should handle boundary investment period values', () => {
      const strategySpecMin = {
        strategy_type: 'fixed_amount',
        entry_timing: 'immediate',
        position_sizing: 'fixed_amount',
        total_investment_amount: 10000,
        investment_period_months: 1, // minimum value
        frequency: 'weekly'
      };

      const strategySpecMax = {
        strategy_type: 'fixed_amount',
        entry_timing: 'immediate',
        position_sizing: 'fixed_amount',
        total_investment_amount: 10000,
        investment_period_months: 120, // maximum value
        frequency: 'weekly'
      };

      expect(() => StrategySpec.parse(strategySpecMin)).not.toThrow();
      expect(() => StrategySpec.parse(strategySpecMax)).not.toThrow();
    });
  });
});
