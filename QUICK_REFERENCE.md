# BooksTrack Backend - Quick Reference Guide

## Quick Navigation

### Essential Files (Start Here)
- **Entry Point:** `/src/index.js` - Main router with 50+ API routes
- **Configuration:** `wrangler.toml` - Cloudflare Workers setup
- **Docs:** `/docs/API_README.md` - API contracts & integration guide

### Core Services (Business Logic)
1. `src/services/external-apis.js` - Google Books, OpenLibrary, ISBNdb
2. `src/services/enrichment.ts` - Multi-provider book enrichment
3. `src/services/ai-scanner.js` - Gemini 2.0 Flash image scanning
4. `src/durable-objects/progress-socket.js` - WebSocket state management

### Data Layer (Storage)
- **KV Cache:** `src/services/kv-cache.js` (7-365 day TTLs)
- **Unified Cache:** `src/services/unified-cache.js` (Edge → KV)
- **R2 Buckets:** Cover images, bookshelf photos, cold archives
- **Analytics:** 4 datasets via Analytics Engine

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                  iOS Client (Native App)                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTP + WebSocket
                       ▼
┌─────────────────────────────────────────────────────────┐
│         Cloudflare Workers (Single Monolith)             │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │  Router        │  │  Middleware      │  │ Handlers │ │
│  │ (index.js)     │→ │ CORS, Rate Limit │→ │ 50+      │ │
│  │ 50+ routes     │  │ Size Validate    │  │ routes   │ │
│  └────────────────┘  └──────────────────┘  └────┬─────┘ │
│                                                   │       │
│  ┌──────────────────────────────────────────────┴──────┐ │
│  │              Services & Providers                   │ │
│  │  ┌─────────────────┐  ┌─────────────────────────┐ │ │
│  │  │ External APIs   │  │ AI Providers           │ │ │
│  │  │ • Google Books  │  │ • Gemini 2.0 Flash    │ │ │
│  │  │ • OpenLibrary   │  │ • CSV Parser           │ │ │
│  │  │ • ISBNdb        │  │                        │ │ │
│  │  └─────────────────┘  └─────────────────────────┘ │ │
│  │                                                   │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │ Durable Objects (Stateful)                   │ │ │
│  │  │ • ProgressWebSocketDO (WebSocket + State)    │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │            Cache Layer (Multi-Tier)               │ │
│  │  Memory (Edge) → KV (7-365d TTL) → External API │ │
│  └──────────────────────────────────────────────────┘ │
└────────────┬───────────────────────┬─────────────────┘
             │                       │
    ┌────────▼─────────┐  ┌──────────▼──────────┐
    │  External APIs   │  │  Cloudflare Storage │
    │                  │  │  • KV Cache         │
    │ • Google Books   │  │  • R2 (covers, etc) │
    │ • OpenLibrary    │  │  • Analytics Engine │
    │ • ISBNdb         │  │  • Durable Objects  │
    │ • Gemini AI      │  │                     │
    └──────────────────┘  └─────────────────────┘
```

## API Endpoints Summary

### Search (Read-Only, Cached)
| Method | Path | Purpose | Cache |
|--------|------|---------|-------|
| GET | `/v1/search/title?q={query}` | Title search | 7 days |
| GET | `/v1/search/isbn?isbn={isbn}` | ISBN lookup | 365 days |
| GET | `/v1/search/advanced?title={title}&author={author}` | Combined search | 7 days |

### Background Jobs (Async with WebSocket)
| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| POST | `/api/scan-bookshelf?jobId={uuid}` | AI image scan | 202 Accepted |
| POST | `/api/scan-bookshelf/batch` | Multiple images | 202 Accepted |
| POST | `/api/import/csv-gemini` | CSV parsing | 202 Accepted |

### Real-Time Updates
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ws/progress?jobId={uuid}&token={token}` | WebSocket progress stream |

### Admin & Monitoring
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/metrics` | Performance metrics |
| GET | `/api/cache/metrics` | Cache statistics |
| GET | `/admin/harvest-dashboard` | ISBNdb harvest status |

## Key Concepts

### Three Storage Tiers
1. **Memory (Edge)** - Fast, per-request, cleared on response
2. **KV Cache** - Persistent, 7-365 day TTLs, ≈30-50ms latency
3. **R2 Storage** - Long-term, cover images & archives
4. **Analytics Engine** - Time-series metrics & queries

### External API Providers
| Provider | Rate Limit | TTL | Primary Use |
|----------|-----------|-----|------------|
| Google Books | 1000/day | 24h | Title & ISBN search |
| OpenLibrary | Unlimited | 24h | Fallback, author works |
| ISBNdb | 5000/day | 7d | Cover harvesting |
| Gemini 2.0 | 1000 RPM | N/A | Image scanning, CSV parsing |

### Job Status Tracking
```javascript
// Via WebSocket (Real-time)
GET /ws/progress?jobId=123&token=abc
// Returns: { progress: 0.75, status: "...", ... }

// Via HTTP (Polling)
GET /api/job-state/123
// Returns: { status, progress, results, ... }
```

## Testing

### Run Tests
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
```

### Test Files (29 total, 4199 lines)
- **Unit:** Cache, validators, rate limiting
- **Integration:** End-to-end workflows
- **Handlers:** Search, enrichment, scanning
- **Services:** External APIs, AI processing

## Environment Setup

### Local Development
```bash
npm install
npx wrangler dev     # Runs on http://localhost:8787
```

### Secrets (via wrangler secret put)
- `GOOGLE_BOOKS_API_KEY`
- `GEMINI_API_KEY`
- `ISBNDB_API_KEY`

### Configuration Variables
- `ENABLE_UNIFIED_ENVELOPE` - Response format toggle
- `LOG_LEVEL` - Logging verbosity
- `RATE_LIMIT_MS` - Rate limit window

## Performance Targets

| Endpoint | P95 Latency | Target |
|----------|------------|--------|
| Cached search | < 50ms | In-memory lookups |
| KV search | 30-50ms | Cold start penalty |
| Fresh search | < 500ms | Provider calls + cache write |
| AI scan | 25-40s | Gemini processing time |
| WebSocket | < 50ms | Real-time updates |

## Common Tasks

### Search for Books (Curl)
```bash
# Title search
curl "http://localhost:8787/v1/search/title?q=dune"

# ISBN search
curl "http://localhost:8787/v1/search/isbn?isbn=9780439708180"

# Advanced search
curl "http://localhost:8787/v1/search/advanced?title=dune&author=herbert"
```

### Scan Bookshelf Photo
```bash
# Start scan
curl -X POST \
  -H "Content-Type: image/jpeg" \
  --data-binary @photo.jpg \
  "http://localhost:8787/api/scan-bookshelf?jobId=$(uuidgen)"

# Connect to progress WebSocket
wscat -c "ws://localhost:8787/ws/progress?jobId=abc&token=xyz"
```

### Cache Warming
```bash
curl -X POST \
  -H "Content-Type: text/csv" \
  --data-binary @books.csv \
  "http://localhost:8787/api/warming/upload"
```

## Key Files by Function

| Function | File | Lines |
|----------|------|-------|
| Routing | `src/index.js` | 1146 |
| External APIs | `src/services/external-apis.js` | 1820 |
| Enrichment | `src/services/enrichment.ts` | 400+ |
| AI Scanning | `src/services/ai-scanner.js` | 300+ |
| WebSocket | `src/durable-objects/progress-socket.js` | 400+ |
| KV Cache | `src/services/kv-cache.js` | 113 |
| Config | `wrangler.toml` | 185 |

## Documentation Resources

- **API Contracts:** `/docs/API_README.md`
- **Deployment:** `/docs/deployment/DEPLOYMENT.md`
- **Secrets Setup:** `/docs/deployment/SECRETS_SETUP.md`
- **Frontend Integration:** `/docs/FRONTEND_HANDOFF.md`
- **Architecture:** `/docs/plans/` (various implementation docs)

## Critical Paths for Testing (Priority Order)

### Phase 1 (Immediate)
1. Router dispatch (50+ routes)
2. External API integration (Google Books, OpenLibrary, ISBNdb)
3. Enrichment pipeline (provider fallback)
4. WebSocket state management
5. AI scanning (3-stage pipeline)

### Phase 2 (Week 2)
6. Cache layer (multi-tier)
7. Rate limiting
8. Data normalizers
9. Background jobs
10. Scheduled tasks

### Phase 3 (Week 3)
11. Error recovery & edge cases
12. Performance & concurrency
13. Security (tokens, CORS, validation)
14. Batch operations

---
**Last Updated:** November 13, 2025
**Repository:** BooksTrack Backend (Cloudflare Workers)
**Status:** Production (https://api.oooefam.net)
