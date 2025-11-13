# API Documentation

**BooksTrack Backend API v1.0.0**

Complete reference for canonical data contracts, API endpoints, and integration patterns.

## Quick Links

- **[Canonical API Contracts](#canonical-data-contracts)** - TypeScript-first API contracts (v1.0.0)
- **[Canonical Contracts Workflow](workflows/canonical-contracts-workflow.md)** - Visual Mermaid diagram
- **[Implementation Plan](plans/2025-11-11-canonical-api-contract-implementation.md)** - Complete implementation details
- **[Cover Harvest System](COVER_HARVEST_SYSTEM.md)** - ISBNdb cover caching (5000 req/day)

## Canonical Data Contracts

### Overview

TypeScript-first API contracts ensure consistency across all data providers. All `/v1/*` endpoints return structured canonical responses.

**Core DTOs:**
- `WorkDTO` - Abstract creative work (mirrors SwiftData Work model)
- `EditionDTO` - Physical/digital manifestation (multi-ISBN support)
- `AuthorDTO` - Creator with diversity analytics

**Response Envelope:** All `/v1/*` endpoints return discriminated union:
```typescript
{
  "success": true | false,
  "data": { works: WorkDTO[], authors: AuthorDTO[] } | undefined,
  "error": { message: string, code: ApiErrorCode, details?: any } | undefined,
  "meta": { timestamp: string, processingTime: number, provider: string, cached: boolean }
}
```

### V1 Endpoints (Canonical)

**Search Endpoints:**
- `GET /v1/search/title?q={query}` - Title search (canonical response)
- `GET /v1/search/isbn?isbn={isbn}` - ISBN lookup with validation (ISBN-10/ISBN-13)
- `GET /v1/search/advanced?title={title}&author={author}` - Flexible search (title, author, or both)

**Enrichment Endpoints:**
- `POST /v1/enrichment/batch` - Batch enrichment with WebSocket progress

**Error Codes:**
- `INVALID_QUERY` - Empty/invalid search parameters
- `INVALID_ISBN` - Malformed ISBN format
- `PROVIDER_ERROR` - Upstream API failure (Google Books, etc.)
- `INTERNAL_ERROR` - Unexpected server error

### Provenance Tracking

Every DTO includes:
- `primaryProvider` - Which API contributed the data ("google-books", "openlibrary", etc.)
- `contributors` - Array of all providers that enriched the data
- `synthetic` - Flag for Works inferred from Edition data (enables iOS deduplication)

### Implementation Status

- ✅ TypeScript types defined (`enums.ts`, `canonical.ts`, `responses.ts`)
- ✅ Google Books normalizers (`normalizeGoogleBooksToWork`, `normalizeGoogleBooksToEdition`)
- ✅ Backend genre normalization service (`genre-normalizer.ts`)
- ✅ All 3 `/v1/*` endpoints deployed with genre normalization active
- ✅ Backend enrichment services migrated to canonical format
- ✅ AI scanner WebSocket messages use canonical DTOs
- ✅ iOS Swift Codable DTOs (`WorkDTO`, `EditionDTO`, `AuthorDTO`)
- ✅ iOS search services migrated to `/v1/*` endpoints with DTOMapper
- ✅ iOS enrichment service migrated to canonical parsing
- ✅ Comprehensive test coverage (CanonicalAPIResponseTests)
- ✅ iOS DTOMapper fully integrated (deduplication active, genre normalization flowing)
- ⏳ Legacy endpoint deprecation (deferred 2-4 weeks)

## Legacy Endpoints (Still Active)

**Search:**
- `GET /search/title?q={query}` - Book search (6h cache)
- `GET /search/isbn?isbn={isbn}` - ISBN lookup (7-day cache)
- `GET /search/advanced?title={title}&author={author}` - Multi-field search (6h cache, supports POST for compatibility)

**Enrichment:**
- `POST /api/enrichment/start` - **DEPRECATED** Use `/v1/enrichment/batch` instead

**AI Scanning:**
- `POST /api/scan-bookshelf?jobId={uuid}` - AI bookshelf scan with Gemini 2.0 Flash
- `POST /api/scan-bookshelf/batch` - Batch scan (max 5 photos, parallel upload → sequential processing)

**CSV Import:**
- `POST /api/import/csv-gemini` - AI-powered CSV import with Gemini parsing (Beta)

**WebSocket:**
- `GET /ws/progress?jobId={uuid}` - WebSocket progress (unified for ALL jobs)

## AI Provider

**Gemini 2.0 Flash:**
- Google's production vision model with 2M token context window
- Processing time: 25-40s (includes AI inference + enrichment)
- Image size: Handles 4-5MB images natively (no resizing needed)
- Accuracy: High (0.7-0.95 confidence scores)
- Optimized for ISBN detection and small text on book spines
- Token tracking: All responses include token usage metrics (Nov 2025+)

**Best Practices (Nov 2025 Audit):**
- ✅ System instructions separated from dynamic content
- ✅ Image-first ordering in prompts
- ✅ Temperature optimization (0.2 CSV, 0.4 bookshelf)
- ✅ JSON output format via `responseMimeType`
- ✅ Token usage logging and metadata
- ✅ Stop sequences for cleaner termination

## Rate Limiting

All API endpoints are protected by a token bucket rate limiter to prevent abuse and control costs.

**Limits:**
- **10 requests per minute** per IP address
- Refill rate: 1 token every 6 seconds
- Window: 60 seconds (sliding window)

**Response Headers:**
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699564920
Retry-After: 42
```

**Rate Limit Exceeded Response (429):**
```json
{
  "error": "Rate limit exceeded. Please try again in 42 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 42,
    "clientIP": "203.0.11...",
    "requestsUsed": 10,
    "requestsLimit": 10
  }
}
```

**Best Practices:**
- Monitor `X-RateLimit-Remaining` header
- Implement exponential backoff on 429 responses
- Use `Retry-After` header value for next retry
- Cache responses client-side to reduce API calls
- Batch enrichment requests when possible

**Source:** `src/middleware/rate-limiter.js`

## Testing

### Health Check

```bash
curl https://api.oooefam.net/health
```

### Search Endpoints

```bash
# Title search (canonical)
curl "https://api.oooefam.net/v1/search/title?q=hamlet"

# ISBN search (canonical)
curl "https://api.oooefam.net/v1/search/isbn?isbn=9780743273565"

# Advanced search (canonical)
curl "https://api.oooefam.net/v1/search/advanced?title=1984&author=Orwell"
```

### WebSocket Flow

1. Connect to WebSocket:
```bash
wscat -c "wss://api.oooefam.net/ws/progress?jobId=test-123"
```

2. Trigger background job:
```bash
curl -X POST https://api.oooefam.net/v1/enrichment/batch \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test-123","workIds":["9780439708180"]}'
```

### WebSocket Message Types

**Endpoint:** `GET /ws/progress?jobId={uuid}&token={auth_token}`

All WebSocket messages follow a unified schema (v1.0.0) with discriminated unions for type safety:

```typescript
interface WebSocketMessage {
  type: MessageType;        // "job_started" | "job_progress" | "job_complete" | "error" | "ping" | "pong"
  jobId: string;            // Client correlation ID
  pipeline: PipelineType;   // "batch_enrichment" | "csv_import" | "ai_scan"
  timestamp: number;        // Server time (ms since epoch)
  version: string;          // Schema version ("1.0.0")
  payload: MessagePayload;  // Type-specific data
}
```

#### Message Types

**1. Job Started**
```json
{
  "type": "job_started",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline": "batch_enrichment",
  "timestamp": 1699564800000,
  "version": "1.0.0",
  "payload": {
    "type": "job_started",
    "totalCount": 20,
    "estimatedDuration": 120
  }
}
```

**2. Job Progress**
```json
{
  "type": "job_progress",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline": "batch_enrichment",
  "timestamp": 1699564830000,
  "version": "1.0.0",
  "payload": {
    "type": "job_progress",
    "progress": 0.45,
    "status": "Processing book 9 of 20",
    "processedCount": 9,
    "currentItem": "978-0-439-70818-0"
  }
}
```

**3. Job Complete**
```json
{
  "type": "job_complete",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline": "batch_enrichment",
  "timestamp": 1699564920000,
  "version": "1.0.0",
  "payload": {
    "type": "job_complete",
    "pipeline": "batch_enrichment",
    "totalProcessed": 20,
    "successCount": 19,
    "failureCount": 1,
    "duration": 120000,
    "enrichedBooks": [ /* ... */ ]
  }
}
```

**4. Error**
```json
{
  "type": "error",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline": "ai_scan",
  "timestamp": 1699564860000,
  "version": "1.0.0",
  "payload": {
    "type": "error",
    "code": "AI_TIMEOUT",
    "message": "Processing timed out after 180s",
    "retryable": true
  }
}
```

**Pipeline-Specific Payloads:**

- **batch_enrichment**: Returns `enrichedBooks` array with success/failure status
- **csv_import**: Returns parsed books and import errors
- **ai_scan**: Returns detected books with confidence scores and bounding boxes

**Error Codes:**
- `AI_TIMEOUT` - Gemini processing exceeded time limit
- `PROVIDER_ERROR` - Upstream API failure (Google Books, etc.)
- `INTERNAL_ERROR` - Unexpected server error
- `RATE_LIMIT_EXCEEDED` - Too many concurrent requests
- `INVALID_INPUT` - Malformed request data

**Source:** `src/types/websocket-messages.ts`

## Type Definitions

### TypeScript (Backend)

**Location:** `src/types/`

```typescript
// enums.ts
export enum DataProvider { /* ... */ }
export enum ApiErrorCode { /* ... */ }

// canonical.ts
export interface WorkDTO { /* ... */ }
export interface EditionDTO { /* ... */ }
export interface AuthorDTO { /* ... */ }

// responses.ts
export interface ApiResponse<T> { /* ... */ }
```

### Swift (iOS)

**Location:** `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/`

```swift
// WorkDTO.swift
public struct WorkDTO: Codable { /* ... */ }

// EditionDTO.swift
public struct EditionDTO: Codable { /* ... */ }

// AuthorDTO.swift
public struct AuthorDTO: Codable { /* ... */ }

// ApiResponse.swift
public struct ApiResponse<T: Codable>: Codable { /* ... */ }
```

## Contract Versioning

**Current Version:** v1.0.0 (November 2025)

**Versioning Strategy:**
- TypeScript types are the source of truth
- iOS Swift types mirror TypeScript structure
- Breaking changes require new API version (`/v2/*`)
- Non-breaking changes (additive fields) maintain backward compatibility

**Contract Changes:**
1. Update TypeScript types in `src/types/`
2. Run backend tests to ensure compatibility
3. Update iOS Swift DTOs to match
4. Update integration tests
5. Deploy backend first (backward compatible)
6. Deploy iOS app second (uses new fields)

## Integration Patterns

### iOS → Backend Flow

1. **Search Flow:**
   ```
   iOS SearchView → EnrichmentConfig.searchTitleURL
                  → Backend /v1/search/title
                  → Google Books API
                  → Normalize to WorkDTO/EditionDTO
                  → Return ApiResponse<SearchResult>
                  → iOS DTOMapper → SwiftData models
   ```

2. **Enrichment Flow:**
   ```
   iOS EnrichmentQueue → EnrichmentConfig.enrichmentStartURL
                       → Backend /v1/enrichment/batch
                       → WebSocket connection (ProgressWebSocketDO)
                       → Background job processing
                       → Real-time progress updates
                       → iOS updates UI
   ```

3. **AI Scanning Flow:**
   ```
   iOS BookshelfScannerView → EnrichmentConfig.scanBookshelfURL
                             → Backend /api/scan-bookshelf
                             → Gemini 2.0 Flash API
                             → ISBN detection + enrichment
                             → WebSocket progress updates
                             → iOS displays results
   ```

## Related Documentation

- **[MONOLITH_ARCHITECTURE.md](../MONOLITH_ARCHITECTURE.md)** - Backend architecture overview
- **[COVER_HARVEST_SYSTEM.md](COVER_HARVEST_SYSTEM.md)** - ISBNdb cover caching system
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Deployment guide
- **[iOS DTO Documentation](https://github.com/jukasdrj/books-tracker-v1/tree/main/BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs)** - Swift DTO implementations

## Support

- **Backend Repository:** https://github.com/jukasdrj/bookstrack-backend
- **iOS Repository:** https://github.com/jukasdrj/books-tracker-v1
- **Issues:** https://github.com/jukasdrj/bookstrack-backend/issues

---

**Last Updated:** November 13, 2025
**API Version:** v1.0.0
**Maintainer:** Claude Code
