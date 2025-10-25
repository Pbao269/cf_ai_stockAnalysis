# User-Data Service - Isolated for Future Use

## Overview

The `user-data` service has been **isolated** from the core stock analysis platform. It contains functionality for user management, watchlists, and preferences that can be integrated when database functionality is needed.

## Current Status: ISOLATED

- **API Gateway**: Watchlist endpoints commented out
- **Health Check**: Removed from core service monitoring
- **Service Binding**: Commented out in `wrangler.jsonc`
- **Service Code**: Preserved and functional

## Functionality

### Watchlist Management
- `POST /add_to_watchlist` - Add ticker to watchlist
- `POST /remove_from_watchlist` - Remove ticker from watchlist
- `GET /get_watchlist` - Get user's watchlist

### User Preferences
- `POST /set_preferences` - Set user investment preferences
- `GET /get_preferences` - Get user investment preferences

## Database Schema

Uses D1 database with tables:
- `watchlists` - User watchlist items
- `preferences` - User investment preferences

## Integration Instructions

To re-enable user-data functionality:

1. **Uncomment in `wrangler.jsonc`**:
   ```json
   {
     "binding": "user-data",
     "service": "user-data-mvp"
   }
   ```

2. **Uncomment in API Gateway**:
   ```typescript
   'user-data': Fetcher;
   ```

3. **Uncomment watchlist endpoint**:
   ```typescript
   if (path === '/watchlist' && request.method === 'POST') {
     return await handleWatchlist(request, env, corsHeaders);
   }
   ```

4. **Add to health check**:
   ```typescript
   const services = ['intent', 'screener', 'fundamentals-dcf', 'technicals', 'entry-dca', 'user-data'];
   ```

5. **Uncomment handler function**:
   Remove `/*` and `*/` around `handleWatchlist` function

## Dependencies

- **D1 Database**: `user_db_mvp` binding required
- **Intent Schema**: Uses for preference validation
- **No External Dependencies**: Self-contained service

## Future Enhancements

When integrated, consider adding:
- User authentication
- Multiple watchlists per user
- Portfolio tracking
- User analytics
- Social features
