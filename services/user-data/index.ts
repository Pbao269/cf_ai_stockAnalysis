import { Intent, validateIntent, type IntentType } from '../shared/schemas/intent';

export interface Env {
  USER_DB: D1Database;
}

/**
 * User Data Service - Handle user watchlists and preferences via RPC
 * User identity comes from Cloudflare Access JWT
 * Works with current D1 schema: watchlists + watchlist_items + user_preferences
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extract user_id from Cloudflare Access JWT
    const user_id = extractUserIdFromJWT(request);
    if (!user_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized - no valid user ID'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Route RPC calls
      if (path === '/add_to_watchlist' && request.method === 'POST') {
        return await addToWatchlist(request, env.USER_DB, user_id);
      }
      
      if (path === '/remove_from_watchlist' && request.method === 'POST') {
        return await removeFromWatchlist(request, env.USER_DB, user_id);
      }
      
      if (path === '/get_watchlist' && request.method === 'GET') {
        return await getWatchlist(env.USER_DB, user_id);
      }
      
      if (path === '/set_preferences' && request.method === 'POST') {
        return await setPreferences(request, env.USER_DB, user_id);
      }
      
      if (path === '/get_preferences' && request.method === 'GET') {
        return await getPreferences(env.USER_DB, user_id);
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
 * Extract user ID from Cloudflare Access JWT
 */
function extractUserIdFromJWT(request: Request): string | null {
  const jwtHeader = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwtHeader) {
    return null;
  }

  try {
    // Parse JWT payload (simplified - in production you'd verify the signature)
    const parts = jwtHeader.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1] || ''));
    return (payload.sub as string) || (payload.email as string) || null;
  } catch (error) {
    console.error('JWT parsing error:', error);
    return null;
  }
}

/**
 * Add ticker to user's watchlist
 * Uses current schema: creates/uses default watchlist + adds to watchlist_items
 */
async function addToWatchlist(request: Request, db: D1Database, user_id: string): Promise<Response> {
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

    // Normalize ticker (uppercase, no spaces)
    const normalizedTicker = ticker.toUpperCase().trim();

    // First, ensure user has a default watchlist
    let defaultWatchlist = await db.prepare(`
      SELECT id FROM watchlists 
      WHERE user_id = ? AND is_default = TRUE
    `).bind(user_id).first();

    if (!defaultWatchlist) {
      // Create default watchlist
      const createResult = await db.prepare(`
        INSERT INTO watchlists (user_id, name, description, is_default)
        VALUES (?, 'Default Watchlist', 'My default stock watchlist', TRUE)
      `).bind(user_id).run();
      
      defaultWatchlist = { id: createResult.meta.last_row_id };
    }

    // Add ticker to watchlist_items (UNIQUE constraint will handle duplicates)
    const result = await db.prepare(`
      INSERT INTO watchlist_items (watchlist_id, symbol)
      VALUES (?, ?)
    `).bind(defaultWatchlist.id, normalizedTicker).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ticker: normalizedTicker,
        added: (result.meta?.changes || 0) > 0,
        watchlist_id: defaultWatchlist.id
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
 * Remove ticker from user's watchlist
 * Uses current schema: removes from watchlist_items
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

    // Remove from watchlist_items via JOIN with watchlists
    const result = await db.prepare(`
      DELETE FROM watchlist_items 
      WHERE symbol = ? AND watchlist_id IN (
        SELECT id FROM watchlists WHERE user_id = ?
      )
    `).bind(normalizedTicker, user_id).run();

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
 * Get user's watchlist
 * Uses current schema: JOIN watchlists + watchlist_items
 */
async function getWatchlist(db: D1Database, user_id: string): Promise<Response> {
  try {
    const result = await db.prepare(`
      SELECT wi.symbol, wi.added_at, w.name as watchlist_name
      FROM watchlist_items wi
      JOIN watchlists w ON wi.watchlist_id = w.id
      WHERE w.user_id = ?
      ORDER BY wi.added_at DESC
    `).bind(user_id).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        tickers: result.results.map((row: any) => ({
          ticker: row.symbol,
          added_at: row.added_at,
          watchlist_name: row.watchlist_name
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
 * Set user preferences
 * Uses current schema: stores in user_preferences with preference_type = 'intent'
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

    // Store in user_preferences table with preference_type = 'intent'
    await db.prepare(`
      INSERT INTO user_preferences (user_id, preference_type, preference_data)
      VALUES (?, 'intent', ?)
      ON CONFLICT(user_id, preference_type) DO UPDATE SET
        preference_data = excluded.preference_data,
        updated_at = CURRENT_TIMESTAMP
    `).bind(user_id, JSON.stringify(validatedPrefs)).run();

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
 * Get user preferences
 * Uses current schema: retrieves from user_preferences with preference_type = 'intent'
 */
async function getPreferences(db: D1Database, user_id: string): Promise<Response> {
  try {
    const result = await db.prepare(`
      SELECT preference_data, updated_at
      FROM user_preferences 
      WHERE user_id = ? AND preference_type = 'intent'
    `).bind(user_id).first();

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
    const preferences = JSON.parse(result.preference_data as string);
    preferences.updated_at = result.updated_at;

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