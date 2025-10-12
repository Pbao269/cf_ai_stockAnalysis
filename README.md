# Stock Report Platform

Cloudflare Workers-based stock analysis platform with AI-powered intent parsing and multi-service architecture.

## Architecture

Microservices deployed as Cloudflare Workers:

- **api-gateway**: Central routing and service orchestration
- **intent**: Natural language processing using Workers AI
- **screener**: Stock screening and filtering
- **fundamentals-dcf**: Fundamental analysis and DCF modeling
- **technicals**: Technical analysis and indicators
- **catalyst-sentiment**: News sentiment analysis
- **entry-dca**: Entry strategies and DCA recommendations
- **user-data**: User preferences and watchlists
- **notion-export**: Report export to Notion
- **etl-workflows**: Data processing and scheduled tasks

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
├── api-gateway/         # Central API gateway
├── intent/              # Natural language processing
├── screener/            # Stock screening
├── fundamentals-dcf/    # Fundamental analysis
├── technicals/          # Technical analysis
├── catalyst-sentiment/  # News sentiment
├── entry-dca/           # Entry strategies
├── user-data/           # User preferences
├── notion-export/       # Notion integration
├── etl-workflows/       # Data processing
└── shared/schemas/      # Zod schemas
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

Uses Workers AI with `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for:

- Natural language intent parsing
- Sentiment analysis
- Report generation

## Configuration

Each service has its own `wrangler.jsonc` with specific bindings:

- **intent**: AI binding
- **user-data**: D1 database binding
- **api-gateway**: All bindings + service bindings
- **screener**: KV namespace binding
- **technicals**: R2 bucket binding
