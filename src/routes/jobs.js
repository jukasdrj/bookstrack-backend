/**
 * Job Management Routes
 * Handles token refresh, job state retrieval, and job cancellation
 */

import { getCorsHeaders } from '../middleware/cors.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';

/**
 * Handle job-related routes
 */
export async function handleJobRoutes(request, url, env, ctx) {
  // POST /api/token/refresh - Refresh authentication token for long-running jobs
  if (url.pathname === '/api/token/refresh' && request.method === 'POST') {
    // Rate limiting: Prevent abuse of token refresh endpoint
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { jobId, oldToken } = await request.json();

      if (!jobId || !oldToken) {
        return new Response(JSON.stringify({
          error: 'Invalid request: jobId and oldToken required'
        }), {
          status: 400,
          headers: {
            ...getCorsHeaders(request),
            'Content-Type': 'application/json'
          }
        });
      }

      // Get DO stub for this job
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      // Refresh token via Durable Object
      const result = await doStub.refreshAuthToken(oldToken);

      if (result.error) {
        return new Response(JSON.stringify({
          error: result.error
        }), {
          status: 401,
          headers: {
            ...getCorsHeaders(request),
            'Content-Type': 'application/json'
          }
        });
      }

      // Return new token
      return new Response(JSON.stringify({
        jobId,
        token: result.token,
        expiresIn: result.expiresIn
      }), {
        status: 200,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.error('Failed to refresh token:', error);
      return new Response(JSON.stringify({
        error: 'Failed to refresh token',
        message: error.message
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });
    }
  }

  // GET /api/job-state/:jobId - Get current job state for reconnection sync
  if (url.pathname.startsWith('/api/job-state/') && request.method === 'GET') {
    try {
      const jobId = url.pathname.split('/').pop();

      if (!jobId) {
        return new Response(JSON.stringify({
          error: 'Invalid request: jobId required'
        }), {
          status: 400,
          headers: {
            ...getCorsHeaders(request),
            'Content-Type': 'application/json'
          }
        });
      }

      // Validate Bearer token (REQUIRED for auth)
      const authHeader = request.headers.get('Authorization');
      const providedToken = authHeader?.replace('Bearer ', '');
      if (!providedToken) {
        return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
          status: 401,
          headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        });
      }

      // Get DO stub for this job
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

      // Fetch job state and auth details (includes validation)
      const result = await doStub.getJobStateAndAuth();

      if (!result) {
        return new Response(JSON.stringify({
          error: 'Job not found or state not initialized'
        }), {
          status: 404,
          headers: {
            ...getCorsHeaders(request),
            'Content-Type': 'application/json'
          }
        });
      }

      const { jobState, authToken, authTokenExpiration } = result;

      // Validate token
      if (!authToken || providedToken !== authToken || Date.now() > authTokenExpiration) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        });
      }

      // Return job state
      return new Response(JSON.stringify(jobState), {
        status: 200,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.error('Failed to get job state:', error);
      return new Response(JSON.stringify({
        error: 'Failed to get job state',
        message: error.message
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });
    }
  }

  return new Response('Not found', { status: 404 });
}
