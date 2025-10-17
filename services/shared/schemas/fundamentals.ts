import { z } from 'zod';

// Wire-level fundamentals snapshot consumed by Workers and AI
// Allow passthrough of additional fields from Python service
export const FundamentalsSnapshotSchema = z.object({
  ticker: z.string(),
  company_name: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  current_price: z.number().positive(),
  market_cap: z.number().nonnegative().optional(),

  // Common metrics used by selection/AI
  revenue: z.number().nonnegative().optional(),
  revenue_cagr_3y: z.number().optional().default(0),
  ebitda_margin: z.number().optional().default(0),
  fcf_margin: z.number().optional(),

  // Analyst consensus passthrough
  analyst_avg_target: z.number().optional().default(0),
  analyst_count: z.number().int().optional().default(0),

  // Qualitative
  economic_moat: z.string().optional(),
  moat_strength_score: z.number().optional(),
}).passthrough();

export type FundamentalsSnapshotType = z.infer<typeof FundamentalsSnapshotSchema>;


