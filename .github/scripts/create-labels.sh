#!/bin/bash

# GitHub Label Creation Script for BooksTrack Backend
# Creates comprehensive labels for issue and PR management

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Creating GitHub labels for BooksTrack Backend...${NC}\n"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) is not installed"
  echo "Install: brew install gh"
  exit 1
fi

# Verify authentication
if ! gh auth status &> /dev/null; then
  echo "❌ Not authenticated with GitHub CLI"
  echo "Run: gh auth login"
  exit 1
fi

# Get current repository
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "${BLUE}Repository: $REPO${NC}\n"

# Function to create or update label
create_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  if gh label list --repo "$REPO" | grep -q "^$name"; then
    echo -e "${YELLOW}Updating: $name${NC}"
    gh label edit "$name" --color "$color" --description "$description" --repo "$REPO" 2>/dev/null || true
  else
    echo -e "${GREEN}Creating: $name${NC}"
    gh label create "$name" --color "$color" --description "$description" --repo "$REPO" 2>/dev/null || true
  fi
}

echo "📊 Creating Priority Labels..."
create_label "P0: Critical" "d73a4a" "Production down, data loss, security breach"
create_label "P1: High" "e99695" "Major functionality broken, blocking deployments"
create_label "P2: Medium" "f9d0c4" "Important but not blocking"
create_label "P3: Low" "fef2c0" "Nice to have, polish"

echo ""
echo "🎯 Creating Phase Labels..."
create_label "phase: 1-foundation" "0e8a16" "Core infrastructure and API stability"
create_label "phase: 2-search" "1d76db" "Search functionality and provider integrations"
create_label "phase: 3-scanning" "5319e7" "AI bookshelf scanning and CSV import"
create_label "phase: 4-caching" "fbca04" "Caching strategies and performance"
create_label "phase: 5-optimization" "d93f0b" "Performance tuning and cost reduction"
create_label "phase: 6-launch" "006b75" "Production readiness and monitoring"

echo ""
echo "💻 Creating Platform Labels..."
create_label "platform: cloudflare" "f38020" "Cloudflare Workers specific"
create_label "platform: api" "0052cc" "REST API endpoints"
create_label "platform: websocket" "1f77b4" "WebSocket and Durable Objects"
create_label "platform: kv" "ff7f0e" "KV cache related"

echo ""
echo "🔧 Creating Component Labels..."
create_label "component: search" "c5def5" "Book search endpoints (Google Books, OpenLibrary, ISBNdb)"
create_label "component: ai" "d4c5f9" "AI features (Gemini scanning, CSV parsing)"
create_label "component: cache" "fef2c0" "Caching strategies (KV, CDN)"
create_label "component: websocket" "bfdadc" "WebSocket progress tracking"
create_label "component: enrichment" "c2e0c6" "Batch enrichment and background jobs"
create_label "component: validation" "f9d0c4" "Input validation and sanitization"
create_label "component: providers" "e99695" "External API integrations"
create_label "component: routing" "d73a4a" "Route handlers and main router"
create_label "component: workers" "f38020" "Cloudflare Workers runtime"
create_label "component: durable-objects" "1f77b4" "Durable Objects implementation"

echo ""
echo "⚡ Creating Effort Labels..."
create_label "effort: XS (<2h)" "e8f5e9" "Quick fix or small change"
create_label "effort: S (2-4h)" "c8e6c9" "Half day of work"
create_label "effort: M (4-8h)" "a5d6a7" "Full day of work"
create_label "effort: L (1-3d)" "81c784" "Multiple days, significant feature"
create_label "effort: XL (3-5d)" "66bb6a" "Week-long project"

echo ""
echo "📋 Creating Status Labels..."
create_label "status: ready" "0e8a16" "Ready for development"
create_label "status: in-progress" "fbca04" "Currently being worked on"
create_label "status: blocked" "d93f0b" "Blocked by external dependency"
create_label "status: needs-review" "5319e7" "Awaiting code review"
create_label "status: needs-testing" "1d76db" "Needs testing before merge"
create_label "status: deployed" "006b75" "Deployed to production"

echo ""
echo "🏷️ Creating Type Labels..."
create_label "type: bug" "d73a4a" "Something isn't working"
create_label "type: feature" "0e8a16" "New functionality"
create_label "type: enhancement" "a2eeef" "Improvement to existing feature"
create_label "type: refactor" "fbca04" "Code refactoring, no behavior change"
create_label "type: documentation" "0075ca" "Documentation updates"
create_label "type: security" "b60205" "Security vulnerability or hardening"
create_label "type: performance" "d4c5f9" "Performance optimization"
create_label "type: ci-cd" "bfd4f2" "CI/CD pipeline changes"
create_label "type: dependencies" "0366d6" "Dependency updates"

echo ""
echo "🤖 Creating AI Labels..."
create_label "ai: claude-code" "8b5cf6" "Worked on by Claude Code"
create_label "ai: jules" "ec4899" "Reviewed by Jules"
create_label "ai: copilot" "06b6d4" "Generated with Copilot"
create_label "ai: zen-mcp" "f59e0b" "Analyzed with Zen MCP"

echo ""
echo "🎨 Creating Special Labels..."
create_label "good first issue" "7057ff" "Good for newcomers"
create_label "help wanted" "008672" "Extra attention needed"
create_label "wontfix" "ffffff" "This will not be worked on"
create_label "duplicate" "cfd3d7" "This issue already exists"
create_label "breaking-change" "b60205" "Breaking API change"
create_label "needs-migration" "d93f0b" "Requires data migration"

echo ""
echo -e "${GREEN}✅ All labels created successfully!${NC}"
echo ""
echo "View labels: gh label list --repo $REPO"
echo "Or visit: https://github.com/$REPO/labels"
