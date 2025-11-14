# BooksTrack Backend - Quick Reference for Sprint 1

## File Paths (Absolute)

### Critical Files for Sprint 1
- **Main Router:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/index.js`
- **Rate Limiter:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/middleware/rate-limiter.js`
- **Batch Enrichment:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/handlers/batch-enrichment.ts`
- **Durable Object:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/durable-objects/progress-socket.js`
- **KV Cache Service:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/services/kv-cache.js`
- **Unified Cache:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/services/unified-cache.js`
- **Parallel Enrichment:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/src/services/parallel-enrichment.js`
- **Configuration:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/wrangler.toml`
- **Test Setup:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/tests/setup.js`
- **Batch Enrichment Tests:** `/Users/justingardner/Downloads/xcode/bookstrack-backend/tests/integration/batch-enrichment.test.ts`

## Key Numbers & Limits

| Limit | Value | File | Purpose |
|-------|-------|------|---------|
| Rate limit window | 60 seconds | rate-limiter.js | Time window for counting requests |
| Max requests/window | 10 requests | rate-limiter.js | Prevent abuse of expensive endpoints |
| Max batch size | 100 books | batch-enrichment.ts | DoS protection |
| Parallel concurrency | 10 concurrent | parallel-enrichment.js | API rate limit respect |
| Image max size | 5MB | index.js:412 | Memory protection |
| CSV max size | 10MB | index.js:378 | Memory protection |
| Cache TTL (title) | 7 days | kv-cache.js | Search result freshness |
| Cache TTL (ISBN) | 365 days | kv-cache.js | ISBN never changes |
| Token expiration | 2 hours | progress-socket.js:218 | WebSocket auth lifetime |
| Token refresh window | 30 minutes | progress-socket.js:259 | Prevent infinite extension |
| Durable Object cleanup | 24 hours | progress-socket.js | Auto-remove old job state |
| CPU timeout | 3 minutes | wrangler.toml:143 | Worker execution limit |
| Memory limit | 256MB | wrangler.toml:144 | Worker memory limit |

## API Response Contracts

### Batch Enrichment Response (202 Accepted)
```json
{
  "success": true,
  "processedCount": 0,
  "totalCount": 2,
  "token": "uuid-string"
}
```

### WebSocket Progress Message
```json
{
  "type": "progress",
  "pipeline": "batch_enrichment",
  "payload": {
    "progress": 0.5,
    "status": "Enriching (1/2): The Great Gatsby",
    "processedCount": 1,
    "currentItem": "The Great Gatsby"
  },
  "timestamp": 1700000000000
}
```

### WebSocket Complete Message
```json
{
  "type": "complete",
  "pipeline": "batch_enrichment",
  "results": {
    "totalProcessed": 2,
    "successCount": 2,
    "failureCount": 0,
    "duration": 5000,
    "enrichedBooks": [...]
  },
  "timestamp": 1700000005000
}
```

## Environment Variables

### Feature Flags
- `ENABLE_UNIFIED_ENVELOPE` → Controls legacy vs new response format (default: false)

### Caching
- `CACHE_HOT_TTL = "7200"` → 2 hours for edge cache
- `CACHE_COLD_TTL = "1209600"` → 14 days for cold storage

### API Configuration
- `MAX_RESULTS_DEFAULT = "40"` → Default page size
- `CONCURRENCY_LIMIT = "10"` → Max parallel enrichments
- `REQUEST_TIMEOUT_MS = "50000"` → 50 second timeout

### AI Configuration
- `AI_PROVIDER = "gemini"` → Which AI provider to use
- `MAX_IMAGE_SIZE_MB = "10"` → Max image size for scanning
- `CONFIDENCE_THRESHOLD = "0.7"` → AI confidence requirement

## Known Issues & TODOs

### CRITICAL: Rate Limiter Race Condition
**File:** `src/middleware/rate-limiter.js:32-108`
**Issue:** Non-atomic read-modify-write cycle allows bursts past limit
**Impact:** 2 concurrent requests at threshold can both pass check
**Fix:** Use KV conditional writes or increment operation (if available)

### TypeScript Inconsistency
**Files:** Mixed `.ts` and `.js` without tsconfig.json
**Impact:** May cause build/IDE issues
**Fix:** Create unified tsconfig.json for module resolution

### Legacy /search Endpoints
**File:** `src/index.js:564-758`
**Status:** Deprecated in favor of `/v1/search/` canonical endpoints
**Migration:** iOS should migrate to `/v1/search/isbn`, `/v1/search/title`

## Test Commands

```bash
# Local development
npm run dev                    # Start wrangler dev on localhost:8787

# Run tests
npm test                       # Run all tests (vitest run)
npm run test:watch            # Watch mode
npm run test:ui               # Visual dashboard
npm run test:coverage         # Generate coverage report

# Integration tests (requires worker running)
npm test integration/batch-enrichment

# Production operations
npm run deploy                # Deploy to production
npm run tail                  # Stream production logs
```

## Code Patterns to Follow

### Handler Pattern
```javascript
// src/handlers/{name}.ts
export async function handle{Name}(request, env, ctx) {
  try {
    // 1. Validate request
    // 2. Check rate limits (if expensive)
    // 3. Get Durable Object stub if needed
    // 4. Return 202 Accepted for async work
    // 5. ctx.waitUntil(backgroundWork())
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}
```

### Service Pattern
```javascript
// src/services/{name}.js
export async function {doSomething}(input, env) {
  try {
    // Business logic with caching
  } catch (error) {
    console.error('[ServiceName]', error);
    throw error;
  }
}
```

### Durable Object RPC Pattern
```javascript
// Call from handler
const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);
await doStub.setAuthToken(token);

// Define in DO class
async setAuthToken(token) {
  await this.storage.put('authToken', token);
  return { success: true };
}
```

## Cloudflare Bindings (from wrangler.toml)

| Binding | Type | Used For |
|---------|------|----------|
| `CACHE` | KV | Cache storage (merged namespace) |
| `KV_CACHE` | KV | Rate limiter, cache keys (same as CACHE) |
| `PROGRESS_WEBSOCKET_DO` | Durable Object | WebSocket state & progress |
| `GOOGLE_BOOKS_API_KEY` | Secret | Google Books API authentication |
| `ISBNDB_API_KEY` | Secret | ISBNdb API authentication |
| `GEMINI_API_KEY` | Secret | Google Gemini AI authentication |
| `API_CACHE_COLD` | R2 | Cold storage for old cache entries |
| `LIBRARY_DATA` | R2 | User library backups |
| `BOOKSHELF_IMAGES` | R2 | Bookshelf photo storage |
| `BOOK_COVERS` | R2 | Cached book cover images |
| `AI` | Workers AI | On-device AI models |
| `AUTHOR_WARMING_QUEUE` | Queue | Cache warming queue |

## Production Domains

- **API:** `api.oooefam.net/*` → Route to api-worker
- **Harvest Dashboard:** `harvest.oooefam.net/` → Route to harvest-dashboard

## Key Metrics

- **Rate Limiter Cost:** ~$0.20/month (100 writes/min peak)
- **KV Cost:** ~$0 (free tier: 10M reads/day)
- **Durable Object Cost:** ~$0.15/100M state transitions
- **Total Cost:** <$1/month at current scale

## Sprint 1 Checklist

- [ ] Fix rate limiter race condition
- [ ] Implement atomic rate limit checks
- [ ] Add /v1/enrichment/batch endpoint  
- [ ] Create v1 response adapter
- [ ] Add v1 integration tests
- [ ] Update router rate limit calls
- [ ] Document v1 API contract
- [ ] Test with iOS client
- [ ] Deploy to staging
- [ ] Deploy to production
