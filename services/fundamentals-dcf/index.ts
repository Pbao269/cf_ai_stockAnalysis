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

// import { validateDcfOutput, type DcfOutputType } from '../shared/schemas/dcf';

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
  AI_MODEL?: string;
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
        
        const res = await (env.AI as any).run((env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8') as any, {
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

    // Only accept POST requests for DCF analysis (except health/test-ai)
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
        probabilities?: Record<string, number>;
        external?: Record<string, any>;
        include_ai?: boolean;
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

      // Check cache first (keyed by assumptions signature)
      const assumpSig = body.assumptions ? btoa(JSON.stringify(body.assumptions)).slice(0, 32) : 'none';
      const cacheKey = `unified-dcf:${ticker}:a=${assumpSig}`;
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
      if (!env.UNIFIED_DCF_URL) {
        throw new Error('UNIFIED_DCF_URL not configured');
      }

      const unifiedResponse = await fetch(`${env.UNIFIED_DCF_URL}/unified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, fundamentals, assumptions: body.assumptions || {} })
      });

      if (!unifiedResponse.ok) {
        throw new Error(`Unified DCF service error: ${unifiedResponse.statusText}`);
      }

      const unifiedResult = await unifiedResponse.json() as { success: boolean; data: any };
      if (!unifiedResult.success) {
        throw new Error('Unified DCF service failed');
      }

      const unifiedData = unifiedResult.data;
      const modelResults = unifiedData.individual_valuations.map((valuation: any) => ({
        model: valuation.model,
        result: valuation
      }));

      if (modelResults.length === 0) {
        throw new Error('Unified DCF service returned no results');
      }

      // === STEP 3: Use Unified Results ===
      
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
        timestamp: new Date().toISOString()
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

      // === SIMPLIFIED AI ANALYSIS (Single Prompt) ===
      let ai_analysis: {
        thesis?: string;
        bull_scenario?: string;
        bear_scenario?: string;
        gap_explanation?: string;
      } = {};

      if (body.include_ai && env.AI) {
        try {
          const model = env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8';
          
          // Single comprehensive prompt for all analysis
          const analysisPrompt = `You are a Senior Equity Research Analyst. Analyze ${ticker} and provide a comprehensive investment analysis.

FUNDAMENTAL DATA:
- Current Price: $${fundamentals.current_price}
- Revenue: $${fundamentals.revenue?.toLocaleString() || 'N/A'}
- EBITDA Margin: ${(fundamentals.ebitda_margin * 100)?.toFixed(1) || 'N/A'}%
- Free Cash Flow: $${fundamentals.free_cash_flow?.toLocaleString() || 'N/A'}
- Beta: ${fundamentals.beta || 'N/A'}
- Revenue Growth (3Y): ${(fundamentals.revenue_cagr_3y * 100)?.toFixed(1) || 'N/A'}%
- Economic Moat: ${fundamentals.economic_moat || 'N/A'} (Score: ${fundamentals.moat_strength_score || 'N/A'}/100)
- Analyst Target: $${analystAvgTarget || 'N/A'} (${analystCount} analysts)

DCF VALUATION:
- Weighted Fair Value: $${weightedFairValue?.toFixed(2) || 'N/A'}
- 3-Stage DCF: $${modelResults.find((r: any) => r.model === '3stage')?.result?.price_per_share?.toFixed(2) || 'N/A'}
- H-Model DCF: $${modelResults.find((r: any) => r.model === 'hmodel')?.result?.price_per_share?.toFixed(2) || 'N/A'}

TASK: Provide a comprehensive investment analysis with the following structure:

**THESIS** (2-3 sentences):
Write the investment thesis focusing on the company's strategic position, business model, and growth story. Consider transformation narratives, competitive advantages, and market positioning beyond just financial metrics.

**BULL CASE** (3-5 key drivers):
- Growth drivers and competitive advantages
- Strategic partnerships, contracts, or market opportunities  
- Business model strengths and transformation milestones
- Market tailwinds and positive catalysts

**BEAR CASE** (3-5 key risks):
- Business model risks and execution challenges
- Market headwinds and competitive threats
- Customer concentration, funding, or operational risks
- Regulatory, macro, or industry-specific risks

Focus on business narrative and strategic context, not just financial ratios. Be specific about the company's actual business model and strategic positioning.`;

          // Execute single AI call for all analysis
          const analysisRes = await (env.AI as any).run(model as any, { 
            prompt: analysisPrompt, 
            max_tokens: 1000 
          });
          
          const analysisText = (analysisRes as any)?.response || '';
          
          // Parse the response into structured format
          const thesisMatch = analysisText.match(/\*\*THESIS\*\*[:\s]*(.*?)(?=\*\*BULL CASE\*\*|$)/s);
          const bullMatch = analysisText.match(/\*\*BULL CASE\*\*[:\s]*(.*?)(?=\*\*BEAR CASE\*\*|$)/s);
          const bearMatch = analysisText.match(/\*\*BEAR CASE\*\*[:\s]*(.*?)$/s);
          
          ai_analysis.thesis = thesisMatch ? thesisMatch[1].trim() : undefined;
          ai_analysis.bull_scenario = bullMatch ? bullMatch[1].trim() : undefined;
          ai_analysis.bear_scenario = bearMatch ? bearMatch[1].trim() : undefined;
          
          // Keep gap explanation separate for now (can be simplified later)
          const gapExplanationInput = {
            ticker,
            company_name: fundamentals.company_name,
            sector: fundamentals.sector,
            current_price: fundamentals.current_price,
            analyst_avg_target: analystAvgTarget || fundamentals.current_price * 1.1,
            dcf_weighted_fair_value: weightedFairValue,
            three_stage: modelResults.find((r: any) => r.model === '3stage')?.result,
            hmodel: modelResults.find((r: any) => r.model === 'hmodel')?.result,
            fundamentals
          };
          
          try {
            const gapResult = await explainGapWithAI(env.AI, model, gapExplanationInput);
            ai_analysis.gap_explanation = gapResult;
          } catch (e) {
            console.warn('[Gap Analysis] Failed:', e);
            ai_analysis.gap_explanation = undefined;
          }

        } catch (e) {
          console.warn('[Unified-DCF] AI analysis failed:', e);
          ai_analysis = {};
        }
      }

      // Add AI analysis to final result
      finalResult.ai_analysis = ai_analysis;

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
// (Removed unused generateRecommendation)

// High-quality, company-tailored gap explanation prompt
async function explainGapWithAI(ai: Ai, model: string, input: {
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
  const { ticker, company_name, sector, current_price, analyst_avg_target, dcf_weighted_fair_value, three_stage, hmodel, fundamentals } = input;

  // CPU-optimized: Minimal string operations, no heavy parsing
  const histGrowth = Math.round((fundamentals.revenue_cagr_3y || 0) * 1000) / 10;
  const analystGrowth = Math.round((fundamentals.analyst_revenue_growth_3y || 0) * 1000) / 10;
  const ebitdaMargin = Math.round((fundamentals.ebitda_margin || 0) * 1000) / 10;
  const fcfMargin = Math.round((fundamentals.fcf_margin || 0) * 1000) / 10;
  const moat = fundamentals.economic_moat || 'unknown';
  const moatScore = Math.round(fundamentals.moat_strength_score || 0);
  const analystCount = Number(fundamentals.analyst_count || 0);

  const threeStagePrice = three_stage?.price_per_share || 0;
  const hmodelPrice = hmodel?.price_per_share || 0;
  const threeStageWacc = three_stage?.wacc || 0;
  const hmodelWacc = hmodel?.wacc || 0;
  const terminalGrowth = Math.max(
    three_stage?.assumptions?.terminal_growth || 0,
    hmodel?.assumptions?.g_low || 0
  );

  const prompt = `Analyze the valuation gap for ${ticker} (${company_name || 'Unknown Company'}) in the ${sector || 'equity'} sector.

CURRENT VALUATION:
• Market Price: $${current_price.toFixed(2)}
• Analyst Target: $${analyst_avg_target.toFixed(2)} (${analystCount} analysts)
• DCF Fair Value: $${dcf_weighted_fair_value.toFixed(2)}

DCF MODELS:
• 3-Stage DCF: $${threeStagePrice.toFixed(2)} (WACC: ${(threeStageWacc * 100).toFixed(1)}%)
• H-Model DCF: $${hmodelPrice.toFixed(2)} (WACC: ${(hmodelWacc * 100).toFixed(1)}%)

KEY METRICS:
• Revenue Growth: ${histGrowth}% (3Y) vs ${analystGrowth}% (expected)
• EBITDA Margin: ${ebitdaMargin}%
• Economic Moat: ${moat} (${moatScore}/100)

Provide a 3-4 sentence analysis explaining the valuation discrepancy. Focus on business model factors, growth assumptions, and market positioning that could explain the gap between market price, analyst targets, and DCF models.`;

  const res = await (ai as any).run(model as any, {
    prompt: prompt,
    max_tokens: 200  // Increased for more detailed analysis
  });
  
  // Return raw response - no parsing, no JSON processing
  return (res as any)?.response || 'AI analysis unavailable';
}

