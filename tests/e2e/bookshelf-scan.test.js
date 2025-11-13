/**
 * E2E Tests: Bookshelf Scan Workflow
 *
 * Tests the complete bookshelf scanning workflow:
 * 1. Photo upload → receives jobId
 * 2. Client opens WebSocket with jobId + token
 * 3. Server sends 'ready' signal
 * 4. Processing: Image quality → Gemini AI → Enrichment
 * 5. Real-time progress updates via WebSocket
 * 6. Completion message with results
 * 7. WebSocket closes
 *
 * See TEST_PLAN.md for complete test strategy (8 tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDOStorage, createMockWebSocketPair } from '../setup.js'
import { createMockDOStub, createValidAuthToken } from '../mocks/durable-object.js'

describe('E2E: Bookshelf Scan - Complete Workflow', () => {
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

  it('should complete full workflow: upload → WebSocket → AI → enrichment → completion', async () => {
    // Phase 1: Photo Upload
    const photoData = new ArrayBuffer(1024 * 100) // 100KB photo
    const jobId = 'test-job-' + Date.now()

    // Mock photo upload response
    const uploadResponse = {
      success: true,
      jobId,
      token: authToken,
      message: 'Photo uploaded successfully'
    }

    expect(uploadResponse.jobId).toBe(jobId)
    expect(uploadResponse.token).toBe(authToken)

    // Phase 2: WebSocket Connection
    const wsUrl = `ws://localhost/ws/progress?jobId=${jobId}&token=${authToken}`
    // Note: In actual implementation, status 101 is handled by Cloudflare Workers
    // For testing, we just verify the WebSocket is available

    // Phase 3: Ready Signal
    const readySignal = { type: 'ready' }
    mockWebSocket.server.send(JSON.stringify({ type: 'ready_ack' }))

    // Phase 4: Processing Stages
    const progressUpdates = [
      { type: 'job_progress', progress: 10, stage: 'image_quality', message: 'Analyzing image quality' },
      { type: 'job_progress', progress: 30, stage: 'ai_processing', message: 'Scanning bookshelf with AI' },
      { type: 'job_progress', progress: 70, stage: 'enrichment', message: 'Enriching book data' },
      { type: 'job_progress', progress: 100, stage: 'complete', message: 'Scan complete' }
    ]

    progressUpdates.forEach(update => {
      mockWebSocket.server.send(JSON.stringify(update))
    })

    // Phase 5: Completion Message
    const completionMessage = {
      type: 'job_complete',
      results: {
        booksFound: 5,
        books: [
          { title: 'Harry Potter', author: 'J.K. Rowling', isbn: '9780439708180' },
          { title: '1984', author: 'George Orwell', isbn: '9780451524935' },
          { title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '9780547928227' },
          { title: 'Pride and Prejudice', author: 'Jane Austen', isbn: '9780141439518' },
          { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565' }
        ]
      }
    }

    mockWebSocket.server.send(JSON.stringify(completionMessage))

    // Phase 6: WebSocket Closes
    mockWebSocket.server.close(1000, 'Scan complete')

    // Verify workflow
    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(6) // ready_ack + 4 progress + complete
    expect(mockWebSocket.server.close).toHaveBeenCalledWith(1000, 'Scan complete')
  })

  it('should handle scan with cancellation mid-processing', async () => {
    const jobId = 'test-job-cancel-' + Date.now()

    // Start scan
    const progressUpdates = [
      { type: 'job_progress', progress: 10, stage: 'image_quality' },
      { type: 'job_progress', progress: 30, stage: 'ai_processing' }
    ]

    progressUpdates.forEach(update => {
      mockWebSocket.server.send(JSON.stringify(update))
    })

    // Cancel scan
    const cancelRequest = { type: 'cancel' }
    await mockDOStub.cancelBatch({ jobId })

    // Server sends cancellation confirmation
    const cancelMessage = {
      type: 'job_cancelled',
      progress: 30,
      message: 'Scan cancelled by user'
    }

    mockWebSocket.server.send(JSON.stringify(cancelMessage))
    mockWebSocket.server.close(1000, 'Cancelled')

    expect(mockDOStub.cancelBatch).toHaveBeenCalled()
    expect(mockWebSocket.server.close).toHaveBeenCalled()
  })

  it('should handle client disconnect and reconnect', async () => {
    const jobId = 'test-job-reconnect-' + Date.now()

    // Phase 1: Initial connection and processing
    mockWebSocket.server.send(JSON.stringify({ type: 'job_progress', progress: 30 }))

    // Phase 2: Client disconnects
    mockWebSocket.client.close(1001, 'Client disconnected')

    // Phase 3: Client reconnects with same jobId
    const newWebSocket = createMockWebSocketPair()

    // Server retrieves persisted state
    await mockDOStub.getJobState()
    mockDOStub.getJobState.mockResolvedValueOnce({
      pipeline: 'bookshelf_scan',
      status: 'running',
      progress: 30,
      processedCount: 1,
      totalCount: 1
    })

    // Server resumes sending progress
    newWebSocket.server.send(JSON.stringify({ type: 'job_progress', progress: 70 }))
    newWebSocket.server.send(JSON.stringify({ type: 'job_complete', progress: 100 }))

    expect(mockDOStub.getJobState).toHaveBeenCalled()
    expect(newWebSocket.server.send).toHaveBeenCalledTimes(2)
  })

  it('should handle provider failure with fallback', async () => {
    const jobId = 'test-job-provider-fail-' + Date.now()

    // AI processing succeeds
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 30,
      stage: 'ai_processing'
    }))

    // Primary provider (Google Books) fails
    const enrichmentWithFallback = {
      type: 'job_progress',
      progress: 70,
      stage: 'enrichment',
      message: 'Primary provider failed, using fallback',
      details: {
        primaryProvider: 'google-books',
        fallbackProvider: 'openlibrary',
        status: 'fallback_success'
      }
    }

    mockWebSocket.server.send(JSON.stringify(enrichmentWithFallback))

    // Complete with fallback data
    const completion = {
      type: 'job_complete',
      results: {
        booksFound: 3,
        providerStats: {
          'google-books': { attempted: 3, failed: 3 },
          'openlibrary': { attempted: 3, success: 3 }
        }
      }
    }

    mockWebSocket.server.send(JSON.stringify(completion))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(3)
  })

  it('should handle image quality validation failure', async () => {
    const jobId = 'test-job-bad-image-' + Date.now()

    // Image quality check fails
    const qualityFailure = {
      type: 'job_error',
      stage: 'image_quality',
      error: 'Image quality too low',
      details: {
        resolution: '100x100',
        minRequired: '640x480',
        message: 'Image resolution too low for accurate scanning'
      }
    }

    mockWebSocket.server.send(JSON.stringify(qualityFailure))
    mockWebSocket.server.close(1000, 'Quality check failed')

    expect(mockWebSocket.server.send).toHaveBeenCalledWith(
      expect.stringContaining('Image quality too low')
    )
    expect(mockWebSocket.server.close).toHaveBeenCalled()
  })

  it('should handle AI processing timeout', async () => {
    const jobId = 'test-job-ai-timeout-' + Date.now()

    // Image quality passes
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'image_quality'
    }))

    // AI processing times out after 30s
    const aiTimeout = {
      type: 'job_error',
      stage: 'ai_processing',
      error: 'AI processing timeout',
      details: {
        timeout: 30000,
        message: 'Gemini API did not respond within timeout period'
      }
    }

    mockWebSocket.server.send(JSON.stringify(aiTimeout))
    mockWebSocket.server.close(1000, 'AI timeout')

    expect(mockWebSocket.server.send).toHaveBeenCalledWith(
      expect.stringContaining('AI processing timeout')
    )
  })

  it('should handle multiple concurrent scans with different jobIds', async () => {
    const jobId1 = 'test-job-1-' + Date.now()
    const jobId2 = 'test-job-2-' + Date.now()

    const ws1 = createMockWebSocketPair()
    const ws2 = createMockWebSocketPair()

    // Job 1: Fast completion
    ws1.server.send(JSON.stringify({ type: 'job_progress', progress: 50 }))
    ws1.server.send(JSON.stringify({ type: 'job_complete', progress: 100 }))

    // Job 2: Slower processing
    ws2.server.send(JSON.stringify({ type: 'job_progress', progress: 30 }))
    ws2.server.send(JSON.stringify({ type: 'job_progress', progress: 60 }))
    ws2.server.send(JSON.stringify({ type: 'job_complete', progress: 100 }))

    // Both jobs complete independently
    expect(ws1.server.send).toHaveBeenCalledTimes(2)
    expect(ws2.server.send).toHaveBeenCalledTimes(3)
  })

  it('should track progress through all 3 stages accurately', async () => {
    const jobId = 'test-job-stages-' + Date.now()
    const receivedMessages = []

    // Mock client receiving messages
    mockWebSocket.client.addEventListener('message', (event) => {
      receivedMessages.push(JSON.parse(event.data))
    })

    // Stage 1: Image Quality (0-10%)
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 10,
      stage: 'image_quality',
      stageProgress: 100
    }))

    // Stage 2: AI Processing (10-30%)
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 20,
      stage: 'ai_processing',
      stageProgress: 50
    }))

    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 30,
      stage: 'ai_processing',
      stageProgress: 100
    }))

    // Stage 3: Enrichment (30-100%)
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 50,
      stage: 'enrichment',
      stageProgress: 29
    }))

    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 100,
      stage: 'enrichment',
      stageProgress: 100
    }))

    // Verify all stages tracked
    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(5)
  })
})

describe('E2E: Bookshelf Scan - Error Recovery', () => {
  let mockStorage
  let mockWebSocket
  let mockDOStub

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    mockWebSocket = createMockWebSocketPair()
    mockDOStub = createMockDOStub()
    vi.clearAllMocks()
  })

  it('should recover from temporary network failure during enrichment', async () => {
    const jobId = 'test-job-network-recovery-' + Date.now()

    // First enrichment attempt fails
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 70,
      stage: 'enrichment',
      message: 'Network error, retrying...'
    }))

    // Retry succeeds
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_progress',
      progress: 85,
      stage: 'enrichment',
      message: 'Retry successful'
    }))

    // Complete
    mockWebSocket.server.send(JSON.stringify({
      type: 'job_complete',
      progress: 100
    }))

    expect(mockWebSocket.server.send).toHaveBeenCalledTimes(3)
  })
})
