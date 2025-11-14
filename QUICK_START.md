# BooksTrack Backend - Quick Start

**All the automation improvements and robit setup in one place.**

---

## 🚀 What Was Just Implemented

### ✅ Automation Improvements
1. **DTO Validation** - Warns when TypeScript/Swift DTOs drift
2. **Deployment Fixes** - `npx wrangler` + retry logic
3. **Pre-commit Detection** - Warns about DTO changes
4. **Documentation** - Complete sync process guide

### ✅ Robit Multi-Repo Setup
1. **Setup Script** - Configure ALL repos from backend
2. **Sync Script** - Push agent updates to all repos
3. **Templates** - Platform-specific agent templates

---

## 🎯 Quick Actions

### Setup Robit in ALL Your Repos (iOS, Flutter)

**One command from backend:**
```bash
cd ~/Downloads/xcode/bookstrack-backend
./scripts/setup-robit-all-repos.sh
```

**What happens:**
- ✅ iOS repo gets project-manager, zen-mcp-master, xcode-agent template
- ✅ Flutter repo gets project-manager, zen-mcp-master, flutter-agent template
- ✅ Hooks and docs copied
- ✅ Everything committed and pushed
- ✅ Ready to customize

**Then customize in each repo:**
```bash
# iOS
cd ~/Downloads/xcode/books-tracker-v1
nano .claude/skills/xcode-agent/skill.md

# Flutter (if exists)
cd path/to/bookstrack-flutter
nano .claude/skills/flutter-agent/skill.md
```

---

### Test DTO Validation

```bash
# Make a DTO change
echo "// test" >> src/types/canonical.ts

# Commit (pre-commit hook will warn you)
git add src/types/canonical.ts
git commit -m "test: dto validation"

# Push (validation workflow will run)
git push

# Check workflow
gh run list --workflow=validate-dtos.yml
```

---

### Test Deployment Workflow

```bash
# Trigger staging deployment
gh workflow run deploy-staging.yml

# Watch it run
gh run watch

# Should see:
# - npx wrangler deploy
# - Health check with retry (up to 5 attempts)
# - Success message
```

---

## 📚 Documentation

**Automation Review & Implementation:**
- `.github/AUTOMATION_REVIEW.md` - Original review
- `.github/IMPLEMENTATION_SUMMARY.md` - What was implemented
- `.github/DTO_SYNC_PROCESS.md` - How to sync DTOs manually

**Robit Setup:**
- `.claude/ROBIT_OPTIMIZATION.md` - Agent architecture
- `.claude/ROBIT_SHARING_FRAMEWORK.md` - How sharing works
- `scripts/README.md` - Script documentation

---

## 🔄 Future Workflows

### When You Update Agents

```bash
# 1. Edit universal agents in backend
nano .claude/skills/project-manager/skill.md

# 2. Test locally
/skill project-manager

# 3. Sync to all repos
./scripts/sync-robit-to-repos.sh

# Done! iOS and Flutter repos updated automatically
```

---

### When You Change DTOs

```bash
# 1. Edit TypeScript DTOs
nano src/types/canonical.ts

# 2. Commit (pre-commit hook warns you)
git commit -m "feat: add field to WorkDTO"

# 3. Push (validation workflow checks iOS)
git push

# 4. Manually update iOS Swift DTOs
cd ~/Downloads/xcode/books-tracker-v1
nano BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/WorkDTO.swift

# 5. Commit iOS changes
git commit -m "feat: sync WorkDTO with backend"
git push
```

---

## 🎨 Agent Usage

### In Backend
```bash
/skill project-manager     # Complex workflows
/skill cloudflare-agent    # Deploy/monitor
/skill zen-mcp-master      # Review/debug
```

### In iOS (After Setup)
```bash
/skill project-manager     # Complex workflows
/skill xcode-agent         # Build/test/deploy
/skill zen-mcp-master      # Review/debug
```

### In Flutter (After Setup)
```bash
/skill project-manager     # Complex workflows
/skill flutter-agent       # Build/deploy
/skill zen-mcp-master      # Review/debug
```

---

## 🛠️ Available Scripts

```bash
# Robit Setup
./scripts/setup-robit-all-repos.sh    # Initial setup (run once)
./scripts/sync-robit-to-repos.sh      # Sync updates (run when agents change)
```

---

## ✅ Checklist

**Immediate (Now):**
- [ ] Run `./scripts/setup-robit-all-repos.sh`
- [ ] Customize xcode-agent in iOS repo
- [ ] Test agent invocation in each repo
- [ ] Test DTO validation workflow

**When Needed:**
- [ ] Run sync script after updating universal agents
- [ ] Update iOS DTOs when backend DTOs change
- [ ] Review validation workflow output on PRs

---

## 📞 Quick Reference

| Need | Command |
|------|---------|
| Setup all repos | `./scripts/setup-robit-all-repos.sh` |
| Sync agent updates | `./scripts/sync-robit-to-repos.sh` |
| Test deployment | `gh workflow run deploy-staging.yml` |
| Check DTO validation | `gh run list --workflow=validate-dtos.yml` |
| View workflow logs | `gh run view --log` |

---

## 🎉 You're All Set!

**Everything is ready:**
- ✅ DTO validation automated
- ✅ Deployment workflows improved
- ✅ Pre-commit warnings added
- ✅ Robit can be synced to all repos with one command
- ✅ Complete documentation

**Just run:**
```bash
./scripts/setup-robit-all-repos.sh
```

And you'll have the same optimized agent setup across backend, iOS, and Flutter! 🚀

---

**Last Updated:** November 13, 2025
**Questions?** Check documentation in `.github/` and `.claude/` directories
