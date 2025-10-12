import { Intent, validateIntent, type IntentType } from '../shared/schemas/intent';

export interface Env {
  AI: Ai;
}

/**
 * Intent Service - Extract investment intent from natural language using Workers AI
 * Uses prompt engineering with few-shot examples and structured JSON output
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

    // Extract intent using AI with structured prompt
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
 * Core intent extraction function using Workers AI
 */
export async function extract(text: string, ai: Ai): Promise<IntentType> {
  const prompt = buildIntentExtractionPrompt(text);
  
  try {
    // Use Llama 3.3 70B with JSON mode for structured output
    const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        {
          role: 'system',
          content: prompt.system
        },
        {
          role: 'user',
          content: prompt.user
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent structured output
      max_tokens: 1000
    });

    // Parse AI response
    const responseText = typeof response === 'string' ? response : (response as any).response;
    const aiResponse = JSON.parse(responseText);
    
    // Validate and normalize the response
    const validatedIntent = validateAndNormalizeIntent(aiResponse);
    
    return validatedIntent;

  } catch (error) {
    console.error('AI intent extraction failed:', error);
    // Return default intent as fallback
    return getDefaultIntent();
  }
}

/**
 * Build sophisticated prompt with few-shot examples and context engineering
 */
function buildIntentExtractionPrompt(userQuery: string) {
  const systemPrompt = `You are an expert investment advisor AI that extracts structured investment intent from natural language queries.

Your task is to analyze user queries and extract:
1. Investment objective (growth, income, balanced, preservation, speculation)
2. Risk tolerance (conservative, moderate, aggressive, very_aggressive)
3. Investment horizon in years
4. Style weights (must sum to 100): value, growth, momentum, quality, size, volatility
5. Investment gates/filters based on mentioned constraints

IMPORTANT: This MVP only handles US stocks traded in USD. All price constraints and market cap values are in USD.

CRITICAL RULES:
- Style weights MUST sum to exactly 100
- Derive gates from mentioned limits (price_max, rev_cagr_min, sectors, etc.)
- Use conservative defaults for missing information
- Never hallucinate or add information not present in the query
- Always return valid JSON matching the exact schema
- All prices and market caps are in USD (no currency conversion needed)

FEW-SHOT EXAMPLES:

Query: "I want growth stocks under $50, US software companies, risk-averse, 3-5 years"
Response: {
  "objective": "growth",
  "risk_tolerance": "conservative",
  "horizon_years": 4,
  "style_weights": {
    "value": 20,
    "growth": 40,
    "momentum": 15,
    "quality": 15,
    "size": 5,
    "volatility": 5
  },
  "gates": {
    "price_max": 50,
    "sectors_include": ["Technology"],
    "countries_include": ["US"]
  }
}

Query: "High dividend yield stocks, moderate risk, 10+ years"
Response: {
  "objective": "income",
  "risk_tolerance": "moderate",
  "horizon_years": 10,
  "style_weights": {
    "value": 30,
    "growth": 10,
    "momentum": 10,
    "quality": 30,
    "size": 10,
    "volatility": 10
  },
  "gates": {
    "min_dividend_yield": 3.0
  }
}

Query: "AI companies, aggressive growth, short term"
Response: {
  "objective": "growth",
  "risk_tolerance": "aggressive",
  "horizon_years": 2,
  "style_weights": {
    "value": 5,
    "growth": 50,
    "momentum": 25,
    "quality": 10,
    "size": 5,
    "volatility": 5
  },
  "gates": {
    "sectors_include": ["Technology"],
    "keywords": ["AI", "artificial intelligence", "machine learning"]
  }
}

Query: "Safe investments, preserve capital, 5 years"
Response: {
  "objective": "preservation",
  "risk_tolerance": "conservative",
  "horizon_years": 5,
  "style_weights": {
    "value": 40,
    "growth": 10,
    "momentum": 5,
    "quality": 35,
    "size": 5,
    "volatility": 5
  },
  "gates": {
    "max_debt_to_equity": 0.5,
    "min_roe": 10
  }
}

Query: "Small cap value, US companies, 7 years"
Response: {
  "objective": "balanced",
  "risk_tolerance": "moderate",
  "horizon_years": 7,
  "style_weights": {
    "value": 50,
    "growth": 15,
    "momentum": 10,
    "quality": 15,
    "size": 5,
    "volatility": 5
  },
  "gates": {
    "market_cap_max_usd": 2000000000,
    "countries_include": ["US"]
  }
}

Now analyze this user query and extract their investment intent:`;

  return {
    system: systemPrompt,
    user: userQuery
  };
}

/**
 * Validate and normalize AI response with Zod schema
 */
function validateAndNormalizeIntent(aiResponse: any): IntentType {
  try {
    // First, normalize style weights to sum to 100
    if (aiResponse.style_weights) {
      const weights = aiResponse.style_weights;
      const sum = Object.values(weights).reduce((total: number, weight: any) => total + (weight || 0), 0);
      
      if (sum > 0) {
        // Normalize to 100
        Object.keys(weights).forEach(key => {
          weights[key] = Math.round((weights[key] / sum) * 100);
        });
      } else {
        // Use default weights if sum is 0
        aiResponse.style_weights = {
          value: 20,
          growth: 20,
          momentum: 20,
          quality: 20,
          size: 10,
          volatility: 10
        };
      }
    }

    // Validate with Zod schema
    const validatedIntent = validateIntent(aiResponse);
    
    return validatedIntent;

  } catch (error) {
    console.error('Intent validation failed:', error);
    return getDefaultIntent();
  }
}

/**
 * Get default intent as fallback
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