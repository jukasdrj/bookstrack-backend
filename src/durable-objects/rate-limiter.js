import { DurableObject } from "cloudflare:workers";

/**
 * Rate Limiter Durable Object
 *
 * Provides atomic rate limiting with guaranteed serialization.
 * Fixes race condition in KV-based rate limiter by using DO's single-threaded execution.
 *
 * One instance per client IP address - ensures all requests from same IP are serialized.
 * No race condition window: read-modify-write happens atomically in DO transaction.
 *
 * Algorithm: Token Bucket
 * - Each IP gets 10 tokens per 60-second window
 * - Each request consumes 1 token
 * - Window resets after 60 seconds of inactivity
 *
 * Performance:
 * - Atomic check & increment: ~5-10ms (acceptable for rate limiter)
 * - No thundering herd problem (single DO per IP handles serialization)
 * - Scales horizontally (each IP has own DO)
 *
 * @example
 * ```javascript
 * const id = env.RATE_LIMITER_DO.idFromName(clientIP)
 * const stub = env.RATE_LIMITER_DO.get(id)
 * const { allowed, remaining, resetAt } = await stub.checkAndIncrement()
 * ```
 */

const RATE_LIMIT_WINDOW = 60; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per window

export class RateLimiterDO extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.state = state;
  }

  /**
   * Check if request is allowed and atomically increment counter.
   *
   * This is the core atomic operation that fixes the race condition.
   * No concurrent requests can both pass the check - serialization guaranteed by DO.
   *
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
   */
  async checkAndIncrement() {
    const now = Date.now();

    // Get current counter state
    const counters = (await this.state.storage.get("counters")) || {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW * 1000,
    };

    // Check if window expired
    if (now >= counters.resetAt) {
      // Reset to new window
      counters.count = 0;
      counters.resetAt = now + RATE_LIMIT_WINDOW * 1000;
    }

    // Check if limit exceeded (BEFORE incrementing)
    const allowed = counters.count < RATE_LIMIT_MAX_REQUESTS;

    if (allowed) {
      // Increment counter (atomic with storage transaction)
      counters.count++;
      await this.state.storage.put("counters", counters);
    }

    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - counters.count);

    return {
      allowed,
      remaining,
      resetAt: counters.resetAt,
    };
  }

  /**
   * Handle fetch requests from rate limiter middleware.
   * Expect POST to trigger checkAndIncrement and return result.
   */
  async fetch(request) {
    if (request.method === "POST") {
      const result = await this.checkAndIncrement();
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }
}
