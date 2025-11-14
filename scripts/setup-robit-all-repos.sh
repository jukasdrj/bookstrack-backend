#!/bin/bash

# Setup Robit (Claude Code Agents) Across All BooksTrack Repositories
# Run from: bookstrack-backend directory
# Uses: Local repos first, then gh CLI as fallback

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🤖 BooksTrack Robit Setup - Multi-Repo Configuration${NC}"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) not found (will only use local repos)${NC}"
    GH_AVAILABLE=false
else
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}⚠️  Not authenticated with GitHub (will only use local repos)${NC}"
        GH_AVAILABLE=false
    else
        echo -e "${GREEN}✓ GitHub CLI ready${NC}"
        GH_AVAILABLE=true
    fi
fi

echo ""

# Configuration
BACKEND_REPO="jukasdrj/bookstrack-backend"
IOS_REPO="jukasdrj/books-tracker-v1"
FLUTTER_REPO="jukasdrj/bookstrack-flutter"

TEMP_DIR="/tmp/bookstrack-robit-setup-$$"
mkdir -p "$TEMP_DIR"

# Current directory should be backend repo
if [ ! -f ".claude/skills/project-manager/skill.md" ]; then
    echo -e "${RED}❌ Must run from bookstrack-backend directory${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo -e "${GREEN}✓ Running from backend repo${NC}"
BACKEND_DIR="$(pwd)"
echo ""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Function to find local repository
find_local_repo() {
    local repo_name="$1"

    # Define alternative names for repos
    local search_names=("$repo_name")
    if [ "$repo_name" = "bookstrack-flutter" ]; then
        search_names+=("books-flutter")
    fi

    local search_dirs=(
        "$HOME/Downloads/vscode"
        "$HOME/Downloads/xcode"
        "$HOME/Downloads"
        "$HOME/Documents"
        "$HOME/Projects"
        "$HOME/Developer"
        "$HOME"
    )

    # Check environment variable override
    local env_var_name="$(echo "$repo_name" | tr '[:lower:]-' '[:upper:]_')_PATH"
    local env_path="${!env_var_name}"

    if [ -n "$env_path" ] && [ -d "$env_path/.git" ]; then
        echo "$env_path"
        return 0
    fi

    # Search common locations with all name variations
    for dir in "${search_dirs[@]}"; do
        for name in "${search_names[@]}"; do
            local path="$dir/$name"
            if [ -d "$path/.git" ]; then
                echo "$path"
                return 0
            fi
        done
    done

    return 1
}

# Function to get repository working directory
get_repo_dir() {
    local repo_name="$1"
    local github_repo="$2"
    local target_dir="$3"

    echo -e "${BLUE}🔍 Looking for $repo_name...${NC}" >&2

    # Try to find local repo first
    local local_path
    if local_path=$(find_local_repo "$repo_name"); then
        echo -e "${GREEN}✓ Found local repository: $local_path${NC}" >&2

        # Check if it's a git repo and has uncommitted changes
        if ! git -C "$local_path" diff-index --quiet HEAD -- 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Repository has uncommitted changes${NC}" >&2
            echo "   Continuing anyway (changes will be committed later)" >&2
        fi

        echo "$local_path"
        return 0
    fi

    # Fall back to GitHub clone
    if [ "$GH_AVAILABLE" = true ]; then
        echo "⬇️  Not found locally, cloning from GitHub..." >&2
        if gh repo clone "$github_repo" "$target_dir" -- --depth=1 2>&1 >&2; then
            echo "$target_dir"
            return 0
        else
            echo -e "${YELLOW}⚠️  Could not clone from GitHub${NC}" >&2
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Not found locally and GitHub CLI unavailable${NC}" >&2
        return 1
    fi
}

# ============================================================================
# SETUP IOS REPO
# ============================================================================

echo -e "${BLUE}📱 Setting up iOS repo (books-tracker-v1)...${NC}"
echo ""

IOS_DIR=$(get_repo_dir "books-tracker-v1" "$IOS_REPO" "$TEMP_DIR/ios")
IOS_STATUS=$?

if [ $IOS_STATUS -eq 0 ]; then
    cd "$IOS_DIR"

    # Create .claude directory structure
    echo "📁 Creating .claude directory structure..."
    mkdir -p .claude/skills
    mkdir -p .claude/hooks
    mkdir -p .claude/docs

    # Copy universal agents from backend
    echo "📋 Copying universal agents..."
    cp -r "$BACKEND_DIR/.claude/skills/project-manager" .claude/skills/
    cp -r "$BACKEND_DIR/.claude/skills/zen-mcp-master" .claude/skills/

    # Copy documentation
    echo "📋 Copying documentation..."
    cp "$BACKEND_DIR/.claude/ROBIT_OPTIMIZATION.md" .claude/ 2>/dev/null || true
    cp "$BACKEND_DIR/.claude/ROBIT_SHARING_FRAMEWORK.md" .claude/ 2>/dev/null || true

    # Create iOS-specific README
    cat > .claude/README.md << 'EOF'
# Claude Code Agent Setup (iOS)

**Synced from:** bookstrack-backend (automated setup)
**Tech Stack:** Swift, SwiftUI, Xcode

## Available Agents

### ✅ Universal Agents (Synced from Backend)
- **project-manager** - Orchestration and delegation
- **zen-mcp-master** - Deep analysis (14 Zen MCP tools)

### 🚧 iOS-Specific Agent (TODO)
- **xcode-agent** - Xcode build, test, TestFlight deployment

## Quick Start

```bash
# For complex workflows
/skill project-manager

# For analysis/review/debugging
/skill zen-mcp-master

# For iOS build/test (after creating xcode-agent)
/skill xcode-agent
```

## Next Steps

### 1. Create xcode-agent (Required)

Create `.claude/skills/xcode-agent/skill.md` with iOS-specific capabilities:

- Xcode build commands (`xcodebuild`)
- Swift testing (`swift test`)
- TestFlight deployment
- Swift package management
- Crash log analysis

See `.claude/ROBIT_SHARING_FRAMEWORK.md` for xcode-agent template.

### 2. Customize project-manager

Edit `.claude/skills/project-manager/skill.md`:
- Replace `cloudflare-agent` references with `xcode-agent`
- Update delegation patterns for iOS workflows

### 3. Add Hooks (Optional)

**Pre-commit hook** (`.claude/hooks/pre-commit.sh`):
- SwiftLint validation
- Xcode project integrity checks
- Asset catalog validation

**Post-tool-use hook** (`.claude/hooks/post-tool-use.sh`):
- Suggest `xcode-agent` when xcodebuild is used
- Suggest `zen-mcp-master` for Swift file changes

## Documentation

- `ROBIT_OPTIMIZATION.md` - Complete agent architecture
- `ROBIT_SHARING_FRAMEWORK.md` - How sharing works
- Backend repo: https://github.com/jukasdrj/bookstrack-backend/.claude/

## Future Updates

Run `../bookstrack-backend/scripts/sync-robit-to-repos.sh` to sync updates from backend.
EOF

    # Create example xcode-agent template
    mkdir -p .claude/skills/xcode-agent
    cat > .claude/skills/xcode-agent/skill.md << 'EOF'
# Xcode Build & Deploy Agent

**Purpose:** iOS app build, test, and TestFlight deployment automation

**When to use:**
- Building iOS app with Xcode
- Running Swift tests
- Deploying to TestFlight
- Managing Swift packages
- Debugging iOS-specific issues

---

## Core Responsibilities

### 1. Build Operations
- Build with `xcodebuild -scheme BooksTracker build`
- Archive for distribution
- Manage configurations (Debug/Release)

### 2. Testing
- Run unit tests: `swift test`
- Run UI tests: `xcodebuild test -scheme BooksTracker`
- Generate code coverage

### 3. Deployment
- Upload to TestFlight: `xcrun altool --upload-app`
- Manage certificates and profiles
- Increment build numbers

### 4. Swift Package Management
- Resolve dependencies: `swift package resolve`
- Update packages: `swift package update`

---

## Essential Commands

### Build
```bash
# Build for testing
xcodebuild -scheme BooksTracker -destination 'platform=iOS Simulator,name=iPhone 15' build

# Build for release
xcodebuild -scheme BooksTracker -configuration Release build
```

### Test
```bash
# Run all tests
xcodebuild test -scheme BooksTracker -destination 'platform=iOS Simulator,name=iPhone 15'

# Run specific test
xcodebuild test -scheme BooksTracker -only-testing:BooksTrackerTests/WorkDTOTests
```

### Archive & Export
```bash
# Archive
xcodebuild archive -scheme BooksTracker -archivePath build/BooksTracker.xcarchive

# Export IPA
xcodebuild -exportArchive -archivePath build/BooksTracker.xcarchive -exportPath build/
```

### TestFlight Upload
```bash
# Upload to App Store Connect
xcrun altool --upload-app -f build/BooksTracker.ipa -u username -p password
```

---

## Integration with Other Agents

**Delegates to zen-mcp-master for:**
- Swift code review (codereview tool)
- Security audit (secaudit tool)
- Complex debugging (debug tool)
- Test generation (testgen tool)

**Receives delegation from project-manager for:**
- Build/test/deploy requests
- iOS-specific operations
- Xcode workflow automation

---

**Autonomy Level:** High - Can build, test, and deploy autonomously
**Human Escalation:** Required for App Store submissions, certificate updates
**CRITICAL:** Always use proper scheme and destination specifications
EOF

    # Create example pre-commit hook
    cat > .claude/hooks/pre-commit.sh << 'EOF'
#!/bin/bash

# iOS Pre-Commit Hook
# Based on backend template, customized for iOS

set -e

echo "🤖 Running iOS pre-commit checks..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# 1. Check for sensitive files
echo "🔐 Checking for sensitive files..."
SENSITIVE_FILES=(
  "*.mobileprovision"
  "*.p12"
  "*.cer"
  "*credentials*.json"
  "GoogleService-Info.plist"
)

for pattern in "${SENSITIVE_FILES[@]}"; do
  if git diff --cached --name-only | grep -q "$pattern"; then
    echo -e "${RED}✗ Blocked: Attempting to commit sensitive file: $pattern${NC}"
    FAILED=1
  fi
done

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ No sensitive files detected${NC}"
fi

# 2. SwiftLint (if available)
if command -v swiftlint &> /dev/null; then
  echo "🎨 Running SwiftLint..."
  STAGED_SWIFT=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.swift$' || true)

  if [ -n "$STAGED_SWIFT" ]; then
    if ! swiftlint lint --quiet $STAGED_SWIFT; then
      echo -e "${YELLOW}⚠ Warning: SwiftLint found issues${NC}"
      echo "  Run: swiftlint autocorrect"
    else
      echo -e "${GREEN}✓ SwiftLint passed${NC}"
    fi
  fi
fi

# 3. Check for debug print statements
echo "🐛 Checking for debug statements..."
DEBUG_COUNT=$(git diff --cached | grep -c "print(" || true)

if [ $DEBUG_COUNT -gt 0 ]; then
  echo -e "${YELLOW}⚠ Warning: Found $DEBUG_COUNT print() statements${NC}"
  echo "  Consider using proper logging"
fi

# 4. Check Xcode project integrity
if git diff --cached --name-only | grep -q "\.xcodeproj/project.pbxproj"; then
  echo "📦 Checking Xcode project file..."

  # Check for merge conflicts in project file
  if git diff --cached BooksTracker.xcodeproj/project.pbxproj | grep -q "<<<<<<"; then
    echo -e "${RED}✗ Merge conflicts in Xcode project file${NC}"
    FAILED=1
  else
    echo -e "${GREEN}✓ Xcode project file looks clean${NC}"
  fi
fi

# 5. Check if DTOs were updated (if synced from backend)
if git diff --cached --name-only | grep -qE "BooksTrackerFeature/DTOs/.*\.swift"; then
  echo "🔄 Checking DTO changes..."

  echo -e "${YELLOW}⚠ DTO files changed${NC}"
  echo "  Ensure DTOs match backend TypeScript definitions"
  echo "  See backend: src/types/canonical.ts"
fi

# Final result
echo ""
if [ $FAILED -eq 1 ]; then
  echo -e "${RED}❌ Pre-commit checks failed. Commit blocked.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
  exit 0
fi
EOF

    # Make hooks executable
    chmod +x .claude/hooks/pre-commit.sh

    # Commit changes
    echo "💾 Committing changes..."
    git add .claude/

    # Check if there are changes to commit
    if git diff --cached --quiet; then
        echo -e "${YELLOW}⚠️  No changes to commit (agents already installed)${NC}"
    else
        git commit -m "feat: setup Claude Code agents (robit)

Installed universal agents from bookstrack-backend:
- project-manager (orchestrator)
- zen-mcp-master (Zen MCP tools integration)

Created iOS-specific templates:
- xcode-agent (template - ready to customize)
- pre-commit hook (iOS-specific checks)

Next steps:
1. Customize xcode-agent for iOS workflows
2. Update project-manager delegation targets
3. Test agent invocation with /skill commands

Synced from: bookstrack-backend
Setup script: scripts/setup-robit-all-repos.sh"

        # Push changes only if repo was cloned (not local)
        if [[ "$IOS_DIR" == "$TEMP_DIR"* ]]; then
            echo "⬆️  Pushing to GitHub..."
            git push origin main
        else
            echo -e "${YELLOW}📌 Local repo detected - skipping automatic push${NC}"
            echo "   Review changes and push manually when ready:"
            echo "   cd $IOS_DIR && git push"
        fi
    fi

    echo -e "${GREEN}✅ iOS repo setup complete!${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  iOS repo setup skipped${NC}"
    echo ""
fi

# ============================================================================
# SETUP FLUTTER REPO (if exists)
# ============================================================================

echo -e "${BLUE}🎯 Setting up Flutter repo (bookstrack-flutter)...${NC}"
echo ""

FLUTTER_DIR=$(get_repo_dir "bookstrack-flutter" "$FLUTTER_REPO" "$TEMP_DIR/flutter")
FLUTTER_STATUS=$?

if [ $FLUTTER_STATUS -eq 0 ]; then
    cd "$FLUTTER_DIR"

    # Create .claude directory structure
    echo "📁 Creating .claude directory structure..."
    mkdir -p .claude/skills
    mkdir -p .claude/hooks

    # Copy universal agents from backend
    echo "📋 Copying universal agents..."
    cp -r "$BACKEND_DIR/.claude/skills/project-manager" .claude/skills/
    cp -r "$BACKEND_DIR/.claude/skills/zen-mcp-master" .claude/skills/

    # Copy documentation
    echo "📋 Copying documentation..."
    cp "$BACKEND_DIR/.claude/ROBIT_OPTIMIZATION.md" .claude/ 2>/dev/null || true
    cp "$BACKEND_DIR/.claude/ROBIT_SHARING_FRAMEWORK.md" .claude/ 2>/dev/null || true

    # Create Flutter-specific README
    cat > .claude/README.md << 'EOF'
# Claude Code Agent Setup (Flutter)

**Synced from:** bookstrack-backend (automated setup)
**Tech Stack:** Flutter, Dart

## Available Agents

### ✅ Universal Agents (Synced from Backend)
- **project-manager** - Orchestration and delegation
- **zen-mcp-master** - Deep analysis (14 Zen MCP tools)

### 🚧 Flutter-Specific Agent (TODO)
- **flutter-agent** - Flutter build, test, and deployment

## Quick Start

```bash
# For complex workflows
/skill project-manager

# For analysis/review/debugging
/skill zen-mcp-master

# For Flutter build/test (after creating flutter-agent)
/skill flutter-agent
```

## Next Steps

### 1. Create flutter-agent (Required)

Create `.claude/skills/flutter-agent/skill.md` with Flutter-specific capabilities:

- Flutter build commands (`flutter build`)
- Dart testing (`flutter test`)
- Package management (`pub get`, `pub upgrade`)
- Platform builds (Android, iOS, Web)
- Performance profiling

### 2. Customize project-manager

Edit `.claude/skills/project-manager/skill.md`:
- Replace `cloudflare-agent` references with `flutter-agent`
- Update delegation patterns for Flutter workflows

### 3. Add Hooks (Optional)

**Pre-commit hook** (`.claude/hooks/pre-commit.sh`):
- Dart analyzer validation
- Flutter formatting checks
- pubspec.yaml validation

**Post-tool-use hook** (`.claude/hooks/post-tool-use.sh`):
- Suggest `flutter-agent` when flutter commands are used
- Suggest `zen-mcp-master` for Dart file changes

## Documentation

- `ROBIT_OPTIMIZATION.md` - Complete agent architecture
- `ROBIT_SHARING_FRAMEWORK.md` - How sharing works
- Backend repo: https://github.com/jukasdrj/bookstrack-backend/.claude/

## Future Updates

Run `../bookstrack-backend/scripts/sync-robit-to-repos.sh` to sync updates from backend.
EOF

    # Create example flutter-agent template
    mkdir -p .claude/skills/flutter-agent
    cat > .claude/skills/flutter-agent/skill.md << 'EOF'
# Flutter Build & Deploy Agent

**Purpose:** Flutter app build, test, and deployment automation

**When to use:**
- Building Flutter apps for multiple platforms
- Running Dart/Flutter tests
- Managing Flutter packages
- Deploying to app stores
- Performance profiling

---

## Core Responsibilities

### 1. Build Operations
- Build Android: `flutter build apk`
- Build iOS: `flutter build ios`
- Build Web: `flutter build web`
- Build desktop apps

### 2. Testing
- Run unit tests: `flutter test`
- Run integration tests: `flutter test integration_test/`
- Generate test coverage: `flutter test --coverage`

### 3. Package Management
- Get dependencies: `flutter pub get`
- Update packages: `flutter pub upgrade`
- Check outdated: `flutter pub outdated`

### 4. Code Quality
- Analyze code: `flutter analyze`
- Format code: `dart format .`
- Check for issues: `dart analyze`

---

## Essential Commands

### Build
```bash
# Android APK
flutter build apk --release

# iOS (requires macOS)
flutter build ios --release

# Web
flutter build web --release
```

### Test
```bash
# All tests
flutter test

# With coverage
flutter test --coverage

# Integration tests
flutter test integration_test/
```

### Development
```bash
# Run app
flutter run

# Hot reload
flutter run --hot

# Profile mode
flutter run --profile
```

---

## Integration with Other Agents

**Delegates to zen-mcp-master for:**
- Dart code review (codereview tool)
- Security audit (secaudit tool)
- Complex debugging (debug tool)
- Test generation (testgen tool)

**Receives delegation from project-manager for:**
- Build/test/deploy requests
- Flutter-specific operations
- Multi-platform builds

---

**Autonomy Level:** High - Can build, test, and analyze autonomously
**Human Escalation:** Required for app store submissions, signing certificates
**CRITICAL:** Always specify platform and build mode explicitly
EOF

    # Create example pre-commit hook
    cat > .claude/hooks/pre-commit.sh << 'EOF'
#!/bin/bash

# Flutter Pre-Commit Hook
# Based on backend template, customized for Flutter

set -e

echo "🤖 Running Flutter pre-commit checks..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# 1. Check for sensitive files
echo "🔐 Checking for sensitive files..."
SENSITIVE_FILES=(
  "*.jks"
  "*.keystore"
  "*key.properties"
  "*google-services.json"
  "*GoogleService-Info.plist"
  "*.p12"
)

for pattern in "${SENSITIVE_FILES[@]}"; do
  if git diff --cached --name-only | grep -q "$pattern"; then
    echo -e "${RED}✗ Blocked: Attempting to commit sensitive file: $pattern${NC}"
    FAILED=1
  fi
done

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ No sensitive files detected${NC}"
fi

# 2. Dart analyzer (if Flutter available)
if command -v flutter &> /dev/null; then
  echo "🎯 Running Dart analyzer..."
  STAGED_DART=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.dart$' || true)

  if [ -n "$STAGED_DART" ]; then
    if ! flutter analyze --no-pub 2>&1 | grep -q "No issues found"; then
      echo -e "${YELLOW}⚠ Warning: Dart analyzer found issues${NC}"
      echo "  Run: flutter analyze"
    else
      echo -e "${GREEN}✓ Dart analyzer passed${NC}"
    fi
  fi
fi

# 3. Check for debug print statements
echo "🐛 Checking for debug statements..."
DEBUG_COUNT=$(git diff --cached | grep -c "print(" || true)

if [ $DEBUG_COUNT -gt 0 ]; then
  echo -e "${YELLOW}⚠ Warning: Found $DEBUG_COUNT print() statements${NC}"
  echo "  Consider using debugPrint() or proper logging"
fi

# 4. Check pubspec.yaml changes
if git diff --cached --name-only | grep -q "pubspec.yaml"; then
  echo "📦 Checking pubspec.yaml..."

  if git diff --cached pubspec.yaml | grep -q "<<<<<<"; then
    echo -e "${RED}✗ Merge conflicts in pubspec.yaml${NC}"
    FAILED=1
  else
    echo -e "${GREEN}✓ pubspec.yaml looks clean${NC}"
  fi
fi

# Final result
echo ""
if [ $FAILED -eq 1 ]; then
  echo -e "${RED}❌ Pre-commit checks failed. Commit blocked.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
  exit 0
fi
EOF

    # Make hooks executable
    chmod +x .claude/hooks/pre-commit.sh

    # Commit changes
    echo "💾 Committing changes..."
    git add .claude/

    # Check if there are changes to commit
    if git diff --cached --quiet; then
        echo -e "${YELLOW}⚠️  No changes to commit (agents already installed)${NC}"
    else
        git commit -m "feat: setup Claude Code agents (robit)

Installed universal agents from bookstrack-backend:
- project-manager (orchestrator)
- zen-mcp-master (Zen MCP tools integration)

Created Flutter-specific templates:
- flutter-agent (template - ready to customize)
- pre-commit hook (Flutter-specific checks)

Next steps:
1. Customize flutter-agent for Flutter workflows
2. Update project-manager delegation targets
3. Test agent invocation with /skill commands

Synced from: bookstrack-backend
Setup script: scripts/setup-robit-all-repos.sh"

        # Push changes only if repo was cloned (not local)
        if [[ "$FLUTTER_DIR" == "$TEMP_DIR"* ]]; then
            echo "⬆️  Pushing to GitHub..."
            git push origin main
        else
            echo -e "${YELLOW}📌 Local repo detected - skipping automatic push${NC}"
            echo "   Review changes and push manually when ready:"
            echo "   cd $FLUTTER_DIR && git push"
        fi
    fi

    echo -e "${GREEN}✅ Flutter repo setup complete!${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Flutter repo setup skipped${NC}"
    echo ""
fi

# ============================================================================
# CLEANUP
# ============================================================================

cd "$BACKEND_DIR"
rm -rf "$TEMP_DIR"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Robit Setup Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

echo "📊 Setup Summary:"
echo ""

if [ $IOS_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ iOS repo (books-tracker-v1)${NC}"
    echo "   - Location: $IOS_DIR"
    echo "   - Universal agents installed"
    echo "   - xcode-agent template created"
    echo "   - Pre-commit hook added"
    echo "   - Ready to customize"
    echo ""
else
    echo -e "${YELLOW}⚠️  iOS repo skipped (not found)${NC}"
    echo "   Set location: export BOOKS_TRACKER_V1_PATH=/path/to/repo"
    echo ""
fi

if [ $FLUTTER_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Flutter repo (bookstrack-flutter)${NC}"
    echo "   - Location: $FLUTTER_DIR"
    echo "   - Universal agents installed"
    echo "   - flutter-agent template created"
    echo "   - Pre-commit hook added"
    echo "   - Ready to customize"
    echo ""
else
    echo -e "${YELLOW}⚠️  Flutter repo skipped (not found)${NC}"
    echo "   Set location: export BOOKSTRACK_FLUTTER_PATH=/path/to/repo"
    echo ""
fi

echo "📋 Next Steps:"
echo ""

if [ $IOS_STATUS -eq 0 ]; then
    echo "For iOS repo:"
    echo "  1. cd $IOS_DIR"
    echo "  2. Review .claude/skills/xcode-agent/skill.md"
    echo "  3. Customize for your iOS workflows"
    echo "  4. Test with: /skill xcode-agent"
    if [[ ! "$IOS_DIR" == "$TEMP_DIR"* ]]; then
        echo "  5. Push changes: git push"
    fi
    echo ""
fi

if [ $FLUTTER_STATUS -eq 0 ]; then
    echo "For Flutter repo:"
    echo "  1. cd $FLUTTER_DIR"
    echo "  2. Review .claude/skills/flutter-agent/skill.md"
    echo "  3. Customize for Flutter workflows"
    echo "  4. Test with: /skill flutter-agent"
    if [[ ! "$FLUTTER_DIR" == "$TEMP_DIR"* ]]; then
        echo "  5. Push changes: git push"
    fi
    echo ""
fi

echo "🔄 To sync updates in the future:"
echo "  cd $BACKEND_DIR"
echo "  ./scripts/sync-robit-to-repos.sh"
echo ""

echo "💡 Tip: Set custom paths with environment variables:"
echo "  export BOOKS_TRACKER_V1_PATH=/custom/path/to/ios"
echo "  export BOOKSTRACK_FLUTTER_PATH=/custom/path/to/flutter"
echo ""

echo -e "${GREEN}🎉 All done!${NC}"
