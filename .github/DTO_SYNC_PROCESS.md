# DTO Contract Synchronization Process

**Last Updated:** November 13, 2025
**Status:** Manual sync required (validation automated)

---

## Overview

TypeScript DTOs in the backend are the **single source of truth** for all API contracts. iOS Swift DTOs must be manually synchronized when backend DTOs change.

**Validation:** `.github/workflows/validate-dtos.yml` automatically checks if DTOs are in sync on every PR.

---

## Source of Truth

### Backend (TypeScript)

**Location:** `src/types/`

**Files:**
- `canonical.ts` - Core DTOs (WorkDTO, EditionDTO, AuthorDTO)
- `enums.ts` - Enum types (EditionFormat, AuthorGender, CulturalRegion, etc.)
- `responses.ts` - Response envelope (ApiResponse)
- `websocket-messages.ts` - WebSocket message types

**Example:**
```typescript
// src/types/canonical.ts
export interface WorkDTO {
  title: string;
  subjectTags: string[];
  originalLanguage?: string;
  // ... more fields
}

export interface EditionDTO {
  isbn?: string;
  isbns: string[];
  title?: string;
  // ... more fields
}

export interface AuthorDTO {
  name: string;
  gender: AuthorGender;
  culturalRegion?: CulturalRegion;
  // ... more fields
}
```

---

### iOS (Swift)

**Location:** `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/`

**Files:**
- `WorkDTO.swift` - Mirrors `WorkDTO` interface
- `EditionDTO.swift` - Mirrors `EditionDTO` interface
- `AuthorDTO.swift` - Mirrors `AuthorDTO` interface
- `ApiResponse.swift` - Mirrors `ApiResponse` interface

**Example:**
```swift
// WorkDTO.swift
public struct WorkDTO: Codable {
    public let title: String
    public let subjectTags: [String]
    public let originalLanguage: String?
    // ... more properties matching TypeScript
}
```

---

## When DTO Changes Are Needed

### Scenario 1: Adding a New Field

**Example:** Adding `rating` field to `WorkDTO`

**Backend (TypeScript):**
```typescript
export interface WorkDTO {
  title: string;
  subjectTags: string[];
  rating?: number;  // NEW FIELD
  // ... existing fields
}
```

**iOS (Swift):**
```swift
public struct WorkDTO: Codable {
    public let title: String
    public let subjectTags: [String]
    public let rating: Double?  // NEW FIELD (matches optional in TS)
    // ... existing properties
}
```

**Note:** Optional fields (`?` in TypeScript) must be optional in Swift (`?` in Swift)

---

### Scenario 2: Adding a New Enum Value

**Example:** Adding `'Graphic Novel'` to `EditionFormat`

**Backend (TypeScript):**
```typescript
export type EditionFormat =
  | 'Hardcover'
  | 'Paperback'
  | 'E-book'
  | 'Audiobook'
  | 'Mass Market'
  | 'Graphic Novel';  // NEW VALUE
```

**iOS (Swift):**
```swift
public enum EditionFormat: String, Codable {
    case hardcover = "Hardcover"
    case paperback = "Paperback"
    case ebook = "E-book"
    case audiobook = "Audiobook"
    case massMarcket = "Mass Market"
    case graphicNovel = "Graphic Novel"  // NEW VALUE
}
```

---

### Scenario 3: Changing Field Type

**⚠️ BREAKING CHANGE - Requires API Version Bump**

**Example:** Changing `pageCount` from optional to required

**Backend (TypeScript):**
```typescript
export interface EditionDTO {
  pageCount: number;  // CHANGED: Was pageCount?: number
}
```

**This is a breaking change because:**
- Existing iOS clients expect `pageCount` to be optional
- Requires `/v2/*` API endpoints
- Old iOS apps will break if forced to `/v1/*`

**Proper approach:**
1. Create `/v2/*` endpoints with new contract
2. Keep `/v1/*` with old contract (backward compatible)
3. Migrate iOS app to `/v2/*`
4. Deprecate `/v1/*` after migration

---

## Step-by-Step Sync Process

### Step 1: Make TypeScript Changes

```bash
cd bookstrack-backend

# Edit DTO files
nano src/types/canonical.ts

# Run backend tests
npm test

# Update API documentation
nano docs/API_README.md
```

### Step 2: Commit Backend Changes

```bash
git add src/types/
git add docs/API_README.md
git commit -m "feat: add rating field to WorkDTO"

# Pre-commit hook will warn you about iOS sync!
```

**Pre-commit hook output:**
```
🔄 Checking DTO contract changes...
⚠ DTO Contract Changes Detected:
  - src/types/canonical.ts

🚨 IMPORTANT: iOS Swift DTOs Must Be Updated Manually!

Steps to sync iOS DTOs:
1. Clone iOS repo: git clone https://github.com/jukasdrj/books-tracker-v1.git
2. Navigate to: BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/
3. Update Swift DTOs to match TypeScript changes
4. Run iOS tests: swift test
5. Commit iOS changes separately
```

### Step 3: Update iOS Swift DTOs

```bash
# Clone iOS repo (if not already)
cd ~/Downloads/xcode
git clone https://github.com/jukasdrj/books-tracker-v1.git
cd books-tracker-v1

# Navigate to DTOs
cd BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs

# Edit Swift DTOs to match TypeScript changes
nano WorkDTO.swift
```

**Match TypeScript → Swift Types:**

| TypeScript | Swift |
|------------|-------|
| `string` | `String` |
| `number` | `Int` or `Double` (depends on context) |
| `boolean` | `Bool` |
| `string[]` | `[String]` |
| `Type?` (optional) | `Type?` (optional) |
| `Type \| undefined` | `Type?` |

### Step 4: Test iOS Changes

```bash
cd ~/Downloads/xcode/books-tracker-v1

# Run Swift tests
swift test

# Or open in Xcode and run tests
open BooksTrackerPackage/Package.swift
```

### Step 5: Commit iOS Changes

```bash
git add BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/
git commit -m "feat: sync WorkDTO with backend (add rating field)

Synced from bookstrack-backend commit: abc123def
Backend PR: #123
```

### Step 6: Push Both Repos

```bash
# Push backend
cd ~/Downloads/xcode/bookstrack-backend
git push origin main

# Push iOS
cd ~/Downloads/xcode/books-tracker-v1
git push origin main
```

### Step 7: Verify Validation Workflow

After pushing backend changes:

1. Go to: https://github.com/jukasdrj/bookstrack-backend/actions
2. Check "🔍 Validate DTO Contracts" workflow
3. Verify it detects iOS DTO changes or shows validation success

---

## Automated Validation

### What Gets Validated

The validation workflow (`.github/workflows/validate-dtos.yml`) checks:

✅ iOS DTO files exist
✅ Field count is roughly similar (within 3 fields tolerance)
⚠️ Last iOS DTO update timestamp

### What Does NOT Get Validated

❌ Exact field names match
❌ Field types match (TypeScript `number` → Swift `Int`)
❌ Optional vs. required mismatch
❌ Enum values match exactly

**Why?** Full validation requires TypeScript → Swift parser, which is complex. Current validation catches major drift.

### When Validation Fails

If the validation workflow detects significant differences:

1. **Review the diff** in workflow output
2. **Update iOS DTOs** to match backend
3. **Re-run validation** by pushing iOS changes

---

## Breaking Changes Policy

### What is a Breaking Change?

**Breaking changes:**
- Removing a field
- Renaming a field
- Changing field type (e.g., `string` → `number`)
- Making optional field required
- Removing enum value
- Changing enum value casing

**Non-breaking changes (additive):**
- Adding optional field
- Adding new enum value
- Adding new DTO
- Expanding field types (e.g., `string` → `string | null` is backward compatible)

### Handling Breaking Changes

1. **Create new API version:**
   ```typescript
   // New v2 endpoint
   app.get('/v2/search/title', handleV2Search)

   // Keep v1 for backward compatibility
   app.get('/v1/search/title', handleV1Search)
   ```

2. **Update backend with both versions**

3. **Deploy backend** (now supports both `/v1/*` and `/v2/*`)

4. **Update iOS app** to use `/v2/*` endpoints

5. **Deploy iOS app**

6. **Deprecate `/v1/*`** after 90 days or when all users upgrade

---

## Deployment Order

### For Non-Breaking Changes (Recommended)

```
1. Deploy Backend (with new optional fields)
   ↓
2. iOS app still works (ignores unknown fields)
   ↓
3. Update iOS DTOs to include new fields
   ↓
4. Deploy iOS app (now uses new fields)
```

**Safe!** Old iOS apps continue working.

---

### For Breaking Changes (API v2)

```
1. Deploy Backend with /v1/* (old) and /v2/* (new)
   ↓
2. Old iOS app still uses /v1/* (works fine)
   ↓
3. Update iOS app to use /v2/*
   ↓
4. Deploy iOS app (uses new API)
   ↓
5. Monitor adoption (90 days)
   ↓
6. Deprecate /v1/* endpoints
```

---

## Common Mistakes

### ❌ Mistake 1: Forgetting to Update iOS

**Problem:** Backend DTOs change, iOS DTOs don't, app breaks.

**Solution:** Pre-commit hook now warns you!

---

### ❌ Mistake 2: Type Mismatches

**Problem:**
```typescript
// TypeScript
age?: number

// Swift (WRONG)
let age: String?  // Should be Int? or Double?
```

**Solution:** Follow type mapping table above.

---

### ❌ Mistake 3: Breaking Changes Without API Version

**Problem:** Removing field from DTO without creating `/v2/*` endpoint.

**Solution:** Always use API versioning for breaking changes.

---

## Future Automation (Planned)

### Phase 1: Current (Manual Sync + Validation) ✅
- Manual TypeScript → Swift synchronization
- Automated validation workflow
- Pre-commit warnings

### Phase 2: TypeScript → Swift Code Generation (Planned)
- Automated conversion using `quicktype` or custom tool
- Auto-generate Swift DTOs from TypeScript
- Auto-commit to iOS repo

### Phase 3: Full Contract Testing (Planned)
- Runtime contract validation
- Automated integration tests
- API endpoint response validation against DTOs

---

## Troubleshooting

### Validation Workflow Failing?

**Check:**
1. iOS repo accessible (GH_TOKEN secret set?)
2. iOS DTO files exist in correct location
3. Field counts are similar (within tolerance)

**Fix:**
- Update iOS DTOs to match backend
- Push iOS changes
- Re-run validation

---

### Pre-Commit Hook Not Warning?

**Check:**
```bash
# Is hook executable?
chmod +x .claude/hooks/pre-commit.sh

# Test manually
bash .claude/hooks/pre-commit.sh
```

---

### iOS Tests Failing After DTO Update?

**Common causes:**
- Type mismatch (String vs Int)
- Missing required field (non-optional in Swift, but optional in TypeScript)
- Enum casing mismatch

**Fix:**
- Review Swift compiler errors
- Check DTO field types match TypeScript
- Ensure optional/required modifiers match

---

## Quick Reference

**Backend DTO Files:**
- `src/types/canonical.ts`
- `src/types/enums.ts`
- `src/types/responses.ts`
- `src/types/websocket-messages.ts`

**iOS DTO Files:**
- `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/WorkDTO.swift`
- `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/EditionDTO.swift`
- `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/AuthorDTO.swift`
- `BooksTrackerPackage/Sources/BooksTrackerFeature/DTOs/ApiResponse.swift`

**Workflows:**
- `.github/workflows/validate-dtos.yml` - DTO validation
- `.github/workflows/sync-docs.yml` - Documentation sync

**Hooks:**
- `.claude/hooks/pre-commit.sh` - DTO change detection

---

**Questions?**
- Review: `.github/AUTOMATION_REVIEW.md`
- Check: `.github/SYNC_AUTOMATION.md`
- Workflow logs: https://github.com/jukasdrj/bookstrack-backend/actions
