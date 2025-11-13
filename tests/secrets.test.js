/**
 * Tests: Secrets Utility
 * 
 * Tests the centralized secrets utility that handles both:
 * - Cloudflare Secrets Store bindings (with async .get() method)
 * - Direct environment variables (string values)
 */

import { describe, it, expect } from 'vitest'
import { getSecret, requireSecret } from '../src/utils/secrets.ts'

describe('getSecret', () => {
  it('should return null for undefined binding', async () => {
    const result = await getSecret(undefined)
    expect(result).toBeNull()
  })

  it('should return null for null binding', async () => {
    const result = await getSecret(null)
    expect(result).toBeNull()
  })

  it('should return string value for direct env var', async () => {
    const result = await getSecret('my-api-key-123')
    expect(result).toBe('my-api-key-123')
  })

  it('should return empty string for empty string binding', async () => {
    const result = await getSecret('')
    expect(result).toBe('')
  })

  it('should return value from Secrets Store binding', async () => {
    const mockSecretBinding = {
      get: async () => 'secret-value-from-store'
    }
    const result = await getSecret(mockSecretBinding)
    expect(result).toBe('secret-value-from-store')
  })

  it('should handle Secrets Store binding that returns null', async () => {
    const mockSecretBinding = {
      get: async () => null
    }
    const result = await getSecret(mockSecretBinding)
    expect(result).toBeNull()
  })

  it('should handle Secrets Store binding that returns empty string', async () => {
    const mockSecretBinding = {
      get: async () => ''
    }
    const result = await getSecret(mockSecretBinding)
    expect(result).toBe('')
  })

  it('should return null for object without get method', async () => {
    const notASecretBinding = {
      someOtherMethod: () => 'value'
    }
    const result = await getSecret(notASecretBinding)
    expect(result).toBeNull()
  })

  it('should return null for number value', async () => {
    const result = await getSecret(123)
    expect(result).toBeNull()
  })

  it('should return null for boolean value', async () => {
    const result = await getSecret(true)
    expect(result).toBeNull()
  })
})

describe('requireSecret', () => {
  it('should throw error for undefined binding', async () => {
    await expect(requireSecret(undefined, 'TEST_KEY'))
      .rejects
      .toThrow('Required secret not configured: TEST_KEY')
  })

  it('should throw error for null binding', async () => {
    await expect(requireSecret(null, 'API_KEY'))
      .rejects
      .toThrow('Required secret not configured: API_KEY')
  })

  it('should throw error for empty string binding', async () => {
    await expect(requireSecret('', 'EMPTY_KEY'))
      .rejects
      .toThrow('Required secret not configured: EMPTY_KEY')
  })

  it('should return string value for direct env var', async () => {
    const result = await requireSecret('my-api-key-456', 'DIRECT_KEY')
    expect(result).toBe('my-api-key-456')
  })

  it('should return value from Secrets Store binding', async () => {
    const mockSecretBinding = {
      get: async () => 'secret-from-store-789'
    }
    const result = await requireSecret(mockSecretBinding, 'STORE_KEY')
    expect(result).toBe('secret-from-store-789')
  })

  it('should throw error if Secrets Store returns null', async () => {
    const mockSecretBinding = {
      get: async () => null
    }
    await expect(requireSecret(mockSecretBinding, 'NULL_STORE_KEY'))
      .rejects
      .toThrow('Required secret not configured: NULL_STORE_KEY')
  })

  it('should throw error if Secrets Store returns empty string', async () => {
    const mockSecretBinding = {
      get: async () => ''
    }
    await expect(requireSecret(mockSecretBinding, 'EMPTY_STORE_KEY'))
      .rejects
      .toThrow('Required secret not configured: EMPTY_STORE_KEY')
  })

  it('should include secret name in error message', async () => {
    await expect(requireSecret(null, 'GOOGLE_BOOKS_API_KEY'))
      .rejects
      .toThrow('GOOGLE_BOOKS_API_KEY')
  })

  it('should throw error for object without get method', async () => {
    const notASecretBinding = {
      someOtherMethod: () => 'value'
    }
    await expect(requireSecret(notASecretBinding, 'INVALID_BINDING'))
      .rejects
      .toThrow('Required secret not configured: INVALID_BINDING')
  })
})

describe('Integration scenarios', () => {
  it('should work with typical Cloudflare Secrets Store pattern', async () => {
    // Simulate Cloudflare Workers environment binding
    const env = {
      GOOGLE_BOOKS_API_KEY: {
        get: async () => 'AIzaSyA_real_api_key_here'
      }
    }
    
    const apiKey = await requireSecret(env.GOOGLE_BOOKS_API_KEY, 'GOOGLE_BOOKS_API_KEY')
    expect(apiKey).toBe('AIzaSyA_real_api_key_here')
  })

  it('should work with local development direct string pattern', async () => {
    // Simulate local development with direct string in wrangler.toml
    const env = {
      GOOGLE_BOOKS_API_KEY: 'AIzaSyA_local_dev_key'
    }
    
    const apiKey = await requireSecret(env.GOOGLE_BOOKS_API_KEY, 'GOOGLE_BOOKS_API_KEY')
    expect(apiKey).toBe('AIzaSyA_local_dev_key')
  })

  it('should work with optional secret check pattern', async () => {
    // Test optional secret pattern using getSecret
    const env = {
      OPTIONAL_KEY: null
    }
    
    const optionalKey = await getSecret(env.OPTIONAL_KEY)
    if (optionalKey) {
      // Use the key
      expect(optionalKey).toBeDefined()
    } else {
      // Skip feature or use default
      expect(optionalKey).toBeNull()
    }
  })

  it('should handle conditional operator pattern correctly', async () => {
    // Common pattern: const apiKey = env.KEY?.get ? await env.KEY.get() : env.KEY
    const secretStore = {
      get: async () => 'store-value'
    }
    
    const result = await getSecret(secretStore)
    expect(result).toBe('store-value')
  })
})
