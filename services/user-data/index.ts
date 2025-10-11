import { Intent, validateIntent, type IntentType } from '../shared/schemas/intent';

export interface Env {
  user_db_mvp: D1Database;
}

/**
 * User Data Service - Handle watchlists and preferences via RPC
 * MVP Version: No authentication - uses session-based user identification
 * Works with simplified D1 schema for testing
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // For MVP: Extract user_id from query params or use default
    const user_id = url.searchParams.get('user_id') || 'mvp-user-001';

    try {
      // Route RPC calls
      if (path === '/add_to_watchlist' && request.method === 'POST') {
        return await addToWatchlist(request, env.user_db_mvp, user_id);
      }
      
      if (path === '/remove_from_watchlist' && request.method === 'POST') {
        return await removeFromWatchlist(request, env.user_db_mvp, user_id);
      }
      
      if (path === '/get_watchlist' && request.method === 'GET') {
        return await getWatchlist(env.user_db_mvp, user_id);
      }
      
      if (path === '/set_preferences' && request.method === 'POST') {
        return await setPreferences(request, env.user_db_mvp, user_id);
      }
      
      if (path === '/get_preferences' && request.method === 'GET') {
        return await getPreferences(env.user_db_mvp, user_id);
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('User data service error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};


/**
 * Add ticker to watchlist
 * MVP Version: Simple ticker storage without user authentication
 */
async function addToWatchlist(request: Request, db: D1Database, user_id: string): Promise<Response> {
  try {
    const { ticker, notes } = await request.json() as { ticker: string; notes?: string };
    
    if (!ticker || typeof ticker !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ticker is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalize ticker (uppercase, no spaces)
    const normalizedTicker = ticker.toUpperCase().trim();

    // Add ticker to watchlist (UNIQUE constraint will handle duplicates)
    const result = await db.prepare(`
      INSERT INTO watchlists (ticker, notes)
      VALUES (?, ?)
    `).bind(normalizedTicker, notes || null).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ticker: normalizedTicker,
        added: (result.meta?.changes || 0) > 0,
        id: result.meta?.last_row_id
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Add to watchlist error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to add ticker to watchlist'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Remove ticker from watchlist
 * MVP Version: Simple ticker removal without user authentication
 */
async function removeFromWatchlist(request: Request, db: D1Database, user_id: string): Promise<Response> {
  try {
    const { ticker } = await request.json() as { ticker: string };
    
    if (!ticker || typeof ticker !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ticker is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalize ticker
    const normalizedTicker = ticker.toUpperCase().trim();

    // Remove from watchlist
    const result = await db.prepare(`
      DELETE FROM watchlists 
      WHERE ticker = ?
    `).bind(normalizedTicker).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ticker: normalizedTicker,
        removed: (result.meta?.changes || 0) > 0
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Remove from watchlist error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to remove ticker from watchlist'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get watchlist
 * MVP Version: Returns all tickers without user authentication
 */
async function getWatchlist(db: D1Database, user_id: string): Promise<Response> {
  try {
    const result = await db.prepare(`
      SELECT ticker, created_at, notes
      FROM watchlists 
      ORDER BY created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        tickers: result.results.map((row: any) => ({
          ticker: row.ticker,
          added_at: new Date(row.created_at * 1000).toISOString(),
          notes: row.notes
        }))
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get watchlist error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get watchlist'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Set preferences
 * MVP Version: Stores global preferences without user authentication
 */
async function setPreferences(request: Request, db: D1Database, user_id: string): Promise<Response> {
  try {
    const prefs = await request.json() as Partial<IntentType>;
    
    // Validate preferences using Intent schema
    const validatedPrefs = validateIntent({
      objective: prefs.objective || 'balanced',
      risk_tolerance: prefs.risk_tolerance || 'moderate',
      horizon_years: prefs.horizon_years || 5,
      style_weights: prefs.style_weights || {
        value: 0.2,
        growth: 0.2,
        momentum: 0.2,
        quality: 0.2,
        size: 0.1,
        volatility: 0.1
      },
      gates: prefs.gates || {}
    });

    // Store in preferences table as global defaults
    await db.prepare(`
      INSERT INTO preferences (preference_key, preference_value)
      VALUES ('default_intent', ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = strftime('%s', 'now')
    `).bind(JSON.stringify(validatedPrefs)).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        preferences: validatedPrefs
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Set preferences error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to set preferences'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get preferences
 * MVP Version: Returns global preferences without user authentication
 */
async function getPreferences(db: D1Database, user_id: string): Promise<Response> {
  try {
    const result = await db.prepare(`
      SELECT preference_value, updated_at
      FROM preferences 
      WHERE preference_key = 'default_intent'
    `).first();

    if (!result) {
      // Return default preferences if none exist
      const defaultPrefs = {
        objective: 'balanced',
        risk_tolerance: 'moderate',
        horizon_years: 5,
        style_weights: {
          value: 0.2,
          growth: 0.2,
          momentum: 0.2,
          quality: 0.2,
          size: 0.1,
          volatility: 0.1
        },
        gates: {}
      };

      return new Response(JSON.stringify({
        success: true,
        data: {
          preferences: defaultPrefs,
          is_default: true
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse JSON preference data
    const preferences = JSON.parse(result.preference_value as string);
    preferences.updated_at = new Date((result.updated_at as number) * 1000).toISOString();

    return new Response(JSON.stringify({
      success: true,
      data: {
        preferences
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get preferences'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}