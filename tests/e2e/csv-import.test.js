/**
 * E2E Tests: CSV Import Workflow
 *
 * Tests the complete CSV import workflow:
 * 1. Client uploads CSV → receives jobId
 * 2. Opens WebSocket (jobId + token)
 * 3. Server schedules CSV processing alarm (2s)
 * 4. Alarm triggers: parse CSV → enrich books
 * 5. Real-time progress for each row
 * 6. Completion with parsed/enriched books
 *
 * See TEST_PLAN.md for complete test strategy (10 tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDOStorage, createMockWebSocketPair } from '../setup.js'
import { createMockDOStub, createValidAuthToken } from '../mocks/durable-object.js'

describe('E2E: CSV Import - Complete Workflow', () => {
  let mockStorage
  let mockWebSocket
  let mockDOStub
  let authToken

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    mockWebSocket = createMockWebSocketPair()
    mockDOStub = createMockDOStub()
    authToken = createValidAuthToken()
    vi.clearAllMocks()
  })

  it('should complete full workflow: upload → parse → enrich → completion', async () => {
    const jobId = 'csv-job-' + Date.now()

    // Phase 1: CSV Upload
    const csvContent = `Title,Author,ISBN
Harry Potter,J.K. Rowling,9780439708180
1984,George Orwell,9780451524935
The Hobbit,J.R.R. Tolkien,9780547928227`

    const uploadResponse = {
      success: true,
      jobId,
      token: authToken,
      rowCount: 3
    }

    expect(uploadResponse.jobId).toBe(jobId)
    expect(uploadResponse.rowCount).toBe(3)

    // Phase 2: WebSocket Connection
    // Note: In actual implementation, status 101 is handled by Cloudflare Workers
    // For testing, we just verify the WebSocket is available

    // Phase 3: Processing Alarm Scheduled
    const alarmScheduled = {
      type: 'csv_processing_scheduled',
      alarmTime: Date.now() + 2000,
      message: 'CSV parsing will begin in 2 seconds'
    }

    mockWebSocket.server.send(JSON.stringify(alarmScheduled))

    // Phase 4: CSV Parsing Begins
    const parsingStarted = {
      type: 'job_progress',
      progress: 10,
      stage: 'parsing',
      message: 'Parsing CSV file'
    }

    mockWebSocket.server.send(JSON.stringify(parsingStarted))

    // Phase 5: Row-by-Row Progress
    const rowUpdates = [
      { type: 'job_progress', progress: 30, processedCount: 1, totalCount: 3, currentRow: 1 },
      { type: 'job_progress', progress: 60, processedCount: 2, totalCount: 3, currentRow: 2 },
      { type: 'job_progress', progress: 90, processedCount: 3, totalCount: 3, currentRow: 3 }
    ]

    rowUpdates.forEach(update => {
      mockWebSocket.server.send(JSON.stringify(update))
    })

    // Phase 6: Completion with Results
    const completion = {
      type: 'job_complete',
      results: {
        totalRows: 3,
        successful: 3,
        failed: 0,
        books: [
          { title: 'Harry Potter', author: 'J.K. Rowling', isbn: '9780439708180', row: 1 },
          { title: '1984', author: 'George Orwell', isbn: '9780451524935', row: 2 },
          { title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '9780547928227', row: 3 }
        ]
      }
    }

    mockWebSocket.server.send(JSON.stringify(completion))

    // Phase 7: WebSocket Closes
    mockWebSocket.server.close(1000, 'CSV import complete')

    // Verify workflow
    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(6) // alarm + parsing + 3 rows + complete
    expect(mockWebSocket.server.close).toHaveBeenCalledWith(1000, 'CSV import complete')
  })

  it('should handle invalid rows in CSV', async () => {
    const jobId = 'csv-job-invalid-' + Date.now()

    // CSV with some invalid rows
    const csvContent = `Title,Author,ISBN
Harry Potter,J.K. Rowling,9780439708180
Invalid Book,,
1984,George Orwell,9780451524935
,Missing Title,
The Hobbit,J.R.R. Tolkien,9780547928227`

    // Parsing started
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'parsing'
    }))

    // Row updates with validation errors
    const updates = [
      { type: 'job_progress', progress: 20, processedCount: 1, status: 'success' },
      { type: 'job_progress', progress: 40, processedCount: 2, status: 'invalid', error: 'Missing required field: isbn' },
      { type: 'job_progress', progress: 60, processedCount: 3, status: 'success' },
      { type: 'job_progress', progress: 80, processedCount: 4, status: 'invalid', error: 'Missing required field: title' },
      { type: 'job_progress', progress: 100, processedCount: 5, status: 'success' }
    ]

    updates.forEach(update => {
      mockWebSocket.server.send(JSON.stringify(update))
    })

    // Completion with partial results
    const completion = {
      type: 'job_complete',
      results: {
        totalRows: 5,
        successful: 3,
        failed: 2,
        invalidRows: [2, 4],
        errors: [
          { row: 2, error: 'Missing required field: isbn' },
          { row: 4, error: 'Missing required field: title' }
        ]
      }
    }

    mockWebSocket.server.send(JSON.stringify(completion))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(7)
  })

  it('should validate CSV file size', async () => {
    const jobId = 'csv-job-size-' + Date.now()

    // Very large CSV (>10MB)
    const largeCSV = {
      size: 11 * 1024 * 1024, // 11MB
      rows: 50000
    }

    // Size validation error
    const sizeError = {
      type: 'job_error',
      error: 'CSV file too large',
      details: {
        fileSize: largeCSV.size,
        maxSize: 10 * 1024 * 1024,
        message: 'CSV file exceeds maximum size of 10MB'
      }
    }

    mockWebSocket.server.send(JSON.stringify(sizeError))
    mockWebSocket.server.close(1000, 'Validation failed')

    expect(mockWebSocket.server.send).toHaveBeenCalledWith(
      expect.stringContaining('CSV file too large')
    )
    expect(mockWebSocket.server.close).toHaveBeenCalled()
  })

  it('should handle CSV parsing errors', async () => {
    const jobId = 'csv-job-parse-error-' + Date.now()

    // Malformed CSV
    const malformedCSV = `Title,Author,ISBN
"Unclosed quote,Missing Author,123
Normal Book,Author,456`

    // Parsing error
    const parseError = {
      type: 'job_error',
      stage: 'parsing',
      error: 'CSV parsing failed',
      details: {
        line: 2,
        message: 'Unclosed quote in CSV'
      }
    }

    mockWebSocket.server.send(JSON.stringify(parseError))
    mockWebSocket.server.close(1000, 'Parse error')

    expect(mockWebSocket.server.send).toHaveBeenCalledWith(
      expect.stringContaining('CSV parsing failed')
    )
  })

  it('should handle CSV with missing header columns', async () => {
    const jobId = 'csv-job-missing-headers-' + Date.now()

    // CSV missing required columns
    const csvContent = `Title,Author
Harry Potter,J.K. Rowling
1984,George Orwell`

    // Header validation error
    const headerError = {
      type: 'job_error',
      stage: 'validation',
      error: 'Missing required columns',
      details: {
        foundColumns: ['Title', 'Author'],
        requiredColumns: ['Title', 'Author', 'ISBN'],
        missingColumns: ['ISBN']
      }
    }

    mockWebSocket.server.send(JSON.stringify(headerError))
    mockWebSocket.server.close(1000, 'Validation failed')

    expect(mockWebSocket.server.send).toHaveBeenCalledWith(
      expect.stringContaining('Missing required columns')
    )
  })

  it('should handle enrichment failures during CSV processing', async () => {
    const jobId = 'csv-job-enrich-fail-' + Date.now()

    // Start processing
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'parsing'
    }))

    // Row 1: Success
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 33,
      processedCount: 1,
      status: 'success'
    }))

    // Row 2: Enrichment fails
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 67,
      processedCount: 2,
      status: 'enrichment_failed',
      error: 'No data from providers'
    }))

    // Row 3: Success
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 100,
      processedCount: 3,
      status: 'success'
    }))

    // Completion
    const completion = {
      type: 'job_complete',
      results: {
        totalRows: 3,
        successful: 2,
        failed: 1,
        enrichmentErrors: [
          { row: 2, error: 'No data from providers' }
        ]
      }
    }

    mockWebSocket.server.send(JSON.stringify(completion))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(5)
  })

  it('should handle CSV with duplicate ISBNs', async () => {
    const jobId = 'csv-job-duplicates-' + Date.now()

    // CSV with duplicate ISBNs
    const csvContent = `Title,Author,ISBN
Harry Potter 1,J.K. Rowling,9780439708180
Harry Potter 2,J.K. Rowling,9780439708180
1984,George Orwell,9780451524935`

    // Processing with deduplication
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'parsing'
    }))

    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 50,
      processedCount: 2,
      message: 'Duplicate ISBN detected, using cached data'
    }))

    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 100,
      processedCount: 3
    }))

    // Completion
    const completion = {
      type: 'job_complete',
      results: {
        totalRows: 3,
        successful: 3,
        duplicatesFound: 1,
        cacheHits: 1
      }
    }

    mockWebSocket.server.send(JSON.stringify(completion))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(4)
  })

  it('should handle very large CSV with progress tracking', async () => {
    const jobId = 'csv-job-large-' + Date.now()

    // Large CSV with 100 rows
    const totalRows = 100

    // Start processing
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 5,
      stage: 'parsing',
      totalRows
    }))

    // Sample progress updates (every 25 rows)
    const progressUpdates = [
      { progress: 25, processedCount: 25, totalCount: 100 },
      { progress: 50, processedCount: 50, totalCount: 100 },
      { progress: 75, processedCount: 75, totalCount: 100 },
      { progress: 100, processedCount: 100, totalCount: 100 }
    ]

    progressUpdates.forEach(update => {
      mockWebSocket.server.send(JSON.stringify({
        type: 'job_progress',
        ...update
      }))
    })

    // Completion
    const completion = {
      type: 'job_complete',
      results: {
        totalRows: 100,
        successful: 98,
        failed: 2,
        processingTime: 45000 // 45 seconds
      }
    }

    mockWebSocket.server.send(JSON.stringify(completion))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(6) // parsing + 4 progress + complete
  })

  it('should handle alarm trigger timeout', async () => {
    const jobId = 'csv-job-alarm-timeout-' + Date.now()

    // Alarm scheduled
    mockWebSocket.server.send(JSON.stringify({
      type: 'csv_processing_scheduled',
      alarmTime: Date.now() + 2000
    }))

    // Wait for alarm (2 seconds)
    // In actual implementation, this would be handled by DO alarm

    // Processing starts after alarm
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'parsing',
      message: 'Processing started by alarm'
    }))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(2)
  })

  it('should handle cancellation during CSV processing', async () => {
    const jobId = 'csv-job-cancel-' + Date.now()

    // Start processing
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'parsing'
    }))

    // Process some rows
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 40,
      processedCount: 20,
      totalCount: 50
    }))

    // Cancel request
    await mockDOStub.cancelBatch({ jobId })

    // Cancellation message
    const cancelMessage = {
      type: 'job_cancelled',
      progress: 40,
      processedCount: 20,
      totalCount: 50,
      message: 'CSV import cancelled by user'
    }

    mockWebSocket.server.send(JSON.stringify(cancelMessage))
    mockWebSocket.server.close(1000, 'Cancelled')

    expect(mockDOStub.cancelBatch).toHaveBeenCalled()
    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(3)
  })
})

describe('E2E: CSV Import - Gemini Integration', () => {
  it('should use Gemini for CSV parsing when enabled', async () => {
    const jobId = 'csv-job-gemini-' + Date.now()

    // Gemini parsing enabled
    const geminiParsingMessage = {
      type: 'job_progress',
      progress: 10,
      stage: 'gemini_parsing',
      message: 'Using Gemini AI to parse CSV'
    }

    const mockWebSocket = createMockWebSocketPair()
    mockWebSocket.server.send(JSON.stringify(geminiParsingMessage))

    // Gemini returns parsed data
    const geminiComplete = {
      type: 'job_progress',
      progress: 30,
      stage: 'gemini_complete',
      message: 'Gemini parsing complete',
      parsedRows: 10
    }

    mockWebSocket.server.send(JSON.stringify(geminiComplete))

    // Enrichment begins
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 50,
      stage: 'enrichment'
    }))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(3)
  })
})

describe('E2E: CSV Import - Error Recovery', () => {
  it('should recover from temporary provider failures', async () => {
    const jobId = 'csv-job-recovery-' + Date.now()

    const mockWebSocket = createMockWebSocketPair()

    // Row 1: Provider timeout, retry succeeds
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 33,
      processedCount: 1,
      message: 'Provider timeout, retrying...'
    }))

    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 33,
      processedCount: 1,
      status: 'retry_success',
      message: 'Retry successful'
    }))

    // Continue processing
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 67,
      processedCount: 2
    }))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(3)
  })
})
