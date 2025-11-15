/**
 * Analytics Tracking Middleware
 *
 * Tracks request metrics and adds custom headers to API responses.
 * Integrates with Cloudflare Analytics Engine for aggregated metrics.
 *
 * Features:
 * - Response time tracking (X-Response-Time header)
 * - Cache status reporting (X-Cache-Status header)
 * - Error code tracking (X-Error-Code header)
 * - Analytics Engine data points for dashboards
 *
 * Related: Issue #108 - Missing analytics tracking from PR #95
 */

/**
 * Get cache status from response
 * @param {Response} response - HTTP response object
 * @returns {string} Cache status (HIT, MISS, BYPASS, NONE)
 */
function getCacheStatus(response) {
  // Check for existing cache header
  const existingCacheHeader = response.headers.get("X-Cache");
  if (existingCacheHeader) {
    return existingCacheHeader;
  }

  // Check if response came from cache (Cloudflare cache)
  const cfCacheStatus = response.headers.get("CF-Cache-Status");
  if (cfCacheStatus) {
    return cfCacheStatus;
  }

  // Check if response has cache control headers
  const cacheControl = response.headers.get("Cache-Control");
  if (
    !cacheControl ||
    cacheControl.includes("no-cache") ||
    cacheControl.includes("no-store")
  ) {
    return "BYPASS";
  }

  // Default to NONE if no cache information available
  return "NONE";
}

/**
 * Extract error code from response
 * @param {Response} response - HTTP response object
 * @returns {string|null} Error code or null if no error
 */
function getErrorCode(response) {
  if (response.ok) {
    return null;
  }

  // Try to extract error code from response body (cached during response creation)
  const errorCodeHeader = response.headers.get("X-Error-Type");
  if (errorCodeHeader) {
    return errorCodeHeader;
  }

  // Fallback to HTTP status code mapping
  const statusCode = response.status;
  const errorMap = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
  };

  return errorMap[statusCode] || `HTTP_${statusCode}`;
}

/**
 * Track analytics for API request
 *
 * @param {Request} request - Original request object
 * @param {Response} response - Response object (will be cloned)
 * @param {Object} env - Cloudflare environment bindings
 * @param {ExecutionContext} ctx - Execution context for waitUntil
 * @param {number} startTime - Request start timestamp (Date.now())
 * @returns {Promise<Response>} Response with analytics headers added
 */
export async function trackAnalytics(request, response, env, ctx, startTime) {
  // Skip analytics for health checks and test endpoints
  const url = new URL(request.url);
  const skipPaths = ["/health", "/test/"];
  if (skipPaths.some((path) => url.pathname.startsWith(path))) {
    return response;
  }

  // Respect analytics flag (can be disabled via env var)
  const analyticsEnabled = env.ENABLE_PERFORMANCE_LOGGING !== "false";
  if (!analyticsEnabled) {
    return response;
  }

  const processingTime = Date.now() - startTime;
  const cacheStatus = getCacheStatus(response);
  const errorCode = getErrorCode(response);

  // Clone response to add headers (responses are immutable)
  const newResponse = new Response(response.body, response);

  // Add custom headers
  newResponse.headers.set("X-Response-Time", `${processingTime}ms`);
  newResponse.headers.set("X-Cache-Status", cacheStatus);

  if (errorCode) {
    newResponse.headers.set("X-Error-Code", errorCode);
  }

  // Write analytics data point (non-blocking via ctx.waitUntil)
  if (env.PERFORMANCE_ANALYTICS && ctx) {
    ctx.waitUntil(
      env.PERFORMANCE_ANALYTICS.writeDataPoint({
        // Blobs: String dimensions for filtering
        blobs: [
          url.pathname, // Endpoint path
          response.status.toString(), // HTTP status code
          errorCode || "SUCCESS", // Error code or success
          request.headers.get("CF-Connecting-IP") || "unknown", // Client IP
          request.cf?.colo || "unknown", // Cloudflare datacenter
        ],
        // Doubles: Numeric metrics for aggregation
        doubles: [processingTime],
        // Indexes: Indexed dimensions for fast queries
        indexes: [url.pathname],
      }).catch((err) => {
        // Log but don't fail request if analytics write fails
        console.error("[Analytics] Failed to write data point:", err);
      }),
    );
  }

  return newResponse;
}

/**
 * Middleware wrapper for handlers
 *
 * Usage:
 * ```javascript
 * import { withAnalytics } from './middleware/analytics-tracker.js'
 *
 * export default {
 *   async fetch(request, env, ctx) {
 *     const startTime = Date.now()
 *     const response = await handleRequest(request, env, ctx)
 *     return withAnalytics(request, response, env, ctx, startTime)
 *   }
 * }
 * ```
 *
 * @param {Request} request - Original request
 * @param {Response} response - Response to track
 * @param {Object} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context
 * @param {number} startTime - Request start time
 * @returns {Promise<Response>} Response with analytics
 */
export async function withAnalytics(request, response, env, ctx, startTime) {
  return trackAnalytics(request, response, env, ctx, startTime);
}
