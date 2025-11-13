/**
 * Admin and Test Routes
 * Handles health checks, harvest dashboard, and test endpoints
 */

import { getCorsHeaders } from '../middleware/cors.js';
import { handleHarvestDashboard } from '../handlers/harvest-dashboard.js';
import { handleTestMultiEdition } from '../handlers/test-multi-edition.js';
import { handleScheduledHarvest } from '../handlers/scheduled-harvest.js';

/**
 * Handle admin and test routes
 */
export async function handleAdminRoutes(request, url, env, ctx) {
  // Health check endpoint
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      worker: 'api-worker',
      version: '1.0.0',
      endpoints: [
        'GET /search/title?q={query}&maxResults={n} - Title search with caching (6h TTL)',
        'GET /search/isbn?isbn={isbn}&maxResults={n} - ISBN search with caching (7 day TTL)',
        'GET /search/author?q={author}&limit={n}&offset={n}&sortBy={sort} - Author bibliography (6h TTL)',
        'GET /search/advanced?title={title}&author={author} - Advanced search (primary method, 6h cache)',
        'POST /search/advanced - Advanced search (legacy support, JSON body)',
        'POST /api/enrichment/start - Start batch enrichment job',
        'POST /api/enrichment/cancel - Cancel in-flight enrichment job (body: {jobId})',
        'POST /api/scan-bookshelf?jobId={id} - AI bookshelf scanner (upload image with Content-Type: image/*)',
        'POST /api/scan-bookshelf/batch - Batch AI scanner (body: {jobId, images: [{index, data}]})',
        'GET /ws/progress?jobId={id} - WebSocket progress updates',
        '/external/google-books?q={query}&maxResults={n}',
        '/external/google-books-isbn?isbn={isbn}',
        '/external/openlibrary?q={query}&maxResults={n}',
        '/external/openlibrary-author?author={name}',
        '/external/isbndb?title={title}&author={author}',
        '/external/isbndb-editions?title={title}&author={author}',
        '/external/isbndb-isbn?isbn={isbn}'
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Harvest Dashboard (public, no auth required)
  if (url.pathname === '/admin/harvest-dashboard' && request.method === 'GET') {
    return await handleHarvestDashboard(request, env);
  }

  // Test multi-edition discovery (no auth required)
  if (url.pathname === '/api/test-multi-edition' && request.method === 'GET') {
    return await handleTestMultiEdition(request, env);
  }

  // Manual ISBNdb harvest trigger (for testing, requires secret header)
  if (url.pathname === '/api/harvest-covers' && request.method === 'POST') {
    // Security: Require secret header to prevent unauthorized harvests
    const authHeader = request.headers.get('X-Harvest-Secret');
    if (authHeader !== env.HARVEST_SECRET && authHeader !== 'test-local-dev') {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid or missing X-Harvest-Secret header'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🌾 Manual ISBNdb harvest triggered');
    const result = await handleScheduledHarvest(env);

    return new Response(JSON.stringify({
      success: result.success,
      stats: result.stats,
      message: result.success ? 'Harvest completed successfully' : 'Harvest failed',
      error: result.error
    }), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========================================================================
  // Test Endpoints for Durable Object Batch State Management
  // ========================================================================

  // POST /test/do/init-batch - Initialize batch job in Durable Object
  if (url.pathname === '/test/do/init-batch' && request.method === 'POST') {
    try {
      const { jobId, totalPhotos, status } = await request.json();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      const result = await doStub.initBatch({ jobId, totalPhotos, status });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Test init-batch failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /test/do/get-state - Get batch state from Durable Object
  if (url.pathname === '/test/do/get-state' && request.method === 'GET') {
    try {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) {
        return new Response(JSON.stringify({ error: 'Missing jobId parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      const state = await doStub.getState();

      if (!state || Object.keys(state).length === 0) {
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(state), {
        status: 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Test get-state failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /test/do/update-photo - Update photo status in Durable Object
  if (url.pathname === '/test/do/update-photo' && request.method === 'POST') {
    try {
      const { jobId, photoIndex, status, booksFound, error: photoError } = await request.json();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      const result = await doStub.updatePhoto({ photoIndex, status, booksFound, error: photoError });

      return new Response(JSON.stringify(result), {
        status: result.error ? 404 : 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Test update-photo failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /test/do/complete-batch - Complete batch in Durable Object
  if (url.pathname === '/test/do/complete-batch' && request.method === 'POST') {
    try {
      const { jobId, status, totalBooks, photoResults, books } = await request.json();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      const result = await doStub.completeBatch({ status, totalBooks, photoResults, books });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Test complete-batch failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /test/do/is-canceled - Check if batch is canceled
  if (url.pathname === '/test/do/is-canceled' && request.method === 'GET') {
    try {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) {
        return new Response(JSON.stringify({ error: 'Missing jobId parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      const result = await doStub.isBatchCanceled();

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Test is-canceled failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /test/do/cancel-batch - Cancel batch in Durable Object
  if (url.pathname === '/test/do/cancel-batch' && request.method === 'POST') {
    try {
      const { jobId } = await request.json();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      const result = await doStub.cancelBatch();

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Test cancel-batch failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not found', { status: 404 });
}
