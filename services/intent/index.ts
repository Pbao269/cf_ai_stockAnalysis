import { z } from 'zod';
import { InvestmentIntent, validateIntent, type InvestmentIntentType } from '../shared/schemas';

export interface Env {
  AI: Ai;
}

/**
 * Intent Service - Parse natural language investment goals using Workers AI
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { query } = await request.json() as { query: string };
      
      if (!query) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Query is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Use Workers AI to parse the investment intent
      const intent = await parseInvestmentIntent(query, env.AI);
      
      return new Response(JSON.stringify({
        success: true,
        data: intent,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Intent parsing error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to parse investment intent',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Parse investment intent from natural language using Workers AI
 */
async function parseInvestmentIntent(query: string, ai: Ai): Promise<InvestmentIntentType> {
  const prompt = `
Parse this investment query into structured data: "${query}"

Extract:
- objective: growth, income, balanced, or preservation
- risk_tolerance: conservative, moderate, or aggressive  
- horizon_years: investment timeframe (1-30 years)
- sectors: any mentioned sectors/themes
- max_price: maximum stock price if mentioned
- min_market_cap: minimum market cap if mentioned
- filters: any other criteria mentioned

Respond with valid JSON only, no explanation.
`;

  const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 200,
    temperature: 0.1
  });

  const responseText = response.response as string;
  
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return validateIntent(parsed);
    
  } catch (error) {
    console.error('Failed to parse AI response:', responseText);
    
    // Fallback to default intent
    return {
      objective: 'balanced',
      risk_tolerance: 'moderate',
      horizon_years: 5,
      sectors: [],
      filters: {}
    };
  }
}
