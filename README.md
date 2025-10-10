# Stock Report Platform

A comprehensive Cloudflare Workers-based stock analysis and reporting platform built with TypeScript, featuring real-time data processing, AI-powered insights, and seamless integrations.

## 🏗️ Architecture

This platform consists of multiple microservices deployed as Cloudflare Workers:

- **API Gateway**: Central routing and authentication
- **Intent Service**: Natural language processing for user queries
- **Screener Service**: Stock screening and filtering
- **Fundamentals DCF Service**: Fundamental analysis and DCF modeling
- **Technicals Service**: Technical analysis and charting
- **Catalyst Sentiment Service**: News sentiment analysis
- **Entry DCA Service**: Entry point and DCA strategy recommendations
- **User Data Service**: User preferences and watchlists
- **Notion Export Service**: Report export to Notion
- **ETL Workflows Service**: Data processing and scheduled tasks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account with Workers, KV, R2, D1, and Workers AI enabled
- Wrangler CLI installed globally: `npm install -g wrangler`

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd stock_report
   pnpm install
   ```

2. **Authenticate with Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Create Cloudflare resources:**
   ```bash
   # Create D1 databases
   wrangler d1 create user-db-dev
   wrangler d1 create user-db-staging  
   wrangler d1 create user-db-prod

   # Create KV namespaces
   wrangler kv:namespace create "FUNDAMENTALS_SNAP" --env dev
   wrangler kv:namespace create "LATEST_QUOTES" --env dev
   wrangler kv:namespace create "SCREENER_INDEX" --env dev

   # Create R2 buckets
   wrangler r2 bucket create ohlcv-dev
   wrangler r2 bucket create ohlcv-staging
   wrangler r2 bucket create ohlcv-prod
   ```

4. **Update wrangler configurations:**
   - Replace placeholder IDs in `infra/wrangler.*.jsonc` with actual resource IDs from step 3
   - Update service names to match your Cloudflare account

5. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

6. **Deploy secrets:**
   ```bash
   wrangler secret put FMP_API_KEY --env dev
   wrangler secret put ALPHAVANTAGE_API_KEY --env dev
   wrangler secret put NOTION_TOKEN --env dev
   ```

7. **Run database migrations:**
   ```bash
   pnpm run db:migrate
   ```

## 📁 Project Structure

```
stock_report/
├── services/                 # Microservices
│   ├── api-gateway/         # Central API gateway
│   ├── users-auth/         # User authentication
│   ├── intent/              # Natural language processing
│   ├── screener/            # Stock screening
│   ├── fundamentals-dcf/    # Fundamental analysis
│   ├── technicals/          # Technical analysis
│   ├── catalyst-sentiment/  # News sentiment
│   ├── entry-dca/           # Entry strategies
│   ├── user-data/           # User preferences
│   ├── notion-export/       # Notion integration
│   ├── etl-workflows/       # Data processing
│   └── shared/              # Shared utilities
├── apps/
│   └── web/                 # Frontend application
├── infra/                   # Infrastructure configuration
│   ├── wrangler.*.jsonc     # Wrangler configurations
│   └── migrations/          # Database migrations
├── tests/                   # Test suites
└── package.json             # Workspace configuration
```

## 🔧 Development

### Running Services Locally

```bash
# Run all services in development mode
pnpm run dev

# Run specific service
pnpm run dev:api-gateway
pnpm run dev:screener
pnpm run dev:fundamentals-dcf
# ... etc
```

### Development Workflow

1. **Start development servers:**
   ```bash
   pnpm run dev
   ```

2. **Make changes to services** - Hot reloading is enabled

3. **Run tests:**
   ```bash
   pnpm run test
   pnpm run test:unit
   pnpm run test:integration
   ```

4. **Type checking:**
   ```bash
   pnpm run typecheck
   ```

5. **Linting:**
   ```bash
   pnpm run lint
   pnpm run lint:fix
   ```

## 🚀 Deployment

### Staging Deployment

```bash
# Deploy all services to staging
pnpm run deploy:staging

# Deploy specific service to staging
pnpm run deploy:staging:api-gateway
```

### Production Deployment

```bash
# Deploy all services to production
pnpm run deploy

# Deploy specific service to production
pnpm run deploy:api-gateway
```

### Database Migrations

```bash
# Run migrations for each environment
pnpm run db:migrate          # Development
pnpm run db:migrate:staging  # Staging
pnpm run db:migrate:prod     # Production
```

## 🔐 Authentication & Security

This platform uses **Cloudflare Access** for authentication instead of custom JWT implementation:

### Setting up Cloudflare Access

1. **Create Access Application:**
   - Go to Cloudflare Dashboard → Zero Trust → Access → Applications
   - Create new application for your domain
   - Configure authentication policies

2. **Configure Service Bindings:**
   - Access JWTs are automatically available in `Cf-Access-Jwt-Assertion` header
   - No need to implement custom JWT validation
   - User information is extracted from the JWT payload

3. **API Shield (Optional):**
   - Enable API Shield for additional request validation
   - Configure rate limiting and DDoS protection

### Service-to-Service Communication

Services communicate via **Workers RPC** using service bindings:

```typescript
// Example: Calling screener service from API gateway
const response = await env.screener.screen({
  filters: { marketCap: 'large', sector: 'technology' },
  limit: 50
});
```

## 📊 Data Sources & APIs

### Primary Data Sources

- **Financial Modeling Prep (FMP)**: Primary source for fundamentals and quotes
- **Alpha Vantage**: Backup source for market data
- **yfinance**: Free alternative for basic market data
- **Stooq**: Additional backup source

### Data Flow

1. **Real-time Quotes**: Updated every 5 minutes via ETL workflows
2. **Fundamentals**: Refreshed hourly for active stocks
3. **Screener Data**: Updated every 15 minutes
4. **OHLCV Data**: Stored in R2 buckets with 1-hour cache TTL

### Caching Strategy

- **KV Store**: Hot data snapshots and indexes
- **R2 Storage**: OHLCV time series data
- **D1 Database**: User preferences and relational data

## 🤖 AI Integration

### Workers AI Models

- **Primary Model**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Fallback Model**: `@cf/meta/llama-3.3-8b-instruct-fp8-fast`

### AI Use Cases

- **Natural Language Processing**: User query interpretation
- **Sentiment Analysis**: News and social media sentiment
- **Report Generation**: Automated analysis summaries
- **Insight Synthesis**: Combining multiple data sources

### AI Configuration

```typescript
// Example AI usage in a service
const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
  messages: [
    { role: 'system', content: 'You are a financial analyst...' },
    { role: 'user', content: userQuery }
  ],
  max_tokens: 1000,
  temperature: 0.7
});
```

## 🔄 ETL Workflows

### Scheduled Tasks

- **Daily ETL**: Full data refresh at 2 AM UTC
- **Hourly Quotes**: Real-time price updates
- **Weekly Fundamentals**: Comprehensive fundamental data refresh

### Workflow Configuration

```typescript
// Example workflow in etl-workflows service
export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const cron = new Cron(event.cron);
    
    if (cron.match('0 2 * * *')) {
      // Daily ETL
      await runDailyETL(env);
    }
    
    if (cron.match('0 * * * *')) {
      // Hourly quotes update
      await updateQuotes(env);
    }
  }
};
```

## 📈 Monitoring & Observability

### Logging

- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error
- **Request Tracing**: Full request/response cycle tracking

### Metrics

- **Performance Metrics**: Response times, error rates
- **Business Metrics**: API usage, user engagement
- **Resource Metrics**: KV/R2/D1 usage statistics

### Error Handling

- **Graceful Degradation**: Fallback to alternative data sources
- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breakers**: Prevent cascade failures

## 🧪 Testing

### Test Structure

```bash
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for service interactions
├── e2e/           # End-to-end tests for complete workflows
└── fixtures/       # Test data and mocks
```

### Running Tests

```bash
# Run all tests
pnpm run test

# Run specific test suites
pnpm run test:unit
pnpm run test:integration

# Run tests with coverage
pnpm run test:coverage
```

## 🔧 Configuration Management

### Environment Variables

- **Development**: `.env` file (not committed)
- **Staging/Production**: Cloudflare secrets via `wrangler secret`

### Feature Flags

Control feature availability via environment variables:

```bash
ENABLE_NOTION_EXPORT=true
ENABLE_PORTFOLIO_TRACKING=true
ENABLE_ALERTS=true
ENABLE_PUBLIC_SHARING=false
```

## 📚 API Documentation

### Service Endpoints

Each service exposes RESTful APIs with OpenAPI documentation:

- **API Gateway**: `/api/v1/*` - Central routing
- **Screener**: `/api/v1/screener/*` - Stock screening
- **Fundamentals**: `/api/v1/fundamentals/*` - Fundamental analysis
- **Technicals**: `/api/v1/technicals/*` - Technical analysis

### Authentication

All API endpoints require valid Cloudflare Access JWT in the `Cf-Access-Jwt-Assertion` header.

## 🚨 Troubleshooting

### Common Issues

1. **Service Binding Errors**: Verify service names match in wrangler configs
2. **Resource Not Found**: Ensure KV/D1/R2 resources are created and IDs are correct
3. **Authentication Failures**: Check Cloudflare Access configuration
4. **Rate Limiting**: Monitor API usage and implement proper caching

### Debug Mode

Enable debug logging:

```bash
DEBUG=true LOG_LEVEL=debug pnpm run dev:api-gateway
```

### Health Checks

Each service exposes health check endpoints:

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📞 Support

For questions and support:

- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

---

**Disclaimer**: This platform provides AI-generated analysis and is not investment advice. Always conduct your own research before making investment decisions.
