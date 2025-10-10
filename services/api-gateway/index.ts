import { z } from 'zod';
import { InvestmentIntent, ScreenerResults, StockAnalysis, type InvestmentIntentType } from '../shared/schemas';

export interface Env {
  AI: Ai;
  intent: Fetcher;
  screener: Fetcher;
  fundamentals: Fetcher;
}

/**
 * API Gateway - Main entry point for the stock analysis platform
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Route requests
      if (path === '/api/analyze' && request.method === 'POST') {
        return await handleAnalysis(request, env, corsHeaders);
      }
      
      if (path === '/api/stock' && request.method === 'POST') {
        return await handleStockAnalysis(request, env, corsHeaders);
      }

      if (path === '/api/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('API Gateway error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle full analysis pipeline: intent -> screener -> stock analysis
 */
async function handleAnalysis(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { query } = await request.json() as { query: string };
    
    if (!query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Query is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Parse investment intent
    const intentResponse = await env.intent.fetch('http://localhost/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!intentResponse.ok) {
      throw new Error('Failed to parse intent');
    }

    const intentData = await intentResponse.json() as { success: boolean; data: InvestmentIntentType };
    if (!intentData.success) {
      throw new Error('Intent parsing failed');
    }

    // Step 2: Screen stocks
    const screenerResponse = await env.screener.fetch('http://localhost/screener', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        intent: intentData.data,
        query 
      })
    });

    if (!screenerResponse.ok) {
      throw new Error('Failed to screen stocks');
    }

    const screenerData = await screenerResponse.json() as { success: boolean; data: ScreenerResults };
    if (!screenerData.success) {
      throw new Error('Stock screening failed');
    }

    // Step 3: Analyze top stock (first result)
    let topStockAnalysis = null;
    if (screenerData.data.results.length > 0) {
      const topSymbol = screenerData.data.results[0].symbol;
      
      const analysisResponse = await env.fundamentals.fetch('http://localhost/fundamentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: topSymbol })
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json() as { success: boolean; data: StockAnalysis };
        if (analysisData.success) {
          topStockAnalysis = analysisData.data;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        intent: intentData.data,
        screener_results: screenerData.data,
        top_stock_analysis: topStockAnalysis
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analysis pipeline error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Analysis failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle individual stock analysis
 */
async function handleStockAnalysis(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { symbol } = await request.json() as { symbol: string };
    
    if (!symbol) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Symbol is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisResponse = await env.fundamentals.fetch('http://localhost/fundamentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    });

    if (!analysisResponse.ok) {
      throw new Error('Stock analysis failed');
    }

    const analysisData = await analysisResponse.json() as { success: boolean; data: StockAnalysis };
    
    return new Response(JSON.stringify({
      success: analysisData.success,
      data: analysisData.data,
      error: analysisData.success ? undefined : 'Analysis failed',
      timestamp: new Date().toISOString()
    }), {
      status: analysisData.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Stock analysis error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Stock analysis failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
