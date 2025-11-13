/**
 * Durable Object Helper Functions
 *
 * Utilities for accessing and managing Durable Objects.
 * Centralizes the pattern of getting DO stubs from jobIds.
 */

/**
 * Get a stub for the Progress WebSocket Durable Object
 * Handles ID generation and stub retrieval
 * @param jobId - Unique job identifier
 * @param env - Worker environment bindings
 * @returns Durable Object stub for the given jobId
 */
export function getProgressDOStub(jobId: string, env: any) {
  const id = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
  return env.PROGRESS_WEBSOCKET_DO.get(id);
}
