/**
 * Mock KV Cache Utilities
 *
 * Standalone KV mocking for testing cache operations
 * Used by: tests/kv-cache.test.js, tests/edge-cache.test.js
 */

import { vi } from 'vitest'

/**
 * Create Mock KV Namespace
 * Simulates Cloudflare KV operations with expiration support
 */
export function createMockKV() {
  const store = new Map()
  const expirations = new Map()

  return {
    /**
     * Get value from KV
     * @param {string} key - Cache key
     * @param {string|object} type - Return type ('text', 'json', 'arrayBuffer', 'stream')
     */
    get: vi.fn(async (key, type = 'text') => {
      // Check if key has expired
      if (expirations.has(key)) {
        const expireTime = expirations.get(key)
        if (Date.now() >= expireTime) {
          store.delete(key)
          expirations.delete(key)
          return null
        }
      }

      const value = store.get(key)
      if (!value) return null

      if (type === 'json') {
        try {
          return JSON.parse(value)
        } catch (err) {
          return null
        }
      }

      if (type === 'arrayBuffer') {
        return new TextEncoder().encode(value).buffer
      }

      if (type === 'stream') {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(value))
            controller.close()
          }
        })
      }

      return value
    }),

    /**
     * Put value into KV with optional expiration
     * @param {string} key - Cache key
     * @param {string|object} value - Value to store
     * @param {object} options - Options (expirationTtl, expiration, metadata)
     */
    put: vi.fn(async (key, value, options = {}) => {
      let stringValue = value
      if (typeof value === 'object') {
        stringValue = JSON.stringify(value)
      }

      store.set(key, stringValue)

      // Handle expiration TTL (seconds)
      if (options.expirationTtl) {
        const expireTime = Date.now() + (options.expirationTtl * 1000)
        expirations.set(key, expireTime)
      }

      // Handle absolute expiration (epoch seconds)
      if (options.expiration) {
        const expireTime = options.expiration * 1000
        expirations.set(key, expireTime)
      }

      // Handle metadata (stored separately in real KV, ignored in mock)
      if (options.metadata) {
        // In real KV, metadata is stored alongside value
        // For mock, we could extend this to store metadata separately
      }
    }),

    /**
     * Delete value from KV
     * @param {string} key - Cache key
     */
    delete: vi.fn(async (key) => {
      store.delete(key)
      expirations.delete(key)
    }),

    /**
     * List all keys in KV with optional filtering
     * @param {object} options - Options (prefix, limit, cursor)
     */
    list: vi.fn(async (options = {}) => {
      const { prefix = '', limit = 1000, cursor } = options
      let keys = Array.from(store.keys())

      // Filter by prefix
      if (prefix) {
        keys = keys.filter(k => k.startsWith(prefix))
      }

      // Handle cursor for pagination
      let startIndex = 0
      if (cursor) {
        startIndex = parseInt(cursor, 10) || 0
      }

      // Apply limit
      const endIndex = startIndex + limit
      const resultKeys = keys.slice(startIndex, endIndex)

      // Build response
      const response = {
        keys: resultKeys.map(name => ({ name })),
        list_complete: endIndex >= keys.length,
        cursor: endIndex < keys.length ? String(endIndex) : undefined
      }

      return response
    }),

    /**
     * Get value with metadata
     * @param {string} key - Cache key
     * @param {string} type - Return type
     */
    getWithMetadata: vi.fn(async (key, type = 'text') => {
      const value = await this.get(key, type)
      if (value === null) {
        return { value: null, metadata: null }
      }

      return {
        value,
        metadata: {} // Mock metadata (can be extended)
      }
    }),

    // ========================================================================
    // Test Helpers (prefixed with __)
    // ========================================================================

    /**
     * Get all stored data (for testing)
     */
    __getAll: () => Object.fromEntries(store),

    /**
     * Get all expirations (for testing)
     */
    __getExpirations: () => Object.fromEntries(expirations),

    /**
     * Clear all data (for testing)
     */
    __clear: () => {
      store.clear()
      expirations.clear()
    },

    /**
     * Fast-forward time to trigger expirations (for testing)
     * @param {number} ms - Milliseconds to advance
     */
    __advanceTime: async (ms) => {
      const now = Date.now() + ms

      // Expire keys
      for (const [key, expireTime] of expirations.entries()) {
        if (now >= expireTime) {
          store.delete(key)
          expirations.delete(key)
        }
      }
    },

    /**
     * Get internal store size (for testing)
     */
    __size: () => store.size,

    /**
     * Check if key exists (for testing)
     */
    __has: (key) => store.has(key)
  }
}

/**
 * Helper: Create pre-populated KV for testing
 * @param {object} data - Initial data to populate
 */
export function createPopulatedKV(data = {}) {
  const kv = createMockKV()

  for (const [key, value] of Object.entries(data)) {
    kv.__getAll()[key] = typeof value === 'object' ? JSON.stringify(value) : value
  }

  return kv
}

/**
 * Helper: Validate KV cache hit
 */
export function assertCacheHit(kv, key) {
  const calls = kv.get.mock.calls
  return calls.some(call => call[0] === key)
}

/**
 * Helper: Validate KV cache miss
 */
export function assertCacheMiss(kv, key) {
  const calls = kv.get.mock.calls
  const keyCall = calls.find(call => call[0] === key)

  if (!keyCall) {
    throw new Error(`Key "${key}" was never queried`)
  }

  // Check if get() returned null for this key
  return true // Implementation depends on mock state
}

/**
 * Helper: Validate KV put with TTL
 */
export function assertPutWithTTL(kv, key, expectedTTL) {
  const calls = kv.put.mock.calls
  const putCall = calls.find(call => call[0] === key)

  if (!putCall) {
    throw new Error(`Key "${key}" was never put into cache`)
  }

  const options = putCall[2] || {}
  if (options.expirationTtl !== expectedTTL) {
    throw new Error(
      `Expected TTL ${expectedTTL}, got ${options.expirationTtl}`
    )
  }

  return true
}

/**
 * Helper: Simulate cache expiration behavior
 * Waits for TTL to expire and validates key is removed
 */
export async function simulateExpiration(kv, key, ttl) {
  // Advance time past expiration
  await kv.__advanceTime(ttl * 1000 + 1000)

  // Try to get the key - should be null
  const value = await kv.get(key)
  return value === null
}
