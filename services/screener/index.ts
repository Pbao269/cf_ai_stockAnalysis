import { z } from 'zod';
import { ScreenerResults, validateScreenerResults, type ScreenerResultsType, type InvestmentIntentType } from '../shared/schemas';

export interface Env {
  // No external dependencies needed for MVP
}

/**
 * Screener Service - Get top 5 stocks using FinViz integration
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { intent, query } = await request.json() as { 
        intent: InvestmentIntentType; 
        query: string;
      };
      
      if (!intent) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Investment intent is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get top 5 stocks based on intent
      const results = await getTopStocks(intent, query);
      
      return new Response(JSON.stringify({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Screener error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to screen stocks',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Get top 5 stocks based on investment intent
 * This is a simplified version - in production you'd integrate with FinViz API
 */
async function getTopStocks(intent: InvestmentIntentType, query: string): Promise<ScreenerResultsType> {
  // For MVP, return mock data based on investment style
  // In production, this would:
  // 1. Use finvizfinance.screener.overview.Overview to set filters
  // 2. Apply investment style scoring (Buffett/value, Lynch/GARP, momentum, etc.)
  // 3. Return top 5 ranked stocks
  
  const mockStocks = getMockStocksForIntent(intent);
  
  return {
    query,
    results: mockStocks,
    generated_at: new Date().toISOString()
  };
}

/**
 * Get mock stocks based on investment intent
 * In production, replace with actual FinViz integration
 */
function getMockStocksForIntent(intent: InvestmentIntentType) {
  const baseStocks = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      market_cap: 3000000000000,
      price: 150.0,
      pe_ratio: 25.5,
      revenue_growth: 0.08,
      score: 85,
      rationale: 'Strong fundamentals, consistent growth, market leader'
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      sector: 'Technology',
      market_cap: 2800000000000,
      price: 380.0,
      pe_ratio: 28.2,
      revenue_growth: 0.12,
      score: 82,
      rationale: 'Cloud leadership, strong moat, dividend growth'
    },
    {
      symbol: 'JNJ',
      name: 'Johnson & Johnson',
      sector: 'Healthcare',
      market_cap: 450000000000,
      price: 160.0,
      pe_ratio: 15.8,
      revenue_growth: 0.04,
      score: 78,
      rationale: 'Defensive healthcare, stable dividend, low volatility'
    },
    {
      symbol: 'BRK.B',
      name: 'Berkshire Hathaway Inc.',
      sector: 'Financial Services',
      market_cap: 750000000000,
      price: 350.0,
      pe_ratio: 12.5,
      revenue_growth: 0.06,
      score: 80,
      rationale: 'Value investing, diversified holdings, strong management'
    },
    {
      symbol: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      sector: 'ETF',
      market_cap: 1200000000000,
      price: 240.0,
      pe_ratio: 18.5,
      revenue_growth: 0.07,
      score: 75,
      rationale: 'Broad market exposure, low cost, diversification'
    }
  ];

  // Filter and score based on intent
  let filteredStocks = baseStocks;

  // Filter by sectors if specified
  if (intent.sectors && intent.sectors.length > 0) {
    filteredStocks = filteredStocks.filter(stock => 
      intent.sectors!.some(sector => 
        stock.sector.toLowerCase().includes(sector.toLowerCase())
      )
    );
  }

  // Filter by max price if specified
  if (intent.max_price) {
    filteredStocks = filteredStocks.filter(stock => stock.price <= intent.max_price!);
  }

  // Filter by min market cap if specified
  if (intent.min_market_cap) {
    filteredStocks = filteredStocks.filter(stock => stock.market_cap >= intent.min_market_cap!);
  }

  // Adjust scores based on risk tolerance and objective
  filteredStocks = filteredStocks.map(stock => {
    let adjustedScore = stock.score;

    if (intent.objective === 'income' && stock.symbol === 'JNJ') {
      adjustedScore += 10; // Boost dividend stocks for income objective
    }

    if (intent.objective === 'growth' && stock.symbol === 'AAPL') {
      adjustedScore += 10; // Boost growth stocks for growth objective
    }

    if (intent.risk_tolerance === 'conservative' && stock.symbol === 'JNJ') {
      adjustedScore += 5; // Boost defensive stocks for conservative investors
    }

    return { ...stock, score: Math.min(100, adjustedScore) };
  });

  // Sort by score and return top 5
  return filteredStocks
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
