/**
 * Technicals Service - Cloudflare Worker Gateway
 * 
 * Provides technical analysis by proxying to Python microservice:
 * - Trend indicators (SMA/EMA 20/50/200)
 * - Momentum indicators (RSI, MACD)
 * - Volatility indicators (ATR, ADX)
 * - Support/Resistance levels
 * - Fibonacci retracements
 * - Market regime detection
 */

export interface Env {
  TECHNICALS_URL?: string;
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
        service: 'technicals-gateway',
        python_service_connected: !!env.TECHNICALS_URL,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Technical analysis endpoint
    if (url.pathname === '/analyze' && request.method === 'POST') {
      try {
        const body = await request.json() as {
          ticker?: string;
          period?: string;
          interval?: string;
        };

        const ticker = (body.ticker || '').toUpperCase();

        if (!ticker) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Ticker is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check cache first (1 hour TTL for intraday, 4 hours for daily)
        const period = body.period || '1y';
        const interval = body.interval || '1d';
        const cacheKey = `tech:${ticker}:${period}:${interval}`;
        
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
        if (!env.TECHNICALS_URL) {
          throw new Error('TECHNICALS_URL not configured');
        }

        const response = await fetch(`${env.TECHNICALS_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, period, interval })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(`Technicals service error: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Technical analysis failed');
        }

        // Cache the result
        if (env.CACHE) {
          const ttl = interval === '1d' ? 14400 : 3600; // 4h for daily, 1h for intraday
          await env.CACHE.put(cacheKey, JSON.stringify(result.data), {
            expirationTtl: ttl
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
        console.error('Technicals service error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Technical analysis failed',
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
