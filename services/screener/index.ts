import { 
  ScreenFilters, 
  ScreenHit, 
  validateScreenFilters, 
  validateScreenHit,
  type ScreenFiltersType,
  type ScreenHitType,
  type SectorAwareFiltersType
} from '../shared/schemas/screen';
import type { KVNamespace } from '@cloudflare/workers-types';
import { 
  SimplifiedIntent, 
  convertIntentToSimplified,
  type SimplifiedIntentType,
  type IntentType
} from '../shared/schemas/intent';

export interface Env {
  SCREENER_INDEX: KVNamespace; // KV namespace for screener data caching
  PY_SCREENER_URL?: string; // Optional: URL of Python screener service
}

/**
 * Production-grade screener service with realistic sector-specific P/E ratios
 * Integrates with FinViz via Python microservice for realistic 2024 US market data
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json() as { 
        filters?: ScreenFiltersType;
        intent?: IntentType; // From intent service
      };
      
      // Convert intent to filters if provided
      const filters = body.intent 
        ? convertIntentToFilters(convertIntentToSimplified(body.intent))
        : body.filters;
      
      if (!filters) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Either filters or intent is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Only use real Python screener data - fail fast if not configured
      if (!env.PY_SCREENER_URL) {
        throw new Error('Python screener service not configured - real data required');
      }
      
      const screenerData = await getPythonScreenerResults(env, filters);
      
      // Sort by market cap (descending) to ensure consistent ordering
      const sortedData = screenerData.data.sort((a: any, b: any) => (b.market_cap || 0) - (a.market_cap || 0));
      
      // Convert to ScreenHit format with sector analysis
      const screenHits = sortedData.map((stock: any, index: number) => ({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        industry: stock.industry,
        market_cap: stock.market_cap,
        price: stock.price,
        pe_ratio: stock.pe_ratio,
        pb_ratio: stock.pb_ratio,
        dividend_yield: stock.dividend_yield,
        beta: stock.beta,
        overall_score: stock.overall_score,
        sector_pe_benchmark: stock.sector_pe_benchmark,
        sector_relative_score: calculateSectorRelativeScore(stock),
        style_scores: calculateStyleScores(stock),
        rationale: generateSectorAwareRationale(stock),
        top_drivers: getTopDrivers(stock),
        sector_analysis: generateSectorAnalysis(stock),
        data_source: 'finviz+yfinance',
        last_updated: new Date().toISOString()
      }));

      return new Response(JSON.stringify({
        success: true,
        data: {
          hits: screenHits,
          total_found: screenerData.total_found,
          filters_applied: screenerData.filters_applied,
          sector_adjustments: screenerData.sector_adjustments,
          data_source: (screenerData as any).data_source || 'worker-mock',
          market_context: {
            sp500_pe: 30.289,
            sector_standards_applied: true
          },
          generated_at: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Screener error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Screening failed',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Convert simplified intent to screen filters with sector awareness
 */
function convertIntentToFilters(intent: SimplifiedIntentType): ScreenFiltersType {
  return {
    strategy: intent.strategy,
    market_cap_preference: intent.market_cap_preference,
    sectors: intent.sectors,
    dividend_preference: intent.dividend_preference,
    price_max: intent.price_max,
    style_checklist: getStyleWeightsForStrategy(intent.strategy),
    limit: 10,
    offset: 0,
    include_rationale: true,
    include_sector_analysis: true
  };
}

/**
 * Get default style weights for balanced strategy
 */
function getDefaultStyleWeights() {
  return {
    value_criteria: {
      pe_ratio_max: 25,
      pb_ratio_max: 2.5,
      dividend_yield_min: 1.5
    },
    growth_criteria: {
      revenue_growth_min: 0.05,
      earnings_growth_min: 0.08
    },
    momentum_criteria: {
      price_momentum_3m_min: 0.02
    },
    quality_criteria: {
      roe_min: 0.12,
      current_ratio_min: 1.2
    },
    size_criteria: {
      market_cap_min: 1000000000
    },
    volatility_criteria: {
      beta_max: 1.5
    }
  };
}

/**
 * Get style weights based on strategy
 */
function getStyleWeightsForStrategy(strategy: string) {
  switch (strategy) {
    case 'growth':
      return {
        growth_criteria: {
          revenue_growth_min: 0.15,
          earnings_growth_min: 0.20
        },
        value_criteria: {
          pe_ratio_max: 50,
          pb_ratio_max: 5.0
        },
        momentum_criteria: {
          price_momentum_3m_min: 0.05
        }
      };
    case 'value':
      return {
        value_criteria: {
          pe_ratio_max: 20,
          pb_ratio_max: 2.0,
          dividend_yield_min: 2.0
        },
        quality_criteria: {
          roe_min: 0.15,
          current_ratio_min: 1.5
        }
      };
    case 'income':
      return {
        value_criteria: {
          dividend_yield_min: 3.0,
          pe_ratio_max: 25
        },
        quality_criteria: {
          roe_min: 0.10,
          current_ratio_min: 1.2
        }
      };
    case 'momentum':
      return {
        momentum_criteria: {
          price_momentum_3m_min: 0.10
        },
        growth_criteria: {
          revenue_growth_min: 0.10
        }
      };
    default: // balanced
      return getDefaultStyleWeights();
  }
}

/**
 * Calculate sector-relative score
 */
function calculateSectorRelativeScore(stock: any): number {
  if (!stock.pe_ratio || !stock.sector_pe_benchmark) return 50;
  
  const ratio = stock.pe_ratio / stock.sector_pe_benchmark;
  if (ratio < 0.7) return 90;
  if (ratio < 0.9) return 75;
  if (ratio < 1.1) return 60;
  if (ratio < 1.3) return 40;
  return 20;
}

/**
 * Generate sector-aware rationale
 */
function generateSectorAwareRationale(stock: any): string {
  const drivers: string[] = [];
  const sector = stock.sector || 'Unknown';
  
  if (stock.pe_ratio && stock.sector_pe_benchmark) {
    const ratio = stock.pe_ratio / stock.sector_pe_benchmark;
    if (ratio < 0.8) {
      drivers.push(`Undervalued vs ${sector} sector average`);
    } else if (ratio > 1.2) {
      drivers.push(`Premium valuation vs ${sector} sector`);
    }
  }
  
  if (stock.dividend_yield && stock.dividend_yield > 3) {
    drivers.push('Strong dividend yield');
  }
  
  if (stock.beta && stock.beta < 1) {
    drivers.push('Low volatility');
  }
  
  if (stock.revenue_growth && stock.revenue_growth > 0.15) {
    drivers.push('High growth');
  }
  
  return `${sector} sector stock with ${drivers.join(', ')}`;
}

/**
 * Generate sector analysis
 */
function generateSectorAnalysis(stock: any): string {
  const sector = stock.sector || 'Unknown';
  const pe = stock.pe_ratio;
  const benchmark = stock.sector_pe_benchmark;
  
  if (!pe || !benchmark) return `No sector analysis available for ${sector}`;
  
  const ratio = pe / benchmark;
  if (ratio < 0.8) {
    return `${sector} sector: Trading at ${Math.round(ratio * 100)}% of sector average P/E - potentially undervalued`;
  } else if (ratio > 1.2) {
    return `${sector} sector: Trading at ${Math.round(ratio * 100)}% of sector average P/E - premium valuation`;
  } else {
    return `${sector} sector: Trading near sector average P/E - fairly valued`;
  }
}

/**
 * Calculate style scores for different investment approaches
 */
function calculateStyleScores(stock: any) {
  return {
    buffett: calculateBuffettScore(stock),
    lynch: calculateLynchScore(stock),
    momentum: calculateMomentumScore(stock),
    deep_value: calculateDeepValueScore(stock),
    dividend: calculateDividendScore(stock)
  };
}

/**
 * Calculate Buffett-style score (value + quality + stability)
 */
function calculateBuffettScore(stock: any): number {
  let score = 50;
  
  // Buffett likes low P/E relative to sector
  if (stock.pe_ratio && stock.sector_pe_benchmark) {
    const ratio = stock.pe_ratio / stock.sector_pe_benchmark;
    if (ratio < 0.7) score += 30;
    else if (ratio < 0.9) score += 20;
    else if (ratio > 1.3) score -= 20;
  }
  
  // Buffett likes stable, large companies
  if (stock.market_cap && stock.market_cap > 10000000000) score += 15;
  if (stock.beta && stock.beta < 1) score += 10;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate Lynch-style score (GARP - Growth at Reasonable Price)
 */
function calculateLynchScore(stock: any): number {
  let score = 50;
  
  // Lynch likes PEG < 1 (we'll estimate PEG from P/E and growth)
  if (stock.pe_ratio && stock.revenue_growth) {
    const estimatedPEG = stock.pe_ratio / (stock.revenue_growth * 100);
    if (estimatedPEG < 1) score += 25;
    else if (estimatedPEG < 1.5) score += 15;
  }
  
  // Lynch likes growth
  if (stock.revenue_growth && stock.revenue_growth > 0.15) score += 20;
  else if (stock.revenue_growth && stock.revenue_growth > 0.10) score += 10;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate momentum score
 */
function calculateMomentumScore(stock: any): number {
  let score = 50;
  
  // Momentum likes higher beta
  if (stock.beta && stock.beta > 1.2) score += 20;
  else if (stock.beta && stock.beta < 0.8) score -= 15;
  
  // Momentum likes growth
  if (stock.revenue_growth && stock.revenue_growth > 0.15) score += 25;
  else if (stock.revenue_growth && stock.revenue_growth < 0.05) score -= 20;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate deep value score
 */
function calculateDeepValueScore(stock: any): number {
  let score = 50;
  
  // Deep value likes very low P/E
  if (stock.pe_ratio && stock.pe_ratio < 10) score += 30;
  else if (stock.pe_ratio && stock.pe_ratio < 15) score += 20;
  else if (stock.pe_ratio && stock.pe_ratio > 25) score -= 20;
  
  // Deep value likes low P/B
  if (stock.pb_ratio && stock.pb_ratio < 1) score += 25;
  else if (stock.pb_ratio && stock.pb_ratio < 1.5) score += 15;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate dividend score
 */
function calculateDividendScore(stock: any): number {
  let score = 30;
  
  if (stock.dividend_yield) {
    if (stock.dividend_yield > 4) score = 90;
    else if (stock.dividend_yield > 3) score = 80;
    else if (stock.dividend_yield > 2) score = 70;
    else if (stock.dividend_yield > 1) score = 60;
  }
  
  return score;
}

/**
 * Get top drivers for the stock
 */
function getTopDrivers(stock: any): string[] {
  const drivers: string[] = [];
  
  if (stock.pe_ratio && stock.sector_pe_benchmark) {
    const ratio = stock.pe_ratio / stock.sector_pe_benchmark;
    if (ratio < 0.8) drivers.push('Sector Value');
    else if (ratio > 1.2) drivers.push('Sector Premium');
  }
  
  if (stock.dividend_yield && stock.dividend_yield > 3) drivers.push('Income');
  if (stock.beta && stock.beta < 1) drivers.push('Stability');
  if (stock.revenue_growth && stock.revenue_growth > 0.15) drivers.push('Growth');
  
  return drivers.slice(0, 3);
}

/**
 * Call external Python screener service (if configured) and adapt its response
 */
async function getPythonScreenerResults(env: Env, filters: ScreenFiltersType) {
  try {
    const url = `${env.PY_SCREENER_URL!.replace(/\/$/, '')}/screen`;
    console.log('Calling Python screener:', url);
    const body = {
      filters,
      // Optional: pass style weights if desired; Python currently does not require
      style_weights: {}
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('Python screener response status:', resp.status);
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Python screener error:', resp.status, errorText);
      throw new Error(`Python screener HTTP ${resp.status}: ${errorText}`);
    }
    const data = await resp.json();
    console.log('Python screener data_source:', (data as any).data_source);
    // Expected Python response shape:
    // { success: boolean, data: Stock[], total_found: number, filters_applied: object, sector_adjustments: object }
    if (data && data.success) {
      return {
        success: true,
        data: data.data || [],
        total_found: data.total_found ?? (data.data ? data.data.length : 0),
        filters_applied: data.filters_applied ?? filters,
        sector_adjustments: data.sector_adjustments ?? {},
        data_source: (data as any).data_source || 'python'
      };
    }
    // Fallback to empty result on unexpected shape
    console.warn('Python screener returned unexpected shape');
    return {
      success: true,
      data: [],
      total_found: 0,
      filters_applied: filters,
      sector_adjustments: {},
      data_source: 'python-empty'
    };
  } catch (err) {
    // Fail fast - no mock data fallback
    console.error('Python screener failed:', (err as Error).message);
    throw new Error(`Python screener service failed: ${(err as Error).message}`);
  }
}

/**
 * Calculate P/E score relative to sector average
 */
function calculatePeScore(peRatio: number, sectorAverage: number): number {
  if (!peRatio || peRatio <= 0) return 50;
  
  if (peRatio < sectorAverage * 0.7) return 90;
  else if (peRatio < sectorAverage * 0.9) return 75;
  else if (peRatio < sectorAverage * 1.1) return 60;
  else if (peRatio < sectorAverage * 1.3) return 40;
  else return 20;
}

/**
 * Calculate growth score
 */
function calculateGrowthScore(revenueGrowth: number): number {
  if (!revenueGrowth) return 50;
  
  const growthPct = revenueGrowth * 100;
  if (growthPct > 20) return 90;
  else if (growthPct > 15) return 80;
  else if (growthPct > 10) return 70;
  else if (growthPct > 5) return 60;
  else return 40;
}

/**
 * Calculate value score with sector awareness
 */
function calculateValueScore(peRatio: number, pbRatio: number, sectorPe: any): number {
  const peScore = calculatePeScore(peRatio, sectorPe.average);
  
  let pbScore = 50;
  if (pbRatio) {
    if (pbRatio < 1.0) pbScore = 90;
    else if (pbRatio < 1.5) pbScore = 75;
    else if (pbRatio < 2.0) pbScore = 60;
    else if (pbRatio < 3.0) pbScore = 40;
    else pbScore = 20;
  }
  
  return (peScore + pbScore) / 2;
}


/**
 * Get sector-specific adjustments applied
 */
function getSectorAdjustments(filters: ScreenFiltersType) {
  const sectors = filters.sectors || [];
  const strategy = filters.strategy || 'balanced';
  
  const adjustments: any = {};
  sectors.forEach(sector => {
    adjustments[sector] = {
      strategy: strategy,
      applied: true
    };
  });
  
  return adjustments;
}