# Multi-Model DCF Valuation Architecture

## Overview

This service implements a sophisticated multi-model DCF valuation system with:
1. **Centralized Data Service** - Single source of truth for all fundamentals
2. **Three DCF Models** - 3-Stage, SOTP, H-Model (institutional-grade)
3. **AI Model Selector** - Cloudflare AI Worker chooses optimal model(s)
4. **Unified Gateway** - Aggregates results with probability weighting

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Worker (index.ts)                                │
│ - AI Model Selector (Llama 3)                               │
│ - Request Routing & Aggregation                             │
│ - KV Caching Layer                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Data Service (python-data/ - Port 8082)                     │
│ - Centralized yfinance integration                          │
│ - Comprehensive FundamentalsSnapshot                        │
│ - SEC EDGAR segment data (TODO)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┬──────────────┐
         │           │           │              │
         ▼           ▼           ▼              ▼
┌──────────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐
│  3-Stage DCF │ │   SOTP   │ │  H-Model  │ │ (Future)   │
│  Port 8083   │ │Port 8084 │ │ Port 8085 │ │ Monte Carlo│
└──────────────┘ └──────────┘ └───────────┘ └────────────┘
         │           │           │
         └───────────┴───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Aggregated Response   │
         │ - Weighted fair value │
         │ - Model selection     │
         │ - Sensitivities       │
         └───────────────────────┘
```

## Directory Structure

```
services/fundamentals-dcf/
├── index.ts                    # Cloudflare Worker (AI Gateway)
├── wrangler.jsonc             # Worker config
├── docker-compose.yml         # ALL services in one file
├── ARCHITECTURE.md            # This file
├── python-data/               # Centralized data service (Port 8082)
│   ├── main.py                # yfinance fundamentals ONLY
│   ├── requirements.txt
│   └── Dockerfile
├── python-3stage/             # 3-Stage DCF model (Port 8083)
│   ├── main.py                # Goldman Sachs standard
│   ├── requirements.txt
│   └── Dockerfile
├── python-sotp/               # Sum-of-the-Parts (Port 8084)
│   ├── main.py                # Conglomerate valuation + EDGAR
│   ├── requirements.txt
│   └── Dockerfile
└── python-hmodel/             # H-Model DCF (Port 8085)
    ├── main.py                # Morningstar standard
    ├── requirements.txt
    └── Dockerfile
```

