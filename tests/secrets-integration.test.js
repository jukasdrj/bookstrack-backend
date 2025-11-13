/**
 * Integration test to verify secrets utility works with external-apis
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchGoogleBooks, searchGoogleBooksById, searchGoogleBooksByISBN } from '../src/services/external-apis.js'

describe('Secrets Integration with External APIs', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('searchGoogleBooks', () => {
    it('should return error response when API key is missing', async () => {
      const env = {
        GOOGLE_BOOKS_API_KEY: null
      }
      
      const result = await searchGoogleBooks('test', {}, env)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Required secret not configured: GOOGLE_BOOKS_API_KEY')
    })

    it('should work with direct string API key', async () => {
      // Mock fetch to avoid actual API call
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] })
      })

      const env = {
        GOOGLE_BOOKS_API_KEY: 'test-api-key'
      }
      
      const result = await searchGoogleBooks('test', {}, env)
      expect(result.success).toBe(true)
      
      // Verify API key was used in the request
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=test-api-key'),
        expect.any(Object)
      )
    })

    it('should work with Secrets Store binding', async () => {
      // Mock fetch to avoid actual API call
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] })
      })

      const env = {
        GOOGLE_BOOKS_API_KEY: {
          get: async () => 'secret-store-key'
        }
      }
      
      const result = await searchGoogleBooks('test', {}, env)
      expect(result.success).toBe(true)
      
      // Verify API key from secrets store was used
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=secret-store-key'),
        expect.any(Object)
      )
    })
  })

  describe('searchGoogleBooksById', () => {
    it('should return error response when API key is undefined', async () => {
      const env = {}
      
      const result = await searchGoogleBooksById('test-id', env)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Required secret not configured: GOOGLE_BOOKS_API_KEY')
    })

    it('should work with Secrets Store binding', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ volumeInfo: { title: 'Test Book' } })
      })

      const env = {
        GOOGLE_BOOKS_API_KEY: {
          get: async () => 'my-secret-key'
        }
      }
      
      const result = await searchGoogleBooksById('abc123', env)
      expect(result.success).toBe(true)
      
      // Verify correct API endpoint was called with secret
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('volumes/abc123'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=my-secret-key'),
        expect.any(Object)
      )
    })
  })

  describe('searchGoogleBooksByISBN', () => {
    it('should return error response when API key is empty string', async () => {
      const env = {
        GOOGLE_BOOKS_API_KEY: ''
      }
      
      const result = await searchGoogleBooksByISBN('9780439708180', env)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Required secret not configured: GOOGLE_BOOKS_API_KEY')
    })

    it('should work with direct string API key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] })
      })

      const env = {
        GOOGLE_BOOKS_API_KEY: 'my-api-key-123'
      }
      
      const result = await searchGoogleBooksByISBN('9780439708180', env)
      expect(result.success).toBe(true)
      
      // Verify ISBN search was performed with API key
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('isbn:9780439708180'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=my-api-key-123'),
        expect.any(Object)
      )
    })
  })
})
