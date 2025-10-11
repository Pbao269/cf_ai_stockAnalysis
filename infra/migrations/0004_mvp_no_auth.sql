-- MVP D1 Database Migration - No Authentication Required
-- Simplified schema for testing without Cloudflare Access

-- Drop existing tables that require user authentication
DROP TABLE IF EXISTS watchlist_items;
DROP TABLE IF EXISTS watchlists;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS saved_reports;

-- Create simplified watchlists table (no user_id required)
CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    notes TEXT
);

-- Create simplified preferences table (global defaults)
CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preference_key TEXT UNIQUE NOT NULL,
    preference_value TEXT NOT NULL, -- JSON
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchlists_ticker ON watchlists(ticker);
CREATE INDEX IF NOT EXISTS idx_preferences_key ON preferences(preference_key);

-- Create trigger for preferences updated_at
CREATE TRIGGER IF NOT EXISTS update_preferences_timestamp 
    AFTER UPDATE ON preferences 
    BEGIN 
        UPDATE preferences SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

-- Insert default preferences
INSERT OR IGNORE INTO preferences (preference_key, preference_value) VALUES 
('default_intent', '{"objective":"balanced","risk_tolerance":"moderate","horizon_years":5,"style_weights":{"value":0.2,"growth":0.2,"momentum":0.2,"quality":0.2,"size":0.1,"volatility":0.1},"gates":{}}');
