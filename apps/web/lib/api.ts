// API Integration Layer
// TODO: Wire these functions to the actual API gateway endpoints

import { ScreenerResult, StockAnalysis } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// Simulated delay for realistic loading states
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parse natural language intent into structured filters
 * Wired to POST /intent endpoint
 */
export async function parseIntent(query: string): Promise<{ 
  success: boolean; 
  data: any;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      throw new Error(`Intent API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Intent API error:', error);
    throw new Error(`Intent API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Screen stocks based on intent or filters
 * Wired to POST /screen endpoint
 */
export async function screenStocks(filters: any): Promise<{
  success: boolean;
  data: { hits: ScreenerResult[] };
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    });
    
    if (!response.ok) {
      throw new Error(`Screen API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Screen API error:', error);
    throw new Error(`Screen API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze a specific stock ticker
 * Wired to GET /analyze?ticker={symbol} endpoint (SSE stream)
 */
export async function analyzeStock(symbol: string): Promise<{
  success: boolean;
  data: StockAnalysis;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze?ticker=${symbol}`);
    
    if (!response.ok) {
      throw new Error(`Analyze API failed: ${response.status}`);
    }
    
    // Handle SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let analysisData: any = null;
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.event === 'synthesis_complete') {
                analysisData = data.report;
                break;
              } else if (data.event === 'error') {
                throw new Error(data.message || 'Analysis failed');
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
        
        if (analysisData) break;
      }
    }
    
    if (!analysisData) {
      throw new Error('No analysis data received');
    }
    
    return {
      success: true,
      data: analysisData,
    };
  } catch (error) {
    console.error('Analyze API error:', error);
    throw new Error(`Analyze API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check API health
 * Wired to GET /healthz
 */
export async function checkHealth(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/healthz`);
    
    if (!response.ok) {
      throw new Error(`Health check API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Health check API error:', error);
    throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

