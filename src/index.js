import { ProgressWebSocketDO } from './durable-objects/progress-socket.js';
import * as externalApis from './services/external-apis.js';
import * as enrichment from './services/enrichment.js';
import * as aiScanner from './services/ai-scanner.js';

// Export the Durable Object class for Cloudflare Workers runtime
export { ProgressWebSocketDO };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route WebSocket connections to the Durable Object
    if (url.pathname === '/ws/progress') {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) {
        return new Response('Missing jobId parameter', { status: 400 });
      }

      // Get Durable Object instance for this specific jobId
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      // Forward the request to the Durable Object
      return doStub.fetch(request);
    }

    // ========================================================================
    // Enrichment API Endpoint
    // ========================================================================

    // POST /api/enrichment/start - Start batch enrichment with WebSocket progress
    if (url.pathname === '/api/enrichment/start' && request.method === 'POST') {
      try {
        const { jobId, workIds } = await request.json();

        // Validate request
        if (!jobId || !workIds || !Array.isArray(workIds)) {
          return new Response(JSON.stringify({
            error: 'Invalid request: jobId and workIds (array) required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (workIds.length === 0) {
          return new Response(JSON.stringify({
            error: 'Invalid request: workIds array cannot be empty'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get DO stub for this job
        const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
        const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

        // Start enrichment in background (direct function call, NO RPC!)
        ctx.waitUntil(enrichment.enrichBatch(jobId, workIds, env, doStub));

        // Return 202 Accepted immediately
        return new Response(JSON.stringify({
          jobId,
          status: 'started',
          totalBooks: workIds.length,
          message: 'Enrichment job started. Connect to /ws/progress?jobId=' + jobId + ' for real-time updates.'
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Failed to start enrichment:', error);
        return new Response(JSON.stringify({
          error: 'Failed to start enrichment',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ========================================================================
    // AI Scanner Endpoint
    // ========================================================================

    // POST /api/scan-bookshelf - AI bookshelf scanner with WebSocket progress
    if (url.pathname === '/api/scan-bookshelf' && request.method === 'POST') {
      try {
        // Get or generate jobId
        const jobId = url.searchParams.get('jobId') || crypto.randomUUID();

        // Validate content type
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          return new Response(JSON.stringify({
            error: 'Invalid content type: image/* required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Read image data
        const imageData = await request.arrayBuffer();

        // Validate size (default 10MB max)
        const maxSize = parseInt(env.MAX_SCAN_FILE_SIZE || '10485760');
        if (imageData.byteLength > maxSize) {
          return new Response(JSON.stringify({
            error: 'Image too large',
            maxSize: maxSize,
            receivedSize: imageData.byteLength
          }), {
            status: 413,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get DO stub for this job
        const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
        const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

        // Start AI scan in background (direct function call, NO RPC!)
        ctx.waitUntil(aiScanner.processBookshelfScan(jobId, imageData, env, doStub));

        // Return 202 Accepted immediately
        return new Response(JSON.stringify({
          jobId,
          status: 'started',
          message: 'AI scan started. Connect to /ws/progress?jobId=' + jobId + ' for real-time updates.'
        }), {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // CORS for iOS app
          }
        });

      } catch (error) {
        console.error('Failed to start AI scan:', error);
        return new Response(JSON.stringify({
          error: 'Failed to start AI scan',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ========================================================================
    // External API Routes (backward compatibility - temporary during migration)
    // ========================================================================

    // Google Books search
    if (url.pathname === '/external/google-books') {
      const query = url.searchParams.get('q');
      if (!query) {
        return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const maxResults = parseInt(url.searchParams.get('maxResults') || '20');
      const result = await externalApis.searchGoogleBooks(query, { maxResults }, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Google Books ISBN search
    if (url.pathname === '/external/google-books-isbn') {
      const isbn = url.searchParams.get('isbn');
      if (!isbn) {
        return new Response(JSON.stringify({ error: 'Missing isbn parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await externalApis.searchGoogleBooksByISBN(isbn, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // OpenLibrary search
    if (url.pathname === '/external/openlibrary') {
      const query = url.searchParams.get('q');
      if (!query) {
        return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const maxResults = parseInt(url.searchParams.get('maxResults') || '20');
      const result = await externalApis.searchOpenLibrary(query, { maxResults }, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // OpenLibrary author works
    if (url.pathname === '/external/openlibrary-author') {
      const author = url.searchParams.get('author');
      if (!author) {
        return new Response(JSON.stringify({ error: 'Missing author parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await externalApis.getOpenLibraryAuthorWorks(author, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ISBNdb search
    if (url.pathname === '/external/isbndb') {
      const title = url.searchParams.get('title');
      if (!title) {
        return new Response(JSON.stringify({ error: 'Missing title parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const author = url.searchParams.get('author') || '';
      const result = await externalApis.searchISBNdb(title, author, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ISBNdb editions for work
    if (url.pathname === '/external/isbndb-editions') {
      const title = url.searchParams.get('title');
      const author = url.searchParams.get('author');

      if (!title || !author) {
        return new Response(JSON.stringify({ error: 'Missing title or author parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await externalApis.getISBNdbEditionsForWork(title, author, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ISBNdb book by ISBN
    if (url.pathname === '/external/isbndb-isbn') {
      const isbn = url.searchParams.get('isbn');
      if (!isbn) {
        return new Response(JSON.stringify({ error: 'Missing isbn parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await externalApis.getISBNdbBookByISBN(isbn, env);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'api-worker',
        version: '1.0.0',
        endpoints: [
          'POST /api/enrichment/start - Start batch enrichment job',
          'POST /api/scan-bookshelf?jobId={id} - AI bookshelf scanner (upload image with Content-Type: image/*)',
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

    // Default 404
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist. Use /health to see available endpoints.'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
