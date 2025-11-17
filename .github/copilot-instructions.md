# GitHub Copilot Instructions for BooksTrack Backend

This repository contains the **BooksTrack Backend API** - a Cloudflare Workers-based API for book search, enrichment, and AI-powered scanning.

**Production URL:** https://api.oooefam.net  
**Tech Stack:** Cloudflare Workers, Hono framework, Vitest

---

## Quick Start

### Build and Test

```bash
# Install dependencies
npm install

# Run tests (required before commits)
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Local development
npx wrangler dev

# Deploy to production (automated via GitHub Actions)
npm run deploy
```

### Repository Structure

- `src/` - Production code (handlers, services, providers, middleware)
- `tests/` - All tests (unit, integration, handlers)
- `docs/` - Active documentation
- `wrangler.toml` - Cloudflare Workers configuration
- `.github/agents/` - Custom AI agents (cf.agent.md)

---

## Testing Requirements

**CRITICAL:** All new code must include tests. This is non-negotiable.

### Coverage Requirements

We require **75% minimum test coverage** for all new code:

- **Validators:** 100%
- **Normalizers:** 100%
- **Auth:** 100%
- **Cache:** 90%+
- **External APIs:** 85%+
- **Enrichment:** 85%+
- **WebSocket DO:** 80%+
- **Handlers:** 75%+
- **Services:** 70%+

### Test Structure

- Test files follow pattern: `tests/unit/services/example.test.js` for `src/services/example.js`
- Use descriptive test names that clearly indicate what is being tested
- **No flaky tests allowed** - if a test fails intermittently, fix it or remove it
- All tests must pass before merging

### Running Tests

```bash
npm test                    # Run all tests once
npm run test:coverage      # Generate coverage report
npm run test:watch         # Watch mode for development
```

---

## API Contract Compliance

**CRITICAL:** All API changes must comply with `docs/API_CONTRACT.md`.

### Canonical Response Format

All endpoints must follow this structure (see `docs/API_CONTRACT.md` lines 152-220):

```typescript
// Success response
{
  "data": { /* resource data */ },
  "metadata": {
    "timestamp": "2024-06-01T12:34:56.789Z",
    // ... other metadata fields (pagination, counts, etc)
  },
  // error is omitted or undefined
}

// Error response
{
  "data": null,
  "metadata": {
    "timestamp": "2024-06-01T12:34:56.789Z"
    // ... other metadata fields
  },
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": { /* optional error details */ }
  }
}
```

### Data Transfer Objects (DTOs)

- **WorkDTO** - Book work information (title, authors, etc.)
- **EditionDTO** - Edition-specific information (ISBN, covers, etc.)
- **AuthorDTO** - Author information

See `docs/API_CONTRACT.md` for complete schemas.

---

## Coding Standards

### Cloudflare Workers Best Practices

1. **Environment Variables:**
   - Access via `env` parameter: `env.GOOGLE_BOOKS_API_KEY`
   - Secrets: Use `wrangler secret put` (never commit)
   - Config: Define in `wrangler.toml`

2. **Error Handling:**
   - Always use try/catch blocks
   - Return proper HTTP status codes
   - Include meaningful error messages
   - Never expose internal errors to clients

3. **Performance:**
   - Response time target: **< 500ms** for search endpoints
   - WebSocket latency target: **< 50ms**
   - Cache hit rate target: **> 60%**
   - Use KV for caching when appropriate

4. **Security:**
   - Validate all inputs
   - Sanitize user data
   - Use rate limiting
   - Implement proper CORS headers
   - Never log sensitive data

### Code Style

- Use ES6+ features (async/await, arrow functions)
- Prefer const over let, never use var
- Use descriptive variable names
- Add JSDoc comments for complex functions
- Follow existing patterns in the codebase

### Import Patterns

```javascript
// Handlers
import { handleISBNSearch } from './handlers/search.js'

// Services
import { enrichBookData } from './services/enrichment.js'

// Utilities
import { normalizeISBN } from './utils/isbn.js'
```

---

## Documentation

### Key Documents to Reference

1. **[README.md](../README.md)** - Repository overview and quick start
2. **[CONTRIBUTING.md](./.github/CONTRIBUTING.md)** - Contribution guidelines
3. **[API_CONTRACT.md](../docs/API_CONTRACT.md)** - API specifications (MUST READ)
4. **[AGENTS.md](../AGENTS.md)** - Custom AI agents available
5. **[ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md)** - System architecture

### When to Update Documentation

- **API changes:** Update `docs/API_CONTRACT.md`
- **New features:** Update `README.md` and relevant guides
- **Breaking changes:** Provide 90-day notice, update contract version
- **Configuration changes:** Update `wrangler.toml` comments

---

## Custom Agents

This repository has specialized AI agents for specific tasks:

### cf.agent.md (Book Library API Worker Agent)

Located at `.github/agents/cf.agent.md`

**Use for:**
- Building new API endpoints
- Reviewing Cloudflare Workers code
- API contract validation
- Security and performance optimization

**When working on:**
- Book search endpoints
- Enrichment services
- WebSocket implementations
- Cloudflare Workers integration

---

## Common Tasks

### Adding a New API Endpoint

1. Create handler in `src/handlers/`
2. Add route in `src/index.js`
3. Implement service logic in `src/services/`
4. Add validation middleware if needed
5. Create tests in `tests/handlers/`
6. Update `docs/API_CONTRACT.md`
7. Ensure 75%+ test coverage
8. Run full test suite

### Fixing a Bug

1. Add failing test that reproduces the bug
2. Fix the bug in source code
3. Verify test now passes
4. Run full test suite
5. Check test coverage

### Performance Optimization

1. Identify bottleneck (use Cloudflare Analytics)
2. Add performance tests
3. Implement optimization
4. Verify improvement
5. Ensure no regression in functionality

---

## External Service Integration

### APIs in Use

- **Google Books API** - Primary search provider
- **OpenLibrary** - Fallback search
- **ISBNdb** - Cover images (5000 req/day limit)
- **Gemini AI** - Bookshelf scanning (2M token context)

### API Keys (Secrets)

Configure via `wrangler secret put`:
- `GOOGLE_BOOKS_API_KEY`
- `GEMINI_API_KEY`
- `ISBNDB_API_KEY`

Never commit API keys to the repository.

---

## CI/CD Pipeline

### GitHub Actions Workflows

1. **deploy-production.yml** - Auto-deploys on push to `main`
2. **deploy-staging.yml** - Manual staging deployment
3. **cache-warming.yml** - Daily cache warm-up

### Required Secrets

Configure in GitHub Settings → Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GOOGLE_BOOKS_API_KEY`
- `GEMINI_API_KEY`
- `ISBNDB_API_KEY`

---

## Common Patterns

### Caching Strategy

```javascript
// Check cache first
const cached = await env.CACHE.get(cacheKey, 'json')
if (cached) return cached

// Fetch from source
const data = await fetchFromAPI()

// Cache with appropriate TTL
await env.CACHE.put(cacheKey, JSON.stringify(data), {
  expirationTtl: 7200 // 2 hours
})

return data
```

### Error Responses

```javascript
// 400 Bad Request - Invalid input
return jsonResponse({
  success: false,
  error: {
    code: 'INVALID_ISBN',
    message: 'ISBN must be 10 or 13 digits'
  }
}, 400)

// 404 Not Found - Resource not found
return jsonResponse({
  success: false,
  error: {
    code: 'BOOK_NOT_FOUND',
    message: 'No book found for the given ISBN'
  }
}, 404)

// 500 Internal Server Error - Unexpected error
return jsonResponse({
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  }
}, 500)
```

### Input Validation

```javascript
// Validate required parameters
const isbn = url.searchParams.get('isbn')
if (!isbn) {
  return createErrorResponse({
    error: {
      code: 'MISSING_PARAMETER',
      message: 'ISBN parameter is required'
    },
    data: null
  }, 400)
}

// Validate format
if (!isValidISBN(isbn)) {
  return createErrorResponse({
    error: {
      code: 'INVALID_ISBN',
      message: 'Invalid ISBN format'
    },
    data: null
  }, 400)
}
```

---

## Performance Targets

- **Search endpoints:** < 500ms response time
- **WebSocket messages:** < 50ms latency
- **Cache hit rate:** > 60%
- **Error rate:** < 1%
- **CPU time:** Stay well under 50ms (Workers limit)

---

## Debugging

### Local Development

```bash
# Start local server
npx wrangler dev

# Tail production logs
npx wrangler tail --remote --format pretty

# Test endpoint locally
curl http://localhost:8787/v1/search/isbn?isbn=9780140328721
```

### Production Monitoring

- **Logs:** Cloudflare Dashboard → Workers → Logs
- **Analytics:** Cloudflare Dashboard → Analytics
- **Health Check:** GET https://api.oooefam.net/health

---

## Resources

- **Cloudflare Workers Docs:** https://developers.cloudflare.com/workers/
- **Hono Framework:** https://hono.dev/
- **Vitest Testing:** https://vitest.dev/
- **GitHub Copilot Best Practices:** https://gh.io/copilot-coding-agent-tips

---

## Questions or Issues?

- Check existing documentation in `docs/`
- Review `ARCHITECTURE_OVERVIEW.md` for system design
- See `AGENTS.md` for specialized AI assistance
- Consult `API_CONTRACT.md` for API specifications
- Follow patterns in existing code

---

**Last Updated:** November 17, 2025  
**Maintained By:** Backend Team
