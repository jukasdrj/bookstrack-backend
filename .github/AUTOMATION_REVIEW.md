# GitHub Actions & Hooks Automation Review

**Review Date:** November 13, 2025
**Reviewer:** Claude Code
**Focus:** DTO contract synchronization and deployment automation

---

## Executive Summary

✅ **Overall Status:** Workflows and hooks are generally well-structured
⚠️ **Critical Gap:** TypeScript DTO files are NOT automatically synced to iOS
✅ **Documentation Sync:** Working correctly for markdown files
⚠️ **Minor Issues:** Several improvements recommended

---

## Findings

### 1. DTO Contract Synchronization ⚠️

**Issue:** TypeScript DTO definitions are NOT automatically copied to iOS project

**Current State:**
- ✅ Markdown documentation (`docs/API_README.md`) is synced via `.github/workflows/sync-docs.yml`
- ❌ TypeScript source files (`src/types/*.ts`) are NOT synced
- ❌ No automated process to keep iOS Swift DTOs in sync with TypeScript DTOs

**Location of DTOs:**
```
Backend (Source of Truth):
- src/types/canonical.ts (WorkDTO, EditionDTO, AuthorDTO)
- src/types/enums.ts (EditionFormat, AuthorGender, etc.)
- src/types/responses.ts (ApiResponse)
- src/types/websocket-messages.ts

iOS (Must be manually updated):
- BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/WorkDTO.swift
- BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/EditionDTO.swift
- BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/AuthorDTO.swift
- BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/ApiResponse.swift
```

**Risk Level:** HIGH
- Breaking changes to TypeScript DTOs can break iOS app
- Manual synchronization is error-prone
- No automated validation that TypeScript and Swift types match

**Recommended Fix:** See [Recommendations](#recommendations) section

---

### 2. Documentation Sync Workflow ✅

**File:** `.github/workflows/sync-docs.yml`

**Status:** ✅ Working correctly

**What It Does:**
- Triggers on changes to `docs/API_README.md` or `docs/QUICK_START.md`
- Copies documentation to iOS repo (`books-tracker-v1`)
- Optional sync to Flutter repo (when `FLUTTER_REPO_ENABLED=true`)
- Graceful failure handling (repo doesn't exist yet)

**Issues Found:**

#### Issue 2.1: Missing npx prefix ⚠️
**Location:** `.github/workflows/sync-docs.yml` (not actually used for wrangler)

**Status:** Not applicable - workflow doesn't use wrangler

---

### 3. Deployment Workflows ⚠️

#### 3.1 Production Deployment
**File:** `.github/workflows/deploy-production.yml`

**Issues:**

**Issue 3.1.1: Missing `npx` prefix for wrangler**
```yaml
# Current (line 29):
command: deploy

# Should be:
command: npx wrangler deploy
```
**Risk:** May use system wrangler instead of project version
**Impact:** Inconsistent deployments, version mismatches

**Issue 3.1.2: Hardcoded worker URL in health check**
```yaml
# Line 34:
curl -f https://api-worker.jukasdrj.workers.dev/health || exit 1
```
**Risk:** If worker name changes in `wrangler.toml`, health check will fail
**Recommendation:** Extract URL from wrangler deployment output

**Issue 3.1.3: Short health check delay**
```yaml
sleep 5  # Wait for deployment to propagate
```
**Risk:** 5 seconds may not be enough for global propagation
**Recommendation:** Increase to 10-15 seconds or implement retry logic

#### 3.2 Staging Deployment
**File:** `.github/workflows/deploy-staging.yml`

**Same issues as production:**
- Missing `npx` prefix
- Hardcoded URL
- Short delay

---

### 4. Git Hooks ✅

#### 4.1 Pre-Commit Hook
**File:** `.claude/hooks/pre-commit.sh`

**Status:** ✅ Excellent implementation

**Features:**
- ✅ Blocks sensitive files (`.env`, credentials)
- ✅ Detects hardcoded secrets
- ✅ Warns about debug statements
- ✅ Validates JavaScript syntax
- ✅ Checks `wrangler.toml` validity
- ✅ Detects large files
- ✅ Verifies test coverage for new handlers
- ✅ Reminds to update API documentation

**Issues:** None found

#### 4.2 Post-Tool-Use Hook
**File:** `.claude/hooks/post-tool-use.sh`

**Status:** ✅ Working correctly (updated for new agent architecture)

**Features:**
- ✅ Suggests `cloudflare-agent` for wrangler commands
- ✅ Suggests `zen-mcp-master` for code changes
- ✅ Suggests `project-manager` for multi-file edits
- ✅ Smart detection of file types

**Issues:** None found

---

## Recommendations

### Priority 1: Implement DTO Contract Synchronization 🔴

**Problem:** TypeScript DTOs and Swift DTOs can drift out of sync

**Solution Option A: Automated TypeScript → Swift Conversion**

Create `.github/workflows/sync-dtos.yml`:

```yaml
name: 🔄 Sync DTO Contracts to iOS

on:
  push:
    branches: [main]
    paths:
      - 'src/types/canonical.ts'
      - 'src/types/enums.ts'
      - 'src/types/responses.ts'
      - '.github/workflows/sync-dtos.yml'

jobs:
  sync-dtos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate Swift DTOs from TypeScript
        run: |
          # Option 1: Use quicktype for TS → Swift conversion
          npx quicktype src/types/canonical.ts \
            --lang swift \
            --out /tmp/generated-dtos.swift

          # Option 2: Manual template-based generation
          node scripts/generate-swift-dtos.js

      - name: Sync to iOS repo
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          git clone --depth 1 https://github.com/jukasdrj/books-tracker-v1.git /tmp/ios

          # Copy generated DTOs
          cp /tmp/generated-dtos.swift \
            /tmp/ios/BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/

          cd /tmp/ios
          if ! git diff --quiet; then
            git add .
            git commit -m "chore: sync DTOs from backend

Synced from: ${{ github.sha }}
Generated from: src/types/*.ts"
            git push origin main
          fi
```

**Pros:**
- Fully automated
- Single source of truth (TypeScript)
- No manual synchronization

**Cons:**
- Requires TS → Swift conversion tool
- May need manual adjustments for Swift-specific features

---

**Solution Option B: Validation-Only Approach**

Create a workflow that validates DTOs match but doesn't auto-sync:

```yaml
name: 🔍 Validate DTO Contracts

on:
  pull_request:
    paths:
      - 'src/types/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check iOS DTOs are updated
        run: |
          # Check if iOS repo DTOs match backend
          node scripts/validate-dto-sync.js

          # If validation fails, block PR and show diff
```

**Pros:**
- Prevents drift without automation complexity
- Forces manual review of DTO changes
- Catches breaking changes early

**Cons:**
- Still requires manual synchronization
- Can block PRs if iOS repo not updated

---

**Recommended Approach:** Start with Option B (validation), then migrate to Option A once proven

---

### Priority 2: Fix Deployment Workflows 🟡

#### Fix 2.1: Use `npx wrangler` consistently

**File:** `.github/workflows/deploy-production.yml`

```yaml
# Before:
- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: deploy

# After:
- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: npx wrangler deploy
```

Apply same fix to `deploy-staging.yml`

---

#### Fix 2.2: Extract deployment URL dynamically

```yaml
- name: Deploy to Cloudflare Workers
  id: deploy
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: npx wrangler deploy

- name: Extract deployment URL
  id: url
  run: |
    # Get worker URL from wrangler output
    WORKER_URL=$(npx wrangler deployments list --json | jq -r '.[0].url')
    echo "url=$WORKER_URL" >> $GITHUB_OUTPUT

- name: Health Check
  run: |
    sleep 15  # Increased from 5 to 15 seconds
    curl -f ${{ steps.url.outputs.url }}/health || exit 1
```

---

#### Fix 2.3: Implement retry logic for health checks

```yaml
- name: Health Check with Retry
  run: |
    sleep 10  # Initial wait

    for i in {1..5}; do
      if curl -sf https://api.oooefam.net/health; then
        echo "✅ Health check passed on attempt $i"
        exit 0
      fi
      echo "⏳ Attempt $i failed, retrying in 5s..."
      sleep 5
    done

    echo "❌ Health check failed after 5 attempts"
    exit 1
```

---

### Priority 3: Add DTO Change Detection Hook 🟢

**File:** `.claude/hooks/pre-commit.sh`

Add new check after line 176:

```bash
# 10. Check DTO changes require documentation update
if git diff --cached --name-only | grep -qE "src/types/(canonical|enums|responses)\.ts"; then
  echo "🔄 Checking DTO contract changes..."

  if ! git diff --cached --name-only | grep -q "docs/API_README.md"; then
    echo -e "${YELLOW}⚠ Warning: DTO contracts changed without API doc updates${NC}"
    echo "  Changed files:"
    git diff --cached --name-only | grep "src/types/"
    echo "  Consider updating docs/API_README.md"
    echo "  ⚠ IMPORTANT: Update iOS Swift DTOs manually!"
  fi
fi
```

This warns developers when they change DTOs but don't update documentation.

---

### Priority 4: Document DTO Synchronization Process 🟢

Create `.github/DTO_SYNC_PROCESS.md`:

```markdown
# DTO Contract Synchronization

## When You Change DTOs

1. **Backend Changes:**
   - Edit `src/types/canonical.ts`, `enums.ts`, or `responses.ts`
   - Run tests: `npm test`
   - Update `docs/API_README.md` with new contracts

2. **iOS Changes Required:**
   - Clone iOS repo: `git clone https://github.com/jukasdrj/books-tracker-v1.git`
   - Navigate to: `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/`
   - Update Swift DTOs to match TypeScript changes
   - Run iOS tests to ensure compatibility

3. **Deployment Order:**
   - Deploy backend first (backward compatible changes only!)
   - Deploy iOS app second (can use new fields)

## Breaking Changes

If you must make breaking changes:
1. Create new API version (`/v2/*` endpoints)
2. Keep `/v1/*` endpoints working
3. Migrate iOS app to `/v2/*`
4. Deprecate `/v1/*` after migration

## Automation Status

- ✅ Documentation sync (automatic)
- ⏳ DTO sync (manual - automation planned)
- ⏳ DTO validation (coming soon)
```

---

## Testing Recommendations

### Test 1: Verify Documentation Sync

```bash
# 1. Make a change to API docs
echo "# Test comment" >> docs/API_README.md

# 2. Commit and push
git add docs/API_README.md
git commit -m "test: verify doc sync automation"
git push origin main

# 3. Check GitHub Actions
# Go to: https://github.com/jukasdrj/bookstrack-backend/actions
# Verify "📚 Sync API Docs to Other Repos" runs successfully

# 4. Verify iOS repo was updated
cd ~/Downloads/xcode/books-tracker-v1
git pull origin main
git log --oneline docs/ | head -3
# Should show sync commit from backend
```

### Test 2: Verify Pre-Commit Hook

```bash
# Test sensitive file blocking
echo "API_KEY=secret" > .env
git add .env
git commit -m "test"
# Expected: Blocked by pre-commit hook

# Test DTO change warning
echo "// comment" >> src/types/canonical.ts
git add src/types/canonical.ts
git commit -m "test: dto change"
# Expected: Warning to update docs and iOS
```

### Test 3: Verify Deployment Workflow

```bash
# Trigger manual deployment to staging
gh workflow run deploy-staging.yml

# Monitor deployment
gh run list --workflow=deploy-staging.yml
gh run view --log
```

---

## Summary of Issues

| Issue | Severity | File | Status |
|-------|----------|------|--------|
| TypeScript DTOs not synced to iOS | 🔴 Critical | N/A | Not implemented |
| Missing `npx` in wrangler commands | 🟡 Medium | deploy-*.yml | Needs fix |
| Hardcoded deployment URLs | 🟡 Medium | deploy-*.yml | Needs fix |
| Short health check delays | 🟢 Low | deploy-*.yml | Needs improvement |
| No DTO change detection | 🟢 Low | pre-commit.sh | Enhancement |

---

## Action Items

**Immediate (This Week):**
1. ✅ Fix `npx wrangler` in deployment workflows
2. ✅ Implement health check retry logic
3. ✅ Add DTO change warning to pre-commit hook
4. ✅ Create DTO synchronization documentation

**Short-term (Next Sprint):**
1. Implement DTO validation workflow (Option B)
2. Extract deployment URLs dynamically
3. Test all workflows end-to-end

**Long-term (Future):**
1. Implement automated TS → Swift conversion (Option A)
2. Set up pre-commit validation for DTO drift
3. Create visual DTO sync dashboard

---

**Reviewed By:** Claude Code
**Next Review:** After implementing Priority 1 fixes
**Questions:** Contact @jukasdrj or review `.github/SYNC_AUTOMATION.md`
