-- D1 Database Migration for User Watchlists and Preferences
-- This migration creates tables for user data without authentication columns
-- Authentication is handled by Cloudflare Access

-- Users table for storing user preferences and settings
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- User ID from Cloudflare Access JWT
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    risk_tolerance TEXT CHECK(risk_tolerance IN ('conservative', 'moderate', 'aggressive')) DEFAULT 'moderate',
    investment_horizon TEXT CHECK(investment_horizon IN ('short', 'medium', 'long')) DEFAULT 'medium',
    notification_preferences JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Watchlists table for user-created stock watchlists
CREATE TABLE IF NOT EXISTS watchlists (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Watchlist items table for stocks in watchlists
CREATE TABLE IF NOT EXISTS watchlist_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    watchlist_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    target_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    UNIQUE(watchlist_id, symbol)
);

-- User preferences for analysis settings
CREATE TABLE IF NOT EXISTS analysis_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    preference_type TEXT NOT NULL, -- 'screener', 'fundamentals', 'technicals', etc.
    preference_key TEXT NOT NULL,
    preference_value JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, preference_type, preference_key)
);

-- Portfolio tracking (optional - for users who want to track their holdings)
CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    portfolio_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity DECIMAL(15,6) NOT NULL,
    average_cost DECIMAL(10,2) NOT NULL,
    purchase_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    UNIQUE(portfolio_id, symbol)
);

-- User alerts and notifications
CREATE TABLE IF NOT EXISTS user_alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('price_above', 'price_below', 'volume_spike', 'news_alert')),
    threshold_value DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    notification_method TEXT DEFAULT 'email',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    triggered_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved analysis reports
CREATE TABLE IF NOT EXISTS saved_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    report_type TEXT NOT NULL, -- 'screener', 'fundamental', 'technical', 'dcf'
    report_name TEXT NOT NULL,
    report_data JSON NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON watchlist_items(symbol);
CREATE INDEX IF NOT EXISTS idx_analysis_preferences_user_id ON analysis_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_portfolio_id ON portfolio_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_symbol ON portfolio_holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_symbol ON user_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users 
    BEGIN 
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_watchlists_timestamp 
    AFTER UPDATE ON watchlists 
    BEGIN 
        UPDATE watchlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_analysis_preferences_timestamp 
    AFTER UPDATE ON analysis_preferences 
    BEGIN 
        UPDATE analysis_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_portfolios_timestamp 
    AFTER UPDATE ON portfolios 
    BEGIN 
        UPDATE portfolios SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_portfolio_holdings_timestamp 
    AFTER UPDATE ON portfolio_holdings 
    BEGIN 
        UPDATE portfolio_holdings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_saved_reports_timestamp 
    AFTER UPDATE ON saved_reports 
    BEGIN 
        UPDATE saved_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
