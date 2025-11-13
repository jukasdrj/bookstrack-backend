/**
 * AI Routes
 * Handles AI bookshelf scanning, CSV import, and cache warming
 */

import { getCorsHeaders } from '../middleware/cors.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';
import { validateResourceSize } from '../middleware/size-validator.js';
import { handleBatchScan } from '../handlers/batch-scan-handler.ts';
import { handleCSVImport } from '../handlers/csv-import.ts';
import * as aiScanner from '../services/ai-scanner.js';

/**
 * Handle AI-related routes (scanning, import, warming)
 */
export async function handleAIRoutes(request, url, env, ctx) {
  // POST /api/scan-bookshelf/batch - Batch AI bookshelf scanner with WebSocket progress
  if (url.pathname === '/api/scan-bookshelf/batch' && request.method === 'POST') {
    // Rate limiting: Prevent denial-of-wallet attacks on AI batch endpoint
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    return handleBatchScan(request, env, ctx);
  }

  // POST /api/scan-bookshelf/cancel - Cancel batch processing
  if (url.pathname === '/api/scan-bookshelf/cancel' && request.method === 'POST') {
    try {
      const { jobId } = await request.json();

      if (!jobId) {
        return new Response(JSON.stringify({ error: 'jobId required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Call Durable Object to cancel batch
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);
      const result = await doStub.cancelBatch();

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Cancel batch error:', error);
      return new Response(JSON.stringify({ error: 'Failed to cancel batch' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /api/import/csv-gemini - Gemini-powered CSV import with WebSocket progress
  if (url.pathname === '/api/import/csv-gemini' && request.method === 'POST') {
    // Rate limiting: Prevent denial-of-wallet attacks on AI CSV import
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    // Size validation: Prevent memory crashes (10MB limit)
    const sizeCheck = validateResourceSize(request, 10, 'CSV file');
    if (sizeCheck) return sizeCheck;

    return handleCSVImport(request, env, ctx);
  }

  // POST /api/warming/upload - Cache warming via CSV upload
  if (url.pathname === '/api/warming/upload' && request.method === 'POST') {
    const { handleWarmingUpload } = await import('../handlers/warming-upload.js');
    return handleWarmingUpload(request, env, ctx);
  }

  // GET /api/warming/dlq - Monitor dead letter queue
  if (url.pathname === '/api/warming/dlq' && request.method === 'GET') {
    const { handleDLQMonitor } = await import('../handlers/dlq-monitor.js');
    return handleDLQMonitor(request, env);
  }

  // POST /api/scan-bookshelf - AI bookshelf scanner with WebSocket progress
  if (url.pathname === '/api/scan-bookshelf' && request.method === 'POST') {
    // Rate limiting: Prevent denial-of-wallet attacks on AI endpoint
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    // Size validation: Prevent memory crashes (5MB limit per photo)
    const sizeCheck = validateResourceSize(request, 5, 'image');
    if (sizeCheck) return sizeCheck;

    try {
      // Get or generate jobId
      const jobId = url.searchParams.get('jobId') || crypto.randomUUID();

      // DIAGNOSTIC: Log all incoming headers
      console.log(`[Diagnostic Layer 1: Main Router] === Incoming Request Headers for job ${jobId} ===`);
      const aiProviderHeader = request.headers.get('X-AI-Provider');
      console.log(`[Diagnostic Layer 1: Main Router] X-AI-Provider header: ${aiProviderHeader ? aiProviderHeader : 'NOT FOUND'}`);
      console.log(`[Diagnostic Layer 1: Main Router] All headers:`, Object.fromEntries(request.headers.entries()));

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

      // Get DO stub for this job
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      // SECURITY: Generate authentication token for WebSocket connection
      const authToken = crypto.randomUUID();
      await doStub.setAuthToken(authToken);

      console.log(`[API] Auth token generated for scan job ${jobId}`);

      // CRITICAL: Wait for WebSocket ready signal before processing
      // This prevents race condition where we send updates before client connects
      console.log(`[API] Waiting for WebSocket ready signal for job ${jobId}`);

      const readyResult = await doStub.waitForReady(5000); // 5 second timeout

      if (readyResult.timedOut || readyResult.disconnected) {
        const reason = readyResult.timedOut ? 'timeout' : 'WebSocket not connected';
        console.warn(`[API] WebSocket ready ${reason} for job ${jobId}, proceeding anyway (client may miss early updates)`);

        // NEW: Log analytics event
        console.log(`[Analytics] websocket_ready_timeout - job_id: ${jobId}, reason: ${reason}, client_ip: ${request.headers.get('CF-Connecting-IP')}`);

        // Continue processing - client might be using polling fallback
      } else {
        console.log(`[API] ✅ WebSocket ready for job ${jobId}, starting processing`);
      }

      // Start AI scan in background (NOW guaranteed WebSocket is listening)
      ctx.waitUntil(aiScanner.processBookshelfScan(jobId, imageData, request, env, doStub, ctx));

      // Define stages metadata for iOS client (used for progress estimation)
      const stages = [
        { name: "Image Quality Analysis", typicalDuration: 3, progress: 0.1 },
        { name: "AI Processing", typicalDuration: 25, progress: 0.5 },
        { name: "Metadata Enrichment", typicalDuration: 12, progress: 1.0 }
      ];

      // Calculate estimated range based on total stage durations
      const totalDuration = stages.reduce((sum, stage) => sum + stage.typicalDuration, 0);
      const estimatedRange = [Math.floor(totalDuration * 0.8), Math.ceil(totalDuration * 1.2)];

      // Return 202 Accepted immediately with stages metadata and auth token
      return new Response(JSON.stringify({
        jobId,
        token: authToken, // NEW: Token for WebSocket authentication
        status: 'started',
        websocketReady: readyResult.success, // NEW: Indicates if WebSocket is ready
        message: 'AI scan started. Connect to /ws/progress?jobId=' + jobId + ' for real-time updates.',
        stages,
        estimatedRange
      }), {
        status: 202,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
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

  return new Response('Not found', { status: 404 });
}
