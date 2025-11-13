# Jules Guide for BooksTrack Backend

**Jules** is GitHub Copilot's AI assistant for PR reviews and code discussions. Available on GitHub.com with Copilot Plus subscription.

---

## Quick Start

### Basic Review
Comment on any PR:
```markdown
@jules review this PR
```

Jules will analyze the changes and provide feedback on:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Security concerns

---

## Backend-Specific Review Requests

### Search API Review
```markdown
@jules review this PR for:
- Search endpoint implementation
- Fallback chain logic (Google Books → OpenLibrary → ISBNdb)
- Response time optimization
- Caching strategy
```

### AI Feature Review
```markdown
@jules review the AI scanning implementation:
- Gemini 2.0 Flash integration
- Prompt engineering
- Confidence score calculation
- Error handling for AI failures
```

### Performance Review
```markdown
@jules analyze performance:
- KV cache usage patterns
- Response time compliance (search < 500ms, cached < 50ms)
- Parallel processing in batch operations
- Memory efficiency
```

### Security Review
```markdown
@jules security review:
- Input validation (ISBN, queries)
- CORS configuration
- Rate limiting implementation
- Error messages (no secret leaking)
- API key handling
```

### Cloudflare Workers Best Practices
```markdown
@jules review for Cloudflare Workers best practices:
- Environment variable usage (env parameter)
- KV cache patterns
- Durable Objects usage
- WebSocket implementation
- Edge runtime compatibility
```

---

## Asking Questions

### About Specific Code
```markdown
@jules explain this caching logic in src/services/search-service.js:42-58
```

### About Architecture
```markdown
@jules why did we use a monolith architecture instead of service bindings?
```

### About Trade-offs
```markdown
@jules what are the pros and cons of adding Goodreads as a fourth search provider?
```

---

## Follow-up Discussions

Jules remembers context within a PR thread:

```markdown
You: @jules review this search handler
Jules: [provides review]
You: @jules how would you refactor the validation logic?
Jules: [provides refactoring suggestions]
You: @jules what about using Zod for validation instead?
Jules: [discusses Zod pros/cons]
```

---

## Common Review Scenarios

### 1. New Search Provider
```markdown
@jules review this new search provider integration:
- API client implementation
- Error handling and retries
- Rate limiting compliance
- Response transformation to canonical format
- Caching strategy
```

### 2. Background Job Implementation
```markdown
@jules review this batch enrichment feature:
- Job queue implementation
- Progress tracking with WebSocket
- Error recovery and retries
- Performance for 100+ ISBNs
- Memory usage
```

### 3. Durable Object Changes
```markdown
@jules review the WebSocket Durable Object:
- State persistence
- Connection lifecycle management
- Message broadcasting
- Error handling
- Memory leaks
```

### 4. Route Handler Addition
```markdown
@jules review this new route handler:
- Input validation
- Error handling
- Response format (canonical)
- Performance (< 500ms)
- Test coverage
```

---

## Integration with Other AI Tools

### After Claude Code Implementation
1. **Claude Code** implements feature (multi-file changes)
2. **Push to GitHub** and create PR
3. **Jules reviews** on GitHub
4. **Human developer** makes final call

```markdown
@jules this was implemented by Claude Code. Please review for:
- Adherence to CLAUDE.md guidelines
- Cloudflare Workers best practices
- Security and performance
```

### After Zen MCP Planning
```markdown
@jules we used Zen MCP to plan this feature. The plan is in the PR description.
Please review the implementation against the plan.
```

### Requesting Zen MCP Analysis
```markdown
@jules this looks complex. Should we run a security audit with Zen MCP?
```

Jules might respond:
> "Yes, I recommend running Zen MCP security audit because I see:
> - User input directly passed to external API (SSRF risk)
> - No rate limiting on this expensive AI endpoint
> - Large file upload without size validation
>
> Run: `mcp zen codereview --review-type security --files src/handlers/scan.js`"

---

## What Jules Reviews

### ✅ Jules is Great For
- Code quality and style
- Best practices (JavaScript, Cloudflare Workers)
- Potential bugs and edge cases
- Performance optimizations
- Documentation completeness
- Test coverage suggestions
- Refactoring ideas

### ⚠️ Jules Won't Do
- Approve/merge PRs (human decision)
- Run tests or builds
- Access production logs or metrics
- Make commits or changes
- Access secrets or environment variables

---

## Review Checklist Template

Ask Jules to review against this checklist:

```markdown
@jules review against backend checklist:

**Security:**
- [ ] No hardcoded secrets
- [ ] Input validation for all user inputs
- [ ] CORS properly configured
- [ ] Rate limiting implemented

**Performance:**
- [ ] KV cache checked before external API calls
- [ ] Response times within target
- [ ] Parallel processing for batch operations
- [ ] No N+1 patterns

**Architecture:**
- [ ] Follows monolith pattern (direct function calls)
- [ ] Handlers in src/handlers/, services in src/services/
- [ ] Canonical response format
- [ ] Error handling with try-catch

**Code Quality:**
- [ ] ES6+ patterns (async/await, destructuring)
- [ ] Meaningful variable names
- [ ] JSDoc comments for public APIs
- [ ] No semicolons (ASI)

**Testing:**
- [ ] Test file exists for new handlers
- [ ] Unit tests for validation functions
- [ ] Integration tests for API endpoints

**Documentation:**
- [ ] docs/API_README.md updated for new endpoints
- [ ] SECRETS_SETUP.md updated for new env vars
- [ ] Code comments explain WHY, not WHAT
```

---

## Response Time Expectations

- **Simple review:** 30-60 seconds
- **Detailed analysis:** 1-2 minutes
- **Complex architecture review:** 2-3 minutes

If Jules is slow or unavailable, fall back to:
1. Manual human review
2. Zen MCP code review tool
3. Claude Code for refactoring suggestions

---

## Cost and Availability

- **Included with:** GitHub Copilot Plus ($39/month)
- **Limitations:** Rate limited during high usage
- **Alternative:** Zen MCP code review tool (uses your own API keys)

---

## Best Practices

### 1. Be Specific
❌ Bad: `@jules review this`
✅ Good: `@jules review the caching logic in search-service.js for correctness and performance`

### 2. Provide Context
```markdown
@jules review this PR. Context:
- This adds a new search provider (Goodreads)
- Should integrate with existing fallback chain
- Performance target: < 500ms
- Cache TTL: 24 hours
```

### 3. Ask Follow-up Questions
Don't accept first answer blindly. Dig deeper:
```markdown
@jules you suggested using Promise.allSettled instead of Promise.all. What happens if all providers fail?
```

### 4. Reference Standards
```markdown
@jules review against CLAUDE.md guidelines in this repo
```

### 5. Request Specific Analysis
```markdown
@jules focus on the error handling in this PR. Are we catching all edge cases?
```

---

## Common Jules Commands

| Command | Purpose |
|---------|---------|
| `@jules review this PR` | General review |
| `@jules explain [code]` | Explain specific code |
| `@jules suggest improvements` | Request refactoring ideas |
| `@jules security review` | Focus on security |
| `@jules performance analysis` | Focus on performance |
| `@jules check tests` | Review test coverage |
| `@jules compare approaches` | Evaluate alternatives |

---

## Troubleshooting

### Jules Doesn't Respond
1. Check GitHub Copilot Plus subscription is active
2. Verify Jules is enabled in GitHub settings
3. Try simpler request (may have hit rate limit)
4. Wait 5 minutes and retry
5. Use Zen MCP as alternative

### Jules Misunderstands Context
1. Provide more context in request
2. Reference specific files and line numbers
3. Link to documentation (CLAUDE.md, API_README.md)
4. Break complex request into smaller questions

### Jules Gives Generic Advice
1. Be more specific in your request
2. Reference project-specific patterns
3. Ask about specific Cloudflare Workers or backend concerns
4. Provide examples of what you want analyzed

---

## Example PR Review Flow

### 1. Developer Creates PR
```bash
git push origin feature/add-goodreads-provider
gh pr create --title "Add Goodreads search provider" --body "Closes #42"
```

### 2. Copilot Workflow Auto-labels
GitHub Action adds labels:
- `component: search`
- `component: providers`
- `effort: M (4-8h)`
- `ai: copilot`

### 3. Developer Requests Jules Review
```markdown
@jules review this new search provider:
- Integration with existing fallback chain
- Error handling and retries
- Performance and caching
- Response transformation
```

### 4. Jules Responds
Jules analyzes and provides feedback on:
- Code structure
- Potential bugs (e.g., missing error handling)
- Performance concerns (e.g., no caching)
- Best practices (e.g., rate limiting)

### 5. Developer Discusses with Jules
```markdown
@jules you mentioned we should add rate limiting. Can we reuse the existing rate limiter?
```

### 6. Developer Implements Changes
Based on Jules' feedback, make improvements.

### 7. Human Reviewer Approves
Final approval from human developer.

### 8. Merge to Main
Auto-deploys to production via GitHub Actions.

---

## Advanced Usage

### Request Comparison
```markdown
@jules compare these two approaches:

**Approach A (current):** Sequential fallback
**Approach B (proposed):** Parallel requests with Promise.race

Which is better for our use case?
```

### Request Refactoring Plan
```markdown
@jules this search handler is getting complex (200+ lines). How should we refactor it?
```

### Request Security Analysis
```markdown
@jules perform OWASP Top 10 analysis on this endpoint. Focus on:
- Injection risks
- Authentication/authorization
- Sensitive data exposure
- Rate limiting
```

---

## Resources

- **Jules Documentation:** https://docs.github.com/copilot/using-github-copilot/asking-github-copilot-questions
- **Copilot Plus Features:** https://github.com/features/copilot
- **Backend Guidelines:** `.claude/CLAUDE.md`
- **API Contracts:** `docs/API_README.md`

---

**Pro Tip:** Use Jules for quick reviews and Zen MCP for deep analysis. They complement each other!

**Last Updated:** November 13, 2025
