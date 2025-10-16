// Shared interfaces for the fundamentals-dcf worker

// Cloudflare KV namespace interface
export interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<any | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// Environment bindings for the worker
export interface Env {
  FUNDAMENTALS_SNAP: KVNamespace;
  UNIFIED_DCF_URL?: string;    // Unified DCF service (data + 3-stage + h-model)
  AI: Ai;                      // Cloudflare Workers AI binding
  AI_MODEL?: string;
}

// Snapshot returned by the Python unified service
export interface FundamentalsSnapshot {
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

// Optional model selector output shape if used in future
export interface ModelSelectorOutput {
  recommended_models: ('3stage' | 'sotp' | 'hmodel')[];
  reasoning: string;
  confidence: number;
  weights: {
    '3stage'?: number;
    'sotp'?: number;
    'hmodel'?: number;
  };
}

// Per-model valuation structure
export interface IndividualValuation {
  model: string;
  model_name: string;
  price_per_share: number;
  price_per_share_original?: number;  // Before caps
  enterprise_value: number;
  upside_downside: number;
  wacc: number;
  assumptions?: any;
  projections?: any[];
  // Caps tracking
  sanity_cap_applied?: string;
  healthcare_cap_applied?: string;
  [key: string]: any;
}

export interface ConfidenceFactor {
  factor: string;
  impact: number;
  description: string;
}

// Consensus valuation and confidence scoring
export interface ConsensusValuation {
  weighted_fair_value: number;
  simple_average: number;
  range: {
    low: number;
    high: number;
  };
  upside_to_weighted: number;
  // Confidence scoring
  confidence_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_factors: {
    score: number;
    level: string;
    factors: ConfidenceFactor[];
    interpretation: string;
  };
  // Weighting explanation
  weighting_method: {
    description: string;
    rationale: string;
    hmodel_weight: number | null;
    stage3_weight: number | null;
  };
  method?: string;
}


