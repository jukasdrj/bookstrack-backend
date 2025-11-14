# BooksTrack Autonomous Agents

Optimized agent architecture with clear delegation hierarchy for Cloudflare Workers backend.

---

## Agent Architecture

```
                    ┌─────────────────────┐
                    │   User Request      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  project-manager    │
                    │  (Orchestrator)     │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
      ┌─────────────────────┐    ┌─────────────────────┐
      │  cloudflare-agent   │    │   zen-mcp-master    │
      │  (npx wrangler)     │    │   (14 Zen tools)    │
      └─────────────────────┘    └──────────┬──────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         ▼                  ▼                  ▼
                    [debug]           [codereview]       [secaudit]
                    [planner]         [thinkdeep]        [analyze]
                    [refactor]        [testgen]          [tracer]
                    [precommit]       [docgen]           [consensus]
```

---

## Available Agents

### 🎯 project-manager
**Purpose:** Top-level orchestration and delegation

**Invoke:** `/skill project-manager`

**Use when:**
- Complex multi-phase workflows
- Unsure which specialist to use
- Need coordination between agents
- Strategic planning required

**Key capabilities:**
- Analyzes requests and delegates appropriately
- Coordinates cloudflare-agent + zen-mcp-master
- Maintains context across handoffs
- Selects optimal models for Zen MCP tasks
- Makes strategic decisions (fast vs. careful path)

**Example:**
```
User: "Review the code and deploy to production"

project-manager:
  Phase 1: Delegate to zen-mcp-master (codereview)
  Phase 2: Delegate to cloudflare-agent (deploy + monitor)
  Report: Code review findings + deployment status
```

---

### ☁️ cloudflare-agent
**Purpose:** Cloudflare Workers deployment and monitoring

**Invoke:** `/skill cloudflare-agent`

**Use when:**
- Deploying to production
- Investigating logs/errors
- Managing KV cache or Durable Objects
- Monitoring runtime performance
- Executing rollbacks

**Key capabilities:**
- `npx wrangler deploy` with health checks
- Log streaming and pattern analysis
- Auto-rollback on high error rates
- KV cache inspection
- Performance profiling (latency, cold starts)
- Secrets management

**CRITICAL:** Always uses `npx wrangler` (never plain `wrangler`)

**Example:**
```
User: "Deploy and monitor for errors"

cloudflare-agent:
  1. Pre-flight checks (git status, secrets)
  2. npx wrangler deploy
  3. Health check /health endpoint
  4. Stream logs for 5 minutes
  5. Auto-rollback if error rate > 5%
```

---

### 🧠 zen-mcp-master
**Purpose:** Deep technical analysis using Zen MCP tools

**Invoke:** `/skill zen-mcp-master`

**Use when:**
- Code review needed
- Security audit required
- Complex debugging
- Refactoring planning
- Test generation
- Any deep technical analysis

**Available Zen MCP Tools:**

#### Core Analysis
- **debug** - Complex bug investigation and root cause analysis
- **codereview** - Code quality, architecture, best practices
- **secaudit** - Security vulnerabilities, OWASP Top 10
- **thinkdeep** - Multi-stage reasoning for complex problems
- **analyze** - Codebase architecture understanding

#### Planning & Improvement
- **planner** - Task planning and roadmapping
- **refactor** - Refactoring opportunity identification
- **testgen** - Test generation and coverage improvement
- **consensus** - Multi-model decision making

#### Specialized Tools
- **tracer** - Execution flow and dependency mapping
- **precommit** - Pre-commit validation across repos
- **docgen** - Documentation generation

**Available Models:**
- **Gemini 2.5 Pro** (`gemini-2.5-pro`, `pro`) - 1M context, deep reasoning
- **Grok-4 Heavy** (`grok-4-heavy`, `grokheavy`) - Most powerful
- **Grok Code** (`grok-code-fast-1`, `grokcode`) - Specialized coding
- **Flash Preview** (`flash-preview`) - Fast, efficient

**Example:**
```
User: "Review the search handler for security issues"

zen-mcp-master:
  Tool: secaudit
  Model: gemini-2.5-pro
  Scope: src/handlers/search.js
  Focus: Input validation, injection prevention
  Threat level: high
  → Returns comprehensive security assessment
```

---

## Agent Delegation Patterns

### Simple Tasks
```
User: "Deploy to production"
→ project-manager delegates to cloudflare-agent
→ Single-phase workflow
```

### Two-Phase Tasks
```
User: "Review code and deploy"
→ project-manager coordinates:
  Phase 1: zen-mcp-master (codereview)
  Phase 2: cloudflare-agent (deploy)
```

### Complex Tasks
```
User: "Debug production errors and deploy fix"
→ project-manager coordinates:
  Phase 1: Parallel investigation
    - cloudflare-agent (logs)
    - zen-mcp-master (debug)
  Phase 2: zen-mcp-master (validate fix)
  Phase 3: cloudflare-agent (deploy + monitor)
  Phase 4: zen-mcp-master (post-mortem)
```

---

## Hook Integration

**Location:** `.claude/hooks/post-tool-use.sh`

**Automatic Agent Suggestions:**

| Action | Suggested Agent | Context |
|--------|----------------|---------|
| `npx wrangler deploy` | cloudflare-agent | Deployment monitoring |
| `npx wrangler tail` | cloudflare-agent | Log analysis |
| Edit `src/handlers/*.js` | zen-mcp-master | Code review (codereview tool) |
| Edit `src/services/*.js` | zen-mcp-master | Code review (codereview tool) |
| Edit `wrangler.toml` | Both agents | Config validation |
| Multiple file edits | project-manager | Comprehensive review |
| Edit Durable Objects | zen-mcp-master | WebSocket pattern review |
| Edit test files | zen-mcp-master | Test coverage (testgen tool) |

---

## Common Workflows

### Pre-PR Validation
```bash
/skill zen-mcp-master
# Uses precommit tool to validate all changes
# Then codereview tool for quality check
```

### Production Deployment
```bash
/skill cloudflare-agent
# Executes deployment with health checks
# Monitors for 5 minutes
# Auto-rollback if needed
```

### Security Audit
```bash
/skill zen-mcp-master
# Uses secaudit tool with gemini-2.5-pro
# Comprehensive OWASP Top 10 analysis
# Then codereview for validation
```

### Incident Response
```bash
/skill project-manager
# Coordinates:
# - cloudflare-agent for log analysis
# - zen-mcp-master for debugging
# - zen-mcp-master for fix validation
# - cloudflare-agent for deployment
```

### Major Refactoring
```bash
/skill project-manager
# Coordinates multi-phase refactoring:
# - analyze (current state)
# - refactor (opportunities)
# - planner (step-by-step)
# - codereview (validation)
# - testgen (coverage)
```

---

## Model Selection Guide

**For Critical Work:**
- Security audits: `gemini-2.5-pro` or `grok-4-heavy`
- Complex debugging: `gemini-2.5-pro`
- Architecture decisions: `gemini-2.5-pro`

**For Fast Work:**
- Quick code review: `flash-preview`
- Simple analysis: `flash-preview`
- Documentation: `flash-preview`

**For Coding Tasks:**
- Test generation: `grokcode`
- Refactoring: `grokcode`
- Code tracing: `grokcode`

**Note:** project-manager and zen-mcp-master handle model selection automatically based on task complexity.

---

## Best Practices

### When to Use Each Agent

**Use cloudflare-agent for:**
- Anything `npx wrangler` related
- Production monitoring and logs
- Deployment operations
- KV/Durable Object management

**Use zen-mcp-master for:**
- Code analysis and review
- Security audits
- Debugging complex issues
- Refactoring planning
- Test generation

**Use project-manager for:**
- Multi-phase workflows
- Complex coordination
- Strategic decisions
- When unsure which specialist to use

### Agent Invocation

**Manual invocation:**
```bash
/skill project-manager
/skill cloudflare-agent
/skill zen-mcp-master
```

**Automatic suggestions:**
- Hooks suggest agents based on your actions
- Watch for 🤖 Agent Suggestion messages
- Invoke with `/skill <agent-name>`

---

## Troubleshooting

### Agent Not Found
```bash
# Verify agent exists
ls -la .claude/skills/

# Should see:
# - project-manager/
# - cloudflare-agent/
# - zen-mcp-master/
```

### Hook Not Suggesting
```bash
# Make hook executable
chmod +x .claude/hooks/post-tool-use.sh

# Test manually
bash .claude/hooks/post-tool-use.sh
```

### Wrong Agent Suggested
- Use project-manager to delegate to correct specialist
- Or invoke specialist directly with `/skill <name>`

---

## Migration from Old Agents

**Old agents (REMOVED):**
- ❌ `cf-ops-monitor` → Now `cloudflare-agent`
- ❌ `cf-code-reviewer` → Now `zen-mcp-master` (codereview tool)

**What changed:**
- Clearer separation of concerns
- project-manager for orchestration
- zen-mcp-master accesses 14 specialized tools
- cloudflare-agent focused on `npx wrangler` only
- Better model selection (Gemini 2.5, Grok-4)

---

## Quick Reference

**Three agents, clear roles:**
1. **project-manager** - Orchestrates everything
2. **cloudflare-agent** - Deploys and monitors (npx wrangler)
3. **zen-mcp-master** - Analyzes and validates (14 tools)

**Invocation:**
```bash
/skill project-manager     # Complex workflows
/skill cloudflare-agent    # Deploy/monitor
/skill zen-mcp-master      # Review/debug/audit
```

**Model recommendations:**
- Critical: `gemini-2.5-pro` or `grok-4-heavy`
- Fast: `flash-preview`
- Coding: `grokcode`

---

**Last Updated:** November 13, 2025
**Architecture:** Optimized 3-agent delegation hierarchy
**Available Models:** 15 models (Gemini + Grok)
**Zen MCP Tools:** 14 specialized tools
