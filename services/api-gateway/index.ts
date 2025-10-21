import { z } from 'zod';
import { Intent, type IntentType } from '../shared/schemas/intent';
import { ScreenHit, type ScreenHitType } from '../shared/schemas/screen';
import { Facts, type FactsType } from '../shared/schemas/facts';
import { DcfOutput, type DcfOutputType } from '../shared/schemas/dcf';
import { TechOutput, type TechOutputType } from '../shared/schemas/tech';
import { DcaOutput, type DcaOutputType } from '../shared/schemas/dca';
import { SynthesisOutput, type SynthesisOutputType } from '../shared/schemas/synthesis';

// Cloudflare Workers types
declare global {
  interface Ai {
    run(model: string, input: any): Promise<any>;
  }
  
  interface Fetcher {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  }
}

export interface Env {
  AI: Ai;
  intent: Fetcher;
  screener: Fetcher;
  'fundamentals-dcf': Fetcher;
  technicals: Fetcher;
  'entry-dca': Fetcher;
  'user-data': Fetcher;
  // Optional services
  'notion-export'?: Fetcher;
  'etl-workflows'?: Fetcher;
}

/**
 * API Gateway - Main entry point for the stock analysis platform
 * Handles all external API requests and routes to internal services via Workers RPC
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers - allow all for testing
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Route requests
      if (path === '/healthz' && request.method === 'GET') {
        return await handleHealthCheck(env, corsHeaders);
      }
      
      if (path === '/intent' && request.method === 'POST') {
        return await handleIntent(request, env, corsHeaders);
      }
      
      if (path === '/screen' && request.method === 'POST') {
        return await handleScreen(request, env, corsHeaders);
      }
      
      if (path === '/analyze' && request.method === 'GET') {
        return await handleAnalyze(request, env, corsHeaders);
      }
      
      if (path === '/export/notion' && request.method === 'POST') {
        return await handleNotionExport(request, env, corsHeaders);
      }
      
      if (path === '/watchlist' && request.method === 'POST') {
        return await handleWatchlist(request, env, corsHeaders);
      }

      return new Response('Not found', { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('API Gateway error:', error);
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
 * GET /healthz - Check resource freshness & provider reachability
 */
async function handleHealthCheck(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const healthChecks = {
    timestamp: new Date().toISOString(),
    services: {} as Record<string, { status: string; latency?: number; error?: string }>,
    overall_status: 'healthy'
  };

  // Check each service
  const services = ['intent', 'screener', 'fundamentals-dcf', 'technicals', 'entry-dca', 'user-data'];
  
  for (const serviceName of services) {
    const startTime = Date.now();
    try {
      const service = env[serviceName as keyof Env] as Fetcher;
      const response = await service.fetch('http://localhost/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      healthChecks.services[serviceName] = {
        status: response.ok ? 'healthy' : 'unhealthy',
        latency: Date.now() - startTime
      };
      
      if (!response.ok) {
        healthChecks.overall_status = 'degraded';
      }
    } catch (error) {
      healthChecks.services[serviceName] = {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      healthChecks.overall_status = 'unhealthy';
    }
  }

  return new Response(JSON.stringify(healthChecks), {
    status: healthChecks.overall_status === 'healthy' ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * POST /intent - Call intent.extract via RPC; return Intent
 */
async function handleIntent(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { query } = await request.json() as { query: string };
    
    if (!query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Query is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call intent service via RPC
    const intentResponse = await env.intent.fetch('http://localhost/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!intentResponse.ok) {
      throw new Error('Intent extraction failed');
    }

    const intentData = await intentResponse.json() as { success: boolean; data: IntentType };
    
    return new Response(JSON.stringify({
      success: intentData.success,
      data: intentData.data,
      timestamp: new Date().toISOString()
    }), {
      status: intentData.success ? 200 : 500,
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
 * POST /screen - Call screener.screen; return top-5 hits
 */
async function handleScreen(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { intent, filters } = await request.json() as { 
      intent?: IntentType; 
      filters?: any;
    };
    
    if (!intent && !filters) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Intent or filters are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call screener service via RPC
    const screenerResponse = await env.screener.fetch('http://localhost/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, filters })
    });

    if (!screenerResponse.ok) {
      throw new Error('Stock screening failed');
    }

    const screenerData = await screenerResponse.json() as { success: boolean; data: { hits: ScreenHitType[] } };
    
    return new Response(JSON.stringify({
      success: screenerData.success,
      data: screenerData.data,
      timestamp: new Date().toISOString()
    }), {
      status: screenerData.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Stock screening error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Stock screening failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /analyze?ticker=XYZ - Start SSE with parallel analysis
 */
async function handleAnalyze(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker');
  
  if (!ticker) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Ticker parameter is required'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Create SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Start analysis in background
  runAnalysisPipeline(ticker, env, writer, encoder).catch(error => {
    console.error('Analysis pipeline error:', error);
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'error',
      message: 'Analysis failed',
      timestamp: new Date().toISOString()
    })}\n\n`));
    writer.close();
  });

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

/**
 * Run the analysis pipeline with SSE streaming
 */
async function runAnalysisPipeline(
  ticker: string, 
  env: Env, 
  writer: WritableStreamDefaultWriter, 
  encoder: TextEncoder
): Promise<void> {
  const sendEvent = (type: string, data: any) => {
    writer.write(encoder.encode(`data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`));
  };

  try {
    // Phase 1: Start parallel analysis calls
    sendEvent('phase', { name: 'starting_analysis', ticker });
    
    const analysisPromises = [
      env['fundamentals-dcf'].fetch('http://localhost/runDcf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker })
      }),
      env.technicals.fetch('http://localhost/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker })
      }),
      env['entry-dca'].fetch('http://localhost/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker })
      })
    ];

    // Phase 2: Wait for analysis results
    sendEvent('phase', { name: 'running_analysis', progress: 0 });
    
    const results = await Promise.allSettled(analysisPromises);
    const analysisResults = {
      dcf: null as DcfOutputType | null,
      technicals: null as TechOutputType | null,
      dca: null as DcaOutputType | null
    };

    // Process results
    const serviceNames = ['dcf', 'technicals', 'dca'];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.ok) {
        sendEvent('analysis_complete', { service: serviceNames[index], ticker });
      } else {
        sendEvent('analysis_error', { service: serviceNames[index], error: 'Failed' });
      }
    });

    // Phase 3: Build facts registry (optional - requires etl-workflows)
    if (env['etl-workflows']) {
      sendEvent('phase', { name: 'building_facts', progress: 50 });
      
      try {
        const factsResponse = await env['etl-workflows'].fetch('http://localhost/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: ticker })
        });

        if (factsResponse.ok) {
          const factsData = await factsResponse.json() as { success: boolean; data: FactsType };
          sendEvent('facts_complete', { ticker, facts: factsData.data });
          
          // Phase 4: Synthesize report
          sendEvent('phase', { name: 'synthesizing_report', progress: 75 });
          
          const synthesisResponse = await env['etl-workflows'].fetch('http://localhost/synthesizeReport', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              symbol: ticker,
              analysis_results: analysisResults,
              facts: factsData.data
            })
          });

          if (synthesisResponse.ok) {
            const synthesisData = await synthesisResponse.json() as { success: boolean; data: SynthesisOutputType };
            sendEvent('synthesis_complete', { ticker, report: synthesisData.data });
          }
        }
      } catch (error) {
        console.log('[ETL Workflows] Optional service not available or failed');
      }
    }

    // Phase 5: Complete
    sendEvent('phase', { name: 'complete', progress: 100 });
    sendEvent('done', { ticker, timestamp: new Date().toISOString() });

  } catch (error) {
    sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    writer.close();
  }
}

/**
 * POST /export/notion - Call notion-export.exportPage (optional)
 */
async function handleNotionExport(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Check if notion-export service is available
  if (!env['notion-export']) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Notion export service is not enabled'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { report, notionToken } = await request.json() as { 
      report: any; 
      notionToken: string;
    };
    
    if (!report || !notionToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Report and Notion token are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call notion-export service via RPC
    const exportResponse = await env['notion-export'].fetch('http://localhost/exportPage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, notionToken })
    });

    if (!exportResponse.ok) {
      throw new Error('Notion export failed');
    }

    const exportData = await exportResponse.json() as { success: boolean; data: any };
    
    return new Response(JSON.stringify({
      success: exportData.success,
      data: exportData.data,
      timestamp: new Date().toISOString()
    }), {
      status: exportData.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Notion export error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Notion export failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /watchlist - Handle watchlist operations
 */
async function handleWatchlist(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { action, ticker, preferences, user_id } = await request.json() as { 
      action: 'add' | 'remove' | 'get' | 'set_preferences';
      ticker?: string;
      preferences?: any;
      user_id?: string;
    };
    
    if (!action) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Action is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let response: Response;
    const baseUrl = `http://localhost?user_id=${user_id || 'mvp-user-001'}`;

    switch (action) {
      case 'add':
        if (!ticker) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Ticker is required for add action'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        response = await env['user-data'].fetch(`${baseUrl}/add_to_watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker })
        });
        break;

      case 'remove':
        if (!ticker) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Ticker is required for remove action'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        response = await env['user-data'].fetch(`${baseUrl}/remove_from_watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker })
        });
        break;

      case 'get':
        response = await env['user-data'].fetch(`${baseUrl}/get_watchlist`, {
          method: 'GET'
        });
        break;

      case 'set_preferences':
        if (!preferences) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Preferences are required for set_preferences action'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        response = await env['user-data'].fetch(`${baseUrl}/set_preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences)
        });
        break;

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      success: data.success,
      data: data.data,
      timestamp: new Date().toISOString()
    }), {
      status: data.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Watchlist operation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Watchlist operation failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}