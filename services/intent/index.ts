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
    // Simple prompt without JSON mode to minimize CPU usage
    const simplePrompt = `Analyze this investment query and respond with just 3 words separated by commas: objective, risk, horizon.

Query: "${text}"

Examples:
"growth stocks" → growth, moderate, 5
"conservative dividend stocks" → income, conservative, 10
"aggressive tech stocks short term" → growth, aggressive, 1
"balanced portfolio long term" → balanced, moderate, 10

Respond with only: objective,risk,horizon`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
      messages: [
        {
          role: 'user',
          content: simplePrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 50 // Very short response to minimize CPU time
    });

    // Parse the simple response
    const responseText = typeof response === 'string' ? response : (response as any).response;
    console.log('AI Response Text:', responseText);
    
    // Parse the simple comma-separated response
    const parts = responseText.trim().split(',').map(p => p.trim().toLowerCase());
    
    if (parts.length >= 3) {
      const [objective, risk, horizon] = parts;
      
      // Map to valid enum values
      const mappedObjective = mapObjective(objective);
      const mappedRisk = mapRiskTolerance(risk);
      const horizonYears = parseInt(horizon) || 5;
      
      // Create intent with derived style weights
      const intent: IntentType = {
        objective: mappedObjective,
        risk_tolerance: mappedRisk,
        horizon_years: Math.max(1, Math.min(50, horizonYears)),
        style_weights: deriveStyleWeights(mappedObjective, mappedRisk),
        gates: deriveGatesFromText(text),
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
  const base = {
    value: 20,
    growth: 20,
    momentum: 20,
    quality: 20,
    size: 10,
    volatility: 10
  };

  // Adjust based on objective
  switch (objective) {
    case 'growth':
      base.growth = 40;
      base.value = 10;
      base.momentum = 25;
      base.quality = 15;
      break;
    case 'income':
      base.value = 40;
      base.growth = 10;
      base.quality = 30;
      base.momentum = 10;
      break;
    case 'preservation':
      base.quality = 40;
      base.value = 30;
      base.growth = 5;
      base.momentum = 5;
      base.volatility = 20;
      break;
    case 'speculation':
      base.momentum = 40;
      base.growth = 30;
      base.value = 5;
      base.quality = 15;
      base.volatility = 10;
      break;
  }

  // Adjust based on risk
  switch (risk) {
    case 'conservative':
      base.quality += 10;
      base.value += 10;
      base.volatility += 10;
      base.growth -= 10;
      base.momentum -= 10;
      break;
    case 'aggressive':
      base.growth += 10;
      base.momentum += 10;
      base.quality -= 10;
      base.value -= 10;
      break;
    case 'very_aggressive':
      base.momentum += 15;
      base.growth += 15;
      base.quality -= 15;
      base.value -= 15;
      break;
  }

  // Normalize to sum to 100
  const sum = Object.values(base).reduce((acc, val) => acc + val, 0);
  const factor = 100 / sum;
  
  return {
    value: Math.round(base.value * factor),
    growth: Math.round(base.growth * factor),
    momentum: Math.round(base.momentum * factor),
    quality: Math.round(base.quality * factor),
    size: Math.round(base.size * factor),
    volatility: Math.round(base.volatility * factor)
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
      gates.price_max = parseFloat(price);
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

/**
 * Default intent fallback
 */
function getDefaultIntent(): IntentType {
  return {
    objective: 'balanced',
    risk_tolerance: 'moderate',
    horizon_years: 5,
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