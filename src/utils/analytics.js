/**
 * Analytics Engine utilities for cache metrics and provider performance
 *
 * Standardized functions for writing cache metrics to Analytics Engine.
 * Used by search endpoints to track ISBN lookups, cache hits/misses, and performance.
 * Also used by external API services to track provider performance.
 */

/**
 * Record an event to Analytics Engine dataset
 * Silently fails if dataset not available (graceful degradation)
 *
 * @param {Object} dataset - Analytics Engine dataset binding
 * @param {Object} event - Event data to write
 * @param {Array<string|number>} [event.blobs] - Array of string/number values
 * @param {Array<number>} [event.doubles] - Array of numeric values
 * @param {Array<string>} [event.indexes] - Array of index values for filtering
 * @returns {Promise<void>}
 *
 * @example
 * await recordAnalytics(env.GOOGLE_BOOKS_ANALYTICS, {
 *   blobs: ['query', 'search'],
 *   doubles: [123, 5],
 *   indexes: ['google-books-search']
 * });
 */
export async function recordAnalytics(dataset, event) {
  if (!dataset) {
    return;
  }

  try {
    dataset.writeDataPoint(event);
  } catch (error) {
    console.warn('[Analytics] Failed to record event:', error.message);
  }
}

/**
 * Record provider performance metrics
 *
 * @param {Object} dataset - Analytics Engine dataset binding
 * @param {string} provider - Provider name (e.g., 'google-books', 'openlibrary', 'isbndb')
 * @param {string} operation - Operation type (e.g., 'search', 'isbn_search', 'id_search')
 * @param {number} processingTimeMs - Processing time in milliseconds
 * @param {number} resultCount - Number of results returned
 * @param {string} [error] - Error message if operation failed
 * @returns {Promise<void>}
 *
 * @example
 * // Success case
 * await recordProviderMetric(
 *   env.GOOGLE_BOOKS_ANALYTICS,
 *   'google-books',
 *   'search',
 *   123,
 *   5
 * );
 *
 * @example
 * // Error case
 * await recordProviderMetric(
 *   env.GOOGLE_BOOKS_ANALYTICS,
 *   'google-books',
 *   'search',
 *   50,
 *   0,
 *   'API timeout'
 * );
 */
export async function recordProviderMetric(
  dataset,
  provider,
  operation,
  processingTimeMs,
  resultCount,
  error
) {
  await recordAnalytics(dataset, {
    blobs: [provider, operation, error ? 'error' : 'success'],
    doubles: [processingTimeMs, resultCount],
    indexes: [error ? 'provider-error' : 'provider-success']
  });
}

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
