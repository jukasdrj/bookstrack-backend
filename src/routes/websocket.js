/**
 * WebSocket Progress Routes
 * Handles WebSocket connections for real-time job progress updates
 */

/**
 * Route WebSocket connections to the Durable Object
 */
export async function handleWebSocketRoutes(request, url, env, ctx) {
  // GET /ws/progress?jobId={id} - WebSocket progress updates
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

  return new Response('Not found', { status: 404 });
}
