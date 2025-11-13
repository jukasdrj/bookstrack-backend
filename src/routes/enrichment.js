/**
 * Enrichment Routes
 * Handles batch enrichment, deprecated enrichment start, and enrichment cancellation
 */

import { getCorsHeaders } from '../middleware/cors.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';
import { handleBatchEnrichment } from '../handlers/batch-enrichment.ts';

/**
 * Handle enrichment-related routes
 */
export async function handleEnrichmentRoutes(request, url, env, ctx) {
  // POST /api/enrichment/start - DEPRECATED: Redirect to /api/enrichment/batch
  // This endpoint used old workIds format. iOS should migrate to /api/enrichment/batch with books array.
  // For backward compatibility, we convert workIds to books format (assuming workId = title for now)
  if (url.pathname === '/api/enrichment/start' && request.method === 'POST') {
    console.warn('[DEPRECATED] /api/enrichment/start called. iOS should migrate to /api/enrichment/batch');

    // Rate limiting: Prevent denial-of-wallet attacks
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

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

      // Convert workIds to books format (workId is treated as title for backward compat)
      // TODO: iOS should send actual book data via /api/enrichment/batch instead
      const books = workIds.map(id => ({ title: String(id) }));

      // Redirect to new batch enrichment handler
      const modifiedRequest = new Request(request, {
        body: JSON.stringify({ books, jobId })
      });

      return handleBatchEnrichment(modifiedRequest, env, ctx);

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

  // POST /api/enrichment/cancel - Cancel an in-flight enrichment job
  if (url.pathname === '/api/enrichment/cancel' && request.method === 'POST') {
    try {
      const { jobId } = await request.json();

      // Validate request
      if (!jobId) {
        return new Response(JSON.stringify({
          error: 'Invalid request: jobId required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get DO stub for this job
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      // Call cancelJob() on the Durable Object
      const result = await doStub.cancelJob("Canceled by iOS client during library reset");

      // Return success response
      return new Response(JSON.stringify({
        jobId,
        status: 'canceled',
        message: 'Enrichment job canceled successfully'
      }), {
        status: 200,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.error('Failed to cancel enrichment:', error);
      return new Response(JSON.stringify({
        error: 'Failed to cancel enrichment',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /api/enrichment/batch - Batch enrichment endpoint
  if (url.pathname === '/api/enrichment/batch' && request.method === 'POST') {
    // Rate limiting: Prevent denial-of-wallet attacks
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    return handleBatchEnrichment(request, env, ctx);
  }

  return new Response('Not found', { status: 404 });
}
