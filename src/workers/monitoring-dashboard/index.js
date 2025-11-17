/**
 * Monitoring Dashboard Worker
 * 
 * Provides a comprehensive monitoring dashboard for BooksTrack backend infrastructure.
 * 
 * Features:
 * - Real-time worker health and performance metrics
 * - Cache performance tracking (Edge, KV, R2)
 * - External API health monitoring
 * - WebSocket connection stats
 * - Cost estimation and analysis
 * - Alert status display
 * 
 * Routes:
 * - GET / - Dashboard UI
 * - GET /api/health - Overall system health
 * - GET /api/metrics - Aggregated metrics
 * - GET /api/cache-stats - Cache performance data
 * - GET /api/provider-health - External API provider status
 * - GET /api/websocket-stats - WebSocket connection metrics
 * - GET /api/costs - Cost estimation and breakdown
 */

import { handleDashboard } from './handlers/dashboard.js';
import { handleHealthCheck } from './handlers/health.js';
import { handleMetrics } from './handlers/metrics.js';
import { handleCacheStats } from './handlers/cache-stats.js';
import { handleProviderHealth } from './handlers/provider-health.js';
import { handleWebSocketStats } from './handlers/websocket-stats.js';
import { handleCosts } from './handlers/costs.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for dashboard
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      let response;

      // Route requests
      switch (path) {
        case '/':
          response = await handleDashboard(request, env);
          break;
        case '/api/health':
          response = await handleHealthCheck(request, env);
          break;
        case '/api/metrics':
          response = await handleMetrics(request, env);
          break;
        case '/api/cache-stats':
          response = await handleCacheStats(request, env);
          break;
        case '/api/provider-health':
          response = await handleProviderHealth(request, env);
          break;
        case '/api/websocket-stats':
          response = await handleWebSocketStats(request, env);
          break;
        case '/api/costs':
          response = await handleCosts(request, env);
          break;
        default:
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to response
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },
};
