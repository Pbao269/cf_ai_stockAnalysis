/**
 * Entry & DCA Service - Cloudflare Worker Gateway
 * 
 * Backtests and recommends DCA strategies:
 * 1. Lump-sum (baseline)
 * 2. Fixed-interval DCA (weekly/monthly)
 * 3. ATR-weighted DCA
 * 4. Drawdown-tiered DCA
 * 5. Fibonacci scale-in DCA
 * 
 * Returns comprehensive metrics:
 * - CAGR, volatility, max drawdown
 * - MAR ratio (CAGR/maxDD)
 * - Time under water
 * - Sharpe ratio
 */

export interface Env {
  DCA_URL?: string;
  CACHE?: KVNamespace;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'entry-dca-gateway',
        python_service_connected: !!env.DCA_URL,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Backtest endpoint
    if (url.pathname === '/backtest' && request.method === 'POST') {
      try {
        const body = await request.json() as {
          ticker?: string;
          capital?: number;
          period?: string;
          risk_tolerance?: string;
        };

        const ticker = (body.ticker || '').toUpperCase();
        const capital = body.capital || 10000;
        const period = body.period || '1y';
        const risk_tolerance = body.risk_tolerance || 'moderate';

        if (!ticker) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Ticker is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (capital <= 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Capital must be positive'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check cache (4 hour TTL)
        const cacheKey = `dca:${ticker}:${capital}:${period}:${risk_tolerance}`;
        
        if (env.CACHE) {
          const cached = await env.CACHE.get(cacheKey, 'json');
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
        }

        // Call Python service
        if (!env.DCA_URL) {
          throw new Error('DCA_URL not configured');
        }

        const response = await fetch(`${env.DCA_URL}/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, capital, period, risk_tolerance })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(`DCA service error: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Backtest failed');
        }

        // Cache the result (4 hours)
        if (env.CACHE) {
          await env.CACHE.put(cacheKey, JSON.stringify(result.data), {
            expirationTtl: 14400
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: result.data,
          cached: false,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('DCA service error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Backtest failed',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders
    });
  }
};
