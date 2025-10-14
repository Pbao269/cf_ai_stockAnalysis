/**
 * Multi-Model DCF Valuation Service - Cloudflare Worker
 * 
 * Architecture:
 * 1. Fetch fundamentals from centralized data service
 * 2. Use AI (Cloudflare Workers AI) to select optimal DCF model(s)
 * 3. Run selected models in parallel (3-Stage, SOTP, H-Model)
 * 4. Aggregate results with weighted fair value
 * 5. Generate final recommendation
 */

import { validateDcfOutput, type DcfOutputType } from '../shared/schemas/dcf';

// Cloudflare Workers types
interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<any | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// Use proper Cloudflare Workers AI type
// The Ai interface is provided by Cloudflare Workers runtime

export interface Env {
  FUNDAMENTALS_SNAP: KVNamespace;
  UNIFIED_DCF_URL?: string;    // Unified DCF service (data + 3-stage + h-model)
  AI: Ai; // Reintroduced for gap explanation
  // Note: SOTP is disabled (requires EDGAR segment data)
}

interface FundamentalsSnapshot {
  ticker: string;
  company_name: string;
  sector: string;
  industry: string;
  revenue: number;
  revenue_by_segment?: Array<{
    segment_name: string;
    revenue: number;
    operating_income: number;
    margin: number;
  }>;
  revenue_cagr_3y: number;
  ebitda_margin: number;
  market_cap: number;
  current_price: number;
  [key: string]: any;
}

interface ModelSelectorOutput {
  recommended_models: ('3stage' | 'sotp' | 'hmodel')[];
  reasoning: string;
  confidence: number;
  weights: {
    '3stage'?: number;
    'sotp'?: number;
    'hmodel'?: number;
  };
}

interface IndividualValuation {
  model: string;
  price_per_share: number;
  enterprise_value: number;
  upside_downside: number;
  wacc: number;
  assumptions?: any;
  [key: string]: any;
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
        service: 'unified-dcf-gateway',
        services_connected: {
          unified_dcf: !!env.UNIFIED_DCF_URL,
          ai: !!env.AI
        },
        note: 'SOTP model disabled (requires EDGAR data)',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AI test endpoint
    if (url.pathname === '/test-ai') {
      try {
        if (!env.AI) {
          return new Response(JSON.stringify({ error: 'AI binding not available' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
          prompt: 'Say hello in one word.'
        });
        
        return new Response(JSON.stringify({ 
          ai_response: (res as any)?.response || 'No response',
          ai_available: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          error: e instanceof Error ? e.message : 'AI test failed',
          ai_available: false 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
        assumptions?: Record<string, any>;
      };
      
      const ticker = (body.ticker || '').toUpperCase();
      
      console.log(`[Unified-DCF] Starting request for ticker: ${ticker}`);
      
      if (!ticker) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Ticker is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[Unified-DCF] Processing ticker: ${ticker}`);

      // Check cache first
      const cacheKey = `unified-dcf:${ticker}`;
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

      // === STEP 1: Fetch Fundamentals ===
      console.log(`[Unified-DCF] Step 1: Fetching fundamentals for ${ticker}`);
      let fundamentals: FundamentalsSnapshot;
      
      if (env.UNIFIED_DCF_URL) {
        const dataResponse = await fetch(`${env.UNIFIED_DCF_URL}/fundamentals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker })
        });

        if (!dataResponse.ok) {
          throw new Error(`Unified DCF service error: ${dataResponse.statusText}`);
        }

        const dataResult = await dataResponse.json() as { success: boolean; data: any };
        if (!dataResult.success) {
          throw new Error('Failed to fetch fundamentals');
        }

        fundamentals = dataResult.data;
      } else {
        throw new Error('UNIFIED_DCF_URL not configured');
      }

      // === STEP 2: Run Unified DCF Service ===
      console.log(`[Unified-DCF] Step 2: Running unified DCF service`);
      
      if (!env.UNIFIED_DCF_URL) {
        throw new Error('UNIFIED_DCF_URL not configured');
      }

      const unifiedResponse = await fetch(`${env.UNIFIED_DCF_URL}/unified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, fundamentals })
      });

      if (!unifiedResponse.ok) {
        throw new Error(`Unified DCF service error: ${unifiedResponse.statusText}`);
      }

      const unifiedResult = await unifiedResponse.json() as { success: boolean; data: any };
      if (!unifiedResult.success) {
        throw new Error('Unified DCF service failed');
      }

      const unifiedData = unifiedResult.data;
      console.log(`[Unified-DCF] Unified service response received for ${ticker}`);
      
      const modelResults = unifiedData.individual_valuations.map((valuation: any) => ({
        model: valuation.model,
        result: valuation
      }));

      if (modelResults.length === 0) {
        throw new Error('Unified DCF service returned no results');
      }

      console.log(`[Unified-DCF] Found ${modelResults.length} model results for ${ticker}`);

      // === STEP 3: Use Unified Results ===
      console.log(`[Unified-DCF] Step 3: Using unified consensus results`);
      
      // Use the consensus valuation from the unified service
      const consensusValuation = unifiedData.consensus_valuation;
      const weightedFairValue = consensusValuation.weighted_fair_value;
      const simpleAverage = consensusValuation.simple_average;
      const rangeLow = consensusValuation.range.low;
      const rangeHigh = consensusValuation.range.high;
      const upsideToWeighted = consensusValuation.upside_to_weighted;
      const recommendation = unifiedData.recommendation;

      const finalResult = {
        ticker,
        current_price: fundamentals.current_price,
        individual_valuations: modelResults.map(({ model, result }: { model: string; result: any }) => ({
          model,
          model_name: result.model_name || (model === '3stage' ? '3-Stage DCF (Goldman Sachs)' : 'H-Model DCF (Morningstar)'),
          price_per_share: result.price_per_share,
          enterprise_value: result.enterprise_value,
          upside_downside: result.upside_downside,
          wacc: result.wacc,
          assumptions: result.assumptions,
          projections: result.projections // Include projections for charting
        })),
        consensus_valuation: {
          weighted_fair_value: weightedFairValue,
          simple_average: simpleAverage,
          range: {
            low: rangeLow,
            high: rangeHigh
          },
          upside_to_weighted: upsideToWeighted,
          method: consensusValuation.method || 'Equal weight average of available models'
        },
        recommendation,
        timestamp: new Date().toISOString(),
        debug_ai_binding: !!env.AI  // Debug field to check if AI binding exists
      } as any;

      // Attach analyst consensus for UI (from fundamentals data service)
      const analystAvgTarget = Number(fundamentals.analyst_avg_target || 0);
      const analystCount = Number(fundamentals.analyst_count || 0);
      if (analystAvgTarget > 0) {
        finalResult.analyst_consensus = {
          average_target_price: analystAvgTarget,
          analyst_count: analystCount,
          gap_vs_weighted: analystAvgTarget - weightedFairValue,
          gap_vs_weighted_pct: fundamentals.current_price > 0 ? ((analystAvgTarget - weightedFairValue) / fundamentals.current_price) * 100 : 0
        };
      }

      console.log(`[Unified-DCF] About to start AI analysis for ${ticker}`);
      
      // AI: Explain gap between DCF and analyst consensus (CPU optimized)
      try {
        console.log('[AI] Checking AI binding:', !!env.AI);
        if (env.AI) {
          console.log('[AI] Starting AI analysis for', ticker);
          
          // Simple test first
          console.log('[AI] Running simple test...');
          const testRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
            prompt: 'Say "AI working" in one word.'
          });
          
          console.log('[AI] Test response:', testRes);
          finalResult.ai_test = (testRes as any)?.response || 'No test response';
          
          // Now try the full analysis
          console.log('[AI] Running full analysis...');
          finalResult.ai_raw_response = await explainGapWithAI(env.AI, {
            ticker,
            company_name: fundamentals.company_name,
            sector: fundamentals.sector,
            current_price: fundamentals.current_price,
            analyst_avg_target: analystAvgTarget || fundamentals.current_price * 1.1, // Fallback if no analyst data
            dcf_weighted_fair_value: weightedFairValue,
            three_stage: modelResults.find((r: any) => r.model === '3stage')?.result,
            hmodel: modelResults.find((r: any) => r.model === 'hmodel')?.result,
            fundamentals
          });
          console.log('[AI] AI analysis completed for', ticker);
        } else {
          console.log('[AI] Skipping AI analysis - no AI binding');
          finalResult.ai_status = 'skipped - no AI binding';
        }
      } catch (e) {
        console.warn('[Unified-DCF] AI gap explanation failed:', e);
        finalResult.ai_error = e instanceof Error ? e.message : 'AI processing failed';
        finalResult.ai_status = 'failed';
      }

      // Cache the result (1 hour TTL)
      await env.FUNDAMENTALS_SNAP.put(cacheKey, JSON.stringify(finalResult), {
        expirationTtl: 3600
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: finalResult,
        cached: false,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Unified-DCF service error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'DCF valuation failed',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Generate buy/sell recommendation from upside %
 */
function generateRecommendation(upside: number): string {
  if (upside > 20) return 'STRONG BUY';
  if (upside > 10) return 'BUY';
  if (upside > -5) return 'HOLD';
  if (upside > -15) return 'SELL';
  return 'STRONG SELL';
}

// High-quality, company-tailored gap explanation prompt
async function explainGapWithAI(ai: Ai, input: {
  ticker: string;
  company_name?: string;
  sector?: string;
  current_price: number;
  analyst_avg_target: number;
  dcf_weighted_fair_value: number;
  three_stage?: any;
  hmodel?: any;
  fundamentals: any;
}): Promise<string> {
  console.log('[AI] explainGapWithAI called with:', input.ticker);
  
  const { ticker, company_name, sector, current_price, analyst_avg_target, dcf_weighted_fair_value, three_stage, hmodel, fundamentals } = input;

  // CPU-optimized: Minimal string operations, no heavy parsing
  const histGrowth = Math.round((fundamentals.revenue_cagr_3y || 0) * 1000) / 10;
  const analystGrowth = Math.round((fundamentals.analyst_revenue_growth_3y || 0) * 1000) / 10;
  const ebitdaMargin = Math.round((fundamentals.ebitda_margin || 0) * 1000) / 10;
  const fcfMargin = Math.round((fundamentals.fcf_margin || 0) * 1000) / 10;
  const moat = fundamentals.economic_moat || 'unknown';
  const moatScore = Math.round(fundamentals.moat_strength_score || 0);

  const threeStagePrice = three_stage?.price_per_share || 0;
  const hmodelPrice = hmodel?.price_per_share || 0;
  const threeStageWacc = three_stage?.wacc || 0;
  const hmodelWacc = hmodel?.wacc || 0;
  const terminalGrowth = Math.max(
    three_stage?.assumptions?.terminal_growth || 0,
    hmodel?.assumptions?.g_low || 0
  );

  // Simplified prompt - no complex string formatting
  const prompt = `Analyze ${ticker} (${company_name || 'Unknown'}) valuation gap:
Current: $${current_price.toFixed(0)} | Analyst: $${analyst_avg_target.toFixed(0)} | DCF: $${dcf_weighted_fair_value.toFixed(0)}
3-Stage: $${threeStagePrice.toFixed(0)} (WACC ${(threeStageWacc * 100).toFixed(0)}%) | H-Model: $${hmodelPrice.toFixed(0)} (WACC ${(hmodelWacc * 100).toFixed(0)}%)
Growth: ${histGrowth}% hist, ${analystGrowth}% analyst | Margins: ${ebitdaMargin}% EBITDA, ${fcfMargin}% FCF | Moat: ${moat} (${moatScore}/100)
Explain the gap in 2-3 sentences.`;

  console.log('[AI] Sending prompt to AI:', prompt.substring(0, 100) + '...');
  
  const res = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    prompt: prompt
  });

  console.log('[AI] AI response received:', res);
  
  // Return raw response - no parsing, no JSON processing
  return (res as any)?.response || 'AI analysis unavailable';
}
