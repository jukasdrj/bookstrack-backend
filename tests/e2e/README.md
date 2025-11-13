# End-to-End Tests

This directory contains end-to-end workflow tests that validate complete user journeys.

## Planned Test Files

As outlined in [TEST_PLAN.md](../../TEST_PLAN.md) and [TEST_IMPLEMENTATION_GUIDE.md](../../TEST_IMPLEMENTATION_GUIDE.md):

### E2E Test Files (Issue #9)

1. **bookshelf-scan.test.js** (8 tests)
   - Photo upload → WebSocket → AI processing → enrichment workflow
   - Multi-photo batch scanning
   - Error recovery and validation

2. **batch-enrichment.test.js** (8 tests)
   - Book batch enrichment workflow
   - Progress tracking via WebSocket
   - Concurrent batch processing

3. **csv-import.test.js** (10 tests)
   - CSV parsing → validation → enrichment → completion
   - Large CSV file handling
   - Error scenarios and validation

## Test Organization

E2E tests validate complete workflows from:
- Initial request → Background processing → WebSocket updates → Final response
- External API integration → Data enrichment → Cache population
- User upload → AI processing → Data normalization → Response delivery

## Coverage Goals

- All critical user workflows tested end-to-end
- Real-world error scenarios validated
- Performance and timeout handling verified
- WebSocket real-time updates confirmed

## Implementation

E2E tests will be implemented in **Phase 4** (Week 3-4) as part of Issue #9.

See [TEST_IMPLEMENTATION_GUIDE.md](../../TEST_IMPLEMENTATION_GUIDE.md) for detailed implementation steps.
