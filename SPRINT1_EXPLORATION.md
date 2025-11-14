# BooksTrack Backend - Project Exploration Summary
**Date:** November 13, 2025  
**Scope:** Sprint 1 Planning & Implementation Guide  
**Stack:** Node.js, Cloudflare Workers, Durable Objects, KV Cache, R2, TypeScript/JavaScript

---

## 1. PROJECT STRUCTURE & KEY DIRECTORIES

### Top-Level Layout
```
/Users/justingardner/Downloads/xcode/bookstrack-backend/
├── .claude/                  # Claude Code configuration & skills
├── .github/                  # GitHub workflows & CI/CD
├── .wrangler/                # Wrangler dev cache
├── coverage/                 # Test coverage reports
├── docs/                     # API documentation
├── src/                      # Source code (main)
├── tests/                    # Test suites (46+ test files)
├── scripts/                  # Utility scripts
├── plans/                    # Sprint planning docs
├── wrangler.toml             # Cloudflare Workers config
├── package.json              # Dependencies & scripts
└── tsconfig.json             # (missing - may need setup)
```

### Source Code Organization (`src/`)
```
src/
├── index.js                      # MAIN ROUTER (1,146 lines)
│   ├── POST /api/enrichment/batch
│   ├── POST /api/enrichment/start (deprecated)
│   ├── POST /api/enrichment/cancel
│   ├── POST /api/scan-bookshelf + /batch
│   ├── POST /api/import/csv-gemini
│   ├── GET /v1/search/{title,isbn,advanced}
│   ├── GET /ws/progress (WebSocket)
│   ├── GET /health
│   └── + legacy endpoints (/search/*, /external/*)
│
├── handlers/                     # Request handlers (one per route)
│   ├── batch-enrichment.ts       # POST /api/enrichment/batch
│   ├── batch-scan-handler.ts     # POST /api/scan-bookshelf/batch
│   ├── csv-import.ts             # POST /api/import/csv-gemini
│   ├── v1/
│   │   ├── search-title.ts
│   │   ├── search-isbn.ts
│   │   └── search-advanced.ts
│   ├── book-search.js
│   ├── author-search.js
│   ├── image-proxy.ts
│   ├── scheduled-harvest.js
│   ├── scheduled-archival.js
│   ├── scheduled-alerts.js
│   └── ... (13+ handlers total)
│
├── middleware/                   # Request processing
│   ├── rate-limiter.js          # RACE CONDITION ISSUE HERE
│   ├── size-validator.js        # Max 10MB for images
│   └── cors.js                  # CORS origin whitelisting
│
├── services/                     # Business logic (reusable)
│   ├── enrichment.ts            # Core enrichment logic
│   ├── parallel-enrichment.js    # Concurrent enrichment (10 parallel)
│   ├── external-apis.js         # Google Books, OpenLibrary, ISBNdb
│   ├── kv-cache.js              # KV caching with TTL strategy
│   ├── unified-cache.js         # Edge Cache → KV → API tier system
│   ├── edge-cache.js            # Cloudflare Cache API
│   ├── ai-scanner.js            # Gemini AI bookshelf scanning
│   ├── isbndb-api.js            # ISBNdb API client
│   ├── edition-discovery.js     # Multi-edition handling
│   ├── alert-monitor.js         # Alert system
│   ├── metrics-aggregator.js    # Analytics aggregation
│   └── ... (10+ services)
│
├── providers/                    # External API integrations
│   ├── gemini-provider.js       # Google Gemini AI
│   └── gemini-csv-provider.js   # Gemini CSV parsing
│
├── durable-objects/              # WebSocket state management
│   └── progress-socket.js        # PROGRESS_WEBSOCKET_DO class
│
├── utils/                        # Shared utilities
│   ├── cache-keys.js            # Cache key generation
│   ├── cache.js                 # Generic cache helpers
│   ├── csv-validator.js         # CSV validation
│   ├── analytics.js             # Event tracking
│   ├── r2-paths.js              # R2 bucket path conventions
│   └── ... (7+ utilities)
│
├── types/                        # TypeScript type definitions
│   ├── canonical.js             # Canonical response DTOs
│   ├── responses.js             # Response envelopes
│   ├── enums.js                 # Data provider enums
│   └── gemini-schemas.js        # AI provider schemas
│
├── consumers/                    # Queue message consumers
│   └── author-warming-consumer.js # Cache warming queue processor
│
├── workers/                      # Background workers
│   └── archival-worker.js       # R2 cold storage archival
│
├── prompts/                      # AI system prompts
│   └── csv-parser-prompt.js     # Gemini CSV parsing instructions
│
└── services/normalizers/         # Response normalization
    ├── google-books.ts
    ├── openlibrary.ts
    ├── isbndb.ts
    └── ... (3+ normalizers)
```

---

## 2. CORE ROUTER ANALYSIS (`src/index.js`)

### Entry Point Pattern
- **Single entry point** for all requests (`async fetch(request, env, ctx)`)
- **No service bindings** - Direct function calls instead of RPC
- **Unified environment bindings** through `env` parameter
- **Context support** for `ctx.waitUntil()` and background processing

### Current Route Structure (46 routes)
```javascript
// Enrichment API (3 routes)
POST   /api/enrichment/start          (deprecated, redirects to /batch)
POST   /api/enrichment/batch          → handleBatchEnrichment()
POST   /api/enrichment/cancel         → DO stub method

// AI Scanner (2 routes)
POST   /api/scan-bookshelf            → aiScanner.processBookshelfScan()
POST   /api/scan-bookshelf/batch      → handleBatchScan()
POST   /api/scan-bookshelf/cancel     → DO stub method

// CSV Import (2 routes)
POST   /api/import/csv-gemini         → handleCSVImport()
POST   /api/warming/upload            → handleWarmingUpload()
GET    /api/warming/dlq               → handleDLQMonitor()

// Search API - V1 (Canonical) (3 routes)
GET    /v1/search/title               → handleSearchTitle()
GET    /v1/search/isbn                → handleSearchISBN()
GET    /v1/search/advanced            → handleSearchAdvanced()

// Search API - Legacy (4 routes)
GET    /search/title                  → bookSearch.searchByTitle()
GET    /search/isbn                   → bookSearch.searchByISBN()
GET    /search/author                 → authorSearch.searchByAuthor()
GET    /search/advanced               → handleAdvancedSearch()

// External API Passthrough (7 routes)
GET    /external/google-books
GET    /external/google-books-isbn
GET    /external/openlibrary
GET    /external/openlibrary-author
GET    /external/isbndb
GET    /external/isbndb-editions
GET    /external/isbndb-isbn

// WebSocket & Job Management (4 routes)
GET    /ws/progress?jobId={id}        → Durable Object fetch()
POST   /api/token/refresh             → DO.refreshAuthToken()
GET    /api/job-state/:jobId          → DO.getJobStateAndAuth()

// Monitoring & Metrics (4 routes)
GET    /api/cache/metrics             → handleCacheMetrics()
GET    /metrics                       → handleMetricsRequest()
GET    /health                        → Health check response
GET    /api/test-multi-edition        → Edition discovery test

// Durable Object Test Endpoints (7 routes)
POST   /test/do/init-batch
GET    /test/do/get-state
POST   /test/do/update-photo
POST   /test/do/complete-batch
GET    /test/do/is-canceled
POST   /test/do/cancel-batch

// Maintenance (1 route)
POST   /api/harvest-covers            → handleScheduledHarvest()
GET    /admin/harvest-dashboard       → handleHarvestDashboard()

// Queue & Scheduled Events
queue()    → author-warming-queue → processAuthorBatch()
scheduled()
  0 2 * * * → handleScheduledArchival()
  */15 * * * * → handleScheduledAlerts()
  0 3 * * * → handleScheduledHarvest()
```

### Key Features
- **Rate limiting**: Applied to all AI/enrichment endpoints (line 226-227, 328, 374)
- **Size validation**: 10MB for CSV, 5MB per image (line 378, 412)
- **CORS handling**: Dynamic headers via `getCorsHeaders(request)`
- **Unified envelope**: Feature flag `ENABLE_UNIFIED_ENVELOPE` (line 37, 532, 539, 547)
- **Error handling**: Try-catch wrapper around all handlers

---

## 3. RATE LIMITER IMPLEMENTATION & RACE CONDITION ISSUE

### File Location
`/Users/justingardner/Downloads/xcode/bookstrack-backend/src/middleware/rate-limiter.js`

### Current Implementation (108 lines)
```javascript
// Token Bucket Algorithm
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // requests per window

// Per-IP state stored in KV_CACHE with key: ratelimit:{clientIP}
export async function checkRateLimit(request, env) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${clientIP}`;
  
  try {
    // Get current counter from KV
    const counterData = await env.KV_CACHE.get(key, { type: 'json' });
    const now = Date.now();
    
    if (!counterData) {
      // Initialize: count=1, resetAt=now+60s
      await env.KV_CACHE.put(key, JSON.stringify({
        count: 1,
        resetAt: now + 60000
      }), { expirationTtl: 60 });
      return null; // Allow
    }
    
    if (now >= counterData.resetAt) {
      // Reset window
      await env.KV_CACHE.put(key, ...);
      return null; // Allow
    }
    
    if (counterData.count >= 10) {
      // Rate limit exceeded
      return new Response(429, ...);
    }
    
    // Increment counter
    await env.KV_CACHE.put(key, JSON.stringify({
      count: counterData.count + 1,
      resetAt: counterData.resetAt
    }), { expirationTtl: 60 });
    
    return null; // Allow
  } catch (error) {
    console.error('Rate limiter failed');
    return null; // Fail open
  }
}
```

### RACE CONDITION ANALYSIS
**Issue:** Non-atomic read-modify-write cycle

1. **Thread 1** reads `count: 9` at time T
2. **Thread 2** reads `count: 9` at time T+1ms
3. **Thread 1** increments → writes `count: 10`
4. **Thread 2** increments → writes `count: 10` (overwrites Thread 1's write!)
5. **Result:** Counter is 10, but 2 requests passed the check (both incremented from 9)

**This allows burst past the 10 req/min limit**, defeating rate limiting.

### Actual Usage in index.js
```javascript
// Line 226-227: Enrichment API
const rateLimitResponse = await checkRateLimit(request, env);
if (rateLimitResponse) return rateLimitResponse;

// Line 328: Batch scan endpoint
const rateLimitResponse = await checkRateLimit(request, env);
if (rateLimitResponse) return rateLimitResponse;

// Line 374: CSV import endpoint
const rateLimitResponse = await checkRateLimit(request, env);
if (rateLimitResponse) return rateLimitResponse;

// Line 408: Single image scan endpoint
const rateLimitResponse = await checkRateLimit(request, env);
if (rateLimitResponse) return rateLimitResponse;

// Line 70: Token refresh endpoint
const rateLimitResponse = await checkRateLimit(request, env);
if (rateLimitResponse) return rateLimitResponse;
```

### Cost Impact
- **Paid KV plan:** ~100 writes/min peak = $0.20/month (negligible)
- **Fail-open fallback:** If rate limiter errors, allows request (conservative)

---

## 4. BATCH ENRICHMENT HANDLER (`src/handlers/batch-enrichment.ts`)

### Handler Location & Function Signature
```typescript
// File: src/handlers/batch-enrichment.ts (248 lines)
export async function handleBatchEnrichment(request, env, ctx): Promise<Response>
```

### Request/Response Contract
```javascript
// REQUEST (POST /api/enrichment/batch)
{
  "books": [
    { "title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "isbn": "9780439708180" },
    { "title": "1984", "author": "George Orwell" }
  ],
  "jobId": "job-uuid-1234"
}

// RESPONSE (202 Accepted)
{
  "success": true,
  "processedCount": 0,
  "totalCount": 2,
  "token": "auth-uuid-5678"
}
```

### Processing Flow
```
1. Request Validation (lines 32-118)
   ├── Check books array exists and is array
   ├── Check jobId exists
   ├── DoS protection: 0 < length ≤ 100
   ├── Per-book validation:
   │   ├── Title required, ≤500 chars
   │   ├── Author optional, ≤300 chars
   │   └── ISBN optional, ≤17 chars
   └── Trim whitespace
   
2. WebSocket Setup (lines 120-132)
   ├── Get Durable Object stub: env.PROGRESS_WEBSOCKET_DO.idFromName(jobId)
   ├── Generate auth token: crypto.randomUUID()
   ├── Store token in DO: doStub.setAuthToken(authToken)
   └── Initialize job state: doStub.initializeJobState('batch_enrichment', books.length)
   
3. Background Processing (line 135)
   └── ctx.waitUntil(processBatchEnrichment(...))
   
4. Immediate Response (lines 145-152)
   └── 202 Accepted with:
       ├── success: true
       ├── processedCount: 0
       ├── totalCount: books.length
       └── token: authToken (for WebSocket auth)
```

### Background Processing Function
```javascript
async function processBatchEnrichment(books, doStub, env, jobId) {
  // Uses enrichBooksParallel() with 10 concurrent requests
  const enrichedBooks = await enrichBooksParallel(
    books,
    async (book) => enrichSingleBook(book, env),
    async (completed, total, title, hasError) => {
      // Progress callback
      await doStub.updateProgressV2('batch_enrichment', {
        progress: completed / total,
        status: `Enriching (${completed}/${total}): ${title}`,
        processedCount: completed,
        currentItem: title
      });
    },
    10  // concurrency
  );
  
  // Complete
  await doStub.completeV2('batch_enrichment', {
    totalProcessed: enrichedBooks.length,
    successCount: ...,
    failureCount: ...,
    duration: Date.now() - startTime,
    enrichedBooks: enrichedBooks
  });
}
```

### Key Features
- **DoS Protection:** Max 100 books per batch (prevents large batch attacks)
- **Parallel Processing:** 10 concurrent enrichments (60% faster than sequential)
- **Progress Updates:** Sent via DO WebSocket after each book
- **Partial Success:** Continues on individual book failures
- **Non-blocking:** Entire enrichment happens in background via `ctx.waitUntil()`

### Integration with Other Services
- **Enrichment:** `enrichSingleBook()` from `src/services/enrichment.ts`
- **Parallel:** `enrichBooksParallel()` from `src/services/parallel-enrichment.js`
- **Progress:** Durable Object stub at `env.PROGRESS_WEBSOCKET_DO`
- **Cache:** External APIs handle their own caching

---

## 5. DURABLE OBJECTS CONFIGURATION & USAGE

### Class Definition
**File:** `src/durable-objects/progress-socket.js` (650+ lines)

**Class:** `ProgressWebSocketDO extends DurableObject`

### Configuration in wrangler.toml (lines 109-117)
```toml
# SINGLE binding, NO service bindings
[[durable_objects.bindings]]
name = "PROGRESS_WEBSOCKET_DO"
class_name = "ProgressWebSocketDO"

# Migrations
[[migrations]]
tag = "v1"
new_classes = ["ProgressWebSocketDO"]
```

### Core Methods (RPC interface)

#### WebSocket Connection Handling
```javascript
async fetch(request) {
  // Lines 41-206
  // WebSocket upgrade validation
  // Token authentication (from storage)
  // WebSocketPair creation
  // Message event handlers (ready, message, close, error)
  // Ready promise mechanism for race condition prevention
}
```

#### Authentication Management
```javascript
async setAuthToken(token) {
  // Lines 215-221
  // Store token in Durable Storage
  // Expire after 2 hours
}

async refreshAuthToken(oldToken) {
  // Lines 233-286
  // Validate old token
  // Enforce 30-minute refresh window
  // Generate new token, extend expiration by 2 hours
  // Prevent concurrent refresh race conditions
}
```

#### Job State Persistence
```javascript
async initializeJobState(pipeline, totalCount) {
  // Lines 300-319
  // Store job state in Durable Storage
  // Track: pipeline, totalCount, processedCount, status, startTime
}

async updateJobState(updates) {
  // Lines 331-...
  // Throttle writes based on pipeline type
  // batch_enrichment: 5 updates per 10 seconds
  // csv_import: 20 updates per 30 seconds
  // ai_scan: 1 update per 60 seconds
}

async completeJobState() / async failJobState() {
  // Mark job as complete/failed
  // Schedule cleanup alarm
}
```

#### Progress Update Methods (v2 API)
```javascript
async updateProgressV2(pipeline, payload) {
  // Send progress message to WebSocket
  // Message format: { type: 'progress', pipeline, payload, timestamp }
}

async completeV2(pipeline, results) {
  // Send completion message to WebSocket
  // Message format: { type: 'complete', pipeline, results, timestamp }
}

async sendError(pipeline, error) {
  // Send error message to WebSocket
  // Message format: { type: 'error', pipeline, error, timestamp }
}
```

### Message Flow Example
```
iOS Client                          Worker                    Durable Object
     |                                 |                             |
     |--- POST /api/enrichment/batch --|                             |
     |                                 |--- setAuthToken(token) -----|
     |                                 |                             |
     |<-- 202 Accepted + token --------|                             |
     |                                 |                             |
     |--- GET /ws/progress?jobId={id}&token={token} -------|         |
     |                                 |                   |         |
     |                                 |--- fetch() -------|         |
     |                                 |                   |         |
     |                                 |<-- WebSocket Pair ---------|
     |<-- WebSocket Upgrade -----------|                   |         |
     |                                 |                   |         |
     |--- JSON { type: 'ready' } ------|--- forward msg ---|---------|
     |                                 |                   |         |
     |<-- JSON { type: 'ready_ack' } --|<-- send() --------|---------|
     |                                 |                   |         |
     |                                 |--- ctx.waitUntil(enrichment) ---|
     |                                 |                   |         |
     |                                 |--- processBatchEnrichment() ---|
     |                                 |     doStub.updateProgressV2() --|
     |<-- { progress: 0.5 } ----------|                   |<-----------|
     |                                 |                   |         |
     |<-- { progress: 1.0, complete } |                   |<-----------|
     |                                 |                   |         |
```

### Storage & Cost
- **Data:** Durable Storage (minimal - only job state, auth tokens)
- **Cost:** ~$0.15/100M requests (for State Transition API calls)
- **Retention:** Auto-cleanup after 24 hours (scheduled alarm)
- **Concurrency:** One instance per jobId (no locking issues)

---

## 6. KV CACHE SETUP & CONFIGURATION

### KV Namespace Bindings (wrangler.toml, lines 46-56)
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "b9cade63b6db48fd80c109a013f38fdb"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "b9cade63b6db48fd80c109a013f38fdb"

# Note: Both bindings point to SAME namespace (merged from multiple workers)
# SCAN_JOBS namespace (5d4b89403bbb4be1949b1ee30df5353e) intentionally excluded
# Migrating to WebSocket-only (no polling)
```

### KV Cache Service (`src/services/kv-cache.js`)

#### TTL Strategy
```javascript
const ttls = {
  title: 7 * 24 * 60 * 60,         // 7 days (was 24h)
  isbn: 365 * 24 * 60 * 60,        // 365 days (was 30d)
  author: 7 * 24 * 60 * 60,        // 7 days (unchanged)
  enrichment: 180 * 24 * 60 * 60,  // 180 days (was 90d)
  cover: 365 * 24 * 60 * 60        // 365 days
};
```

#### Key Generation Strategy
**File:** `src/utils/cache-keys.js`

Convention: `{type}:{provider}:{query}:{maxResults}`
- Example: `isbn:google-books:9780439708180:1`

#### Quality-Based TTL Adjustment
```javascript
assessDataQuality(data) {
  // Scoring:
  // - Has ISBN: +0.4
  // - Has cover image: +0.4
  // - Has description (>100 chars): +0.2
  // Returns 0.0-1.0 score
}
```

### Unified Cache Service (`src/services/unified-cache.js`)

#### Three-Tier Caching Strategy
```
Tier 1: Edge Cache (caches.default)
  ├─ Speed: 5-10ms
  ├─ Hit rate: 80%
  ├─ TTL: 1 hour fresh, 24 hours stale-while-revalidate
  └─ Backed by: Cloudflare CDN

Tier 2: KV Cache (extended TTL)
  ├─ Speed: 30-50ms
  ├─ Hit rate: 15%
  ├─ TTL: 7-365 days (see above)
  └─ Backed by: Cloudflare Workers KV

Tier 3: Cold Storage (R2)
  ├─ Speed: 300-500ms (async rehydration)
  ├─ Hit rate: 4%
  ├─ Cost: ~$0.015/GB/month
  └─ Backed by: R2 bucket rehydration

External APIs (miss)
  ├─ Speed: 300-500ms
  ├─ Hit rate: 1%
  └─ Providers: Google Books, OpenLibrary, ISBNdb
```

#### Cache Key Management
```javascript
// Request flow:
1. Edge Cache check (if fresh, return immediately)
2. KV Cache check (if hit, populate edge for next request)
3. Cold Storage check (if indexed, trigger async rehydration)
4. External API call (populate all tiers)
```

---

## 7. BUILD & DEPLOYMENT CONFIGURATION

### wrangler.toml (185 lines)
**Location:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/wrangler.toml`

#### Basic Configuration
```toml
name = "api-worker"
main = "src/index.js"
compatibility_date = "2024-10-01"
workers_dev = true
compatibility_flags = ["nodejs_compat"]
```

#### Custom Domain Routes
```toml
routes = [
  { pattern = "api.oooefam.net/*", zone_name = "oooefam.net" },
  { pattern = "harvest.oooefam.net/*", zone_name = "oooefam.net" }
]
```

#### Environment Variables
```toml
[vars]
CACHE_HOT_TTL = "7200"              # 2 hours
CACHE_COLD_TTL = "1209600"          # 14 days
MAX_RESULTS_DEFAULT = "40"
RATE_LIMIT_MS = "50"
CONCURRENCY_LIMIT = "10"
AGGRESSIVE_CACHING = "true"

LOG_LEVEL = "DEBUG"
ENABLE_PERFORMANCE_LOGGING = "true"
ENABLE_CACHE_ANALYTICS = "true"
ENABLE_PROVIDER_METRICS = "true"
ENABLE_RATE_LIMIT_TRACKING = "true"
STRUCTURED_LOGGING = "true"

OPENLIBRARY_BASE_URL = "https://openlibrary.org"
USER_AGENT = "BooksTracker/1.0 (nerd@ooheynerds.com)"

AI_PROVIDER = "gemini"
MAX_IMAGE_SIZE_MB = "10"
REQUEST_TIMEOUT_MS = "50000"
CONFIDENCE_THRESHOLD = "0.7"
MAX_SCAN_FILE_SIZE = "10485760"

ENABLE_UNIFIED_ENVELOPE = "false"  # Feature flag (default: legacy)
```

#### Secrets (via `wrangler secret put`)
```
GOOGLE_BOOKS_API_KEY
ISBNDB_API_KEY
GEMINI_API_KEY
CF_ACCOUNT_ID
CF_API_TOKEN
HARVEST_SECRET
```

#### Resource Limits
```toml
[limits]
cpu_ms = 180000    # 3 minutes (increased from 30s for large batches)
memory_mb = 256
```

#### R2 Buckets
```toml
[[r2_buckets]]
binding = "API_CACHE_COLD"
bucket_name = "personal-library-data"

[[r2_buckets]]
binding = "LIBRARY_DATA"
bucket_name = "personal-library-data"

[[r2_buckets]]
binding = "BOOKSHELF_IMAGES"
bucket_name = "bookshelf-images"

[[r2_buckets]]
binding = "BOOK_COVERS"
bucket_name = "bookstrack-covers"
```

#### Workers AI
```toml
[ai]
binding = "AI"
```

#### Durable Objects
```toml
[[durable_objects.bindings]]
name = "PROGRESS_WEBSOCKET_DO"
class_name = "ProgressWebSocketDO"

[[migrations]]
tag = "v1"
new_classes = ["ProgressWebSocketDO"]
```

#### Analytics Engine
```toml
[[analytics_engine_datasets]]
binding = "PERFORMANCE_ANALYTICS"
dataset = "books_api_performance"

[[analytics_engine_datasets]]
binding = "CACHE_ANALYTICS"
dataset = "books_api_cache_metrics"

[[analytics_engine_datasets]]
binding = "PROVIDER_ANALYTICS"
dataset = "books_api_provider_performance"

[[analytics_engine_datasets]]
binding = "AI_ANALYTICS"
dataset = "bookshelf_ai_performance"
```

#### Queues
```toml
[[queues.producers]]
binding = "AUTHOR_WARMING_QUEUE"
queue = "author-warming-queue"

[[queues.consumers]]
queue = "author-warming-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "author-warming-dlq"
max_concurrency = 5
```

#### Scheduled Tasks
```toml
[triggers]
crons = [
  "0 2 * * *",        # Daily archival at 2:00 AM UTC
  "*/15 * * * *",     # Alert checks every 15 minutes
  "0 3 * * *"         # Daily ISBNdb harvest at 3:00 AM UTC
]
```

#### Staging Environment
```toml
[env.staging]
name = "books-api-proxy-staging"
workers_dev = true

[env.staging.vars]
ENABLE_UNIFIED_ENVELOPE = "true"  # Enable for testing
LOG_LEVEL = "DEBUG"
```

### package.json
```json
{
  "name": "api-worker",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^4.0.8",
    "@vitest/ui": "^4.0.8",
    "typescript": "^5.9.3",
    "vitest": "^4.0.8",
    "wrangler": "^4.48.0"
  }
}
```

### Deployment Scripts
**Location:** `scripts/` directory

Key scripts:
- `wrangler deploy` → Deploy to production
- `wrangler dev` → Local development
- `wrangler tail` → Stream production logs
- `npm test` → Run test suite

---

## 8. TESTING PATTERNS & INFRASTRUCTURE

### Test Directory Structure
```
tests/
├── unit/                               # Unit tests
│   ├── normalizers.test.js
│   ├── cache.test.js
│   ├── validators.test.js
│   └── auth.test.js
│
├── integration/                        # Integration tests
│   ├── batch-enrichment.test.ts       # POST /api/enrichment/batch
│   ├── v1-search.test.ts              # GET /v1/search/*
│   ├── websocket-do.test.js           # WebSocket Durable Object
│   └── batch-processing.test.js       # End-to-end batch flows
│
├── normalizers/                        # Provider normalization tests
│   ├── isbndb.test.ts
│   ├── google-books.test.ts
│   ├── openlibrary.test.ts
│   └── contract-compliance.test.ts
│
├── handlers/                           # Handler-specific tests
│   └── ... (multiple handler tests)
│
├── setup.js                            # Global test setup
├── mocks/                              # Mock factories
└── assets/                             # Test data files
```

### Test Framework
**Framework:** Vitest with TypeScript support

```javascript
// setup.js global utilities
export function createMockKV() {
  // Mock KV namespace with get/put/delete
  // Supports { type: 'json' } parameter
}

export function createMockEnv() {
  // Create fake env with mocked bindings
  // CACHE, KV_CACHE, PROGRESS_WEBSOCKET_DO, etc.
}

export function createMockRequest() {
  // Create fake Request object
  // Supports: headers, url, method, json()
}
```

### Test Patterns
**Integration tests check:**
- Request validation
- Response contract compliance
- HTTP status codes (202 Accepted, 400 Bad Request, 429 Rate Limited, etc.)
- Error handling and messages
- WebSocket upgrade response

**Example from batch-enrichment.test.ts:**
```javascript
describe('POST /api/enrichment/batch (integration)', () => {
  it('should accept valid books and return 202 Accepted', async () => {
    const response = await fetch(`${WORKER_URL}/api/enrichment/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        books: [{ title: 'Test Book', author: 'Test Author' }],
        jobId: 'test-job-123'
      })
    });
    
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
  });
});
```

### Running Tests Locally
```bash
# Start worker
wrangler dev --port 8787

# In another terminal
npm test                   # Run all tests
npm run test:watch        # Watch mode
npm run test:ui           # UI dashboard
npm run test:coverage     # Coverage report
```

---

## 9. KEY SERVICES & UTILITY FUNCTIONS

### Enrichment Service (`src/services/enrichment.ts`)
```typescript
// Core enrichment with multi-provider fallback
export async function enrichSingleBook(
  book: { title, author, isbn },
  env: WorkerEnv
): Promise<SingleEnrichmentResult | null> {
  // 1. Try Google Books API
  // 2. Fallback to OpenLibrary
  // 3. Return: { work: WorkDTO, edition: EditionDTO, authors: AuthorDTO[] }
}

// Multiple results (for search queries)
export async function enrichMultipleBooks(
  results: Object[],
  env: WorkerEnv
): Promise<EnrichedResult[]>
```

### Parallel Enrichment (`src/services/parallel-enrichment.js`)
```javascript
export async function enrichBooksParallel(
  books,
  enrichFn,          // Async function to enrich single book
  progressCallback,  // Called after each: (completed, total, title, hasError)
  concurrency = 10   // Max concurrent enrichments
): Promise<EnrichedBook[]>

// Benefits:
// - 60% faster than sequential for 100+ books
// - Continues on individual failures
// - Progress updates after each book
```

### Cache Services
```javascript
// Edge Cache (5-10ms)
EdgeCacheService → caches.default

// KV Cache (30-50ms)
KVCacheService → env.KV_CACHE with smart TTLs

// Unified Cache (intelligent routing)
UnifiedCacheService → Edge → KV → Cold → API
```

### External APIs (`src/services/external-apis.js`)
```javascript
// Google Books
searchGoogleBooks(query, { maxResults }, env)
searchGoogleBooksByISBN(isbn, env)

// OpenLibrary
searchOpenLibrary(query, { maxResults }, env)
getOpenLibraryAuthorWorks(author, env)

// ISBNdb
searchISBNdb(title, author, env)
getISBNdbEditionsForWork(title, author, env)
getISBNdbBookByISBN(isbn, env)
```

### AI Services
```javascript
// Gemini-powered CSV import
handleCSVImport(request, env, ctx)

// Bookshelf AI scanning
aiScanner.processBookshelfScan(jobId, imageData, request, env, doStub, ctx)
```

---

## 10. CORS & SECURITY MIDDLEWARE

### CORS Configuration (`src/middleware/cors.js`)
```javascript
const ALLOWED_ORIGINS = [
  'https://bookstrack.app',
  'https://www.bookstrack.app',
  'http://localhost:3000',
  'capacitor://localhost',    // iOS Capacitor
  'ionic://localhost'         // iOS Ionic
];

export function getCorsHeaders(request) {
  // Whitelist-based origin validation
  // Returns: Access-Control-Allow-Origin header
}
```

### Rate Limiting Middleware
```javascript
// File: src/middleware/rate-limiter.js
// 10 requests per 60-second window per IP
// Protects: /api/enrichment/*, /api/scan-bookshelf/*, /api/import/csv-gemini

// ISSUE: Race condition in read-modify-write cycle (documented above)
```

### Size Validation Middleware
```javascript
// File: src/middleware/size-validator.js
validateResourceSize(request, maxMB, resourceType)

// Usage:
// - Images: 5MB max
// - CSV files: 10MB max
```

---

## 11. SUMMARY: FILES FOR SPRINT 1 PLANNING

### Critical Files to Understand
1. **Main Router:** `/src/index.js` (1,146 lines)
   - Route structure and flow
   - Rate limiting integration points
   - Durable Object interactions

2. **Batch Enrichment:** `/src/handlers/batch-enrichment.ts` (248 lines)
   - Request/response contracts
   - Background processing pattern
   - Progress updates via DO

3. **Rate Limiter:** `/src/middleware/rate-limiter.js` (108 lines)
   - Current implementation (has race condition)
   - KV storage pattern
   - Integration points

4. **Durable Object:** `/src/durable-objects/progress-socket.js` (650+ lines)
   - WebSocket management
   - State persistence
   - Auth token handling

5. **KV Cache Services:**
   - `/src/services/kv-cache.js` - KV namespace operations
   - `/src/services/unified-cache.js` - Three-tier cache strategy
   - `/src/utils/cache-keys.js` - Key naming convention

6. **Configuration:**
   - `wrangler.toml` (185 lines) - Environment & bindings
   - `package.json` - Dependencies & scripts

7. **Testing Setup:**
   - `/tests/setup.js` - Mock utilities
   - `/tests/integration/batch-enrichment.test.ts` - Example integration test
   - 46+ test files for reference

### Test Coverage Status
- Unit tests: ✓ 15+ files
- Integration tests: ✓ 10+ files
- Handler tests: ✓ Various
- **Total:** 193 tests (Phase 2 complete), 21+ tests in Phase 3

### Deployment Commands
```bash
# Local development
npm run dev                    # Start wrangler dev

# Testing
npm test                       # Run all tests
npm run test:coverage         # Generate coverage report

# Deployment
npm run deploy                # Deploy to production
npm run tail                  # Stream production logs
```

---

## SPRINT 1 IMPLEMENTATION READINESS

✓ **Project structure:** Well organized with clear separation of concerns
✓ **Router pattern:** Single entry point, no RPC service bindings
✓ **Rate limiting:** Existing middleware, needs race condition fix
✓ **Batch enrichment:** Fully implemented, can be replicated for /v1
✓ **Durable Objects:** Configured and used for WebSocket state
✓ **KV cache:** Three-tier strategy implemented
✓ **Testing:** Comprehensive test infrastructure with Vitest
✓ **Deployment:** Wrangler configured with production domain routing

⚠️ **Known Issues:**
- Rate limiter has race condition (non-atomic read-modify-write)
- Some handlers use TypeScript, some use JavaScript (inconsistent)
- No single tsconfig.json (may cause TypeScript issues)

