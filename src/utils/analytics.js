/**
 * Analytics Engine utilities for cache and API metrics
 *
 * Standardized functions for writing metrics to Analytics Engine.
 * Used by search endpoints to track ISBN lookups, cache hits/misses, performance,
 * and external API calls.
 */

/**
 * Write cache metrics to Analytics Engine
 *
 * @param {Object} env - Worker environment bindings (must include CACHE_ANALYTICS)
 * @param {Object} metrics - Metrics to write
 * @param {string} metrics.endpoint - API endpoint path (e.g., '/search/isbn')
 * @param {string} [metrics.isbn] - ISBN value (for ISBN searches only)
 * @param {boolean} metrics.cacheHit - Whether request was served from cache
 * @param {number} metrics.responseTime - Response time in milliseconds
 * @param {string} metrics.imageQuality - Image quality tier (e.g., 'HIGH', 'MEDIUM')
 * @param {number} metrics.dataCompleteness - Data completeness percentage (0-100)
 * @param {number} metrics.itemCount - Number of items returned
 *
 * @example
 * // ISBN search (logs actual ISBN for daily harvest)
 * await writeCacheMetrics(env, {
 *   endpoint: '/search/isbn',
 *   isbn: '9780385529985',
 *   cacheHit: false,
 *   responseTime: 234,
 *   imageQuality: 'HIGH',
 *   dataCompleteness: 85,
 *   itemCount: 1
 * });
 *
 * @example
 * // Title search (logs endpoint + quality)
 * await writeCacheMetrics(env, {
 *   endpoint: '/search/title',
 *   cacheHit: true,
 *   responseTime: 5,
 *   imageQuality: 'MEDIUM',
 *   dataCompleteness: 78,
 *   itemCount: 15
 * });
 */
export async function writeCacheMetrics(env, metrics) {
  if (!env.CACHE_ANALYTICS) {
    console.warn('CACHE_ANALYTICS binding not available');
    return;
  }

  try {
    // For ISBN searches, log the actual ISBN value for daily harvest
    // Analytics harvest script expects: blob1=<isbn_number>, blob2='isbn_search', index1='google-books-isbn'
    // For other searches, log endpoint and image quality (legacy format)
    const blobs = metrics.isbn
      ? [metrics.isbn, 'isbn_search']  // blob1=<isbn_number>, blob2='isbn_search'
      : [metrics.endpoint, metrics.imageQuality];

    // For ISBN searches, set index1='google-books-isbn' for query filtering
    // For other searches, use cache hit/miss as index0
    const indexes = metrics.isbn
      ? ['google-books-isbn', metrics.cacheHit ? 'HIT' : 'MISS']  // index1='google-books-isbn', index0=HIT/MISS
      : [metrics.cacheHit ? 'HIT' : 'MISS'];  // index0=HIT/MISS only

    await env.CACHE_ANALYTICS.writeDataPoint({
      blobs,
      doubles: [
        metrics.responseTime,
        metrics.dataCompleteness,
        metrics.itemCount
      ],
      indexes
    });
  } catch (error) {
    console.error('Failed to write cache metrics:', error);
    // TODO: Add error tracking metric (env.ANALYTICS_ERRORS.increment())
    // Don't throw - would break search requests. Silent failure acceptable for analytics.
  }
}

/**
 * Write API call metrics to Analytics Engine
 *
 * Provides consistent analytics logging for external API integrations with
 * graceful degradation if analytics binding is unavailable.
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} provider - API provider name (e.g., 'google-books', 'openlibrary', 'isbndb')
 * @param {string} operation - Operation type (e.g., 'search', 'isbn_search', 'id_search')
 * @param {string} query - Search query or identifier
 * @param {number} processingTime - Processing time in milliseconds
 * @param {number} resultCount - Number of results returned
 * @param {boolean} success - Whether the API call succeeded
 * @param {string} [error] - Error message if call failed
 *
 * @example
 * // Successful Google Books search
 * logAPIMetrics(env, 'google-books', 'search', 'Harry Potter', 234, 15, true);
 *
 * @example
 * // Failed OpenLibrary search
 * logAPIMetrics(env, 'openlibrary', 'search', 'invalid query', 123, 0, false, 'API error: 404');
 */
export function logAPIMetrics(env, provider, operation, query, processingTime, resultCount, success, error = null) {
  const analyticsBinding = getAnalyticsBinding(env, provider);
  
  if (!analyticsBinding) {
    return;
  }

  try {
    const blobs = [query, success ? operation : `${operation}_error`];
    const doubles = [processingTime, resultCount];
    const indexes = [success ? `${provider}-${operation}` : `${provider}-error`];

    analyticsBinding.writeDataPoint({
      blobs,
      doubles,
      indexes
    });
  } catch (err) {
    console.error(`Failed to write ${provider} metrics:`, err);
    // Don't throw - analytics failure should not break API calls
  }
}

/**
 * Get the appropriate analytics binding for a provider
 *
 * Maps provider names to their analytics bindings with graceful fallback
 * if binding is unavailable.
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} provider - Provider name
 * @returns {Object|null} Analytics binding or null if unavailable
 * @private
 */
function getAnalyticsBinding(env, provider) {
  const bindingMap = {
    'google-books': 'GOOGLE_BOOKS_ANALYTICS',
    'openlibrary': 'OPENLIBRARY_ANALYTICS',
    'isbndb': 'ISBNDB_ANALYTICS'
  };

  const bindingName = bindingMap[provider];
  if (!bindingName) {
    console.warn(`Unknown provider for analytics: ${provider}`);
    return null;
  }

  const binding = env[bindingName];
  if (!binding) {
    console.warn(`${bindingName} binding not available`);
    return null;
  }

  return binding;
}
