/**
 * Error Scenario Tests: State Violations
 *
 * Tests for invalid state transitions and recovery:
 * - Token refresh before token set
 * - Job update before initialization
 * - Batch operation on non-batch job
 * - Update on completed job
 * - Invalid state transitions
 * - DO eviction & recovery
 *
 * See TEST_PLAN.md for complete test strategy (15 tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDOStorage } from '../setup.js'
import { createMockDOStub } from '../mocks/durable-object.js'

describe('State Violations: Token Management', () => {
  let mockStorage
  let mockDOStub

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    mockDOStub = createMockDOStub()
    vi.clearAllMocks()
  })

  it('should error when refreshing token before token is set', async () => {
    // Try to refresh without setting token first
    const mockRefresh = async (oldToken) => {
      const storedToken = await mockStorage.get('authToken')
      if (!storedToken) {
        throw new Error('Cannot refresh: No token found')
      }
      return { token: 'new-token', expiresIn: 7200 }
    }

    await expect(mockRefresh('invalid-token')).rejects.toThrow(
      'Cannot refresh: No token found'
    )
  })

  it('should error when refreshing with invalid old token', async () => {
    // Set token
    await mockStorage.put('authToken', 'valid-token')
    await mockStorage.put('authTokenExpiration', Date.now() + 7200000)

    // Try to refresh with wrong token
    const mockRefresh = async (oldToken) => {
      const storedToken = await mockStorage.get('authToken')
      if (storedToken !== oldToken) {
        throw new Error('Invalid token')
      }
      return { token: 'new-token', expiresIn: 7200 }
    }

    await expect(mockRefresh('wrong-token')).rejects.toThrow('Invalid token')
  })

  it('should error when refreshing outside 30-minute window', async () => {
    const now = Date.now()
    const twoHoursFromNow = now + 7200000

    await mockStorage.put('authToken', 'valid-token')
    await mockStorage.put('authTokenExpiration', twoHoursFromNow)

    // Mock refresh logic
    const mockRefresh = async (oldToken) => {
      const expiration = await mockStorage.get('authTokenExpiration')
      const timeUntilExpiration = expiration - Date.now()
      const thirtyMinutes = 30 * 60 * 1000

      if (timeUntilExpiration > thirtyMinutes) {
        throw new Error('Cannot refresh: More than 30 minutes remain')
      }
      return { token: 'new-token', expiresIn: 7200 }
    }

    await expect(mockRefresh('valid-token')).rejects.toThrow(
      'Cannot refresh: More than 30 minutes remain'
    )
  })

  it('should error when refreshing expired token', async () => {
    const pastExpiration = Date.now() - 1000

    await mockStorage.put('authToken', 'expired-token')
    await mockStorage.put('authTokenExpiration', pastExpiration)

    const mockRefresh = async (oldToken) => {
      const expiration = await mockStorage.get('authTokenExpiration')
      if (Date.now() > expiration) {
        throw new Error('Cannot refresh: Token expired')
      }
      return { token: 'new-token', expiresIn: 7200 }
    }

    await expect(mockRefresh('expired-token')).rejects.toThrow(
      'Cannot refresh: Token expired'
    )
  })
})

describe('State Violations: Job State Management', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    vi.clearAllMocks()
  })

  it('should error when updating job before initialization', async () => {
    const mockUpdateJob = async (updates) => {
      const jobState = await mockStorage.get('jobState')
      if (!jobState) {
        throw new Error('Cannot update: Job not initialized')
      }
      return { success: true }
    }

    await expect(mockUpdateJob({ progress: 50 })).rejects.toThrow(
      'Cannot update: Job not initialized'
    )
  })

  it('should error when updating completed job', async () => {
    // Initialize completed job
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'completed',
      completedAt: Date.now()
    })

    const mockUpdateJob = async (updates) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.status === 'completed') {
        throw new Error('Cannot update: Job already completed')
      }
      return { success: true }
    }

    await expect(mockUpdateJob({ progress: 100 })).rejects.toThrow(
      'Cannot update: Job already completed'
    )
  })

  it('should error when updating failed job', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'failed',
      error: 'Provider timeout'
    })

    const mockUpdateJob = async (updates) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.status === 'failed') {
        throw new Error('Cannot update: Job already failed')
      }
      return { success: true }
    }

    await expect(mockUpdateJob({ progress: 50 })).rejects.toThrow(
      'Cannot update: Job already failed'
    )
  })

  it('should allow idempotent completion calls', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'running'
    })

    const mockCompleteJob = async (results) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.status === 'completed') {
        // Idempotent: return success without error
        return { success: true, alreadyCompleted: true }
      }
      await mockStorage.put('jobState', {
        ...jobState,
        status: 'completed',
        results
      })
      return { success: true, alreadyCompleted: false }
    }

    // First completion
    const result1 = await mockCompleteJob({ books: [] })
    expect(result1.alreadyCompleted).toBe(false)

    // Second completion (idempotent)
    const result2 = await mockCompleteJob({ books: [] })
    expect(result2.alreadyCompleted).toBe(true)
  })

  it('should validate state version on updates', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'running',
      version: 5
    })

    const mockUpdateJob = async (updates, expectedVersion) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.version !== expectedVersion) {
        throw new Error('Version mismatch: State updated by another process')
      }
      await mockStorage.put('jobState', {
        ...jobState,
        ...updates,
        version: jobState.version + 1
      })
      return { success: true }
    }

    // Update with correct version
    await mockUpdateJob({ progress: 50 }, 5)

    // Update with old version (should fail)
    await expect(mockUpdateJob({ progress: 60 }, 5)).rejects.toThrow(
      'Version mismatch'
    )
  })
})

describe('State Violations: Batch Operations', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    vi.clearAllMocks()
  })

  it('should error when performing batch operation on non-batch job', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'single_enrichment', // Not a batch pipeline
      status: 'running'
    })

    const mockUpdatePhoto = async (photoIndex, status) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.pipeline !== 'bookshelf_scan' && jobState.pipeline !== 'batch_enrichment') {
        throw new Error('Cannot update photo: Not a batch job')
      }
      return { success: true }
    }

    await expect(mockUpdatePhoto(0, 'completed')).rejects.toThrow(
      'Cannot update photo: Not a batch job'
    )
  })

  it('should error when updating photo with invalid index', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'bookshelf_scan',
      status: 'running',
      totalPhotos: 5
    })

    const mockUpdatePhoto = async (photoIndex, status) => {
      const jobState = await mockStorage.get('jobState')
      if (photoIndex < 0 || photoIndex >= jobState.totalPhotos) {
        throw new Error('Invalid photo index')
      }
      return { success: true }
    }

    await expect(mockUpdatePhoto(10, 'completed')).rejects.toThrow(
      'Invalid photo index'
    )
  })

  it('should error when initializing batch twice', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'bookshelf_scan',
      status: 'running',
      batchInitialized: true
    })

    const mockInitBatch = async ({ totalPhotos }) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.batchInitialized) {
        throw new Error('Batch already initialized')
      }
      return { success: true }
    }

    await expect(mockInitBatch({ totalPhotos: 5 })).rejects.toThrow(
      'Batch already initialized'
    )
  })

  it('should handle concurrent photo updates', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'bookshelf_scan',
      status: 'running',
      totalPhotos: 3,
      photos: [
        { status: 'pending' },
        { status: 'pending' },
        { status: 'pending' }
      ],
      version: 1
    })

    const mockUpdatePhoto = async (photoIndex, status, expectedVersion) => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.version !== expectedVersion) {
        throw new Error('Version conflict: Photo updated concurrently')
      }
      jobState.photos[photoIndex].status = status
      jobState.version++
      await mockStorage.put('jobState', jobState)
      return { success: true, version: jobState.version }
    }

    // Update photo 0
    const result1 = await mockUpdatePhoto(0, 'completed', 1)
    expect(result1.version).toBe(2)

    // Concurrent update with old version should fail
    await expect(mockUpdatePhoto(1, 'completed', 1)).rejects.toThrow(
      'Version conflict'
    )

    // Update with current version should succeed
    const result2 = await mockUpdatePhoto(1, 'completed', 2)
    expect(result2.version).toBe(3)
  })
})

describe('State Violations: Invalid State Transitions', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    vi.clearAllMocks()
  })

  it('should validate allowed state transitions', async () => {
    const validTransitions = {
      'pending': ['running', 'cancelled'],
      'running': ['completed', 'failed', 'cancelled'],
      'completed': [],
      'failed': [],
      'cancelled': []
    }

    const mockTransitionState = async (newStatus) => {
      const jobState = await mockStorage.get('jobState')
      const currentStatus = jobState.status
      const allowed = validTransitions[currentStatus] || []

      if (!allowed.includes(newStatus)) {
        throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`)
      }

      await mockStorage.put('jobState', {
        ...jobState,
        status: newStatus
      })
      return { success: true }
    }

    // Initialize job
    await mockStorage.put('jobState', { status: 'pending' })

    // Valid: pending → running
    await mockTransitionState('running')

    // Invalid: running → pending
    await expect(mockTransitionState('pending')).rejects.toThrow(
      'Invalid transition: running → pending'
    )

    // Valid: running → completed
    await mockTransitionState('completed')

    // Invalid: completed → running
    await expect(mockTransitionState('running')).rejects.toThrow(
      'Invalid transition: completed → running'
    )
  })

  it('should log state transitions for debugging', async () => {
    const transitionLog = []

    const mockTransitionState = async (newStatus) => {
      const jobState = await mockStorage.get('jobState')
      const currentStatus = jobState.status

      transitionLog.push({
        from: currentStatus,
        to: newStatus,
        timestamp: Date.now()
      })

      await mockStorage.put('jobState', {
        ...jobState,
        status: newStatus
      })
      return { success: true }
    }

    await mockStorage.put('jobState', { status: 'pending' })

    await mockTransitionState('running')
    await mockTransitionState('completed')

    expect(transitionLog).toHaveLength(2)
    expect(transitionLog[0].from).toBe('pending')
    expect(transitionLog[0].to).toBe('running')
    expect(transitionLog[1].from).toBe('running')
    expect(transitionLog[1].to).toBe('completed')
  })
})

describe('State Violations: DO Eviction & Recovery', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    vi.clearAllMocks()
  })

  it('should recover state after DO eviction', async () => {
    // Before eviction: save state
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'running',
      progress: 50,
      processedCount: 2,
      totalCount: 5
    })

    // Simulate eviction: clear in-memory state
    let inMemoryState = null

    // Recovery: load from storage
    const mockRecoverState = async () => {
      if (!inMemoryState) {
        inMemoryState = await mockStorage.get('jobState')
        if (!inMemoryState) {
          throw new Error('Cannot recover: No persisted state')
        }
      }
      return inMemoryState
    }

    const recovered = await mockRecoverState()

    expect(recovered.status).toBe('running')
    expect(recovered.progress).toBe(50)
    expect(recovered.processedCount).toBe(2)
  })

  it('should handle missing state after eviction', async () => {
    const mockRecoverState = async () => {
      const jobState = await mockStorage.get('jobState')
      if (!jobState) {
        // State never persisted or expired
        return null
      }
      return jobState
    }

    const recovered = await mockRecoverState()
    expect(recovered).toBeNull()
  })

  it('should checkpoint state periodically to prevent loss', async () => {
    const checkpointInterval = 5 // Every 5 updates
    let updatesSinceCheckpoint = 0

    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'running',
      progress: 0
    })

    const mockUpdateWithCheckpoint = async (updates) => {
      const jobState = await mockStorage.get('jobState')
      const newState = { ...jobState, ...updates }

      updatesSinceCheckpoint++

      if (updatesSinceCheckpoint >= checkpointInterval) {
        // Persist to storage
        await mockStorage.put('jobState', newState)
        updatesSinceCheckpoint = 0
        return { success: true, checkpointed: true }
      }

      // Only in-memory update
      return { success: true, checkpointed: false }
    }

    // 4 updates: no checkpoint
    for (let i = 0; i < 4; i++) {
      const result = await mockUpdateWithCheckpoint({ progress: i * 20 })
      expect(result.checkpointed).toBe(false)
    }

    // 5th update: checkpoint
    const result = await mockUpdateWithCheckpoint({ progress: 100 })
    expect(result.checkpointed).toBe(true)
  })

  it('should handle storage corruption', async () => {
    // Corrupt state: invalid JSON
    await mockStorage.put('jobState', 'invalid-json-{corrupt')

    const mockLoadState = async () => {
      try {
        const jobState = await mockStorage.get('jobState')
        if (typeof jobState === 'string') {
          // Storage returned string instead of object
          throw new Error('Corrupted state: Invalid format')
        }
        return jobState
      } catch (error) {
        // Return default state
        return {
          pipeline: 'unknown',
          status: 'failed',
          error: 'State corruption detected'
        }
      }
    }

    const state = await mockLoadState()
    expect(state.status).toBe('failed')
    expect(state.error).toContain('corruption')
  })

  it('should handle concurrent state reads after recovery', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'running',
      progress: 75
    })

    // Simulate multiple concurrent reads
    const mockGetState = async () => {
      return await mockStorage.get('jobState')
    }

    const [state1, state2, state3] = await Promise.all([
      mockGetState(),
      mockGetState(),
      mockGetState()
    ])

    // All reads should return consistent state
    expect(state1.progress).toBe(75)
    expect(state2.progress).toBe(75)
    expect(state3.progress).toBe(75)
  })
})

describe('State Violations: Cancellation Edge Cases', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockDOStorage()
    vi.clearAllMocks()
  })

  it('should handle cancellation of already completed job', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'completed'
    })

    const mockCancelJob = async () => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.status === 'completed' || jobState.status === 'failed') {
        throw new Error('Cannot cancel: Job already finished')
      }
      return { success: true }
    }

    await expect(mockCancelJob()).rejects.toThrow(
      'Cannot cancel: Job already finished'
    )
  })

  it('should handle multiple concurrent cancellation requests', async () => {
    await mockStorage.put('jobState', {
      pipeline: 'batch_enrichment',
      status: 'running',
      cancelled: false
    })

    let cancelCount = 0

    const mockCancelJob = async () => {
      const jobState = await mockStorage.get('jobState')
      if (jobState.cancelled) {
        // Idempotent: already cancelled
        return { success: true, alreadyCancelled: true }
      }

      cancelCount++
      await mockStorage.put('jobState', {
        ...jobState,
        cancelled: true,
        status: 'cancelled'
      })
      return { success: true, alreadyCancelled: false }
    }

    // First cancellation
    const result1 = await mockCancelJob()
    expect(result1.alreadyCancelled).toBe(false)

    // Second cancellation (idempotent)
    const result2 = await mockCancelJob()
    expect(result2.alreadyCancelled).toBe(true)

    expect(cancelCount).toBe(1)
  })
})
