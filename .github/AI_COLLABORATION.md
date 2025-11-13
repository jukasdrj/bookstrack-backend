# AI Collaboration Workflow

**How AI tools work together on BooksTrack Backend**

---

## The AI Team

### 1. **GitHub Copilot** (In IDE)
- **Role:** Real-time code completion
- **When:** Writing new code
- **Access:** VS Code, JetBrains IDEs
- **Cost:** Included in Copilot Plus ($39/month)

### 2. **Claude Code** (Terminal)
- **Role:** Multi-file refactoring, architecture changes
- **When:** Complex changes, following CLAUDE.md guidelines
- **Access:** Terminal CLI
- **Cost:** Included in Claude Max ($200/month)

### 3. **Jules** (GitHub.com)
- **Role:** PR reviews, code explanations
- **When:** After PR creation
- **Access:** GitHub PR comments
- **Cost:** Included in Copilot Plus ($39/month)

### 4. **Zen MCP** (Terminal)
- **Role:** Deep analysis (security, debugging, planning)
- **When:** Complex issues, architecture decisions
- **Access:** Terminal via Claude Code
- **Cost:** ~$2-5/month (API calls)

---

## Development Workflow

### Stage 1: Writing Code

**Developer + GitHub Copilot**

```javascript
// Developer types comment
// GET endpoint to search by ISBN

// Copilot suggests:
export async function handleISBNSearch(request, env) {
  const isbn = new URL(request.url).searchParams.get('isbn')

  if (!isbn) {
    return jsonResponse({ success: false, error: 'Missing ISBN' }, 400)
  }

  // Developer accepts, continues...
}
```

**Handoff:** Developer has initial implementation from Copilot.

---

### Stage 2: Refactoring

**Developer + Claude Code**

```bash
# In terminal
"Refactor search handler to follow CLAUDE.md patterns:
- Add proper validation
- Implement caching
- Use canonical response format
- Add error handling"
```

Claude Code:
1. Reads `.claude/CLAUDE.md` guidelines
2. Refactors multiple files
3. Ensures consistency across codebase
4. Follows Cloudflare Workers best practices

**Handoff:** Code now follows project standards.

---

### Stage 3: Validation

**Developer + Zen MCP**

```bash
# Run security audit
mcp zen codereview \
  --files src/handlers/search.js \
  --review-type security \
  --model gemini-2.5-pro
```

Zen MCP analyzes:
- Input validation
- Rate limiting
- Error message safety
- Cache security
- CORS configuration

**Handoff:** Security issues identified and fixed.

---

### Stage 4: PR Review

**Developer + Jules**

1. Push to GitHub and create PR
2. Copilot Review workflow auto-labels
3. Developer requests Jules review:

```markdown
@jules review this search handler for:
- Cloudflare Workers best practices
- Performance (< 500ms target)
- Error handling completeness
```

Jules provides feedback on:
- Code quality
- Potential bugs
- Performance concerns
- Missing edge cases

**Handoff:** Code reviewed by AI, ready for human review.

---

### Stage 5: Human Approval

**Human Developer**

- Reviews AI feedback
- Makes final decision
- Approves or requests changes
- Merges PR

**Handoff:** Merged to main.

---

### Stage 6: Deployment

**GitHub Actions**

- Auto-deploys to Cloudflare Workers
- Runs health checks
- Notifies team

**Handoff:** Live in production!

---

## AI-to-AI Communication

### Claude Code → Zen MCP

When Claude Code needs deep analysis:

```bash
# Claude Code realizes this needs security review
"This looks complex. Let me run a security audit."

# Internally calls Zen MCP
mcp zen codereview --review-type security --files src/handlers/scan.js
```

### Claude Code → Jules

After implementing feature:

```markdown
# Claude Code creates PR with context
This feature was implemented by Claude Code following CLAUDE.md guidelines.

Key changes:
- New search provider (Goodreads)
- Integrated with fallback chain
- Added caching (24h TTL)
- Response time < 500ms validated

@jules please review for:
- Integration correctness
- Edge cases
- Performance implications
```

### Jules → Zen MCP

Jules might recommend escalation:

```markdown
# Jules comment
This looks like it needs deeper security analysis. I see:
- Complex rate limiting logic
- External API integration
- User file upload handling

Recommend running: `mcp zen codereview --review-type security`
```

---

## Communication Protocols

### From Claude Code to Jules

**In PR Description:**
```markdown
## Implementation Notes

**Implemented by:** Claude Code
**Follows:** `.claude/CLAUDE.md` guidelines
**Models used:** Local Haiku (refactoring), Gemini 2.5 Pro (validation)

**Changes:**
1. Added Goodreads search provider
2. Updated fallback chain logic
3. Added rate limiting
4. Implemented caching

**Testing:**
- [x] Local dev testing passed
- [x] Response time < 500ms
- [x] Cache hit rate > 60%
- [x] Error handling tested

**Review Focus:**
@jules please review:
- Integration with existing providers
- Error handling completeness
- Performance implications
```

### From Jules to Developer

**Jules Comment:**
```markdown
Great implementation! A few suggestions:

**🟢 Strengths:**
- Clean integration with fallback chain
- Good error handling
- Proper caching strategy

**🟡 Suggestions:**
1. Add rate limiting for Goodreads API (line 42)
2. Consider using Promise.allSettled for parallel requests (line 78)
3. Add test for cache invalidation edge case

**🔴 Issues:**
None found

**Performance:** Looks good for < 500ms target

**Security:** No concerns

**Recommendation:** Approve after addressing rate limiting
```

### From Developer to Zen MCP

**Complex Issue:**
```bash
# Developer message to Zen MCP
"Debug this: Batch enrichment fails intermittently at 50 ISBNs.
- Sometimes succeeds, sometimes times out
- No clear pattern in logs
- External APIs seem responsive
- Cache hit rate is normal"

# Zen MCP investigates with multi-model consensus
mcp zen debug \
  --issue "Intermittent batch enrichment failures at 50 ISBNs" \
  --files src/services/enrichment.js,src/utils/rate-limiter.js \
  --thinking-mode high \
  --models "gemini-2.5-pro,o3-pro"
```

---

## Decision Making

### When to Use Which AI

| Situation | Use This AI | Why |
|-----------|-------------|-----|
| Writing new code | GitHub Copilot | Real-time suggestions in IDE |
| Multi-file refactor | Claude Code | Understands project structure |
| Following standards | Claude Code | Reads CLAUDE.md guidelines |
| PR review | Jules | Quick feedback on GitHub |
| Security audit | Zen MCP | Deep analysis with premium models |
| Complex debugging | Zen MCP | Multi-model consensus |
| Architecture planning | Zen MCP Planner | Structured planning with validation |
| Performance optimization | Zen MCP | Specialized analysis |

---

## Cost Optimization

### Free/Included
- **Copilot:** Included in $39/month subscription
- **Jules:** Included in $39/month subscription
- **Claude Code:** Included in $200/month Max plan
- **Haiku (Zen MCP):** Free local execution

### Paid API Calls
- **Gemini 2.5 Pro:** ~$0.002 per 1K tokens
- **O3 Pro:** ~$0.01 per 1K tokens
- **Grok 4:** ~$0.005 per 1K tokens

### Optimization Strategy
1. **80% of tasks:** Use Copilot + Claude Code (free)
2. **15% of tasks:** Use Zen MCP with Haiku (free)
3. **5% of tasks:** Use Zen MCP with premium models (~$2-5/month)

**Result:** ~$2-5/month in API costs (vs $50-100 without optimization)

---

## Example Workflows

### Example 1: New Feature

1. **Planning (Zen MCP Planner):**
   ```bash
   mcp zen planner --feature "Add batch ISBN validation endpoint"
   ```

2. **Implementation (Copilot + Claude Code):**
   - Copilot suggests code as you type
   - Claude Code refactors to follow CLAUDE.md

3. **Security Review (Zen MCP):**
   ```bash
   mcp zen codereview --review-type security --files src/handlers/batch.js
   ```

4. **PR Review (Jules):**
   ```markdown
   @jules review this batch validation feature
   ```

5. **Deploy (GitHub Actions):**
   - Auto-deploys to production
   - Health checks pass

### Example 2: Bug Fix

1. **Bug Report:** User reports 500 error on search endpoint

2. **Initial Investigation (Developer):**
   - Check logs: `wrangler tail`
   - Reproduce locally: `curl localhost:8787/v1/search/isbn?isbn=123`

3. **Deep Debug (Zen MCP):**
   ```bash
   mcp zen debug --issue "500 error on invalid ISBN input"
   ```

4. **Fix (Claude Code):**
   ```bash
   "Fix validation to return 400 for invalid ISBN, not 500"
   ```

5. **PR Review (Jules):**
   ```markdown
   @jules verify the fix handles all invalid ISBN formats
   ```

6. **Deploy:** Auto-deploys, bug fixed!

### Example 3: Performance Optimization

1. **Performance Issue:** Search endpoint slow (3s average)

2. **Analysis (Zen MCP):**
   ```bash
   mcp zen codereview \
     --review-type performance \
     --files src/handlers/search.js,src/services/book-service.js
   ```

3. **Optimization Plan (Zen MCP Planner):**
   ```bash
   mcp zen planner --feature "Optimize search endpoint to < 500ms"
   ```

4. **Implementation (Claude Code):**
   - Add aggressive caching
   - Implement request coalescing
   - Parallelize provider calls

5. **Validation (Jules):**
   ```markdown
   @jules verify performance improvements don't break functionality
   ```

6. **Monitor:** Check Cloudflare Analytics for new response times

---

## Best Practices

### 1. Context Handoff

Always provide context when handing off between AI tools:

```markdown
## Context for @jules

**Background:** This feature was planned with Zen MCP and implemented by Claude Code

**Planning output:** See #issue-42
**Implementation approach:** Monolith pattern with direct function calls
**Models used:** Haiku (refactoring), Gemini 2.5 Pro (security validation)

**Review focus:** Integration with existing caching layer
```

### 2. Incremental Development

Don't try to build everything at once:

```
Phase 1: Copilot + Claude Code → Basic implementation
Phase 2: Zen MCP → Security audit
Phase 3: Jules → PR review
Phase 4: Human → Final approval
```

### 3. Use Right Tool for Job

Don't use expensive models for simple tasks:

- ✅ Use Copilot for autocomplete
- ✅ Use Claude Code with Haiku for refactoring
- ✅ Use Zen MCP with Gemini 2.5 Pro for security
- ❌ Don't use O3 Pro for simple code generation

### 4. Trust But Verify

AI tools are assistants, not replacements:

- ✅ Review AI suggestions before accepting
- ✅ Test changes locally
- ✅ Run full test suite
- ✅ Human developer makes final decision

---

## Monitoring AI Usage

### Track What's Working

```bash
# Label PRs with AI tool used
gh pr create \
  --label "ai: claude-code" \
  --label "ai: jules" \
  --label "ai: zen-mcp"

# Review AI-assisted PRs
gh pr list --label "ai: claude-code"

# Analyze impact
# Are AI-reviewed PRs higher quality?
# Do they have fewer bugs?
# Faster development?
```

### Cost Tracking

```bash
# Monthly Zen MCP usage
cat ~/.zen/logs/api-usage.json | jq '.total_cost'

# If > $10/month, optimize:
# - Use Haiku more often
# - Reduce premium model usage
# - Cache common analyses
```

---

## Resources

- **Claude Code Docs:** https://docs.claude.com/claude-code
- **Copilot Docs:** https://docs.github.com/copilot
- **Jules Guide:** `.github/JULES_GUIDE.md`
- **Zen MCP Setup:** `docs/robit/GITHUB_ZEN_SETUP.md`
- **Backend Guidelines:** `.claude/CLAUDE.md`

---

**Last Updated:** November 13, 2025
**AI Team:** Claude Code, Jules, Zen MCP, GitHub Copilot
