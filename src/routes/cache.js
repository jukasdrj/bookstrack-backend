/**
 * Cache and Metrics Routes
 * Handles cache metrics and performance monitoring endpoints
 */

import { handleCacheMetrics } from '../handlers/cache-metrics.js';
import { handleMetricsRequest } from '../handlers/metrics-handler.js';
import { handleImageProxy } from '../handlers/image-proxy.js';

/**
 * Handle cache and metrics routes
 */
export async function handleCacheRoutes(request, url, env, ctx) {
  // GET /api/cache/metrics - Cache performance metrics
  if (url.pathname === '/api/cache/metrics' && request.method === 'GET') {
    return handleCacheMetrics(request, env);
  }

  // GET /metrics - Aggregated metrics with Analytics Engine
  if (url.pathname === '/metrics' && request.method === 'GET') {
    return handleMetricsRequest(request, env, ctx);
  }

  // GET /images/proxy - Proxy and cache book cover images via R2
  if (url.pathname === '/images/proxy' && request.method === 'GET') {
    return handleImageProxy(request, env);
  }

  return new Response('Not found', { status: 404 });
}
