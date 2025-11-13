/**
 * Rate Limiting Middleware
 *
 * Protects expensive endpoints from abuse using Durable Object-based atomic counters.
 *
 * Security: Prevents denial-of-wallet attacks on AI/enrichment endpoints.
 * Implementation: Uses RateLimiterDO for atomic operations (no race conditions).
 * Cost: ~$0 (minimal DO requests, ~100 req/min peak)
 *
 * Algorithm: Token Bucket
 * - Each IP gets 10 tokens per minute
 * - Each request consumes 1 token atomically
 * - Tokens refill at 1 token every 6 seconds
 *
 * @example
 * ```javascript
 * const rateLimitResponse = await checkRateLimit(request, env);
 * if (rateLimitResponse) return rateLimitResponse; // 429 Too Many Requests
 * ```
 */

const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per window

/**
 * Check if request exceeds rate limit for the client's IP.
 *
 * Uses Durable Objects for atomic counter operations - eliminates race conditions.
 *
 * @param {Request} request - Incoming request
 * @param {object} env - Worker environment bindings
 * @returns {Response|null} - 429 response if rate limited, null otherwise
 */
export async function checkRateLimit(request, env) {
  // Extract client IP (Cloudflare provides this in CF-Connecting-IP header)
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // Get Durable Object stub for this IP (each IP gets its own DO instance)
    const doId = env.RATE_LIMITER_DO.idFromName(clientIP);
    const doStub = env.RATE_LIMITER_DO.get(doId);

    // Call atomic checkLimit method - guaranteed no race condition
    const result = await doStub.checkLimit();

    if (!result.allowed) {
      console.warn(`[Rate Limit] Blocked request from IP: ${clientIP} (limit exceeded)`);

      return new Response(JSON.stringify({
        error: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: result.retryAfter,
          clientIP: clientIP.substring(0, 8) + '...', // Partial IP for privacy
          requestsUsed: RATE_LIMIT_MAX_REQUESTS,
          requestsLimit: RATE_LIMIT_MAX_REQUESTS
        }
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter.toString(),
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toString()
        }
      });
    }

    // Rate limit not hit - allow request
    return null;

  } catch (error) {
    // If rate limiter fails, log error but allow request (fail open)
    console.error('[Rate Limit] Error checking rate limit:', error);
    console.warn('[Rate Limit] Failing open - allowing request despite error');
    return null;
  }
}

/**
 * Get rate limit status for a client IP (for monitoring/debugging).
 *
 * @param {string} clientIP - Client IP address
 * @param {object} env - Worker environment bindings
 * @returns {Promise<object>} - Rate limit status
 */
export async function getRateLimitStatus(clientIP, env) {
  try {
    // Get Durable Object stub for this IP
    const doId = env.RATE_LIMITER_DO.idFromName(clientIP);
    const doStub = env.RATE_LIMITER_DO.get(doId);

    // Get status without incrementing counter
    const status = await doStub.getStatus();

    return {
      success: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: status.remaining,
      resetAt: status.resetAt,
      clientIP: clientIP.substring(0, 8) + '...'
    };

  } catch (error) {
    console.error('[Rate Limit] Error getting status:', error);
    return {
      success: false,
      error: error.message,
      clientIP: clientIP.substring(0, 8) + '...'
    };
  }
}
