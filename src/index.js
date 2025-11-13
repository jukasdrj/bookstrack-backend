import { ProgressWebSocketDO } from './durable-objects/progress-socket.js';
import { processAuthorBatch } from './consumers/author-warming-consumer.js';
import { handleScheduledArchival } from './handlers/scheduled-archival.js';
import { handleScheduledAlerts } from './handlers/scheduled-alerts.js';
import { handleScheduledHarvest } from './handlers/scheduled-harvest.js';
import { handleHarvestDashboard } from './handlers/harvest-dashboard.js';
import { getCorsHeaders } from './middleware/cors.js';
import { handleWebSocketRoutes } from './routes/websocket.js';
import { handleJobRoutes } from './routes/jobs.js';
import { handleEnrichmentRoutes } from './routes/enrichment.js';
import { handleAIRoutes } from './routes/ai.js';
import { handleSearchRoutes } from './routes/search.js';
import { handleCacheRoutes } from './routes/cache.js';
import { handleAdminRoutes } from './routes/admin.js';
import { handleExternalRoutes } from './routes/external.js';

// Export the Durable Object class for Cloudflare Workers runtime
export { ProgressWebSocketDO };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Custom domain routing: harvest.oooefam.net root → Dashboard
    if (url.hostname === 'harvest.oooefam.net' && url.pathname === '/') {
      return await handleHarvestDashboard(request, env);
    }

    // Handle OPTIONS preflight requests (CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    // Route to WebSocket module
    if (url.pathname.startsWith('/ws/')) {
      return handleWebSocketRoutes(request, url, env, ctx);
    }

    // Route to Jobs module (token refresh, job state)
    if (url.pathname.startsWith('/api/token/') || url.pathname.startsWith('/api/job-state/')) {
      return handleJobRoutes(request, url, env, ctx);
    }

    // Route to Enrichment module
    if (url.pathname.startsWith('/api/enrichment/')) {
      return handleEnrichmentRoutes(request, url, env, ctx);
    }

    // Route to AI module (scan, import, warming)
    if (url.pathname.startsWith('/api/scan-bookshelf') || 
        url.pathname.startsWith('/api/import/') ||
        url.pathname.startsWith('/api/warming/')) {
      return handleAIRoutes(request, url, env, ctx);
    }

    // Route to Search module (v1 and legacy)
    if (url.pathname.startsWith('/v1/search/') || url.pathname.startsWith('/search/')) {
      return handleSearchRoutes(request, url, env, ctx);
    }

    // Route to Cache module (metrics, image proxy)
    if (url.pathname.startsWith('/api/cache/') || 
        url.pathname.startsWith('/metrics') ||
        url.pathname.startsWith('/images/')) {
      return handleCacheRoutes(request, url, env, ctx);
    }

    // Route to Admin module (health, test endpoints, harvest)
    if (url.pathname.startsWith('/health') ||
        url.pathname.startsWith('/admin/') ||
        url.pathname.startsWith('/api/test-') ||
        url.pathname.startsWith('/api/harvest-') ||
        url.pathname.startsWith('/test/do/')) {
      return handleAdminRoutes(request, url, env, ctx);
    }

    // Route to External API module
    if (url.pathname.startsWith('/external/')) {
      return handleExternalRoutes(request, url, env, ctx);
    }

    // Default 404
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist. Use /health to see available endpoints.'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async queue(batch, env, ctx) {
    // Route queue messages to appropriate consumer
    if (batch.queue === 'author-warming-queue') {
      await processAuthorBatch(batch, env, ctx);
    } else {
      console.error(`Unknown queue: ${batch.queue}`);
    }
  },

  async scheduled(event, env, ctx) {
    // Route by cron pattern
    if (event.cron === '0 2 * * *') {
      // Daily archival at 2:00 AM UTC
      await handleScheduledArchival(env, ctx);
    } else if (event.cron === '*/15 * * * *') {
      // Alert checks every 15 minutes
      await handleScheduledAlerts(env, ctx);
    } else if (event.cron === '0 3 * * *') {
      // Daily ISBNdb cover harvest at 3:00 AM UTC
      await handleScheduledHarvest(env);
    }
  }
};
