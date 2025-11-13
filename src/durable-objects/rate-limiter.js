import { DurableObject } from 'cloudflare:workers';

/**
 * Durable Object for Rate Limiting with Atomic Operations
 * 
 * Solves the KV race condition by providing atomic counter increments
 * through Durable Object's single-threaded execution model.
 * 
 * Each IP address gets its own Durable Object instance with guaranteed
 * serialization of all operations - no race conditions possible.
 * 
 * Algorithm: Token Bucket
 * - 10 requests per minute per IP
 * - Counter resets automatically after 60 seconds
 * 
 * Security: Prevents DoS attacks on expensive AI/enrichment endpoints
 */

const RATE_LIMIT_WINDOW = 60; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per window

export class RateLimiterDO extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.storage = state.storage;
  }

  /**
   * RPC Method: Check and increment rate limit counter atomically
   * 
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number, retryAfter?: number}>}
   */
  async checkLimit() {
    const now = Date.now();
    
    // Get current counter state
    let counterData = await this.storage.get('counter');
    
    if (!counterData) {
      // First request - initialize counter
      counterData = {
        count: 1,
        resetAt: now + (RATE_LIMIT_WINDOW * 1000)
      };
      await this.storage.put('counter', counterData);
      
      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - 1,
        resetAt: counterData.resetAt
      };
    }
    
    // Check if window expired - reset counter
    if (now >= counterData.resetAt) {
      counterData = {
        count: 1,
        resetAt: now + (RATE_LIMIT_WINDOW * 1000)
      };
      await this.storage.put('counter', counterData);
      
      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - 1,
        resetAt: counterData.resetAt
      };
    }
    
    // Check if limit exceeded
    if (counterData.count >= RATE_LIMIT_MAX_REQUESTS) {
      const retryAfter = Math.ceil((counterData.resetAt - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: counterData.resetAt,
        retryAfter
      };
    }
    
    // Increment counter atomically
    counterData.count += 1;
    await this.storage.put('counter', counterData);
    
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - counterData.count,
      resetAt: counterData.resetAt
    };
  }

  /**
   * RPC Method: Get current rate limit status without incrementing
   * Used for monitoring/debugging
   * 
   * @returns {Promise<{count: number, remaining: number, resetAt: number}>}
   */
  async getStatus() {
    const now = Date.now();
    const counterData = await this.storage.get('counter');
    
    if (!counterData || now >= counterData.resetAt) {
      return {
        count: 0,
        remaining: RATE_LIMIT_MAX_REQUESTS,
        resetAt: now + (RATE_LIMIT_WINDOW * 1000)
      };
    }
    
    return {
      count: counterData.count,
      remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - counterData.count),
      resetAt: counterData.resetAt
    };
  }

  /**
   * RPC Method: Reset counter (for testing)
   */
  async reset() {
    await this.storage.delete('counter');
    return { success: true };
  }
}
