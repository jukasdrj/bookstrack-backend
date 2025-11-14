#!/bin/bash

# Sync Robit (Claude Code Agents) Updates to All Repos
# Run when you update universal agents (project-manager, zen-mcp-master)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Syncing Robit Updates to All Repos${NC}"
echo ""

# Configuration
IOS_REPO="jukasdrj/books-tracker-v1"
FLUTTER_REPO="jukasdrj/bookstrack-flutter"
TEMP_DIR="/tmp/bookstrack-robit-sync-$$"

# Check we're in backend repo
if [ ! -f ".claude/skills/project-manager/skill.md" ]; then
    echo -e "${RED}❌ Must run from bookstrack-backend directory${NC}"
    exit 1
fi

mkdir -p "$TEMP_DIR"

# ============================================================================
# SYNC TO iOS
# ============================================================================

echo -e "${BLUE}📱 Syncing to iOS repo...${NC}"

gh repo clone "$IOS_REPO" "$TEMP_DIR/ios" -- --depth=1 2>&1 || {
    echo -e "${YELLOW}⚠️  Could not clone iOS repo${NC}"
    IOS_SKIP=true
}

if [ "$IOS_SKIP" != "true" ]; then
    cd "$TEMP_DIR/ios"

    # Update universal agents
    echo "📋 Updating project-manager..."
    cp -r "$OLDPWD/.claude/skills/project-manager" .claude/skills/

    echo "📋 Updating zen-mcp-master..."
    cp -r "$OLDPWD/.claude/skills/zen-mcp-master" .claude/skills/

    echo "📋 Updating documentation..."
    cp "$OLDPWD/.claude/ROBIT_OPTIMIZATION.md" .claude/ 2>/dev/null || true
    cp "$OLDPWD/.claude/ROBIT_SHARING_FRAMEWORK.md" .claude/ 2>/dev/null || true

    if ! git diff --quiet .claude/; then
        git add .claude/
        git commit -m "chore: sync Claude agent updates from backend

Updated universal agents:
- project-manager
- zen-mcp-master
- Documentation

Synced via: scripts/sync-robit-to-repos.sh"
        git push origin main
        echo -e "${GREEN}✅ iOS repo updated${NC}"
    else
        echo -e "${YELLOW}ℹ️  No changes to sync${NC}"
    fi
fi

# ============================================================================
# SYNC TO FLUTTER (if exists)
# ============================================================================

echo ""
echo -e "${BLUE}🎯 Syncing to Flutter repo...${NC}"

gh repo clone "$FLUTTER_REPO" "$TEMP_DIR/flutter" -- --depth=1 2>&1 || {
    echo -e "${YELLOW}⚠️  Could not clone Flutter repo${NC}"
    FLUTTER_SKIP=true
}

if [ "$FLUTTER_SKIP" != "true" ]; then
    cd "$TEMP_DIR/flutter"

    cp -r "$OLDPWD/.claude/skills/project-manager" .claude/skills/
    cp -r "$OLDPWD/.claude/skills/zen-mcp-master" .claude/skills/

    if ! git diff --quiet .claude/; then
        git add .claude/
        git commit -m "chore: sync Claude agent updates from backend"
        git push origin main
        echo -e "${GREEN}✅ Flutter repo updated${NC}"
    else
        echo -e "${YELLOW}ℹ️  No changes to sync${NC}"
    fi
fi

# ============================================================================
# CLEANUP
# ============================================================================

cd "$OLDPWD"
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
