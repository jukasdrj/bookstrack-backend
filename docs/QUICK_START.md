# BooksTrack Backend - Quick Start Guide

## First Time Here?

**Start with these two files:**

1. **[API_CONTRACT.md](./API_CONTRACT.md)** - The single source of truth for the API.
2. **[../README.md](../README.md)** - Repository overview and features.

---

## Common Tasks

### 🔍 I need to...

**Find API documentation**
→ [API_CONTRACT.md](./API_CONTRACT.md)

**Deploy to production**
→ [docs/deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md)

**Setup secrets (GitHub Actions)**
→ [docs/deployment/SECRETS_SETUP.md](deployment/SECRETS_SETUP.md)

**Monitor performance metrics**
→ [docs/guides/METRICS.md](guides/METRICS.md)

**Understand ISBNdb cover caching**
→ [docs/guides/ISBNDB-HARVEST-IMPLEMENTATION.md](guides/ISBNDB-HARVEST-IMPLEMENTATION.md)

**Verify the API is working**
→ [docs/guides/VERIFICATION.md](guides/VERIFICATION.md)

**Integrate as iOS/Flutter team**
→ [V2_MIGRATION_GUIDE.md](./V2_MIGRATION_GUIDE.md)

**Review architecture decisions**
→ [../.claude/CLAUDE.md](../.claude/CLAUDE.md)

**See implementation details**
→ [plans/](plans/) folder

**Look at historical documentation**
→ [archives/](archives/) folder

---

## Directory Guide

```
docs/
├── API_CONTRACT.md            ⭐ START HERE (API contracts)
├── V2_MIGRATION_GUIDE.md      ⭐ START HERE (Frontend integration)
├── deployment/                🚀 Deployment guides
├── guides/                     📖 Feature documentation
└── archives/                   📦 Historical documentation
```

---

## Running Commands

```bash
# Local development
npm run dev                    # Start npx wrangler dev server

# Testing
npm test                       # Run all tests
npm run test:watch             # Watch mode

# Deployment
npm run deploy                 # Deploy to production

# Monitoring
npm run tail                   # Stream production logs
```

---

## Key Endpoints

**Search:**
- `GET /v1/search/title?q={query}`
- `GET /v1/search/isbn?isbn={isbn}`
- `GET /v1/search/advanced?title={title}&author={author}`

**Background Jobs:**
- `POST /v1/enrichment/batch` (with WebSocket progress)
- `POST /api/scan-bookshelf?jobId={uuid}` (AI scanning)

**Real-time Updates:**
- `wss://api.oooefam.net/ws/progress?jobId={jobId}&token={token}` (WebSocket)

**Health:**
- `GET /health` (API status)

See [API_CONTRACT.md](API_CONTRACT.md) for complete reference.

---

## Rate Limiting

**Global Limits:**
- **1000 requests/hour** per IP address
- **Burst:** 50 requests/minute

**Response header:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Support & Help

**For API questions:**
→ Open GitHub issue in `bookstrack-backend` repo

**For integration issues (iOS/Flutter):**
→ See [V2_MIGRATION_GUIDE.md](./V2_MIGRATION_GUIDE.md)

**For deployment issues:**
→ See [docs/deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md)

**For bug reports:**
→ Include endpoint, timestamp, jobId, and error message

---

**Last Updated:** November 17, 2025
**Next:** Read [API_CONTRACT.md](API_CONTRACT.md) for canonical contracts
