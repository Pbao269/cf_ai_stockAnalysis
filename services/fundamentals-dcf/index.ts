/**
 * Fundamentals & DCF Service - Cloudflare Worker
 * 
 * This Worker proxies requests to the Python DCF microservice which:
 * 1. Fetches fundamentals from yfinance
 * 2. Runs deterministic DCF calculations
 * 3. Generates base/bull/bear scenarios
 * 4. Provides sensitivity analysis
 */

import { validateDcfOutput, type DcfOutputType } from '../shared/schemas/dcf';

export interface Env {
  FUNDAMENTALS_SNAP: KVNamespace;
  DCF_SERVICE_URL?: string;  // URL of Python DCF service
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'fundamentals-dcf',
        dcf_service_available: !!env.DCF_SERVICE_URL,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only accept POST requests for DCF analysis
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json() as {
        ticker?: string;
        symbol?: string;
        assumptions?: Record<string, any>;
        scenarios?: string[];
        include_sensitivities?: boolean;
      };
      
      const ticker = (body.ticker || body.symbol || '').toUpperCase();
      
      if (!ticker) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Ticker or symbol is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check cache first (TTL: 1 hour for fundamentals)
      const cacheKey = `dcf:${ticker}:${JSON.stringify(body.assumptions || {})}`;
      const cached = await env.FUNDAMENTALS_SNAP.get(cacheKey, 'json');
      
      if (cached && url.searchParams.get('fresh') !== 'true') {
        return new Response(JSON.stringify({
          success: true,
          data: cached,
          cached: true,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Call Python DCF service
      let dcfData: DcfOutputType;
      
      if (env.DCF_SERVICE_URL) {
        const dcfResponse = await fetch(`${env.DCF_SERVICE_URL}/dcf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            assumptions: body.assumptions,
            scenarios: body.scenarios || ['base', 'bull', 'bear'],
            include_sensitivities: body.include_sensitivities !== false
          })
        });

        if (!dcfResponse.ok) {
          throw new Error(`DCF service error: ${dcfResponse.statusText}`);
        }

        const dcfResult = await dcfResponse.json() as { success: boolean; data: any; error?: string };
        
        if (!dcfResult.success) {
          throw new Error(dcfResult.error || 'DCF calculation failed');
        }

        dcfData = dcfResult.data;
      } else {
        // Fallback to mock data if no DCF service configured
        dcfData = getMockDcfOutput(ticker);
      }

      // Validate output against schema
      const validated = validateDcfOutput(dcfData);

      // Cache the result (1 hour TTL)
      await env.FUNDAMENTALS_SNAP.put(cacheKey, JSON.stringify(validated), {
        expirationTtl: 3600
      });

      return new Response(JSON.stringify({
        success: true,
        data: validated,
        cached: false,
        data_source: env.DCF_SERVICE_URL ? 'yfinance' : 'mock',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('DCF service error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'DCF analysis failed',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Mock DCF output for testing/fallback
 */
function getMockDcfOutput(ticker: string): DcfOutputType {
  const currentPrice = 180.0;
  const fairValue = 210.0;
  const upside = ((fairValue - currentPrice) / currentPrice) * 100;

  return {
    symbol: ticker,
    analysis_date: new Date().toISOString(),
    assumptions: {
      revenue_growth_years_1_5: 0.10,
      revenue_growth_years_6_10: 0.05,
      terminal_growth_rate: 0.03,
      ebitda_margin_current: 0.28,
      ebitda_margin_target: 0.30,
      margin_expansion_years: 5,
      tax_rate_current: 0.21,
      tax_rate_target: 0.21,
      capex_as_percent_revenue: 0.04,
      depreciation_as_percent_capex: 0.80,
      working_capital_as_percent_revenue: 0.02,
      risk_free_rate: 0.045,
      market_risk_premium: 0.08,
      beta: 1.2,
      cost_of_debt: 0.05,
      debt_to_equity_ratio: 1.5,
      terminal_multiple_method: 'perpetuity' as const,
      created_at: new Date().toISOString()
    },
    base_case: {
      enterprise_value: 3_300_000_000_000,
      equity_value: 3_250_000_000_000,
      price_per_share: fairValue,
      current_price: currentPrice,
      upside_downside: upside,
      wacc: 0.095,
      terminal_value: 2_200_000_000_000,
      terminal_value_percent: 0.67,
      projections: Array.from({ length: 5 }, (_, i) => ({
        year: i + 1,
        revenue: 383_000_000_000 * Math.pow(1.10, i + 1),
        ebitda: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.30,
        ebit: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.27,
        ebt: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.27,
        net_income: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.27 * 0.79,
        capex: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.04,
        depreciation: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.03,
        working_capital_change: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.02,
        free_cash_flow: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.20,
        discounted_fcf: 383_000_000_000 * Math.pow(1.10, i + 1) * 0.20 / Math.pow(1.095, i + 1)
      })),
      terminal_year: {
        revenue: 616_000_000_000,
        ebitda: 185_000_000_000,
        ebit: 166_000_000_000,
        net_income: 131_000_000_000,
        free_cash_flow: 123_000_000_000
      },
      sensitivity_revenue_growth: {
        low: 180.0,
        base: fairValue,
        high: 245.0
      },
      sensitivity_margins: {
        low: 185.0,
        base: fairValue,
        high: 238.0
      },
      sensitivity_wacc: {
        low: 245.0,
        base: fairValue,
        high: 178.0
      }
    },
    bull_case: {
      scenario_name: 'bull_case' as const,
      enterprise_value: 4_200_000_000_000,
      equity_value: 4_150_000_000_000,
      price_per_share: 268.0,
      current_price: currentPrice,
      upside_downside: ((268.0 - currentPrice) / currentPrice) * 100,
      wacc: 0.085,
      terminal_value: 2_800_000_000_000,
      terminal_value_percent: 0.67,
      projections: Array.from({ length: 5 }, (_, i) => ({
        year: i + 1,
        revenue: 383_000_000_000 * Math.pow(1.13, i + 1),
        ebitda: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.32,
        ebit: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.29,
        ebt: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.29,
        net_income: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.29 * 0.79,
        capex: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.04,
        depreciation: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.03,
        working_capital_change: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.02,
        free_cash_flow: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.22,
        discounted_fcf: 383_000_000_000 * Math.pow(1.13, i + 1) * 0.22 / Math.pow(1.085, i + 1)
      })),
      terminal_year: {
        revenue: 706_000_000_000,
        ebitda: 226_000_000_000,
        ebit: 205_000_000_000,
        net_income: 162_000_000_000,
        free_cash_flow: 155_000_000_000
      },
      sensitivity_revenue_growth: {
        low: 230.0,
        base: 268.0,
        high: 312.0
      },
      sensitivity_margins: {
        low: 235.0,
        base: 268.0,
        high: 305.0
      },
      sensitivity_wacc: {
        low: 312.0,
        base: 268.0,
        high: 228.0
      }
    },
    bear_case: {
      scenario_name: 'bear_case' as const,
      enterprise_value: 2_400_000_000_000,
      equity_value: 2_350_000_000_000,
      price_per_share: 152.0,
      current_price: currentPrice,
      upside_downside: ((152.0 - currentPrice) / currentPrice) * 100,
      wacc: 0.105,
      terminal_value: 1_600_000_000_000,
      terminal_value_percent: 0.67,
      projections: Array.from({ length: 5 }, (_, i) => ({
        year: i + 1,
        revenue: 383_000_000_000 * Math.pow(1.07, i + 1),
        ebitda: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.26,
        ebit: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.23,
        ebt: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.23,
        net_income: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.23 * 0.79,
        capex: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.04,
        depreciation: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.03,
        working_capital_change: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.02,
        free_cash_flow: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.16,
        discounted_fcf: 383_000_000_000 * Math.pow(1.07, i + 1) * 0.16 / Math.pow(1.105, i + 1)
      })),
      terminal_year: {
        revenue: 537_000_000_000,
        ebitda: 140_000_000_000,
        ebit: 123_000_000_000,
        net_income: 97_000_000_000,
        free_cash_flow: 86_000_000_000
      },
      sensitivity_revenue_growth: {
        low: 130.0,
        base: 152.0,
        high: 178.0
      },
      sensitivity_margins: {
        low: 135.0,
        base: 152.0,
        high: 172.0
      },
      sensitivity_wacc: {
        low: 178.0,
        base: 152.0,
        high: 128.0
      }
    },
    sensitivities: {
      revenue_growth_sensitivity: [
        { growth_rate: 0.05, price_per_share: 180.0, upside_downside: 0 },
        { growth_rate: 0.10, price_per_share: 210.0, upside_downside: 16.7 },
        { growth_rate: 0.15, price_per_share: 245.0, upside_downside: 36.1 }
      ],
      margin_sensitivity: [
        { ebitda_margin: 0.26, price_per_share: 185.0, upside_downside: 2.8 },
        { ebitda_margin: 0.30, price_per_share: 210.0, upside_downside: 16.7 },
        { ebitda_margin: 0.34, price_per_share: 238.0, upside_downside: 32.2 }
      ],
      wacc_sensitivity: [
        { wacc: 0.085, price_per_share: 245.0, upside_downside: 36.1 },
        { wacc: 0.095, price_per_share: 210.0, upside_downside: 16.7 },
        { wacc: 0.105, price_per_share: 178.0, upside_downside: -1.1 }
      ],
      terminal_growth_sensitivity: [
        { terminal_growth: 0.02, price_per_share: 195.0, upside_downside: 8.3 },
        { terminal_growth: 0.03, price_per_share: 210.0, upside_downside: 16.7 },
        { terminal_growth: 0.04, price_per_share: 228.0, upside_downside: 26.7 }
      ],
      two_way_sensitivity: [
        { revenue_growth: 0.07, ebitda_margin: 0.26, price_per_share: 158.0, upside_downside: -12.2 },
        { revenue_growth: 0.07, ebitda_margin: 0.30, price_per_share: 172.0, upside_downside: -4.4 },
        { revenue_growth: 0.07, ebitda_margin: 0.34, price_per_share: 188.0, upside_downside: 4.4 },
        { revenue_growth: 0.10, ebitda_margin: 0.26, price_per_share: 185.0, upside_downside: 2.8 },
        { revenue_growth: 0.10, ebitda_margin: 0.30, price_per_share: 210.0, upside_downside: 16.7 },
        { revenue_growth: 0.10, ebitda_margin: 0.34, price_per_share: 238.0, upside_downside: 32.2 },
        { revenue_growth: 0.13, ebitda_margin: 0.26, price_per_share: 218.0, upside_downside: 21.1 },
        { revenue_growth: 0.13, ebitda_margin: 0.30, price_per_share: 252.0, upside_downside: 40.0 },
        { revenue_growth: 0.13, ebitda_margin: 0.34, price_per_share: 292.0, upside_downside: 62.2 }
      ]
    },
    summary: {
      fair_value_range: {
        low: 152.0,
        high: 268.0,
        base: 210.0
      },
      probability_weighted_value: 210.0,
      confidence_level: 0.75,
      key_drivers: [
        'Revenue growth: 10%',
        'EBITDA margin expansion to 30%',
        'WACC: 9.5%'
      ],
      key_risks: [
        'Growth slowdown below assumptions',
        'Margin compression from competition',
        'Higher cost of capital'
      ]
    },
    data_sources: ['mock'],
    last_updated: new Date().toISOString(),
    notes: 'Mock DCF output - connect DCF_SERVICE_URL for real data'
  };
}
