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

export interface Env {
  FUNDAMENTALS_SNAP: KVNamespace;
  AI: Ai;  // Cloudflare AI binding
  DATA_SERVICE_URL?: string;  // Centralized data service
  DCF_3STAGE_URL?: string;  // 3-Stage DCF model
  DCF_SOTP_URL?: string;    // SOTP model
  DCF_HMODEL_URL?: string;  // H-Model DCF
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
        service: 'multi-model-dcf',
        models: {
          data_service: !!env.DATA_SERVICE_URL,
          three_stage: !!env.DCF_3STAGE_URL,
          sotp: !!env.DCF_SOTP_URL,
          hmodel: !!env.DCF_HMODEL_URL
        },
        ai_available: !!env.AI,
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
        models?: 'auto' | 'all' | '3stage' | 'sotp' | 'hmodel';
        assumptions?: Record<string, any>;
      };
      
      const ticker = (body.ticker || '').toUpperCase();
      const modelPreference = body.models || 'auto';
      
      if (!ticker) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Ticker is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check cache first
      const cacheKey = `multi-dcf:${ticker}:${modelPreference}`;
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
      console.log(`[Multi-DCF] Step 1: Fetching fundamentals for ${ticker}`);
      let fundamentals: FundamentalsSnapshot;
      
      if (env.DATA_SERVICE_URL) {
        const dataResponse = await fetch(`${env.DATA_SERVICE_URL}/fundamentals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker })
        });

        if (!dataResponse.ok) {
          throw new Error(`Data service error: ${dataResponse.statusText}`);
        }

        const dataResult = await dataResponse.json() as { success: boolean; data: any };
        if (!dataResult.success) {
          throw new Error('Failed to fetch fundamentals');
        }

        fundamentals = dataResult.data;
      } else {
        throw new Error('DATA_SERVICE_URL not configured');
      }

      // === STEP 2: Select Models (AI or Rule-based) ===
      console.log(`[Multi-DCF] Step 2: Selecting models (preference: ${modelPreference})`);
      let modelSelection: ModelSelectorOutput;

      if (modelPreference === 'auto') {
        // Use AI to select models
        try {
          modelSelection = await selectModelsWithAI(fundamentals, env);
        } catch (error) {
          console.warn('[Multi-DCF] AI selection failed, using rule-based fallback');
          modelSelection = selectModelsRuleBased(fundamentals);
        }
      } else if (modelPreference === 'all') {
        modelSelection = {
          recommended_models: ['3stage', 'sotp', 'hmodel'],
          reasoning: 'User requested all models',
          confidence: 1.0,
          weights: { '3stage': 0.33, 'sotp': 0.33, 'hmodel': 0.34 }
        };
      } else {
        modelSelection = {
          recommended_models: [modelPreference as '3stage' | 'sotp' | 'hmodel'],
          reasoning: 'User specified model',
          confidence: 1.0,
          weights: { [modelPreference]: 1.0 }
        };
      }

      console.log(`[Multi-DCF] Selected models: ${modelSelection.recommended_models.join(', ')}`);

      // === STEP 3: Run Selected Models in Parallel ===
      console.log(`[Multi-DCF] Step 3: Running ${modelSelection.recommended_models.length} model(s)`);
      const modelPromises = modelSelection.recommended_models.map(async (model) => {
        const serviceUrl = getServiceUrl(model, env);
        
        if (!serviceUrl) {
          console.warn(`[Multi-DCF] Service URL not configured for ${model}`);
          return null;
        }

        const endpoint = model === '3stage' ? '/dcf' : model === 'sotp' ? '/sotp' : '/hmodel';
        
        try {
          const response = await fetch(`${serviceUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, fundamentals })
          });

          if (!response.ok) {
            console.error(`[Multi-DCF] ${model} error: ${response.statusText}`);
            return null;
          }

          const result = await response.json() as { success: boolean; data: any };
          
          if (!result.success) {
            console.error(`[Multi-DCF] ${model} calculation failed`);
            return null;
          }

          return { model, result: result.data };
        } catch (error) {
          console.error(`[Multi-DCF] ${model} exception:`, error);
          return null;
        }
      });

      const modelResults = (await Promise.all(modelPromises)).filter(r => r !== null) as Array<{ model: string; result: any }>;

      if (modelResults.length === 0) {
        throw new Error('All DCF models failed');
      }

      // === STEP 4: Aggregate Results ===
      console.log(`[Multi-DCF] Step 4: Aggregating ${modelResults.length} result(s)`);
      
      const weightedFairValue = modelResults.reduce((sum, { model, result }) => {
        const weight = modelSelection.weights[model as keyof typeof modelSelection.weights] || 0;
        return sum + (result.price_per_share * weight);
      }, 0);

      const simpleAverage = modelResults.reduce((sum, { result }) => sum + result.price_per_share, 0) / modelResults.length;

      const prices = modelResults.map(({ result }) => result.price_per_share);
      const rangeLow = Math.min(...prices);
      const rangeHigh = Math.max(...prices);

      const currentPrice = fundamentals.current_price;
      const upsideToWeighted = ((weightedFairValue - currentPrice) / currentPrice) * 100;

      // === STEP 5: Generate Recommendation ===
      const recommendation = generateRecommendation(upsideToWeighted);

      const finalResult = {
        ticker,
        current_price: currentPrice,
        model_selection: {
          recommended_models: modelSelection.recommended_models,
          reasoning: modelSelection.reasoning,
          confidence: modelSelection.confidence
        },
        individual_valuations: modelResults.map(({ model, result }) => ({
          model,
          price_per_share: result.price_per_share,
          enterprise_value: result.enterprise_value,
          upside_downside: result.upside_downside,
          wacc: result.wacc,
          assumptions: result.assumptions
        })),
        consensus_valuation: {
          weighted_fair_value: weightedFairValue,
          simple_average: simpleAverage,
          range: {
            low: rangeLow,
            high: rangeHigh
          },
          upside_to_weighted: upsideToWeighted
        },
        recommendation,
        confidence_level: modelSelection.confidence,
        timestamp: new Date().toISOString()
      };

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
      console.error('Multi-DCF service error:', error);
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
 * AI-powered model selector using Cloudflare Workers AI
 */
async function selectModelsWithAI(fundamentals: FundamentalsSnapshot, env: Env): Promise<ModelSelectorOutput> {
  const segmentInfo = fundamentals.revenue_by_segment && fundamentals.revenue_by_segment.length > 0
    ? fundamentals.revenue_by_segment.map(s => 
        `- ${s.segment_name}: $${(s.revenue / 1e9).toFixed(1)}B (${(s.margin * 100).toFixed(1)}% margin)`
      ).join('\n')
    : 'Single/undisclosed segment';

  const prompt = `You are a senior financial analyst at Goldman Sachs. Recommend which DCF valuation model(s) to use for the following company:

COMPANY: ${fundamentals.ticker}
SECTOR: ${fundamentals.sector || 'Unknown'}
MARKET CAP: $${(fundamentals.market_cap / 1e9).toFixed(1)}B
REVENUE: $${(fundamentals.revenue / 1e9).toFixed(1)}B

BUSINESS SEGMENTS:
${segmentInfo}

GROWTH METRICS:
- 3Y Revenue CAGR: ${(fundamentals.revenue_cagr_3y * 100).toFixed(1)}%
- EBITDA Margin: ${(fundamentals.ebitda_margin * 100).toFixed(1)}%

AVAILABLE MODELS:
1. **3-Stage DCF**: Best for large-cap companies with predictable declining growth trajectory
2. **SOTP (Sum-of-the-Parts)**: Best for diversified companies with distinct business segments
3. **H-Model DCF**: Best for high-growth companies with simpler assumptions

INSTRUCTIONS:
- If company has 3+ distinct segments with different margins/growth, strongly favor SOTP
- If company is large-cap (>$500B) and diversified, use SOTP + 3-Stage
- If company is pure-play or 80%+ revenue from one segment, prefer 3-Stage or H-Model
- If high growth (>15% CAGR), H-Model is appropriate
- You can recommend multiple models with weights

Return ONLY valid JSON (no markdown):
{
  "recommended_models": ["model1", "model2"],
  "reasoning": "explanation",
  "confidence": 0.85,
  "weights": {"model1": 0.6, "model2": 0.4}
}`;

  const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  }) as any;

  // Parse AI response
  let responseText = response.response || '';
  
  // Remove markdown code blocks if present
  responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  const parsed = JSON.parse(responseText);

  return {
    recommended_models: parsed.recommended_models || ['3stage'],
    reasoning: parsed.reasoning || 'AI model selection',
    confidence: parsed.confidence || 0.75,
    weights: parsed.weights || { '3stage': 1.0 }
  };
}

/**
 * Rule-based fallback model selector
 */
function selectModelsRuleBased(fundamentals: FundamentalsSnapshot): ModelSelectorOutput {
  const models: ('3stage' | 'sotp' | 'hmodel')[] = [];
  const weights: Record<string, number> = {};
  let reasoning = '';

  // Rule 1: Check if diversified (multiple segments)
  const hasMultipleSegments = fundamentals.revenue_by_segment && fundamentals.revenue_by_segment.length >= 3;
  const segmentConcentration = hasMultipleSegments
    ? Math.max(...fundamentals.revenue_by_segment!.map(s => s.revenue)) / fundamentals.revenue
    : 1.0;

  if (hasMultipleSegments && segmentConcentration < 0.60) {
    // Diversified: No single segment > 60%
    models.push('sotp');
    weights['sotp'] = 0.5;
    reasoning += 'Company is diversified across multiple segments. ';
  }

  // Rule 2: Check growth stage
  const isHighGrowth = fundamentals.revenue_cagr_3y > 0.15;
  const isMaturing = fundamentals.market_cap > 500_000_000_000; // >$500B

  if (isHighGrowth && !isMaturing) {
    models.push('hmodel');
    weights['hmodel'] = 0.4;
    reasoning += 'High growth rate favors H-Model. ';
  }

  // Rule 3: Default to 3-stage for most established companies
  if (isMaturing || !isHighGrowth) {
    models.push('3stage');
    weights['3stage'] = 0.5;
    reasoning += '3-Stage DCF appropriate for mature company. ';
  }

  // Normalize weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach(key => {
    weights[key] = weights[key] / totalWeight;
  });

  return {
    recommended_models: models.length > 0 ? models : ['3stage'], // Default
    reasoning,
    confidence: 0.75,
    weights: weights as any
  };
}

/**
 * Get service URL for a specific model
 */
function getServiceUrl(model: string, env: Env): string | undefined {
  if (model === '3stage') return env.DCF_3STAGE_URL;
  if (model === 'sotp') return env.DCF_SOTP_URL;
  if (model === 'hmodel') return env.DCF_HMODEL_URL;
  return undefined;
}

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
