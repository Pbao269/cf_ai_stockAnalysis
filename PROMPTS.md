# PROMPTS for Reproducing the Entire Stock Report Application (AI Assistant Ready)

This file contains copy‑ready prompts for an AI coding assistant to replicate, run, and extend the full application across all services. Replace placeholders like TICKER, COMPANY, ACCOUNT_ID, or WORKER_URL as needed. Notion content is intentionally excluded.
The context and role of the AI assistant is define in .cursor/rules/cursor-cloudflare.mdc   | Make sure to always allow or mention it to ensure the Agent will adhere to the general structure of the product.
Set up MCP to link Cursor (or any AI agent) with Cloudflare docs to help search for documents and enhance AI agent interaction with Cloudflare.

## 1) Repository Discovery & Architecture

- **Map the monorepo**:
  "Scan the repo and produce an architecture map covering: `services/*` workers, Python microservices (Dockerized), shared schemas in `services/shared/schemas`, the API gateway, caching (KV), database (D1), and AI integration. Show request flow from API gateway to downstream services and back."

- **Identify all endpoints**:
  "List HTTP endpoints exposed by: `services/api-gateway`, `services/fundamentals-dcf`, `services/technicals`, `services/screener`, `services/catalyst-sentiment`, `services/intent`, `services/user-data`, and any ETL schedulers in `services/etl-workflows`. Include HTTP methods, request/response shapes, and example curl commands."

- **Summarize shared contracts**:
  "Read `services/shared/schemas/*.ts` and summarize key Zod schemas used across services. Call out `dcf.ts`, `screen.ts`, `intent.ts`, `facts.ts`, `tech.ts` and describe how they validate runtime data."

## 2) Local Environment & Tooling

- **Set up Node, pnpm, Wrangler**:
  "Ensure Node LTS and pnpm are installed. Install Wrangler globally or use `npx wrangler`. From repo root, run `pnpm i`. Verify `wrangler versions` and that Cloudflare login works with `npx wrangler whoami`."

- **Python toolchain**:
  "Install Docker Desktop. Verify `docker --version` works. Ensure local Python isn’t required (we use Docker for Python services), but if needed install Python 3.11 with venv support."

## 3) Configuration & Secrets

- **Review env and bindings**:
  "Open `env.example` and each service `wrangler.jsonc`. Document required bindings: KV namespaces, D1 databases, AI binding (Workers AI), R2 (if any), Durable Objects (if any). Identify missing secrets and where they’re set."

- **Create/Link KV & D1**:
  "Create Cloudflare KV namespaces for caching and link them in each service’s `wrangler.jsonc`. Create a D1 database, run migrations from `services/user-data/migrations/d1.sql`, and bind it."

- **AI binding**:
  "Configure Workers AI binding in `wrangler.jsonc` for workers using AI. Confirm `AI` binding name consistency across services. Optionally set `AI_MODEL`."

## 4) Build & Run Python Microservices (Docker)

- **Fundamentals DCF service**:
  "From `services/fundamentals-dcf/python-unified`, build the Docker image (name: dcf-unified). Stop any container on 8086, then run it publishing `8086:8086`. Verify via curl and capture JSON responses."

- **Screener Python service**:
  "From `services/screener/python-screener`, use the provided Dockerfile or `docker-compose.yml` to build and run the screener service. Publish its port and verify endpoints."

## 5) Workers: Build, Bindings, and Deployment

- **Audit each worker config**:
  "Open `wrangler.jsonc` in each `services/*` directory. Verify `main` entrypoints, routes or service names, `compatibility_date`, and bindings. Ensure TypeScript `tsconfig.json` aligns (rootDir, include)."

- **Deploy workers**:
  "For each worker (`api-gateway`, `fundamentals-dcf`, `technicals`, `screener`, `catalyst-sentiment`, `intent`, `etl-workflows`, `user-data`), run `npx wrangler deploy`. Confirm the deployment names and URLs."

- **Worker routing**:
  "If using custom routes, document them. Otherwise, record the default service URLs returned by Wrangler."

## 6) API Gateway Orchestration

- **Trace request flow**:
  "Open `services/api-gateway/index.ts`. Explain how it routes client requests to downstream services, applies caching, error handling, and aggregates responses. Document any AI usage or fallback logic."

- **Example end-to-end calls**:
  "Provide curl commands that hit the API gateway for: fundamentals DCF (with AI), technicals snapshot, screener queries, intent analysis, catalysts/sentiment, and user-data reads/writes. Include sample payloads and show expected JSON."

## 7) Fundamentals DCF Worker (Cloudflare) + Python DCF

- **Contracts & models**:
  "Open `services/fundamentals-dcf/index.ts` and `services/fundamentals-dcf/dcf.ts`. Summarize interfaces, weighting logic between 3‑Stage and H‑Model, sanity caps, healthcare caps, and confidence scoring. Then relate these to the Python `main.py` DCF computations and validations (beta, WACC bounds, negative FCF proxies, terminal value share, implied market cap checks)."

- **AI analysis integration**:
  "Ensure the worker always attempts AI analysis when binding is present and adds `ai=1` to cache keys. Use `generateAiAnalysis` or equivalent to await thesis, bull, bear, and gap. Provide a fallback synthesis when AI returns partial/empty data."

- **Consensus vs DCF**:
  "Verify `analyst_consensus` with fields `average_target_price`, `analyst_count`, `gap_vs_weighted`, `gap_vs_weighted_pct`. Provide example outputs for TICKER and discuss gap drivers."

## 8) Other Services

- **Technicals worker**:
  "Open `services/technicals/index.ts`. Document endpoints, indicators computed, inputs required, and sample curl. Include any caching or throttling."

- **Screener worker**:
  "Open `services/screener/index.ts` and `python-screener`. Document filters, query structure, and example screen requests. Include how Python and Worker coordinate."

- **Catalyst/Sentiment worker**:
  "Open `services/catalyst-sentiment/index.ts`. Describe sources, NLP/AI steps if any, and response shape. Provide example curl."

- **Intent worker**:
  "Open `services/intent/index.ts`. Document how intent classification works, inputs, outputs, and scoring."

- **ETL Workflows**:
  "Open `services/etl-workflows/index.ts`. Explain scheduled jobs, data refresh cadence, and outputs sent to KV/D1 or caches."

- **User Data worker**:
  "Open `services/user-data/index.ts`. Explain CRUD endpoints, D1 schema (`services/user-data/migrations/d1.sql`), and auth/rate limiting if any."

## 9) Shared Schemas & Validation

- **Schema coverage**:
  "Review `services/shared/schemas/*.ts`. Summarize key Zod schemas and how they’re enforced at runtime in each worker. Ensure response shapes match consumer expectations."

- **TypeScript interfaces**:
  "Ensure `dcf.ts` and other interfaces are consumed consistently. Fix any `rootDir` or include issues in `tsconfig.json` files."

## 10) Caching & Freshness

- **KV strategy**:
  "Document KV namespaces used for each worker. Define cache keys including freshness flags (e.g., `?fresh=true`) and AI signature (`ai=1`). Provide prompts to implement cache invalidation and TTL strategies."

- **Data staleness**:
  "Add a freshness indicator in responses (quote timestamp, last filing date). Surface in API gateway responses for observability."

## 11) AI Prompts & Fallbacks

- **Unified AI prompt**:
  "Write a single prompt that, given fundamentals, consensus, DCF model results, and confidence factors, returns JSON: { thesis, bull_scenario, bear_scenario, gap_explanation }. Keep outputs finance‑grade, concise, and quant‑referenced."

- **Gap‑only prompt**:
  "If needed, create a focused prompt explaining price vs. DCF gap with 4–6 bullets using drivers like WACC, margins, growth expectations, cyclicality, sentiment, and execution risks."

- **Deterministic fallback**:
  "When AI returns partial/empty content, synthesize fields from known data. Prefer conservative tone at Low confidence. Always return non‑empty fields."

## 12) Deployment, CI/CD, and Environments

- **Wrangler deploy**:
  "Deploy each worker with `npx wrangler deploy`. Record resulting URLs. Confirm bindings (KV, AI, D1) in production configs."

- **Environment parity**:
  "Create separate environments (dev, staging, prod) with distinct KV/D1/AI bindings. Document how to target environments in Wrangler."

- **CI suggestions**:
  "Propose a GitHub Actions workflow: install pnpm deps, type‑check, lint, build workers, run minimal e2e curl checks against preview deployments, then deploy on main merges."

## 13) Testing & E2E Validation

- **Functional tests (curl)**:
  "Provide curl scripts for each service. Validate JSON shape vs Zod schemas. Verify `analyst_consensus`, AI outputs, `confidence_score`, and `weighting_method` where applicable."

- **Cross‑ticker validation**:
  "Test with APLD, GOOGL, UNH, AAPL, NVDA. Capture model weights, caps applied, terminal value share, implied market cap, consensus gap, and confidence. Flag anomalies."

- **Sensitivity checks**:
  "Run WACC ±200 bps and terminal growth ±100 bps for DCF. Summarize fair value ranges and confidence implications."

## 14) Observability & Troubleshooting

- **Logs & tailing**:
  "Use `npx wrangler tail` per worker to watch logs. Add structured logs around external fetches, parsing, and model selection."

- **Common errors**:
  "Document and fix: empty Python JSON (wrap exceptions), list vs object access for `individual_valuations`, numpy.bool_ serialization, Docker port conflicts, TypeScript `rootDir` issues, AI fields empty (await + fallback)."

- **Performance**:
  "Measure cold start and response times. Add KV caching where safe. Consider batching or streaming for heavy calls."

## 15) Security & Hardening

- **Input validation**:
  "Validate all inputs via Zod schemas. Enforce ticker formats and max lengths. Reject unsupported sectors (e.g., financials for DCF)."

- **Rate limiting**:
  "Implement per‑IP rate limiting at the gateway. Cache recent IP counters in KV with short TTLs."

- **Secrets management**:
  "Ensure no secrets in repo. Use Wrangler secrets and account‑level bindings where required."

- **Data provenance**:
  "Log data sources and timestamps to support auditing and user trust."

## 16) Checklists

- **Before deploy**:
  - **Workers**: Build passes, routes configured, bindings present
  - **Python**: Containers built, health checked, ports open
  - **Schemas**: Zod validations passing
  - **AI**: Binding configured, fallback logic tested
  - **KV/D1**: Namespaces created, migrations applied

- **E2E smoke**:
  - **Gateway**: Returns aggregated JSON
  - **DCF**: Weighted FV, consensus gap, AI content present
  - **Technicals**: Indicators present
  - **Screener**: Filters work
  - **User‑data**: D1 read/write ok

---

Use these prompts as a playbook. Execute them sequentially or selectively to stand up, validate, and evolve the entire application with an AI coding assistant.
