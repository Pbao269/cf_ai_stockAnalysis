import { describe, it, expect } from 'vitest';
import {
  AnalysisInput,
  SynthesisInput,
  SynthesisOutput,
  validateAnalysisInput,
  validateSynthesisInput,
  validateSynthesisOutput,
  validateAnalysisInputSafe,
  validateSynthesisInputSafe,
  validateSynthesisOutputSafe,
  type AnalysisInputType,
  type SynthesisInputType,
  type SynthesisOutputType
} from '../synthesis';

describe('Synthesis Schema', () => {
  describe('AnalysisInput', () => {
    const validAnalysisInput: AnalysisInputType = {
      component: 'fundamental',
      data: {
        pe_ratio: 25.5,
        market_cap: 3000000000000,
        revenue_growth: 0.08
      },
      confidence: 'high',
      weight: 0.8,
      timestamp: '2024-01-01T00:00:00Z',
      source: 'fmp',
      analyst: 'analyst-1'
    };

    it('should validate complete analysis input', () => {
      expect(() => AnalysisInput.parse(validAnalysisInput)).not.toThrow();
      expect(AnalysisInput.parse(validAnalysisInput)).toEqual(validAnalysisInput);
    });

    it('should validate minimal analysis input', () => {
      const minimalAnalysisInput = {
        component: 'technical',
        data: {},
        confidence: 'medium',
        weight: 0.5,
        timestamp: '2024-01-01T00:00:00Z'
      };

      expect(() => AnalysisInput.parse(minimalAnalysisInput)).not.toThrow();
    });

    it('should reject invalid component', () => {
      const invalidAnalysisInput = {
        ...validAnalysisInput,
        component: 'invalid_component'
      };

      expect(() => AnalysisInput.parse(invalidAnalysisInput)).toThrow();
    });

    it('should reject invalid confidence level', () => {
      const invalidAnalysisInput = {
        ...validAnalysisInput,
        confidence: 'invalid_confidence'
      };

      expect(() => AnalysisInput.parse(invalidAnalysisInput)).toThrow();
    });

    it('should reject weight outside 0-1 range', () => {
      const invalidAnalysisInput = {
        ...validAnalysisInput,
        weight: 1.5
      };

      expect(() => AnalysisInput.parse(invalidAnalysisInput)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidAnalysisInput = {
        ...validAnalysisInput,
        timestamp: 'invalid-date'
      };

      expect(() => AnalysisInput.parse(invalidAnalysisInput)).toThrow();
    });
  });

  describe('SynthesisInput', () => {
    const validSynthesisInput: SynthesisInputType = {
      symbol: 'AAPL',
      analysis_date: '2024-01-01T00:00:00Z',
      analyses: [
        {
          component: 'fundamental',
          data: { pe_ratio: 25.5 },
          confidence: 'high',
          weight: 0.8,
          timestamp: '2024-01-01T00:00:00Z'
        },
        {
          component: 'technical',
          data: { rsi: 65.5 },
          confidence: 'medium',
          weight: 0.6,
          timestamp: '2024-01-01T00:00:00Z'
        }
      ],
      user_preferences: {
        risk_tolerance: 'medium',
        time_horizon: 'medium',
        investment_objective: 'growth',
        sector_preferences: ['Technology'],
        sector_exclusions: ['Energy'],
        esg_preferences: true,
        liquidity_requirements: 'medium'
      },
      market_context: {
        market_regime: 'bull',
        sector_rotation: 'growth_to_value',
        economic_cycle: 'expansion',
        interest_rate_environment: 'rising',
        inflation_environment: 'moderate'
      },
      synthesis_params: {
        consensus_threshold: 0.7,
        conflict_resolution: 'weighted_average',
        uncertainty_handling: 'conservative',
        time_decay_factor: 0.9
      },
      request_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should validate complete synthesis input', () => {
      expect(() => SynthesisInput.parse(validSynthesisInput)).not.toThrow();
      expect(SynthesisInput.parse(validSynthesisInput)).toEqual(validSynthesisInput);
    });

    it('should validate minimal synthesis input', () => {
      const minimalSynthesisInput = {
        symbol: 'AAPL',
        analysis_date: '2024-01-01T00:00:00Z',
        analyses: [
          {
            component: 'fundamental',
            data: {},
            confidence: 'medium',
            weight: 0.5,
            timestamp: '2024-01-01T00:00:00Z'
          }
        ]
      };

      expect(() => SynthesisInput.parse(minimalSynthesisInput)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        symbol: ''
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject empty analyses array', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        analyses: []
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid risk tolerance', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        user_preferences: {
          ...validSynthesisInput.user_preferences!,
          risk_tolerance: 'invalid_risk'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid time horizon', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        user_preferences: {
          ...validSynthesisInput.user_preferences!,
          time_horizon: 'invalid_horizon'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid investment objective', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        user_preferences: {
          ...validSynthesisInput.user_preferences!,
          investment_objective: 'invalid_objective'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid liquidity requirements', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        user_preferences: {
          ...validSynthesisInput.user_preferences!,
          liquidity_requirements: 'invalid_liquidity'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid market regime', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        market_context: {
          ...validSynthesisInput.market_context!,
          market_regime: 'invalid_regime'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid sector rotation', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        market_context: {
          ...validSynthesisInput.market_context!,
          sector_rotation: 'invalid_rotation'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid economic cycle', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        market_context: {
          ...validSynthesisInput.market_context!,
          economic_cycle: 'invalid_cycle'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid interest rate environment', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        market_context: {
          ...validSynthesisInput.market_context!,
          interest_rate_environment: 'invalid_environment'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid inflation environment', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        market_context: {
          ...validSynthesisInput.market_context!,
          inflation_environment: 'invalid_inflation'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject consensus threshold outside 0-1 range', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        synthesis_params: {
          ...validSynthesisInput.synthesis_params!,
          consensus_threshold: 1.5
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid conflict resolution method', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        synthesis_params: {
          ...validSynthesisInput.synthesis_params!,
          conflict_resolution: 'invalid_resolution'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid uncertainty handling', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        synthesis_params: {
          ...validSynthesisInput.synthesis_params!,
          uncertainty_handling: 'invalid_handling'
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject time decay factor outside 0-1 range', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        synthesis_params: {
          ...validSynthesisInput.synthesis_params!,
          time_decay_factor: 1.5
        }
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid UUID format for request ID', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        request_id: 'invalid-uuid'
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid UUID format for user ID', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        user_id: 'invalid-uuid'
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalidSynthesisInput = {
        ...validSynthesisInput,
        analysis_date: 'invalid-date'
      };

      expect(() => SynthesisInput.parse(invalidSynthesisInput)).toThrow();
    });
  });

  describe('SynthesisOutput', () => {
    const validSynthesisOutput: SynthesisOutputType = {
      symbol: 'AAPL',
      analysis_date: '2024-01-01T00:00:00Z',
      recommendation: {
        action: 'buy',
        confidence: 'high',
        conviction_score: 85,
        price_target: 150.0,
        price_target_range: {
          low: 140.0,
          high: 160.0
        },
        time_horizon: 'medium',
        expected_return: 0.15,
        expected_return_range: {
          low: 0.10,
          high: 0.20
        }
      },
      risk_assessment: {
        overall_risk: 'medium',
        risk_score: 60,
        risk_factors: [
          {
            factor: 'Market volatility',
            level: 'medium',
            impact: 70,
            description: 'High market volatility expected'
          }
        ],
        risk_mitigation: ['Diversification', 'Position sizing'],
        downside_scenario: {
          probability: 0.2,
          potential_loss: -0.15,
          trigger_events: ['Market crash', 'Earnings miss']
        }
      },
      synthesis_summary: {
        consensus_score: 80,
        agreement_level: 'high',
        key_insights: ['Strong fundamentals', 'Technical breakout'],
        key_risks: ['Market volatility', 'Competition'],
        key_opportunities: ['Market expansion', 'Product innovation'],
        conflicts: [
          {
            component: 'technical',
            conflict_description: 'RSI shows overbought conditions',
            resolution: 'Short-term technical concerns outweighed by strong fundamentals'
          }
        ],
        supporting_evidence: [
          {
            component: 'fundamental',
            evidence: 'Strong earnings growth',
            strength: 'high'
          }
        ]
      },
      component_analysis: [
        {
          component: 'fundamental',
          score: 85,
          confidence: 'high',
          weight: 0.8,
          summary: 'Strong fundamentals with consistent growth',
          key_points: ['Revenue growth', 'Margin expansion'],
          limitations: ['High valuation']
        }
      ],
      portfolio_context: {
        correlation_with_portfolio: 0.7,
        diversification_benefit: 75,
        sector_allocation_impact: 0.15,
        position_size_recommendation: 'medium',
        position_size_percentage: 0.05
      },
      implementation: {
        entry_strategy: 'Gradual accumulation',
        exit_strategy: 'Take profit at target',
        monitoring_points: ['Earnings announcements', 'Technical levels'],
        review_schedule: 'Monthly',
        position_management: {
          initial_position_size: 0.02,
          scaling_strategy: 'DCA',
          stop_loss_level: 130.0,
          take_profit_level: 160.0
        }
      },
      data_sources: ['fmp', 'alphavantage'],
      last_updated: '2024-01-01T00:00:00Z',
      analyst: 'analyst-1',
      notes: 'Strong buy recommendation',
      quality_metrics: {
        data_freshness: 0.95,
        analysis_completeness: 0.9,
        confidence_score: 0.85,
        uncertainty_score: 0.2
      }
    };

    it('should validate complete synthesis output', () => {
      expect(() => SynthesisOutput.parse(validSynthesisOutput)).not.toThrow();
      expect(SynthesisOutput.parse(validSynthesisOutput)).toEqual(validSynthesisOutput);
    });

    it('should validate minimal synthesis output', () => {
      const minimalSynthesisOutput = {
        symbol: 'AAPL',
        analysis_date: '2024-01-01T00:00:00Z',
        recommendation: {
          action: 'hold',
          confidence: 'medium',
          conviction_score: 50,
          time_horizon: 'medium'
        },
        risk_assessment: {
          overall_risk: 'medium',
          risk_score: 50,
          risk_factors: [],
          risk_mitigation: []
        },
        synthesis_summary: {
          consensus_score: 50,
          agreement_level: 'medium',
          key_insights: [],
          key_risks: [],
          key_opportunities: [],
          supporting_evidence: []
        },
        component_analysis: [],
        data_sources: [],
        last_updated: '2024-01-01T00:00:00Z'
      };

      expect(() => SynthesisOutput.parse(minimalSynthesisOutput)).not.toThrow();
    });

    it('should reject empty symbol', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        symbol: ''
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid recommendation action', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        recommendation: {
          ...validSynthesisOutput.recommendation,
          action: 'invalid_action'
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid confidence level', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        recommendation: {
          ...validSynthesisOutput.recommendation,
          confidence: 'invalid_confidence'
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject conviction score outside 0-100 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        recommendation: {
          ...validSynthesisOutput.recommendation,
          conviction_score: 150
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject negative price target', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        recommendation: {
          ...validSynthesisOutput.recommendation,
          price_target: -100.0
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid time horizon', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        recommendation: {
          ...validSynthesisOutput.recommendation,
          time_horizon: 'invalid_horizon'
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid risk level', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        risk_assessment: {
          ...validSynthesisOutput.risk_assessment,
          overall_risk: 'invalid_risk'
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject risk score outside 0-100 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        risk_assessment: {
          ...validSynthesisOutput.risk_assessment,
          risk_score: 150
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid agreement level', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        synthesis_summary: {
          ...validSynthesisOutput.synthesis_summary,
          agreement_level: 'invalid_level'
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject consensus score outside 0-100 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        synthesis_summary: {
          ...validSynthesisOutput.synthesis_summary,
          consensus_score: 150
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid component', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        component_analysis: [
          {
            component: 'invalid_component',
            score: 50,
            confidence: 'medium',
            weight: 0.5,
            summary: 'Test',
            key_points: []
          }
        ]
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject component score outside 0-100 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        component_analysis: [
          {
            component: 'fundamental',
            score: 150,
            confidence: 'medium',
            weight: 0.5,
            summary: 'Test',
            key_points: []
          }
        ]
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid confidence level in component analysis', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        component_analysis: [
          {
            component: 'fundamental',
            score: 50,
            confidence: 'invalid_confidence',
            weight: 0.5,
            summary: 'Test',
            key_points: []
          }
        ]
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject component weight outside 0-1 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        component_analysis: [
          {
            component: 'fundamental',
            score: 50,
            confidence: 'medium',
            weight: 1.5,
            summary: 'Test',
            key_points: []
          }
        ]
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject correlation outside -1 to 1 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        portfolio_context: {
          ...validSynthesisOutput.portfolio_context!,
          correlation_with_portfolio: 1.5
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject diversification benefit outside 0-100 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        portfolio_context: {
          ...validSynthesisOutput.portfolio_context!,
          diversification_benefit: 150
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject invalid position size recommendation', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        portfolio_context: {
          ...validSynthesisOutput.portfolio_context!,
          position_size_recommendation: 'invalid_size'
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject position size percentage outside 0-1 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        portfolio_context: {
          ...validSynthesisOutput.portfolio_context!,
          position_size_percentage: 1.5
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });

    it('should reject quality metrics outside 0-1 range', () => {
      const invalidSynthesisOutput = {
        ...validSynthesisOutput,
        quality_metrics: {
          ...validSynthesisOutput.quality_metrics!,
          data_freshness: 1.5
        }
      };

      expect(() => SynthesisOutput.parse(invalidSynthesisOutput)).toThrow();
    });
  });

  describe('Validation Functions', () => {
    const validAnalysisInput: AnalysisInputType = {
      component: 'fundamental',
      data: {},
      confidence: 'medium',
      weight: 0.5,
      timestamp: '2024-01-01T00:00:00Z'
    };

    it('should validate analysis input using validateAnalysisInput', () => {
      expect(() => validateAnalysisInput(validAnalysisInput)).not.toThrow();
      expect(validateAnalysisInput(validAnalysisInput)).toEqual(validAnalysisInput);
    });

    it('should validate analysis input using validateAnalysisInputSafe', () => {
      const result = validateAnalysisInputSafe(validAnalysisInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAnalysisInput);
      }
    });

    it('should return error for invalid analysis input using validateAnalysisInputSafe', () => {
      const invalidAnalysisInput = {
        ...validAnalysisInput,
        component: 'invalid_component'
      };

      const result = validateAnalysisInputSafe(invalidAnalysisInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all valid analysis components', () => {
      const components = ['fundamental', 'technical', 'catalyst', 'dcf', 'screener', 'sentiment'];
      
      components.forEach(component => {
        const analysisInput = {
          component,
          data: {},
          confidence: 'medium',
          weight: 0.5,
          timestamp: '2024-01-01T00:00:00Z'
        };

        expect(() => AnalysisInput.parse(analysisInput)).not.toThrow();
      });
    });

    it('should handle all valid confidence levels', () => {
      const confidenceLevels = ['very_low', 'low', 'medium', 'high', 'very_high'];
      
      confidenceLevels.forEach(confidence => {
        const analysisInput = {
          component: 'fundamental',
          data: {},
          confidence,
          weight: 0.5,
          timestamp: '2024-01-01T00:00:00Z'
        };

        expect(() => AnalysisInput.parse(analysisInput)).not.toThrow();
      });
    });

    it('should handle all valid recommendation actions', () => {
      const actions = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
      
      actions.forEach(action => {
        const synthesisOutput = {
          symbol: 'AAPL',
          analysis_date: '2024-01-01T00:00:00Z',
          recommendation: {
            action,
            confidence: 'medium',
            conviction_score: 50,
            time_horizon: 'medium'
          },
          risk_assessment: {
            overall_risk: 'medium',
            risk_score: 50,
            risk_factors: [],
            risk_mitigation: []
          },
          synthesis_summary: {
            consensus_score: 50,
            agreement_level: 'medium',
            key_insights: [],
            supporting_evidence: []
          },
          component_analysis: [],
          data_sources: [],
          last_updated: '2024-01-01T00:00:00Z'
        };

        expect(() => SynthesisOutput.parse(synthesisOutput)).not.toThrow();
      });
    });

    it('should handle all valid risk levels', () => {
      const riskLevels = ['very_low', 'low', 'medium', 'high', 'very_high'];
      
      riskLevels.forEach(riskLevel => {
        const synthesisOutput = {
          symbol: 'AAPL',
          analysis_date: '2024-01-01T00:00:00Z',
          recommendation: {
            action: 'hold',
            confidence: 'medium',
            conviction_score: 50,
            time_horizon: 'medium'
          },
          risk_assessment: {
            overall_risk: riskLevel,
            risk_score: 50,
            risk_factors: [],
            risk_mitigation: []
          },
          synthesis_summary: {
            consensus_score: 50,
            agreement_level: 'medium',
            key_insights: [],
            key_risks: [],
            key_opportunities: [],
            supporting_evidence: []
          },
          component_analysis: [],
          data_sources: [],
          last_updated: '2024-01-01T00:00:00Z'
        };

        expect(() => SynthesisOutput.parse(synthesisOutput)).not.toThrow();
      });
    });

    it('should handle all valid time horizons', () => {
      const timeHorizons = ['very_short', 'short', 'medium', 'long', 'very_long'];
      
      timeHorizons.forEach(timeHorizon => {
        const synthesisOutput = {
          symbol: 'AAPL',
          analysis_date: '2024-01-01T00:00:00Z',
          recommendation: {
            action: 'hold',
            confidence: 'medium',
            conviction_score: 50,
            time_horizon: timeHorizon
          },
          risk_assessment: {
            overall_risk: 'medium',
            risk_score: 50,
            risk_factors: [],
            risk_mitigation: []
          },
          synthesis_summary: {
            consensus_score: 50,
            agreement_level: 'medium',
            key_insights: [],
            supporting_evidence: []
          },
          component_analysis: [],
          data_sources: [],
          last_updated: '2024-01-01T00:00:00Z'
        };

        expect(() => SynthesisOutput.parse(synthesisOutput)).not.toThrow();
      });
    });

    it('should handle boundary score values', () => {
      const synthesisOutput = {
        symbol: 'AAPL',
        analysis_date: '2024-01-01T00:00:00Z',
        recommendation: {
          action: 'hold',
          confidence: 'medium',
          conviction_score: 0, // minimum value
          time_horizon: 'medium'
        },
        risk_assessment: {
          overall_risk: 'medium',
          risk_score: 100, // maximum value
          risk_factors: [],
          risk_mitigation: [],
          key_risks: [],
          key_opportunities: []
        },
        synthesis_summary: {
          consensus_score: 0, // minimum value
          agreement_level: 'medium',
          key_insights: [],
          key_risks: [],
          key_opportunities: [],
          supporting_evidence: []
        },
        component_analysis: [],
        data_sources: [],
        last_updated: '2024-01-01T00:00:00Z'
      };

      expect(() => SynthesisOutput.parse(synthesisOutput)).not.toThrow();
    });
  });
});
