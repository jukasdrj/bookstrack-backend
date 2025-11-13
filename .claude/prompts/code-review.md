# Backend Code Review Prompt

Use this prompt with Zen MCP for comprehensive code reviews:

```bash
/mcp zen codereview
```

## Review Checklist

### 🔐 Security
- [ ] No hardcoded API keys or secrets
- [ ] Input validation for all user inputs (ISBN, queries)
- [ ] CORS configured correctly for allowed origins
- [ ] Rate limiting properly implemented
- [ ] Error messages don't leak sensitive information

### ⚡ Performance
- [ ] KV cache checked before external API calls
- [ ] Response times within target (search < 500ms, cached < 50ms)
- [ ] Parallel processing used for batch operations
- [ ] No N+1 query patterns
- [ ] Large operations use streaming or pagination

### 🏗️ Architecture
- [ ] Follows monolith pattern (direct function calls)
- [ ] Handlers in `src/handlers/`, services in `src/services/`
- [ ] Canonical response format used consistently
- [ ] Error handling with try-catch blocks
- [ ] Environment variables accessed through `env` parameter

### 📝 Code Quality
- [ ] ES6+ patterns (async/await, destructuring)
- [ ] No semicolons (ASI)
- [ ] Single quotes for strings
- [ ] Meaningful variable names
- [ ] JSDoc comments for public APIs

### 🧪 Testing
- [ ] Test file exists for new handlers
- [ ] Unit tests for validation functions
- [ ] Integration tests for API endpoints
- [ ] Edge cases covered (invalid ISBN, rate limits)

### 📚 Documentation
- [ ] `docs/API_README.md` updated for new endpoints
- [ ] `SECRETS_SETUP.md` updated for new environment variables
- [ ] Code comments explain WHY, not WHAT
- [ ] README updated if deployment process changes

## Example Usage

```bash
# Review security of a specific file
mcp zen codereview --files src/handlers/search.js --review-type security

# Full review of PR changes
mcp zen codereview --review-type full

# Performance-focused review
mcp zen codereview --files src/services/enrichment.js --review-type performance
```

## Common Issues to Watch For

### ❌ Cache Bypass
```javascript
// Bad - always hits external API
const book = await googleBooks.search(isbn)

// Good - check cache first
const cached = await env.BOOK_CACHE.get(`book:${isbn}`, 'json')
if (cached) return cached
```

### ❌ Blocking Event Loop
```javascript
// Bad - sequential processing
for (const isbn of isbns) {
  await enrichBook(isbn)
}

// Good - parallel processing
await Promise.all(isbns.map(isbn => enrichBook(isbn)))
```

### ❌ Leaking Secrets
```javascript
// Bad - exposes API key
console.error('API call failed:', env.GEMINI_API_KEY)

// Good - generic error
console.error('External API call failed')
```

### ❌ Missing Validation
```javascript
// Bad - no validation
const isbn = request.isbn
const book = await search(isbn)

// Good - validate first
const isbn = validateISBN(request.isbn)
if (!isbn) {
  return errorResponse('Invalid ISBN', 400)
}
```

## Models to Use

- **Quick review:** Haiku (local, free)
- **Security audit:** Gemini 2.5 Pro
- **Complex architecture:** O3 Pro
- **Performance analysis:** Grok 4

## Auto-Review on PR

Jules will automatically review PRs. To request specific analysis:

```markdown
@jules review this PR for:
- Security vulnerabilities
- Performance bottlenecks
- Cloudflare Workers best practices
```
