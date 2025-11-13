# Documentation Sync Automation

## Overview

API documentation is automatically synced from the backend repo to frontend repos (iOS, Flutter) whenever changes are pushed. This ensures all teams use the same canonical contracts.

**Single Source of Truth:** `bookstrack-backend/docs/`

## How It Works

```
You push to bookstrack-backend/main
  ↓
docs/API_README.md or docs/QUICK_START.md changed?
  ↓ Yes
GitHub Actions workflow triggers
  ↓
Clone iOS repo
  ↓
Copy updated docs/
  ↓
Commit with backend reference
  ↓
Push to iOS repo main
  ↓
(Optional) Repeat for Flutter repo
```

## Workflow File

**Location:** `.github/workflows/sync-docs.yml`

**Triggers on:**
- Push to `main` branch
- Changes to `docs/API_README.md`
- Changes to `docs/QUICK_START.md`
- Changes to `.github/workflows/sync-docs.yml` (self-updates)

**Jobs:**
1. `sync-to-ios` - Always runs (iOS is primary target)
2. `sync-to-flutter` - Runs if `FLUTTER_REPO_ENABLED=true`
3. `notify` - Summary step (for debugging)

## Synced Repositories

### iOS (books-tracker-v1)
- **Status:** Active ✅
- **Sync Frequency:** On every docs change
- **Location:** `docs/API_README.md`, `docs/QUICK_START.md`
- **Last Sync:** Commit be52fa8

### Flutter (bookstrack-flutter)
- **Status:** Disabled (pending repo creation)
- **To Enable:** Set `FLUTTER_REPO_ENABLED=true` in repo variables
- **Location:** `docs/API_README.md`, `docs/QUICK_START.md`

## Configuration

### Enable Flutter Repo Syncing

1. Go to: https://github.com/jukasdrj/bookstrack-backend/settings/variables
2. Click "New repository variable"
3. Name: `FLUTTER_REPO_ENABLED`
4. Value: `true`
5. Save

The next push to docs will trigger sync to Flutter repo.

### Modify Sync Behavior

Edit `.github/workflows/sync-docs.yml`:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'docs/API_README.md'     # ← Files to sync on
      - 'docs/QUICK_START.md'
      - '.github/workflows/sync-docs.yml'
```

Add more files to sync:
```yaml
paths:
  - 'docs/API_README.md'
  - 'docs/QUICK_START.md'
  - 'docs/FRONTEND_HANDOFF.md'    # ← Add new file
```

Add more repos to sync:
```yaml
  sync-to-other-repo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync to other repo
        run: |
          git clone https://github.com/jukasdrj/other-repo.git /tmp/other-repo
          cp docs/API_README.md /tmp/other-repo/docs/
          # ... commit and push
```

## Authentication

The workflow uses `GITHUB_TOKEN` secret (automatically provided by GitHub Actions).

**Permissions:** The workflow requires the following permissions to be granted to `GITHUB_TOKEN`:
- `contents: write` - Read/write access to repository contents
- `workflows: write` - Ability to update workflow files

**Note:** By default, `GITHUB_TOKEN` only has access to the repository where the workflow runs. To push to other repositories (iOS, Flutter), you may need to use a Personal Access Token (PAT) with `repo` scope instead.

**To use a PAT (if cross-repo push fails):**
```bash
gh secret set GITHUB_TOKEN --body "$(gh auth token)"
```

**Required PAT Scopes:**
- `repo` - Full control of private repositories (needed to push to other repos)

## What Gets Synced

### docs/API_README.md (8.6KB)
- Canonical data contracts (TypeScript DTOs)
- HTTP endpoints with all parameters
- WebSocket protocol (4 message types)
- Error codes catalog
- Rate limiting configuration
- Integration patterns for all platforms

### docs/QUICK_START.md (3.5KB)
- Quick reference for common tasks
- API endpoint shortcuts
- Deployment and testing commands
- Rate limit summary
- Support and debugging links

## Testing the Automation

### Automated Test
1. Edit `docs/API_README.md` locally (add a comment)
2. `git add docs/API_README.md`
3. `git commit -m "test: verify sync automation"`
4. `git push origin main`
5. Go to: https://github.com/jukasdrj/bookstrack-backend/actions
6. Watch "📚 Sync API Docs to Other Repos" workflow
7. Check iOS repo for new commit in `docs/`

### Manual Verification
```bash
# Check iOS repo was updated
cd ~/Downloads/xcode/books-tracker-v1
git log --oneline docs/ | head -3

# Should show sync commit from backend
```

## Troubleshooting

### Sync Not Working?

**Check 1: Is the workflow enabled?**
```bash
git log --oneline .github/workflows/sync-docs.yml | head -1
```
Should show it was created/pushed.

**Check 2: Did docs actually change?**
```bash
git diff HEAD~1 docs/API_README.md
```
The workflow only triggers on actual file changes.

**Check 3: Check workflow runs**
- Go to: https://github.com/jukasdrj/bookstrack-backend/actions
- Look for "📚 Sync API Docs to Other Repos"
- Click to see logs

**Check 4: GitHub Token**
If token is missing, expired, or lacks permissions:
```bash
# Option 1: Use a PAT with repo scope
gh secret set GITHUB_TOKEN --body "$(gh auth token)"

# Option 2: Grant workflow permissions
# Go to: Settings → Actions → General → Workflow permissions
# Select: "Read and write permissions"
```

### Sync to Flutter Not Running?

Variable `FLUTTER_REPO_ENABLED` must be set to `true`:
1. Go to repo settings → Variables
2. Create: `FLUTTER_REPO_ENABLED = true`
3. Next push will trigger Flutter sync

## Benefits

✅ **Single source of truth** - Edit in backend, syncs everywhere
✅ **No manual work** - Automatic on every push
✅ **Clean history** - Skips commits if no changes
✅ **Traceable** - Sync commits reference backend source
✅ **Scalable** - Add repos without workflow changes
✅ **Efficient** - Shallow clones, minimal bandwidth
✅ **Safe** - Graceful handling of missing repos

## What NOT to Sync

The workflow intentionally does NOT sync:

- `docs/deployment/` - Environment-specific
- `docs/guides/` - Implementation details
- `docs/archives/` - Historical docs
- `docs/plans/` - Planning documents
- Source code changes
- CI/CD configurations

These are backend-specific. Only canonical contracts (API_README, QUICK_START) are synced.

## Future Enhancements

### 1. Sync More Files
```yaml
paths:
  - 'docs/API_README.md'
  - 'docs/QUICK_START.md'
  - 'docs/FRONTEND_HANDOFF.md'    # Add integration guide
```

### 2. Validation Before Sync
```yaml
- name: Validate markdown
  run: npx markdownlint docs/API_README.md
```

### 3. Link Checking
```yaml
- name: Check for broken links
  run: npx markdown-link-check docs/API_README.md
```

### 4. Notify Teams
```yaml
- name: Create GitHub discussion
  run: gh discussion create --title "API docs updated"
```

## Related Files

- **Workflow:** `.github/workflows/sync-docs.yml`
- **API Docs:** `docs/API_README.md`
- **Quick Reference:** `docs/QUICK_START.md`
- **iOS Repo:** https://github.com/jukasdrj/books-tracker-v1

## Questions?

For sync issues:
1. Check workflow logs: Actions tab → Sync workflow
2. Verify token: `gh secret list`
3. Test manually: Copy file to iOS repo, commit, push

---

**Last Updated:** November 13, 2025
**Maintenance:** Automatic via GitHub Actions
**Manual Trigger:** Edit docs/ and push to main
