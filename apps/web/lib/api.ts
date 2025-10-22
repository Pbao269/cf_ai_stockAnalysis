// API Integration Layer
// TODO: Wire these functions to the actual API gateway endpoints

import { ScreenerResult, StockAnalysis } from './types';
import { mockScreenerResults, mockStockAnalysis } from './mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// Simulated delay for realistic loading states
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parse natural language intent into structured filters
 * TODO: Wire to POST /intent endpoint
 */
export async function parseIntent(query: string): Promise<{ 
  success: boolean; 
  data: any;
  error?: string;
}> {
  // Simulate API call
  await delay(800);
  
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/intent`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ query }),
  // });
  // return response.json();
  
  // Mock response
  return {
    success: true,
    data: {
      objective: 'growth',
      risk_tolerance: 'moderate',
      style_weights: {
        value: 0.2,
        growth: 0.4,
        momentum: 0.2,
        quality: 0.2,
        size: 0.0,
        volatility: 0.0,
      },
      gates: {
        sectors: ['Technology'],
        min_market_cap: 1000000000,
      },
    },
  };
}

/**
 * Screen stocks based on intent or filters
 * TODO: Wire to POST /screen endpoint
 */
export async function screenStocks(filters: any): Promise<{
  success: boolean;
  data: { hits: ScreenerResult[] };
  error?: string;
}> {
  // Simulate API call
  await delay(1200);
  
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/screen`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ filters }),
  // });
  // return response.json();
  
  // Mock response
  return {
    success: true,
    data: {
      hits: mockScreenerResults,
    },
  };
}

/**
 * Analyze a specific stock ticker
 * TODO: Wire to GET /analyze?ticker={symbol} endpoint (SSE stream)
 */
export async function analyzeStock(symbol: string): Promise<{
  success: boolean;
  data: StockAnalysis;
  error?: string;
}> {
  // Simulate API call
  await delay(2000);
  
  // TODO: Replace with actual SSE stream handling
  // const response = await fetch(`${API_BASE_URL}/analyze?ticker=${symbol}`);
  // Handle SSE stream events:
  // - phase: starting_analysis, running_analysis, building_facts, synthesizing_report, complete
  // - analysis_complete: { service: 'dcf' | 'technicals' | 'dca' }
  // - analysis_error: { service, error }
  // - facts_complete: { ticker, facts }
  // - synthesis_complete: { ticker, report }
  // - done: { ticker }
  // - error: { message }
  
  // Mock response with the symbol requested
  const analysis = { ...mockStockAnalysis, symbol, name: `${symbol} Analysis` };
  
  return {
    success: true,
    data: analysis,
  };
}

/**
 * Get user's watchlist
 * TODO: Wire to POST /watchlist with action: 'get'
 */
export async function getWatchlist(userId?: string): Promise<{
  success: boolean;
  data: string[];
  error?: string;
}> {
  await delay(300);
  
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/watchlist`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ action: 'get', user_id: userId }),
  // });
  // return response.json();
  
  return {
    success: true,
    data: ['AAPL', 'GOOGL', 'MSFT'],
  };
}

/**
 * Add stock to watchlist
 * TODO: Wire to POST /watchlist with action: 'add'
 */
export async function addToWatchlist(ticker: string, userId?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  await delay(200);
  
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/watchlist`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ action: 'add', ticker, user_id: userId }),
  // });
  // return response.json();
  
  return {
    success: true,
  };
}

/**
 * Remove stock from watchlist
 * TODO: Wire to POST /watchlist with action: 'remove'
 */
export async function removeFromWatchlist(ticker: string, userId?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  await delay(200);
  
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/watchlist`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ action: 'remove', ticker, user_id: userId }),
  // });
  // return response.json();
  
  return {
    success: true,
  };
}

/**
 * Check API health
 * TODO: Wire to GET /healthz
 */
export async function checkHealth(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  await delay(100);
  
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/healthz`);
  // return response.json();
  
  return {
    success: true,
    data: {
      overall_status: 'healthy',
      services: {
        intent: { status: 'healthy' },
        screener: { status: 'healthy' },
        'fundamentals-dcf': { status: 'healthy' },
        technicals: { status: 'healthy' },
        'entry-dca': { status: 'healthy' },
        'user-data': { status: 'healthy' },
      },
    },
  };
}

