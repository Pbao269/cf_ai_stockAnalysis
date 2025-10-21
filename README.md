# Stock Report Platform

Cloudflare Workers-based stock analysis platform with AI-powered intent parsing and multi-service architecture.

## Architecture

Microservices deployed as Cloudflare Workers:

### Core Services

- **api-gateway** - Routes requests via Workers RPC, handles SSE streaming for parallel analysis
- **intent** - Parses natural language queries into structured filters using Workers AI (Llama 3.1)
- **screener** - Filters stocks using technical + fundamental criteria from cached KV/R2 data
- **fundamentals-dcf** - Runs 3-Stage and H-Model DCF valuations, generates AI thesis/bull/bear scenarios
- **technicals** - Calculates indicators (RSI, MACD, ADX, ATR), detects market regimes, finds support/resistance
- **entry-dca** - Backtests 6 DCA strategies (lump-sum, fixed, ATR-weighted, drawdown, Fibonacci) with risk metrics
- **user-data** - Stores watchlists and preferences in D1 database

### Optional Services

- **notion-export** - Exports analysis reports to Notion pages (disabled by default)
- **etl-workflows** - Aggregates facts and synthesizes final reports (disabled by default)

## Setup

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account with Workers, KV, R2, D1, and Workers AI enabled
- Wrangler CLI: `npm install -g wrangler`

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

3. Create Cloudflare resources:
   ```bash
   # D1 database
   wrangler d1 create user-db-mvp
   
   # KV namespaces
   wrangler kv:namespace create "FUNDAMENTALS_SNAP"
   wrangler kv:namespace create "LATEST_QUOTES"
   wrangler kv:namespace create "SCREENER_INDEX"
   
   # R2 bucket
   wrangler r2 bucket create ohlcv-mvp
   ```

4. Update service wrangler configurations with actual resource IDs

5. Run database migrations:
   ```bash
   pnpm run db:migrate
   ```

## Project Structure

```
services/
├── api-gateway/         # Request routing and orchestration
├── intent/              # NLP query parsing
├── screener/            # Stock filtering
├── fundamentals-dcf/    # DCF valuation + AI analysis
├── technicals/          # Indicators + regime detection
├── entry-dca/           # DCA strategy backtesting
├── user-data/           # Watchlists (D1)
├── notion-export/       # [Optional] Notion integration
├── etl-workflows/       # [Optional] Report synthesis
└── shared/schemas/      # Zod validation schemas
```

## Development

### Local Development

```bash
# Run all services
pnpm run dev

# Run specific service
pnpm run dev:intent
pnpm run dev:api-gateway
```

### Deployment

```bash
# Deploy all services
pnpm run deploy

# Deploy specific service
pnpm run deploy:intent
pnpm run deploy:api-gateway
```

## API Endpoints

### API Gateway

- `GET /healthz` - Health check
- `POST /intent` - Extract investment intent
- `POST /screen` - Stock screening
- `GET /analyze?ticker=XYZ` - Stock analysis (SSE)
- `POST /export/notion` - Export to Notion
- `POST /watchlist` - Watchlist operations

### Service Communication

Services communicate via Workers RPC using service bindings:

```typescript
// Example: Calling intent service from API gateway
const response = await env.intent.fetch('http://localhost/extract', {
  method: 'POST',
  body: JSON.stringify({ query: userInput })
});
```

## Data Sources

- **yfinance**: Primary market data source
- **FinViz**: Stock screening data
- **FMP/Alpha Vantage**: Fallback sources

## AI Integration

Workers AI with `@cf/meta/llama-3.1-8b-instruct-fp8` for:

- **Intent parsing** - Converts queries like "undervalued tech stocks" into structured filters
- **DCF analysis** - Generates investment thesis, bull/bear scenarios, and gap explanations
- **Report synthesis** - Aggregates multi-service results into cohesive narratives (optional)

## Configuration

Each service has its own `wrangler.jsonc`:

- **api-gateway** - Service bindings to all workers, KV (FUNDAMENTALS_SNAP, LATEST_QUOTES, SCREENER_INDEX), R2 (ohlcv-mvp), D1 (user-db-mvp), AI
- **intent** - AI binding
- **screener** - KV (SCREENER_INDEX) for cached stock universe
- **fundamentals-dcf** - KV (FUNDAMENTALS_SNAP), AI binding
- **technicals** - KV (CACHE), external Python backend URL (Render.com)
- **entry-dca** - KV (CACHE), external Python backend URL (Render.com)
- **user-data** - D1 (user-db-mvp)

To enable optional services, uncomment their bindings in `api-gateway/wrangler.jsonc`
