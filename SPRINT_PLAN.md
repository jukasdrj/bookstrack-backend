# BooksTrack Backend - 4 Sprint Plan
## Nov 13 - Jan 8, 2026 (8 weeks)

**Planning Date:** November 13, 2025
**Current Status:** Ready to begin Sprint 1
**Total Issues:** 20 issues consolidated into 5 sprint-based PRs
**Team Capacity:** 1 developer (full-time)
**Hard Deadline:** December 11, 2025 (iOS migration deadline)

---

## Executive Summary

Based on consensus from multiple planning models, the **Balanced Approach** is optimal:
- **Sprint 1:** Critical security fix (#13) + iOS feature deployment (#4)
- **Sprint 2:** Test infrastructure setup (#10) + Phase 1 tests (#6) + legacy removal (#5)
- **Sprint 3:** Phase 2-3 tests (#7-8) + start refactoring (#14-16)
- **Sprint 4:** Phase 4 tests (#9) + complete refactoring (#17-20) + documentation (#2-3)

**Success Metrics:**
- ✅ Security race condition fixed by end of Sprint 1
- ✅ iOS canonical endpoint deployed by end of Sprint 1 (meets Dec 11 deadline)
- ✅ Test infrastructure ready by end of Sprint 2 (unblocks test phases)
- ✅ 240+ tests implemented across Sprints 2-4 (>75% coverage)
- ✅ All refactoring consolidated into 5 sprint-based PRs

---

# SPRINT 1: Critical Security + iOS Migration
**Duration:** Week 1-2 (Nov 13-27, 2025)
**Theme:** Unblock Features & Fix Security
**Key Deadline:** iOS migration deadline Jan 15, 2025

## Goals
1. Fix critical race condition in rate limiter (#13)
2. Deploy canonical `/v1/enrichment/batch` endpoint (#4)
3. Prepare legacy endpoint deprecation (#5)

## Issues (3 total)

### 🔴 #13: CRITICAL Rate Limiter Race Condition
**Type:** Bug / Security
**Effort:** 3-4 days
**Priority:** CRITICAL (DoS risk)
**Assignee:** [Self]

**Problem:**
KV-based rate limiter has race condition between read and write operations. Concurrent requests can all read the same counter, then all increment and write, bypassing the limit. Allows attackers to make significantly more than 10 requests/minute per IP.

**Solution Options:**
1. **Durable Objects (Recommended)** - Atomic rate limit counters
2. **KV with exponential backoff** - Retry logic with eventual consistency
3. **Cloudflare Rate Limiting API** - Native support (if available)

**Acceptance Criteria:**
- [ ] Rate limit atomic operation implemented (no race condition window)
- [ ] 100+ concurrent requests to same endpoint don't exceed limit
- [ ] Unit test covers concurrent request scenario
- [ ] Performance acceptable (< 50ms added latency)
- [ ] All tests pass

**Implementation Checklist:**
- [ ] Review `src/middleware/rate-limiter.js` lines 39-97
- [ ] Implement chosen solution (recommend Durable Objects)
- [ ] Add concurrency test to test suite
- [ ] Deploy to staging and verify
- [ ] Monitor production metrics post-deployment

**Status:** Not started → In Progress → Ready for PR

---

### ✨ #4: Deploy Canonical /v1/enrichment/batch Endpoint
**Type:** Feature / iOS Migration
**Effort:** 4-5 days
**Priority:** CRITICAL (iOS waiting, Dec 11 deadline)
**Assignee:** [Self]
**Depends On:** None (can be done in parallel with #13)

**Problem:**
iOS app has implemented feature flag for migration but backend hasn't deployed the canonical endpoint yet. iOS is currently using legacy `/api/enrichment/batch` and waiting for `/v1/enrichment/batch` to be available.

**Requirements:**
1. Create `/v1/enrichment/batch` endpoint with identical behavior to `/api/enrichment/batch`
2. Return ResponseEnvelope format (success, data, error, meta)
3. Same WebSocket auth token format for `/ws/progress?jobId={uuid}`
4. Apply same rate limiting (10 req/min)
5. Use same CORS middleware

**Response Format:**
```typescript
{
  success: boolean
  data: {
    success: boolean
    processedCount: number
    totalCount: number
    token: string  // WebSocket auth token
  } | null
  error: ApiError | null
  meta: ResponseMetadata
}
```

**Acceptance Criteria:**
- [ ] POST `/v1/enrichment/batch` with empty books array → 400 with `E_EMPTY_BATCH`
- [ ] POST `/v1/enrichment/batch` with 5 books → 202 with token
- [ ] POST `/v1/enrichment/batch` with 20 books → 202, WebSocket receives progress
- [ ] Response matches TypeScript canonical contracts (`src/types/canonical.ts`)
- [ ] Health endpoint lists `/v1/enrichment/batch`
- [ ] Rate limiting enforced (10 req/min)
- [ ] CORS headers correct for iOS app

**Implementation Checklist:**
- [ ] Review legacy `/api/enrichment/batch` handler in `src/index.js`
- [ ] Create new route in `src/index.js` or route module (prepare for #17)
- [ ] Reuse existing enrichment logic (no behavior change)
- [ ] Test with canary curl: `POST https://api.oooefam.net/v1/enrichment/batch`
- [ ] Verify WebSocket integration works
- [ ] Deploy to production

**iOS Coordination:**
- **iOS Repo:** jukasdrj/books-tracker-v1 (#425)
- **iOS Feature Flag:** `feature.useCanonicalEnrichment` (default: OFF)
- **iOS Rollout Plan:** 10% → 50% → 100% over 3 days after backend deployment
- **iOS Migration Deadline:** December 11, 2025

**Status:** Not started → In Progress → Ready for PR

---

### 📋 #5: Remove Deprecated /api/enrichment/batch Endpoint
**Type:** Refactor / Cleanup
**Effort:** 2-3 days (starts Sprint 1, completes Sprint 2)
**Priority:** HIGH (iOS migration blocker)
**Assignee:** [Self]
**Depends On:** #4 (must deploy `/v1` first)
**Blocks:** None

**Timeline:**
- **Nov 27 (Sprint 1):** Add deprecation headers, begin monitoring
- **Dec 11 (Sprint 2):** Verify iOS usage at 0%, remove endpoint
- **Jan 8 (v2.0 release):** Breaking change published

**Deprecation Headers (Nov 27):**
```
X-Deprecated: true
X-Deprecation-Date: 2026-01-08
X-Migration-Guide: Use /v1/enrichment/batch instead
```

**Verification Checklist:**
- [ ] `/v1/enrichment/batch` usage at 100% for 2+ weeks
- [ ] `/api/enrichment/batch` usage at 0% for 1+ week
- [ ] iOS fallback metrics at 0%
- [ ] No customer support tickets about enrichment
- [ ] Zero requests to legacy endpoint in logs

**Implementation (Sprint 2):**
- [ ] Remove `/api/enrichment/batch` route from router
- [ ] Remove from health endpoint listing
- [ ] Update API documentation
- [ ] Announce breaking change in release notes

**Status:** Planning → Prep Phase (Sprint 1) → Removal (Sprint 2)

---

## Sprint 1 PR
**PR Title:** `feat: Fix rate limiter DoS vulnerability & deploy iOS canonical endpoint`
**PR Body:**
```
## Summary
- 🔴 Fix critical rate limiter race condition (atomic counter with Durable Objects)
- ✨ Deploy /v1/enrichment/batch canonical endpoint (iOS migration)
- 📋 Begin /api/enrichment/batch deprecation (add headers, monitor usage)

## Testing
- Rate limiter: 100+ concurrent requests don't bypass limit
- iOS endpoint: WebSocket progress updates work correctly
- All existing tests pass

## Deployment Notes
- Durable Object rate limiter replaces KV-based implementation
- /v1/enrichment/batch behavior identical to /api/enrichment/batch
- iOS rollout can begin immediately after merge

## Timeline
- DoS fix: Critical, security patch
- iOS feature: Unblocks iOS app migration (deadline Dec 11)
```

---

# SPRINT 2: Test Infrastructure + Test Phase 1
**Duration:** Week 3-4 (Dec 1-15, 2025)
**Theme:** Build Test Foundation & Complete iOS Migration
**Key Deadline:** Complete iOS migration (Dec 11)

## Goals
1. Set up Vitest infrastructure (#10)
2. Implement Phase 1 unit tests (#6)
3. Complete legacy endpoint removal (#5)

## Issues (3 total)

### 🧪 #10: Test Infrastructure Setup & Configuration
**Type:** Testing / Infrastructure
**Effort:** 5-6 days
**Priority:** BLOCKER (unblocks all test phases)
**Assignee:** [Self]

**What's Included:**
- Vitest installation & configuration
- Mock setup for all external APIs
- CI/CD integration
- Test scripts & tooling

**Tasks:**

1. **Vitest Setup** (2-3 days)
   - [ ] `npm install --save-dev vitest @vitest/ui`
   - [ ] Create `vitest.config.js`
   - [ ] Create `tests/setup.js` for global configuration
   - [ ] Update `package.json` scripts:
     ```json
     {
       "test": "vitest run",
       "test:watch": "vitest watch",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest run --coverage"
     }
     ```
   - [ ] Create `.gitignore` entries for `coverage/` and `test-results/`

2. **Mock Setup** (2-3 days)
   - [ ] Create `tests/mocks/providers.js`
     - Google Books mock responses
     - OpenLibrary mock responses
     - ISBNdb mock responses
   - [ ] Create `tests/mocks/kv-cache.js`
     - Mock KV get/put/delete
     - Mock TTL expiration
   - [ ] Create `tests/mocks/durable-object.js`
     - Mock DO storage
     - Mock WebSocket pairs
     - Mock alarm scheduling
   - [ ] Create `tests/mocks/gemini.js`
     - Mock Gemini API responses
     - Mock token usage

3. **Configuration** (1 day)
   - [ ] Create test helper utilities
   - [ ] Setup test database (if needed)
   - [ ] Configure coverage thresholds (75% for critical paths)
   - [ ] Setup CI/CD workflow for GitHub Actions

**Acceptance Criteria:**
- [ ] `npm test` runs all tests successfully
- [ ] `npm run test:ui` opens visual dashboard
- [ ] Coverage reports generate correctly
- [ ] All mocks working for external APIs
- [ ] CI/CD workflow validates code on PR

**Status:** Not started → In Progress → Ready for PR

---

### 🧪 #6: Phase 1 Unit Tests (Validators, Normalizers, Auth, Cache)
**Type:** Testing / Phase 1
**Effort:** 3-4 days
**Priority:** CRITICAL (unblocks Phase 2)
**Assignee:** [Self]
**Depends On:** #10 (test infrastructure)

**Tests to Implement (27 total):**

1. **tests/unit/validators.test.js** (5 tests)
   - ISBN validation (10/13 digit)
   - Query sanitization
   - JobId format validation

2. **tests/unit/normalizers.test.js** (8 tests)
   - Google Books normalization
   - OpenLibrary normalization
   - ISBNdb normalization

3. **tests/unit/auth.test.js** (10 tests)
   - Token generation & expiration
   - Token refresh window enforcement (30 min)
   - Token refresh race condition prevention

4. **tests/unit/cache.test.js** (4 tests)
   - TTL assignment (7 vs 365 days)
   - Cache hits/misses
   - Cache invalidation

**Target Coverage:**
- Validators: 100%
- Normalizers: 100%
- Auth: 100%
- Cache: 90%+

**Acceptance Criteria:**
- [ ] All 27 tests passing
- [ ] Coverage >50% for utils layer
- [ ] All tests deterministic (no flaky tests)
- [ ] Test execution <1 minute
- [ ] All mocking patterns documented

**Status:** Not started → In Progress → Ready for PR

---

### 📋 #5: Complete /api/enrichment/batch Endpoint Removal
**Type:** Refactor / Cleanup
**Effort:** 1-2 days (continuation from Sprint 1)
**Priority:** HIGH (iOS migration completion)
**Assignee:** [Self]
**Depends On:** #4 (iOS migration stable)

**Timeline Verification (Dec 11):**
- [ ] Check logs: `/api/enrichment/batch` usage = 0%
- [ ] Check iOS metrics: fallback usage = 0%
- [ ] Verify no support tickets related to enrichment failures
- [ ] Confirm iOS feature flag at 100% stable

**Removal Tasks:**
- [ ] Remove `/api/enrichment/batch` route from `src/index.js`
- [ ] Remove from health endpoint listing
- [ ] Remove deprecation headers (no longer needed)
- [ ] Update `docs/API_README.md` to remove legacy endpoint

**Verification Post-Removal:**
- [ ] Health endpoint shows only `/v1/enrichment/batch`
- [ ] All tests still pass
- [ ] No 404 errors in production (no clients using legacy endpoint)

**Status:** Monitoring (Sprint 1) → Removal (Sprint 2) → Verified

---

## Sprint 2 PR
**PR Title:** `test: Setup test infrastructure + Phase 1 unit tests`
**PR Body:**
```
## Summary
- 🧪 Setup Vitest infrastructure (configuration, mocks, CI/CD)
- 🧪 Implement Phase 1 unit tests (27 tests for validators, normalizers, auth, cache)
- 🧹 Remove deprecated /api/enrichment/batch endpoint (iOS migration complete)

## Testing
- All 27 Phase 1 tests passing
- Coverage >50% for utils layer
- No flaky tests

## Deployment Notes
- Test infrastructure now in place for subsequent phases
- iOS migration complete (zero usage of legacy endpoint)
- CI/CD now validates test coverage

## Unblocks
- Phase 2 integration tests (#7)
- Phase 3 handler tests (#8)
- Phase 4 E2E tests (#9)
```

---

# SPRINT 3: Integration Tests + Refactoring Phase 1
**Duration:** Week 5-6 (Dec 15-29, 2025)
**Theme:** Test Coverage + Code Quality
**Key Deadline:** Test infrastructure established + Phase 2 tests started

## Goals
1. Implement Phase 2 integration tests (#7)
2. Implement Phase 3 handler tests (#8)
3. Start refactoring initiatives (#14-16)

## Issues (6 total)

### 🧪 #7: Phase 2 Integration Tests (External APIs, Enrichment, Batch)
**Type:** Testing / Phase 2
**Effort:** 6-7 days
**Priority:** CRITICAL
**Assignee:** [Self]
**Depends On:** #10 (test infrastructure)

**Tests to Implement (50+ total):**

1. **tests/integration/external-apis.test.js** (15 tests)
   - Google Books search & fallback chains
   - OpenLibrary as fallback provider
   - ISBNdb cover image harvest
   - Provider error recovery & normalization

2. **tests/integration/enrichment.test.js** (12 tests)
   - Single book enrichment with provider fallback
   - Multiple book batch enrichment
   - Quality-based provider selection
   - Author data merging & deduplication

3. **tests/integration/websocket-do.test.js** (15 tests) ⚠️ **MOST COMPLEX**
   - WebSocket auth token validation & refresh
   - Job state persistence with throttling
   - Batch state initialization & photo updates
   - Token refresh window enforcement (30 min)
   - Cleanup alarms & CSV processing

4. **tests/integration/batch-processing.test.js** (8 tests)
   - Concurrent batch enrichment
   - Photo processing & progress tracking
   - Batch cancellation & error recovery

**Target Coverage:**
- Services: 60%+
- External APIs: 70%+
- Batch processing: 65%+

**Acceptance Criteria:**
- [ ] All 50+ tests passing
- [ ] Coverage >60% for services layer
- [ ] Mock API integration complete
- [ ] Test execution <3 minutes
- [ ] WebSocket DO integration tested

**Status:** Not started → In Progress → Ready for PR

---

### 🧪 #8: Phase 3 Handler Tests (Search Routes & WebSocket)
**Type:** Testing / Phase 3
**Effort:** 5-6 days
**Priority:** CRITICAL
**Assignee:** [Self]
**Depends On:** #10 (test infrastructure)

**Tests to Implement (55+ total):**

1. **tests/handlers/search-handlers.test.js** (40 tests)
   - `GET /v1/search/title` - title search with caching (7 days)
   - `GET /v1/search/isbn` - ISBN search with caching (365 days)
   - `GET /v1/search/advanced` - multi-field search
   - Error handling (400, 429, 5xx)
   - Cache header validation
   - Rate limiting enforcement

2. **tests/handlers/websocket-handlers.test.js** (5 tests)
   - WebSocket upgrade validation
   - Missing jobId → 400
   - Invalid token → 401
   - Expired token → 401
   - Non-WebSocket upgrade → 426

3. **tests/handlers/token-refresh.test.js** (5 tests)
   - `POST /api/token/refresh`
   - Token validation & refresh window
   - Concurrent refresh handling
   - Error cases

4. **tests/handlers/batch-scan.test.js** (5 tests)
   - `POST /api/scan-bookshelf`
   - `POST /v1/enrichment/batch`
   - `POST /api/import/csv-gemini`
   - Job initialization & progress tracking

**Response Format Validation:**
- [ ] Unified envelope format (success, data, metadata)
- [ ] CORS headers present
- [ ] Cache-Control headers correct
- [ ] Error response format
- [ ] Rate limit headers present

**Target Coverage:**
- Handlers: 75%+
- Index.js: 70%+

**Acceptance Criteria:**
- [ ] All 55+ handler tests passing
- [ ] Coverage >70% for handlers
- [ ] All 50+ routes tested
- [ ] Response format validation complete
- [ ] Rate limit enforcement verified

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #14: Extract Durable Object Accessor Pattern
**Type:** Refactor / Code Quality
**Effort:** 30 minutes - 1 hour
**Priority:** MEDIUM
**Assignee:** [Self]

**Problem:**
Pattern for getting Durable Object stub repeated 5+ times:
```javascript
const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId)
const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId)
```

**Solution:**
Create `src/utils/durable-object-helpers.ts`:
```typescript
export function getProgressDOStub(jobId: string, env: any) {
  const id = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId)
  return env.PROGRESS_WEBSOCKET_DO.get(id)
}
```

**Locations to Update:**
- [ ] `src/index.js` - All 5+ occurrences

**Acceptance Criteria:**
- [ ] Utility function created in `src/utils/durable-object-helpers.ts`
- [ ] All occurrences in `src/index.js` replaced
- [ ] Tests pass
- [ ] No functional change

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #15: Standardize API Key Access Pattern
**Type:** Refactor / Code Quality
**Effort:** 1-2 hours
**Priority:** MEDIUM
**Assignee:** [Self]

**Problem:**
Inconsistent API key retrieval across codebase. Some functions check for `.get()` method (Cloudflare Secrets Store), others don't.

**Solution:**
Create `src/utils/secrets.ts`:
```typescript
export async function getSecret(secretBinding: any): Promise<string | null> {
  if (!secretBinding) return null
  if (typeof secretBinding === 'string') return secretBinding
  if (typeof secretBinding?.get === 'function') {
    return await secretBinding.get()
  }
  return null
}

export async function requireSecret(
  secretBinding: any,
  secretName: string
): Promise<string> {
  const value = await getSecret(secretBinding)
  if (!value) {
    throw new Error(`Required secret not configured: ${secretName}`)
  }
  return value
}
```

**Locations to Update:**
- [ ] `src/services/external-apis.js` - All 8 API functions
- [ ] `src/providers/gemini-provider.js`
- [ ] `src/services/ai-scanner.js`

**Acceptance Criteria:**
- [ ] Utility functions created
- [ ] All API key accesses use utility
- [ ] Tests cover Secrets Store and direct env var
- [ ] Error messages clear when secrets missing

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #16: Convert external-apis.js to TypeScript
**Type:** Refactor / Code Quality
**Effort:** 1-2 hours
**Priority:** MEDIUM
**Assignee:** [Self]
**Depends On:** #15 (secrets utility first)

**Problem:**
`src/services/external-apis.js` imports TypeScript modules (`normalizers/*.ts`). This creates build complexity and loses type safety benefits.

**Solution:**
Migrate file to TypeScript with proper type definitions:

1. Rename file:
   ```bash
   git mv src/services/external-apis.js src/services/external-apis.ts
   ```

2. Update imports in `src/index.js`

3. Convert JSDoc to TypeScript interfaces:
   ```typescript
   interface GoogleBooksResponse {
     success: boolean
     works?: WorkDTO[]
     editions?: EditionDTO[]
     provider: string
     processingTime: number
     error?: string
   }

   export async function searchGoogleBooks(
     query: string,
     params?: { maxResults?: number },
     env?: WorkerEnv
   ): Promise<GoogleBooksResponse>
   ```

**Acceptance Criteria:**
- [ ] File renamed to `.ts`
- [ ] All imports updated
- [ ] JSDoc converted to TS interfaces
- [ ] Build succeeds (no tsc errors)
- [ ] All tests pass
- [ ] No functional changes

**Status:** Not started → In Progress → Ready for PR

---

## Sprint 3 PR
**PR Title:** `test: Phase 2 & 3 tests (integration + handlers) + refactor: extract patterns`
**PR Body:**
```
## Summary
- 🧪 Implement Phase 2 integration tests (50+ tests for external APIs, enrichment, batch)
- 🧪 Implement Phase 3 handler tests (55+ tests for all API routes)
- 🔧 Extract Durable Object accessor pattern
- 🔧 Standardize API key access pattern
- 🔧 Convert external-apis.js to TypeScript

## Testing
- All 105+ tests passing
- Coverage >60% for services, >70% for handlers
- All 50+ routes covered by handler tests
- No flaky tests

## Refactoring Benefits
- DRY violation eliminated (Durable Object pattern)
- Consistent secrets handling across codebase
- Type safety for external APIs (TypeScript conversion)
- Reduced code duplication

## Coverage Progress
- Phase 1: 27 tests (unit)
- Phase 2: 50+ tests (integration)
- Phase 3: 55+ tests (handlers)
- Total: 132+ tests, >65% overall coverage
```

---

# SPRINT 4: E2E Tests + Refactoring Phase 2 + Documentation
**Duration:** Week 7-8 (Dec 29-Jan 8, 2026)
**Theme:** Completion & Polish
**Key Deadline:** All work complete by Jan 8 (v2.0 release)

## Goals
1. Implement Phase 4 E2E tests (#9)
2. Complete refactoring initiatives (#17-20)
3. Sync documentation to iOS/Flutter repos (#2-3)
4. Consolidate all PRs into sprint-based structure (#40)

## Issues (8 total)

### 🧪 #9: Phase 4 E2E Tests (Workflows & Resilience)
**Type:** Testing / Phase 4
**Effort:** 5-6 days
**Priority:** CRITICAL
**Assignee:** [Self]
**Depends On:** #7, #8 (prior test phases)

**Tests to Implement (73+ total):**

1. **tests/e2e/bookshelf-scan.test.js** (8 tests)
   - Photo upload → WebSocket → AI processing → enrichment → completion
   - Scan with cancellation
   - Scan with client disconnect/reconnect
   - Scan with provider failure

2. **tests/e2e/batch-enrichment.test.js** (8 tests)
   - Upload 5 books → initialization → enrichment → progress → completion
   - Mixed success/failure handling
   - Batch cancellation mid-processing
   - Rate limiting during batch

3. **tests/e2e/csv-import.test.js** (10 tests)
   - CSV upload → parsing → enrichment → completion
   - Invalid rows handling
   - CSV size validation
   - Parser error recovery

4. **tests/error-scenarios/network-failures.test.js** (12 tests)
   - Provider timeouts (>5000ms)
   - Connection refused errors
   - Rate limit recovery (429)
   - Partial/truncated responses
   - SSL/DNS failures

5. **tests/error-scenarios/state-violations.test.js** (15 tests)
   - Token refresh before token set
   - Job update before initialization
   - Batch operation on non-batch job
   - Update on completed job
   - Invalid state transitions
   - DO eviction & recovery

6. **tests/error-scenarios/concurrency.test.js** (20+ tests)
   - Token refresh race conditions
   - Concurrent job state updates
   - Multiple WebSocket connections
   - Photo index collisions
   - Reader-writer conflicts in KV
   - Rate limit boundary conditions

**Workflow Validation:**
- [ ] Bookshelf scan: upload → init → WebSocket → 3 stages → complete
- [ ] Batch enrichment: upload → init → parallel enrich → progress → results
- [ ] CSV import: upload → alarm scheduled → parsing → enrichment → completion
- [ ] All workflows include error paths & recovery

**Target Coverage:**
- Overall: >75%
- Critical paths: 100%
- Error scenarios: 90%+

**Acceptance Criteria:**
- [ ] All 73+ E2E + error tests passing
- [ ] Coverage >75% overall
- [ ] No flaky tests (all deterministic)
- [ ] Concurrency testing comprehensive
- [ ] Performance under load (1000+ concurrent ops) validated
- [ ] Error recovery patterns validated

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #17: Extract Router into Route Modules
**Type:** Refactor / Maintainability
**Effort:** 3-4 hours
**Priority:** HIGH
**Assignee:** [Self]

**Problem:**
`src/index.js` has grown to 1,146 lines with 50+ route handlers inline. Makes file:
- Hard to navigate
- Difficult to test
- Hard to maintain
- Causes merge conflicts

**Solution:**
Extract routes into focused modules:

```
src/
├── index.js              # 100-150 lines (entry point only)
├── routes/
│   ├── search.js        # Title, ISBN, author, advanced search
│   ├── enrichment.js    # Batch, start, cancel, status
│   ├── ai.js           # Scan bookshelf, CSV import
│   ├── jobs.js         # Token refresh, job state, cancel
│   ├── cache.js        # Metrics, warming, dashboard
│   ├── admin.js        # Health, harvest dashboard, test endpoints
│   └── websocket.js    # Progress WebSocket routing
```

**New index.js Structure:**
```javascript
import { handleSearchRoutes } from './routes/search.js'
import { handleEnrichmentRoutes } from './routes/enrichment.js'
import { handleAIRoutes } from './routes/ai.js'
import { handleJobRoutes } from './routes/jobs.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      })
    }

    if (url.pathname.startsWith('/v1/search')) {
      return handleSearchRoutes(request, url, env, ctx)
    }
    if (url.pathname.startsWith('/v1/enrichment')) {
      return handleEnrichmentRoutes(request, url, env, ctx)
    }
    // ... etc
  }
}
```

**Acceptance Criteria:**
- [ ] `src/routes/` directory created with 6-7 modules
- [ ] index.js reduced to ~150 lines
- [ ] All routes moved to appropriate modules
- [ ] Router dispatch logic clear
- [ ] All existing tests pass
- [ ] No functional changes

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #18: Standardize Error Response Format
**Type:** Refactor / API Design
**Effort:** 1-2 hours
**Priority:** HIGH
**Assignee:** [Self]

**Problem:**
Error responses inconsistent. Some return `{error: string}`, others `{error, code}`, others `{error, message, details}`. Makes API contract unclear.

**Solution:**
Create error response builder with standard format:
```typescript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message',
    details: { /* optional context */ }
  }
}
```

**Implementation:**
1. Create `src/utils/error-response.ts`
2. Define error code enum
3. Create standardized error response builder
4. Update all endpoints to use builder

**Acceptance Criteria:**
- [ ] Error code enum created
- [ ] Standard error response builder implemented
- [ ] All endpoints use standard format
- [ ] Error codes documented
- [ ] Tests pass

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #19: Standardize Analytics Logging
**Type:** Refactor / Observability
**Effort:** 30 minutes - 1 hour
**Priority:** MEDIUM
**Assignee:** [Self]

**Problem:**
Analytics logging inconsistent in `src/services/external-apis.js`. Some functions check if ANALYTICS binding exists, others don't record metrics at all.

**Solution:**
Create analytics wrapper in `src/utils/analytics.ts`:
```typescript
export function logAPICall(
  provider: string,
  endpoint: string,
  status: 'success' | 'error',
  duration: number,
  env: any
) {
  if (!env?.ANALYTICS) return // Graceful degradation

  const event = {
    timestamp: new Date().toISOString(),
    provider,
    endpoint,
    status,
    duration
  }

  // Send to analytics binding
  env.ANALYTICS.writeDataPoint({
    indexes: [provider, status],
    blobs: [JSON.stringify(event)],
    doubles: [duration]
  })
}
```

**Locations to Update:**
- [ ] `src/services/external-apis.js` - All API functions
- [ ] Any other services making external API calls

**Acceptance Criteria:**
- [ ] Analytics helper functions created
- [ ] All API functions use consistent logging
- [ ] Graceful degradation if binding missing
- [ ] No functional changes to behavior

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #20: Standardize Response Envelope Format
**Type:** Refactor / API Design
**Effort:** Included in prior response builder refactoring
**Priority:** MEDIUM
**Assignee:** [Self]
**Related To:** #18

**Problem:**
Response envelope format should be standardized across all endpoints.

**Standard Format:**
```typescript
{
  success: true,
  data: { /* canonical book object */ },
  meta: {
    source: 'google_books',
    cached: true,
    timestamp: '2025-01-10T12:00:00Z'
  }
}
```

**Acceptance Criteria:**
- [ ] All endpoints use standard response envelope
- [ ] Response builder validates format
- [ ] Tests verify envelope structure
- [ ] No functional changes

**Status:** Included in #18 refactoring

---

### 📚 #2: Sync QUICK_START and API_README to iOS/Flutter Repos
**Type:** Documentation
**Effort:** 1-2 hours
**Priority:** MEDIUM
**Assignee:** [Self]

**Files to Copy:**
1. **docs/QUICK_START.md**
   - Quick reference guide for common API tasks
   - Deployment and testing commands
   - Links to all important documentation

2. **docs/API_README.md**
   - Canonical API contracts (TypeScript DTO definitions)
   - All V1 endpoints with parameters and response formats
   - Error codes catalog
   - WebSocket message types and formats
   - Rate limiting details
   - Integration patterns for all platforms

**Destination Repos:**
- **iOS:** https://github.com/jukasdrj/books-tracker-v1 → `docs/` or README
- **Flutter:** (when applicable) similar structure

**Acceptance Criteria:**
- [ ] Files copied to iOS repo `docs/`
- [ ] Files ready for Flutter repo integration
- [ ] No code changes needed (markdown only)
- [ ] iOS/Flutter teams notified

**Status:** Not started → In Progress → Ready for PR

---

### 🔧 #3: GitHub Action for Flutter Repo Documentation Sync
**Type:** DevOps / Documentation
**Effort:** 1-2 hours
**Priority:** MEDIUM
**Assignee:** [Self]

**Problem:**
Backend repo has GH action to copy API_README to other projects. Need to add Flutter repo coverage.

**Solution:**
Update existing GitHub Actions workflow to include Flutter repo.

**Implementation:**
1. Find existing workflow (`.github/workflows/sync-docs.yml`)
2. Add Flutter repo destination (jukasdrj/books-flutter)
3. Test workflow on docs update
4. Verify files synced to all frontend repos

**Acceptance Criteria:**
- [ ] GH action updated to include Flutter repo
- [ ] Workflow triggers on API_README or QUICK_START changes
- [ ] Flutter repo receives documentation updates
- [ ] Workflow logs show successful sync

**Status:** Not started → In Progress → Ready for PR

---

### 📋 #40: Create Sprint-Based PRs from Closed Work
**Type:** Meta / Sprint Planning
**Effort:** Consolidation task (across all sprints)
**Priority:** TRACKING
**Assignee:** [Self]

**Consolidation Plan:**
The 19 individual issues (closed PRs 21-39) will be consolidated into 5 sprint-based PRs:

1. **Sprint 1 PR:** Security fix + iOS feature deployment
2. **Sprint 2 PR:** Test infrastructure + Phase 1 tests
3. **Sprint 3 PR:** Phase 2-3 tests + refactoring phase 1
4. **Sprint 4a PR:** Phase 4 E2E tests
5. **Sprint 4b PR:** Refactoring phase 2 + documentation sync

**Status:** Tracking across all sprints

---

## Sprint 4 PR (split into 2)

### PR 1: Phase 4 Tests
**PR Title:** `test: Phase 4 E2E + error scenario tests (73+ tests, >75% coverage)`
**PR Body:**
```
## Summary
- 🧪 Implement Phase 4 E2E tests (26 tests for complete workflows)
- 🧪 Implement error scenario tests (47+ tests for resilience)
- ✅ Achieve >75% overall test coverage target

## Testing
- All 73+ tests passing
- Coverage >75% overall
- All critical paths at 100%
- No flaky tests
- Performance under load verified (1000+ concurrent ops)

## Completion
- 240+ tests implemented across all 4 phases
- Complete test suite ready for CI/CD validation
- Test suite execution <5 minutes
```

### PR 2: Refactoring + Documentation
**PR Title:** `refactor: Extract router + standardize errors/logging + convert to TS + sync docs`
**PR Body:**
```
## Summary
- 🔧 Extract router into route modules (src/index.js: 1146 → 150 lines)
- 🔧 Standardize error response format (single error response builder)
- 🔧 Standardize analytics logging (consistent API metrics)
- 🔧 Convert external-apis.js to TypeScript (proper type safety)
- 📚 Sync API documentation to iOS/Flutter repos
- 🔧 Add GitHub Action for Flutter repo documentation sync

## Code Quality
- index.js reduced by ~90% (cleaner, more maintainable)
- Error handling unified across all endpoints
- Analytics logging consistent for all API calls
- Type safety improved for external API integrations

## Documentation
- iOS/Flutter teams have up-to-date API contracts
- Documentation sync now automated for all frontend repos
```

---

# Summary & Success Metrics

## Timeline
- **Sprint 1 (Nov 13-27):** Critical security + iOS feature → 2 issues
- **Sprint 2 (Dec 1-15):** Test infrastructure + Phase 1 tests → 3 issues
- **Sprint 3 (Dec 15-29):** Phase 2-3 tests + refactoring phase 1 → 6 issues
- **Sprint 4 (Dec 29-Jan 8):** Phase 4 tests + refactoring phase 2 + docs → 8 issues

## Success Criteria by Sprint

### Sprint 1 ✅
- [ ] Rate limiter race condition fixed (DoS vulnerability eliminated)
- [ ] `/v1/enrichment/batch` endpoint deployed (iOS can begin migration)
- [ ] All changes deployed to production successfully
- [ ] Zero regressions in existing functionality

### Sprint 2 ✅
- [ ] Vitest infrastructure set up and working
- [ ] 27 Phase 1 unit tests passing (>50% coverage for utils)
- [ ] `/api/enrichment/batch` endpoint removed (iOS migration complete)
- [ ] Test infrastructure unblocks all subsequent phases

### Sprint 3 ✅
- [ ] 50+ Phase 2 integration tests passing (>60% services coverage)
- [ ] 55+ Phase 3 handler tests passing (>70% handlers coverage)
- [ ] 3 refactoring initiatives completed (DRY, secrets, TypeScript)
- [ ] Total 132+ tests, >65% overall coverage

### Sprint 4 ✅
- [ ] 73+ Phase 4 E2E + error tests passing (>75% overall coverage)
- [ ] 4 refactoring initiatives completed (router, errors, logging, conversion)
- [ ] API documentation synced to iOS/Flutter repos
- [ ] GitHub Action for documentation sync working
- [ ] All 20 issues closed
- [ ] 5 sprint-based PRs consolidated
- [ ] v2.0 release ready

## Coverage Goals
- **Overall Target:** >75% coverage
- **Critical Paths:** 100% coverage
- **Utilities:** 100% coverage (validators, normalizers, auth, cache)
- **Services:** 70%+ coverage
- **Handlers:** 75%+ coverage
- **WebSocket DO:** 80%+ coverage (most complex)

## Dependencies & Blockers
- ✅ #10 (test infrastructure) is blocker for #6-9 (all test phases)
- ✅ #4 (iOS feature deployment) must complete before #5 (legacy removal)
- ✅ #1 (rate limiter fix) must complete before other enhancements
- ✅ All refactoring (#14-20) can parallelize without conflicts

## Hard Deadlines
- **Dec 11, 2025:** iOS migration complete (Sprint 2 end)
- **Jan 8, 2026:** v2.0 release ready (Sprint 4 end)

## Risk Mitigation
1. **Rate Limiter Complexity:** Solution uses Durable Objects (proven pattern in Workers ecosystem)
2. **Test Coverage Gaps:** Comprehensive test plan with 240+ tests covers all critical paths
3. **Refactoring Scope:** Incremental refactoring (3-4 issues per sprint) prevents bottlenecks
4. **iOS Deadline:** Sprint 1 completion ensures iOS migration unblocked by week 2

---

## Status Tracking

### Issues & PRs
- **Total Issues:** 20 (all in active development)
- **Total PRs:** 5 (consolidated from 19 closed work)
- **Progress:** 0% → 100% over 8 weeks

### Weekly Check-ins
- **Week 1 (Nov 13):** Sprint 1 kicks off
- **Week 2 (Nov 20):** Sprint 1 completes, iOS migration available
- **Week 3 (Dec 1):** Sprint 2 kicks off with test infrastructure
- **Week 4 (Dec 8):** iOS migration deadline approaches
- **Week 5 (Dec 15):** Sprint 3 kicks off with integration tests
- **Week 6 (Dec 22):** Refactoring phase 1 ongoing
- **Week 7 (Dec 29):** Sprint 4 kicks off with final tests
- **Week 8 (Jan 8):** v2.0 release with 240+ tests + refactoring complete

---

**Last Updated:** November 13, 2025
**Approved By:** Consensus from 3 planning models (8-9/10 confidence)
**Next Action:** Begin Sprint 1 - Fix rate limiter (#13) and deploy iOS endpoint (#4)
