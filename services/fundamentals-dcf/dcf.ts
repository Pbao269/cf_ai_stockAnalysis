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

// Re-export shared runtime contracts (types inferred from Zod)
export { 
  FundamentalsSnapshotSchema,
  type FundamentalsSnapshotType as FundamentalsSnapshot
} from '../shared/schemas/fundamentals';

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

export {
  UnifiedIndividualValuationSchema,
  UnifiedConsensusValuationSchema,
  UnifiedDcfResponseSchema,
  type UnifiedIndividualValuationType as IndividualValuation,
  type UnifiedConsensusValuationType as ConsensusValuation,
  type ConfidenceFactor
} from '../shared/schemas/dcf';

// Confidence factor type aligns with shared schema types (inferred)


