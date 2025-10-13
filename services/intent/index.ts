import { Intent, validateIntent, type IntentType, type InvestmentObjectiveType, type RiskToleranceType, type StyleWeightsType, type InvestmentGatesType } from '../shared/schemas/intent';

export interface Env {
  AI: Ai;
}

/**
 * Intent Service - Extract investment intent from natural language using Workers AI
 * Simplified approach to avoid CPU time limits on free tier
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
      if (path === '/extract' && request.method === 'POST') {
        return await extractIntent(request, env, corsHeaders);
      }

      if (path === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          service: 'intent',
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
      console.error('Intent service error:', error);
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
 * Extract investment intent from natural language text
 */
async function extractIntent(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { query } = await request.json() as { query: string };
    
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Query is required and must be a string'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Lightweight guardrail: only proceed if query appears stock/investing-related
    if (!isStockRelated(query)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Query appears unrelated to stocks or investing',
        code: 'UNRELATED_TOPIC'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract intent using AI with simplified approach
    const intent = await extract(query, env.AI);
    
    return new Response(JSON.stringify({
      success: true,
      data: intent,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Intent extraction error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Intent extraction failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Core intent extraction function using Workers AI - Simplified approach
 * Removes JSON mode to avoid CPU time limits on free tier
 */
export async function extract(text: string, ai: Ai): Promise<IntentType> {
  try {
    // Concise role + constraints to keep output short and CPU low
    const systemPrompt = 'You are a financial intent extractor. Extract ONLY three values: objective, risk, pricecap. Output format: "objective, risk, pricecap". Rules: (1) objective ∈ {growth,income,balanced,preservation,speculation}. (2) risk ∈ {conservative,moderate,aggressive,very_aggressive}. (3) pricecap = 0 UNLESS the query explicitly says "under $X" or "below X" or "less than X". DO NOT infer price from risk level.';
    const userPrompt = `Query: "${text}"

Examples:
"growth stocks under $50" → growth, moderate, 50
"conservative dividend stocks" → income, conservative, 0
"aggressive tech stocks" → growth, aggressive, 0
"balanced portfolio" → balanced, moderate, 0
"value healthcare stocks" → preservation, conservative, 0
"tech under 20" → growth, moderate, 20`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast' as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.05,
      max_tokens: 24 // keep extremely short
    });

    // Parse the simple response
    const responseText = typeof response === 'string' ? response : (response as any).response;
    console.log('AI Response Text:', responseText);
    
    // Parse the simple comma-separated response
    const parts = responseText.trim().split(',').map((p: string) => p.trim().toLowerCase());
    
    if (parts.length >= 3) {
      const [objective, risk, pricecap] = parts;

      // Guardrail from model contract
      if (objective === 'invalid' && risk === 'invalid') {
        throw new Error('Unrelated topic');
      }
      
      // Map to valid enum values
      const mappedObjective = mapObjective(objective);
      const mappedRisk = mapRiskTolerance(risk);
      const priceCapNumber = Math.max(0, Math.floor(parseInt(pricecap) || 0));
      
      // Create intent with derived style weights
      const intent: IntentType = {
        objective: mappedObjective,
        risk_tolerance: mappedRisk,
        style_weights: deriveStyleWeights(mappedObjective, mappedRisk),
        // Single source of truth for price cap: model cap overrides text-derived cap
        gates: withPriceCap(deriveGatesFromText(text), priceCapNumber),
        source: 'AI'
      };
      
      return intent;
    } else {
      throw new Error('Invalid response format');
    }

  } catch (error) {
    console.error('AI intent extraction failed:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    // Return default intent as fallback
    const fallbackIntent = getDefaultIntent();
    fallbackIntent.source = 'Fallback';
    return fallbackIntent;
  }
}

/**
 * Very small heuristic to check if a query is stock/investing related
 */
function isStockRelated(text: string): boolean {
  const t = text.toLowerCase();
  const keywords = [
    'stock','stocks','equity','equities','share','shares','ticker','tickers',
    'market','markets','nasdaq','nyse','sp500','s&p','invest','investing','portfolio',
    'dividend','pe','p/e','earnings','revenue','sector','industry','finviz','yfinance','etf','ipo',
    // Relaxed terms commonly used by users
    'tech','technology','value','growth','income','momentum','balanced','small cap','large cap','mid cap'
  ];
  if (keywords.some(k => t.includes(k))) return true;

  // Price-cap patterns (e.g., under $50, <$10, price < 20)
  const pricePatterns = [
    /under\s*\$?\s*\d+(?:\.\d+)?/,
    /below\s*\$?\s*\d+(?:\.\d+)?/,
    /\$\s*\d+(?:\.\d+)?/,
    /price\s*[<≤]\s*\$?\s*\d+(?:\.\d+)?/
  ];
  if (pricePatterns.some((re) => re.test(t))) return true;

  // Basic ticker-like token (e.g., AAPL, MSFT): allow mixed case tokens 1-5 letters with at least 2 uppercase
  const tickerLike = /\b[A-Za-z]{1,5}\b/;
  if (tickerLike.test(text)) {
    const tokens = text.split(/\s+/);
    if (tokens.some(tok => /[A-Z]/.test(tok) && tok.length <= 5)) return true;
  }
  return false;
}

/**
 * Map objective text to valid enum value
 */
function mapObjective(text: string): InvestmentObjectiveType {
  const lower = text.toLowerCase();
  if (lower.includes('growth')) return 'growth';
  if (lower.includes('income') || lower.includes('dividend')) return 'income';
  if (lower.includes('preservation') || lower.includes('conservative')) return 'preservation';
  if (lower.includes('speculation') || lower.includes('aggressive')) return 'speculation';
  return 'balanced';
}

/**
 * Map risk text to valid enum value
 */
function mapRiskTolerance(text: string): RiskToleranceType {
  const lower = text.toLowerCase();
  if (lower.includes('conservative')) return 'conservative';
  if (lower.includes('aggressive')) return 'aggressive';
  if (lower.includes('very_aggressive')) return 'very_aggressive';
  return 'moderate';
}

/**
 * Derive style weights based on objective and risk
 */
function deriveStyleWeights(objective: InvestmentObjectiveType, risk: RiskToleranceType): StyleWeightsType {
  // Start with equal weights in fractional form
  const base = {
    value: 0.20,
    growth: 0.20,
    momentum: 0.20,
    quality: 0.20,
    size: 0.10,
    volatility: 0.10
  };

  // Adjust based on objective
  switch (objective) {
    case 'growth':
      base.growth = 0.40;
      base.value = 0.10;
      base.momentum = 0.25;
      base.quality = 0.15;
      break;
    case 'income':
      base.value = 0.40;
      base.growth = 0.10;
      base.quality = 0.30;
      base.momentum = 0.10;
      break;
    case 'preservation':
      base.quality = 0.40;
      base.value = 0.30;
      base.growth = 0.05;
      base.momentum = 0.05;
      base.volatility = 0.20;
      break;
    case 'speculation':
      base.momentum = 0.40;
      base.growth = 0.30;
      base.value = 0.05;
      base.quality = 0.15;
      base.volatility = 0.10;
      break;
  }

  // Adjust based on risk
  switch (risk) {
    case 'conservative':
      base.quality += 0.10;
      base.value += 0.10;
      base.volatility += 0.10;
      base.growth -= 0.10;
      base.momentum -= 0.10;
      break;
    case 'aggressive':
      base.growth += 0.10;
      base.momentum += 0.10;
      base.quality -= 0.10;
      base.value -= 0.10;
      break;
    case 'very_aggressive':
      base.momentum += 0.15;
      base.growth += 0.15;
      base.quality -= 0.15;
      base.value -= 0.15;
      break;
  }

  // Normalize to sum to 1
  const sum = Object.values(base).reduce((acc, val) => acc + val, 0);
  if (sum <= 0) {
    return { value: 0.2, growth: 0.2, momentum: 0.2, quality: 0.2, size: 0.1, volatility: 0.1 };
  }
  const factor = 1 / sum;
  return {
    value: Number((base.value * factor).toFixed(4)),
    growth: Number((base.growth * factor).toFixed(4)),
    momentum: Number((base.momentum * factor).toFixed(4)),
    quality: Number((base.quality * factor).toFixed(4)),
    size: Number((base.size * factor).toFixed(4)),
    volatility: Number((base.volatility * factor).toFixed(4))
  };
}

/**
 * Derive gates from the original text
 */
function deriveGatesFromText(text: string): InvestmentGatesType {
  const gates: InvestmentGatesType = {};
  const lowerText = text.toLowerCase();

  // Price constraints
  const priceMatch = lowerText.match(/under \$?(\d+(?:\.\d+)?)|below \$?(\d+(?:\.\d+)?)|less than \$?(\d+(?:\.\d+)?)/);
  if (priceMatch) {
    const price = priceMatch[1] || priceMatch[2] || priceMatch[3];
    if (price) {
      gates.max_price = parseFloat(price);
    }
  }

  // Market cap constraints
  if (lowerText.includes('small cap')) {
    gates.max_market_cap = 2000000000; // $2B
  }
  if (lowerText.includes('large cap')) {
    gates.min_market_cap = 10000000000; // $10B
  }

  // Sectors
  const sectors: string[] = [];
  if (lowerText.includes('tech') || lowerText.includes('software') || lowerText.includes('ai')) {
    sectors.push('Technology');
  }
  if (lowerText.includes('finance') || lowerText.includes('banks')) {
    sectors.push('Financial Services');
  }
  if (lowerText.includes('healthcare') || lowerText.includes('pharma')) {
    sectors.push('Healthcare');
  }
  if (sectors.length > 0) {
    gates.sectors = sectors;
  }

  return gates;
}

// Merge a price cap from the model output into derived gates
function withPriceCap(gates: InvestmentGatesType, priceCap: number): InvestmentGatesType {
  if (priceCap && priceCap > 0) {
    return { ...gates, max_price: priceCap };
  }
  return gates;
}

/**
 * Default intent fallback
 */
function getDefaultIntent(): IntentType {
  return {
    objective: 'balanced',
    risk_tolerance: 'moderate',
    style_weights: {
      value: 20,
      growth: 20,
      momentum: 20,
      quality: 20,
      size: 10,
      volatility: 10
    },
    gates: {}
  };
}