/**
 * Multi-Model DCF Valuation Service - Cloudflare Worker (Gateway)
 * 
 * This service acts as an intelligent gateway to the unified Python DCF service,
 * handling API orchestration, error translation, and AI-powered analysis enrichment.
 * 
 * === ARCHITECTURE ===
 * 1. Fetch fundamentals from Python unified DCF service (/fundamentals endpoint)
 * 2. Request unified DCF calculation (/unified endpoint)
 *    - Runs 3-Stage DCF (Goldman Sachs methodology)
 *    - Runs H-Model DCF (Morningstar methodology)
 *    - Applies sector-specific weighting and sanity caps
 *    - Calculates confidence score based on 6 factors
 * 3. Handle Financial Services rejection (DCF not appropriate)
 * 4. Enrich with AI analysis (thesis, bull/bear cases, gap explanation)
 * 5. Return comprehensive valuation package to frontend
 **/

// Import shared interfaces to keep this file focused on functional code
// NOTE: Using relative import path compatible with wrangler bundler. If tsconfig rootDir is strict,
// ensure this file is included in the worker's build scope (same directory).
import type { 
  Env, 
  KVNamespace, 
  FundamentalsSnapshot, 
  ModelSelectorOutput, 
  IndividualValuation, 
  ConfidenceFactor, 
  ConsensusValuation 
} from './dcf';

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
        
        // Test with both formats
        const modelName = env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8';
        
        // Try messages format first (recommended)
        let messagesResult;
        try {
          const messagesRes = await (env.AI as any).run(modelName as any, {
            messages: [
              { role: 'user', content: 'Say hello in one word.' }
            ]
          });
          messagesResult = (messagesRes as any)?.response || (messagesRes as any)?.result || 'No response';
        } catch (msgError) {
          messagesResult = `Messages format error: ${msgError instanceof Error ? msgError.message : 'Unknown'}`;
        }
        
        // Try prompt format
        let promptResult;
        try {
          const promptRes = await (env.AI as any).run(modelName as any, {
            prompt: 'Say hello in one word.'
          });
          promptResult = (promptRes as any)?.response || (promptRes as any)?.result || 'No response';
        } catch (promptError) {
          promptResult = `Prompt format error: ${promptError instanceof Error ? promptError.message : 'Unknown'}`;
        }
        
        return new Response(JSON.stringify({ 
          ai_available: true,
          model: modelName,
          messages_format: messagesResult,
          prompt_format: promptResult
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

      // Check cache first (keyed by assumptions signature + AI signature)
      const assumpSig = body.assumptions ? btoa(JSON.stringify(body.assumptions)).slice(0, 32) : 'none';
      const aiSig = 'ai=1'; // Always include AI analysis in responses
      const cacheKey = `unified-dcf:${ticker}:a=${assumpSig}:${aiSig}`;
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
        // Handle HTTP errors (including 500 from DCF rejection)
        const errorData = await unifiedResponse.json().catch(() => ({ error: unifiedResponse.statusText })) as { error?: string };
        
        // Check if this is a Financial Services rejection
        if (errorData?.error && errorData.error.includes('DCF not appropriate')) {
          return new Response(JSON.stringify({
            success: false,
            error: errorData.error,
            recommendation: 'Use P/E, P/B, or P/TBV multiples for financial companies',
            alternative_methods: ['price_to_earnings', 'price_to_book', 'dividend_discount_model'],
            ticker,
            sector: fundamentals.sector,
            timestamp: new Date().toISOString()
          }), {
            status: 400, // Client error - inappropriate valuation method
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        throw new Error(`Unified DCF service error: ${errorData?.error || unifiedResponse.statusText}`);
      }

      const unifiedResult = await unifiedResponse.json() as { success: boolean; data: any; error?: string };
      if (!unifiedResult.success) {
        throw new Error(unifiedResult.error || 'Unified DCF service failed');
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

      // Helper: Build fallback AI analysis if AI binding unavailable or fails
      const buildFallbackAIAnalysis = (
        f: FundamentalsSnapshot,
        cv: ConsensusValuation,
        modelResults: Array<{ model: string; result: any }>,
        analystAvgTarget: number,
        analystCount: number
      ) => {
        const tickerSym = ticker;
        const sectorName = f.sector || 'Unknown';
        const confLevel = cv.confidence_level;
        const confScorePct = Math.round((cv.confidence_score || 0) * 100);
        const fv = cv.weighted_fair_value;
        const cp = f.current_price;
        const up = cp > 0 ? ((fv - cp) / cp) * 100 : 0;
        const moat = (f as any).economic_moat || 'none';
        const growthPct = Math.round(((f as any).revenue_cagr_3y || 0) * 100);
        const fcfMarginPct = Math.round((((f as any).fcf_margin || 0) * 100) || 0);
        const wm = cv.weighting_method?.rationale || 'Equal weighting across models';
        const factors = (cv.confidence_factors?.factors || []) as any[];
        const negatives = factors.filter((x: any) => (x.impact || 0) < 0).slice(0, 3);
        const positives = factors.filter((x: any) => (x.impact || 0) > 0).slice(0, 3);

        const thesis = `With ${confLevel} confidence (${confScorePct}%), our DCF estimates fair value at $${fv.toFixed(2)} (${up.toFixed(1)}% vs current $${cp.toFixed(2)}). ${tickerSym} operates in ${sectorName} with an economic moat of ${moat}. Weighting rationale: ${wm}.`;

        const bullBullets: string[] = [];
        if (positives.length) bullBullets.push(...positives.map((p: any) => `- ${p.description}`));
        if (fcfMarginPct > 0) bullBullets.push(`- Strong cash generation (FCF margin ~${fcfMarginPct}%)`);
        if (growthPct >= 10) bullBullets.push(`- Sustainable growth profile (~${growthPct}% 3Y CAGR)`);
        if (analystAvgTarget && analystCount > 0 && analystAvgTarget > fv) bullBullets.push(`- Analyst targets above DCF ($${analystAvgTarget.toFixed(2)} from ${analystCount} analysts)`);
        if (bullBullets.length === 0) bullBullets.push('- Solid fundamentals and market positioning');
        const bull_scenario = bullBullets.join('\n');

        const bearBullets: string[] = [];
        if (negatives.length) bearBullets.push(...negatives.map((n: any) => `- ${n.description}`));
        if (growthPct > 50) bearBullets.push('- Extreme recent growth may normalize faster than expected');
        if (confLevel === 'LOW') bearBullets.push('- Model divergence indicates high uncertainty');
        if (bearBullets.length === 0) bearBullets.push('- Macro/competition and execution risks could pressure assumptions');
        const bear_scenario = bearBullets.join('\n');

        const gap_explanation = analystCount > 0
          ? `Analyst target is $${(analystAvgTarget || 0).toFixed(2)} vs DCF $${fv.toFixed(2)} and market $${cp.toFixed(2)}. Differences arise from model weighting (${wm}), cash flow quality, and confidence factors: ${factors.map((x: any) => x.factor).slice(0,3).join(', ')}.`
          : `DCF fair value $${fv.toFixed(2)} vs market $${cp.toFixed(2)}. Key drivers: ${wm}. Confidence is ${confLevel.toLowerCase()} due to ${negatives.map((n: any) => n.factor).slice(0,2).join(', ') || 'model and data uncertainty'}.`;

        return { thesis, bull_scenario, bear_scenario, gap_explanation };
      };
      
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
          // NEW: Track original value before caps
          price_per_share_original: result.price_per_share_original,
          enterprise_value: result.enterprise_value,
          upside_downside: result.upside_downside,
          wacc: result.wacc,
          assumptions: result.assumptions,
          projections: result.projections,
          // NEW: Track applied caps for transparency
          sanity_cap_applied: result.sanity_cap_applied,
          healthcare_cap_applied: result.healthcare_cap_applied
        })),
        consensus_valuation: {
          weighted_fair_value: weightedFairValue,
          simple_average: simpleAverage,
          range: {
            low: rangeLow,
            high: rangeHigh
          },
          upside_to_weighted: upsideToWeighted,
          // NEW: Confidence scoring (critical for AI explanations)
          confidence_score: consensusValuation.confidence_score,
          confidence_level: consensusValuation.confidence_level,
          confidence_factors: consensusValuation.confidence_factors,
          // NEW: Weighting explanation (helps AI explain methodology)
          weighting_method: consensusValuation.weighting_method,
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

      // === AI ANALYSIS (Always On; await until done; fallback if fails/unavailable) ===
      let ai_analysis: {
        thesis?: string;
        bull_scenario?: string;
        bear_scenario?: string;
        gap_explanation?: string;
      } = {};

      // Always attempt AI analysis when AI binding is available; otherwise fallback
      if (env.AI) {
        try {
          ai_analysis = await generateAiAnalysis({
            ai: env.AI,
            model: env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8',
            ticker,
            fundamentals,
            analystAvgTarget,
            analystCount,
            modelResults,
            consensusValuation
          });

        } catch (e) {
          console.warn('[Unified-DCF] AI analysis failed:', e);
          ai_analysis = buildFallbackAIAnalysis(
            fundamentals,
            consensusValuation as any,
            modelResults,
            analystAvgTarget,
            analystCount
          );
        }
      } else {
        ai_analysis = buildFallbackAIAnalysis(
          fundamentals,
          consensusValuation as any,
          modelResults,
          analystAvgTarget,
          analystCount
        );
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

// Generate full AI analysis (thesis, bull, bear, and gap) - awaited
async function generateAiAnalysis(input: {
  ai: Ai;
  model: string;
  ticker: string;
  fundamentals: any;
  analystAvgTarget: number;
  analystCount: number;
  modelResults: Array<{ model: string; result: any }>;
  consensusValuation: ConsensusValuation;
}): Promise<{ thesis?: string; bull_scenario?: string; bear_scenario?: string; gap_explanation?: string; }> {
  const { ai, model, ticker, fundamentals, analystAvgTarget, analystCount, modelResults, consensusValuation } = input;

  // Prepare context
  const confidenceLevel = consensusValuation.confidence_level;
  const confidenceScore = consensusValuation.confidence_score;
  const confidenceFactorsText = consensusValuation.confidence_factors?.factors
    ?.slice(0, 3)
    ?.map((f: ConfidenceFactor) => `  • ${f.description}`)
    ?.join('\n') || 'N/A';
  const weightingRationale = consensusValuation.weighting_method?.rationale || 'Equal weighting';
  const weightedFairValue = consensusValuation.weighted_fair_value;

  const systemPrompt = `You are a Senior Equity Research Analyst. Provide comprehensive investment analysis with clear structure using **THESIS**, **BULL CASE**, and **BEAR CASE** headers.`;
  
  const companyName = fundamentals.company_name || ticker;
  const sector = fundamentals.sector || 'Unknown';
  
  const userPrompt = `Analyze ${ticker} (${companyName}) in the ${sector} sector and provide investment analysis.

IMPORTANT: You are analyzing ${companyName} (ticker: ${ticker}). Do not confuse this with any other company.

FUNDAMENTAL DATA:
- Current Price: $${fundamentals.current_price}
- Revenue: $${fundamentals.revenue?.toLocaleString() || 'N/A'}
- EBITDA Margin: ${(fundamentals.ebitda_margin * 100)?.toFixed(1) || 'N/A'}%
- Free Cash Flow: $${fundamentals.free_cash_flow?.toLocaleString() || 'N/A'}
- Beta: ${fundamentals.beta || 'N/A'}
- Revenue Growth (3Y): ${(fundamentals.revenue_cagr_3y * 100)?.toFixed(1) || 'N/A'}%
- Economic Moat: ${fundamentals.economic_moat || 'N/A'} (Score: ${fundamentals.moat_strength_score || 'N/A'}/100)
- Analyst Target: $${analystAvgTarget || 'N/A'} (${analystCount} analysts)

DCF VALUATION (${confidenceLevel} Confidence - ${(confidenceScore * 100).toFixed(0)}%):
- Weighted Fair Value: $${weightedFairValue?.toFixed(2) || 'N/A'}
- 3-Stage DCF: $${modelResults.find((r: any) => r.model === '3stage')?.result?.price_per_share?.toFixed(2) || 'N/A'}
- H-Model DCF: $${modelResults.find((r: any) => r.model === 'hmodel')?.result?.price_per_share?.toFixed(2) || 'N/A'}
- Model Weighting: ${weightingRationale}
- Confidence Factors:
${confidenceFactorsText}

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

  // Use scoped prompts (recommended by Cloudflare) with messages format
  const analysisRes = await (ai as any).run(model as any, { 
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000 
  });
  
  console.log('[AI Analysis] Raw response:', JSON.stringify(analysisRes).substring(0, 200));
  const text = (analysisRes as any)?.response || (analysisRes as any)?.result || (analysisRes as any)?.output_text || '';
  console.log('[AI Analysis] Extracted text length:', text.length);

  // Check if we got empty response
  if (!text || text.length < 10) {
    console.error('[AI Analysis] Empty or very short response received, text:', text);
    console.error('[AI Analysis] Trying fallback with prompt format...');
    
    // Try fallback with unscoped prompt format
    try {
      const fallbackRes = await (ai as any).run(model as any, { 
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        max_tokens: 1000 
      });
      const fallbackText = (fallbackRes as any)?.response || (fallbackRes as any)?.result || (fallbackRes as any)?.output_text || '';
      console.log('[AI Analysis] Fallback response length:', fallbackText.length);
      
      if (fallbackText && fallbackText.length > 10) {
        // Use fallback text
        const thesisMatch = fallbackText.match(/\*\*THESIS\*\*[:\s]*(.*?)(?=\*\*BULL CASE\*\*|$)/s);
        const bullMatch = fallbackText.match(/\*\*BULL CASE\*\*[:\s]*(.*?)(?=\*\*BEAR CASE\*\*|$)/s);
        const bearMatch = fallbackText.match(/\*\*BEAR CASE\*\*[:\s]*(.*?)$/s);
        
        const result: { thesis?: string; bull_scenario?: string; bear_scenario?: string; gap_explanation?: string } = {
          thesis: thesisMatch ? thesisMatch[1].trim() : undefined,
          bull_scenario: bullMatch ? bullMatch[1].trim() : undefined,
          bear_scenario: bearMatch ? bearMatch[1].trim() : undefined
        };
        
        // Gap explanation (second awaited call)
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
          const gap = await explainGapWithAI(ai, model, gapExplanationInput);
          if (gap && gap !== 'AI analysis unavailable') result.gap_explanation = gap;
        } catch (gapError) {
          console.error('[Gap Analysis] Error:', gapError);
        }
        
        return result;
      }
    } catch (fallbackError) {
      console.error('[AI Analysis] Fallback failed:', fallbackError);
    }
    
    // If we still don't have text, throw error to trigger fallback generation
    throw new Error('AI response empty after fallback attempts');
  }

  const thesisMatch = text.match(/\*\*THESIS\*\*[:\s]*(.*?)(?=\*\*BULL CASE\*\*|$)/s);
  const bullMatch = text.match(/\*\*BULL CASE\*\*[:\s]*(.*?)(?=\*\*BEAR CASE\*\*|$)/s);
  const bearMatch = text.match(/\*\*BEAR CASE\*\*[:\s]*(.*?)$/s);

  const result: { thesis?: string; bull_scenario?: string; bear_scenario?: string; gap_explanation?: string } = {
    thesis: thesisMatch ? thesisMatch[1].trim() : undefined,
    bull_scenario: bullMatch ? bullMatch[1].trim() : undefined,
    bear_scenario: bearMatch ? bearMatch[1].trim() : undefined
  };
  
  console.log('[AI Analysis] Parsed sections:', {
    hasThesis: !!result.thesis,
    hasBull: !!result.bull_scenario,
    hasBear: !!result.bear_scenario
  });

  // Gap explanation (second awaited call)
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
    const gap = await explainGapWithAI(ai, model, gapExplanationInput);
    if (gap && gap !== 'AI analysis unavailable') {
      result.gap_explanation = gap;
      console.log('[AI Analysis] Gap explanation added, length:', gap.length);
    }
  } catch (gapError) {
    console.error('[Gap Analysis] Error:', gapError);
  }

  return result;
}

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

  // Calculate gaps explicitly for the prompt
  const dcfVsMarket = dcf_weighted_fair_value - current_price;
  const dcfVsMarketPct = (dcfVsMarket / current_price) * 100;
  const analystVsMarket = analyst_avg_target - current_price;
  const analystVsMarketPct = (analystVsMarket / current_price) * 100;
  const dcfVsAnalyst = dcf_weighted_fair_value - analyst_avg_target;
  const dcfVsAnalystPct = Math.abs(analyst_avg_target) > 0 ? (dcfVsAnalyst / analyst_avg_target) * 100 : 0;

  const systemPrompt = `You are a Senior Equity Research Analyst. Explain valuation gaps concisely, focusing on the DCF weighted consensus fair value compared to market price and analyst consensus.`;
  
  const userPrompt = `Explain the valuation gap for ${ticker} (${company_name || 'Unknown Company'}) in ${sector || 'equity'} sector.

CRITICAL FOCUS: Explain why there are differences between these THREE key valuations:
1. Market Price: $${current_price.toFixed(2)} (what investors are paying NOW)
2. Analyst Consensus: $${analyst_avg_target.toFixed(2)} (${analystCount} analysts' average target)
3. DCF Weighted Fair Value: $${dcf_weighted_fair_value.toFixed(2)} (our fundamental valuation combining 3-Stage and H-Model)

VALUATION GAPS TO EXPLAIN:
• DCF vs Market: ${dcfVsMarket >= 0 ? '+' : ''}$${dcfVsMarket.toFixed(2)} (${dcfVsMarketPct >= 0 ? '+' : ''}${dcfVsMarketPct.toFixed(1)}%)
• Analyst vs Market: ${analystVsMarket >= 0 ? '+' : ''}$${analystVsMarket.toFixed(2)} (${analystVsMarketPct >= 0 ? '+' : ''}${analystVsMarketPct.toFixed(1)}%)
• DCF vs Analyst: ${dcfVsAnalyst >= 0 ? '+' : ''}$${dcfVsAnalyst.toFixed(2)} (${dcfVsAnalystPct >= 0 ? '+' : ''}${dcfVsAnalystPct.toFixed(1)}%)

CONTEXT (for reference only):
• 3-Stage DCF: $${threeStagePrice.toFixed(2)} | H-Model DCF: $${hmodelPrice.toFixed(2)}
• Revenue Growth: ${histGrowth}% (historical) vs ${analystGrowth}% (expected)
• EBITDA Margin: ${ebitdaMargin}% | FCF Margin: ${fcfMargin}%
• Economic Moat: ${moat} (strength: ${moatScore}/100)

TASK: Write 2-3 sentences explaining:
1. Why DCF weighted consensus (${dcf_weighted_fair_value.toFixed(2)}) differs from market price (${current_price.toFixed(2)})
2. Why DCF differs from analyst consensus (${analyst_avg_target.toFixed(2)})
3. What business/market factors drive these gaps (growth assumptions, risk perception, market sentiment, moat quality, etc.)

Focus on the WEIGHTED CONSENSUS DCF value, not individual model differences.`;

  // Use scoped prompts (recommended by Cloudflare) with messages format
  try {
    const res = await (ai as any).run(model as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 250  // Increased for more detailed analysis
    });
    
    console.log('[Gap Analysis] Raw response:', JSON.stringify(res).substring(0, 200));
    
    // Return raw response - no parsing, no JSON processing
    const gapText = (res as any)?.response || (res as any)?.result || (res as any)?.output_text || '';
    console.log('[Gap Analysis] Extracted text length:', gapText.length);
    
    // If we got a valid response, return it
    if (gapText && gapText.length > 10) {
      return gapText;
    }
    
    // Otherwise, try fallback with unscoped prompt
    console.error('[Gap Analysis] Empty response with messages format, trying fallback...');
  } catch (error) {
    console.error('[Gap Analysis] Error with messages format:', error);
  }
  
  // Fallback: Try unscoped prompt format
  try {
    const fallbackRes = await (ai as any).run(model as any, {
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      max_tokens: 250
    });
    
    const fallbackText = (fallbackRes as any)?.response || (fallbackRes as any)?.result || (fallbackRes as any)?.output_text || '';
    console.log('[Gap Analysis] Fallback response length:', fallbackText.length);
    
    if (fallbackText && fallbackText.length > 10) {
      return fallbackText;
    }
  } catch (fallbackError) {
    console.error('[Gap Analysis] Fallback failed:', fallbackError);
  }
  
  return 'AI analysis unavailable';
}

