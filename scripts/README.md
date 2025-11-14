# BooksTrack Scripts

Automation scripts for managing the BooksTrack project ecosystem.

---

## Robit (Claude Code Agents) Setup

### Initial Setup (Run Once)

**Setup robit across ALL repos from backend:**

```bash
cd ~/Downloads/xcode/bookstrack-backend
./scripts/setup-robit-all-repos.sh
```

**What it does:**
- ✅ Clones iOS repo (books-tracker-v1)
- ✅ Clones Flutter repo (bookstrack-flutter) if it exists
- ✅ Copies universal agents (project-manager, zen-mcp-master)
- ✅ Creates iOS-specific xcode-agent template
- ✅ Creates pre-commit hooks
- ✅ Commits and pushes to each repo
- ✅ All from backend repo using `gh` CLI

**Requirements:**
- GitHub CLI installed: `brew install gh`
- Authenticated: `gh auth login`
- Run from backend directory

---

### Sync Updates (Run When Agents Change)

**Sync agent updates to all repos:**

```bash
cd ~/Downloads/xcode/bookstrack-backend
./scripts/sync-robit-to-repos.sh
```

**What it does:**
- ✅ Updates project-manager in iOS repo
- ✅ Updates zen-mcp-master in iOS repo
- ✅ Updates Flutter repo (if exists)
- ✅ Commits and pushes changes
- ✅ Only syncs universal agents (platform-specific agents stay local)

**When to run:**
- After updating project-manager agent
- After updating zen-mcp-master agent
- After updating robit documentation

---

## Usage Examples

### First Time Setup

```bash
# 1. Setup all repos from backend
cd ~/Downloads/xcode/bookstrack-backend
./scripts/setup-robit-all-repos.sh

# 2. Wait for completion (uses gh CLI to push to all repos)

# 3. Check iOS repo
cd ~/Downloads/xcode/books-tracker-v1
git pull
ls -la .claude/skills/
# Should see: project-manager/, zen-mcp-master/, xcode-agent/

# 4. Customize iOS-specific agent
nano .claude/skills/xcode-agent/skill.md
# Edit for your iOS workflows

# 5. Test
/skill project-manager  # Should work
/skill xcode-agent      # Should work after customization
```

---

### After Updating Agents

```bash
# 1. Update agents in backend
cd ~/Downloads/xcode/bookstrack-backend
nano .claude/skills/project-manager/skill.md
# Make your changes

# 2. Test locally
/skill project-manager  # Verify changes work

# 3. Sync to all repos
./scripts/sync-robit-to-repos.sh

# 4. Verify
cd ~/Downloads/xcode/books-tracker-v1
git pull
# Changes should be synced automatically
```

---

## What Gets Synced

### Universal Agents (Synced Automatically)
- ✅ `project-manager/` - Same across all repos
- ✅ `zen-mcp-master/` - Same across all repos
- ✅ Documentation (ROBIT_*.md)

### Platform-Specific (Created Locally, NOT Synced)
- ❌ `cloudflare-agent/` - Backend only
- ❌ `xcode-agent/` - iOS only (template provided)
- ❌ `flutter-agent/` - Flutter only (template provided)
- ❌ Hooks (pre-commit.sh, post-tool-use.sh) - Customized per repo

---

## Troubleshooting

### Script fails with "gh not found"
```bash
brew install gh
gh auth login
```

### Script fails with "permission denied"
```bash
chmod +x scripts/*.sh
```

### Can't clone iOS repo
```bash
# Check you have access
gh repo view jukasdrj/books-tracker-v1

# Check authentication
gh auth status
```

### Changes not appearing in iOS repo
```bash
# Pull latest
cd ~/Downloads/xcode/books-tracker-v1
git pull origin main

# Check .claude/skills/
ls -la .claude/skills/
```

---

## File Structure After Setup

### Backend (Source of Truth)
```
bookstrack-backend/
├── .claude/
│   ├── skills/
│   │   ├── project-manager/        ← Synced to all repos
│   │   ├── zen-mcp-master/         ← Synced to all repos
│   │   └── cloudflare-agent/       ← Backend only
│   └── ROBIT_*.md                  ← Synced to all repos
└── scripts/
    ├── setup-robit-all-repos.sh    ← Initial setup
    └── sync-robit-to-repos.sh      ← Sync updates
```

### iOS (Receives Sync)
```
books-tracker-v1/
└── .claude/
    ├── skills/
    │   ├── project-manager/        ← Synced from backend
    │   ├── zen-mcp-master/         ← Synced from backend
    │   └── xcode-agent/            ← Created locally (template provided)
    ├── hooks/
    │   └── pre-commit.sh           ← Created locally (iOS-specific)
    └── README.md                   ← Auto-generated with instructions
```

---

## Benefits of This Approach

**Centralized Management:**
- Update once in backend, sync to all repos
- No need to manually clone/edit each repo
- Uses `gh` CLI to automate everything

**Platform Flexibility:**
- Each repo gets universal agents
- Each repo customizes platform-specific agent
- Hooks are platform-specific

**Easy Updates:**
- Run sync script when universal agents change
- Platform-specific agents stay local
- No conflicts between repos

---

## Quick Reference

| Task | Command |
|------|---------|
| Initial setup (all repos) | `./scripts/setup-robit-all-repos.sh` |
| Sync updates to all repos | `./scripts/sync-robit-to-repos.sh` |
| Test robit in iOS | `cd books-tracker-v1 && /skill project-manager` |
| Customize iOS agent | `nano books-tracker-v1/.claude/skills/xcode-agent/skill.md` |

---

**Created:** November 13, 2025
**Requires:** GitHub CLI (`gh`)
**Manages:** Backend, iOS, Flutter repos
