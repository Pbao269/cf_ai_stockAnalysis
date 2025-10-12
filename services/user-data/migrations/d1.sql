-- Simplified D1 Database Migration for MVP Stock Analysis Platform
-- Focus on core features: user preferences, watchlists, and saved reports

-- Users table - minimal user data from Cloudflare Access JWT
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- User ID from Cloudflare Access JWT
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences - store parsed investment intent and analysis settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    preference_type TEXT NOT NULL, -- 'intent', 'screener_filters', 'analysis_settings'
    preference_data JSON NOT NULL, -- Store the parsed intent or filter settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, preference_type)
);

-- Watchlists - simple stock lists for users
CREATE TABLE IF NOT EXISTS watchlists (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Watchlist items - stocks in watchlists
CREATE TABLE IF NOT EXISTS watchlist_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    watchlist_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    UNIQUE(watchlist_id, symbol)
);

-- Saved analysis reports - store generated analysis results
CREATE TABLE IF NOT EXISTS saved_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    report_type TEXT NOT NULL, -- 'screener_results', 'stock_analysis', 'dcf_analysis'
    report_name TEXT NOT NULL,
    symbol TEXT, -- For single-stock reports
    report_data JSON NOT NULL, -- The full analysis result
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON watchlist_items(symbol);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_symbol ON saved_reports(symbol);
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users 
    BEGIN 
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp 
    AFTER UPDATE ON user_preferences 
    BEGIN 
        UPDATE user_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_watchlists_timestamp 
    AFTER UPDATE ON watchlists 
    BEGIN 
        UPDATE watchlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_saved_reports_timestamp 
    AFTER UPDATE ON saved_reports 
    BEGIN 
        UPDATE saved_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;