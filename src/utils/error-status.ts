/**
 * Error Status Mapping Utilities
 *
 * Centralized mapping of API error codes to HTTP status codes.
 * Ensures consistent error responses across all endpoints.
 *
 * Related: GitHub Issue #398
 */

import type { ApiErrorCode } from '../types/enums.js';
import type { ErrorResponse } from '../types/responses.js';

/**
 * Type-safe HTTP status codes
 * Union of literal types enforces compile-time safety
 */
export type HttpStatus = 400 | 401 | 404 | 413 | 500 | 502 | 503;

/**
 * Centralized error code to HTTP status mapping
 *
 * Mapping rationale:
 * - 400 (Bad Request): Client input errors - INVALID_*, MISSING_*, BATCH_TOO_LARGE, etc.
 * - 401 (Unauthorized): Authentication errors - UNAUTHORIZED, INVALID_TOKEN, TOKEN_EXPIRED
 * - 404 (Not Found): Resource doesn't exist - NOT_FOUND, JOB_NOT_FOUND
 * - 413 (Payload Too Large): File/content size errors - FILE_TOO_LARGE
 * - 500 (Internal Server Error): Unexpected server failures - INTERNAL_ERROR, *_FAILED
 * - PROVIDER_ERROR: Handled by providerErrorStatus() for nuanced cases (502/503)
 */
const ERROR_STATUS_MAP = {
  // Authentication & Authorization (401)
  UNAUTHORIZED: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  
  // Request Validation (400)
  INVALID_REQUEST: 400,
  INVALID_ISBN: 400,
  INVALID_QUERY: 400,
  INVALID_PARAMETER: 400,
  MISSING_PARAMETER: 400,
  INVALID_FILE_TYPE: 400,
  INVALID_CONTENT: 400,
  BATCH_TOO_LARGE: 400,
  EMPTY_BATCH: 400,
  
  // File Size (413)
  FILE_TOO_LARGE: 413,
  
  // Resources (404)
  NOT_FOUND: 404,
  JOB_NOT_FOUND: 404,
  
  // Rate Limiting (503) - Temporary service unavailability
  RATE_LIMIT_EXCEEDED: 503,
  
  // Provider Issues (503) - Temporary service unavailability  
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_TIMEOUT: 503,
  
  // Processing Errors (500)
  PROCESSING_FAILED: 500,
  ENRICHMENT_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const satisfies Record<Exclude<ApiErrorCode, 'PROVIDER_ERROR'>, HttpStatus>;

/**
 * Determine HTTP status for provider errors with nuanced logic
 *
 * @param error - Error response object
 * @returns 503 for timeout/unavailable/rate-limit, 502 for upstream errors
 */
function providerErrorStatus(error: ErrorResponse): HttpStatus {
  const message = error.error.message.toLowerCase();

  // Convert details to string (handles objects, primitives, etc.)
  let detailsStr = '';
  if (error.error.details) {
    detailsStr = typeof error.error.details === 'object'
      ? JSON.stringify(error.error.details).toLowerCase()
      : String(error.error.details).toLowerCase();
  }

  // 503 Service Unavailable: Temporary conditions
  if (
    message.includes('timeout') ||
    message.includes('unavailable') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    detailsStr.includes('timeout') ||
    detailsStr.includes('rate limit')
  ) {
    return 503;
  }

  // 502 Bad Gateway: Upstream responded but with error
  return 502;
}

/**
 * Map error response to appropriate HTTP status code
 *
 * Priority:
 * 1. Explicit status field on error (if present)
 * 2. Error code mapping (ERROR_STATUS_MAP)
 * 3. Provider error logic (for PROVIDER_ERROR)
 * 4. Default 500 (unknown errors)
 *
 * @param error - Error response or unknown error object
 * @returns HTTP status code
 */
export function statusFromError(error: ErrorResponse | unknown): HttpStatus {
  // Type guard: ensure we have an ErrorResponse
  if (!error || typeof error !== 'object' || !('error' in error)) {
    return 500; // Unknown error format
  }

  const errorResponse = error as ErrorResponse;

  // 1. Explicit status (if already set)
  if (errorResponse.status) {
    return errorResponse.status;
  }

  // 2. Map via error code
  const errorCode = errorResponse.error.code;
  if (!errorCode) {
    return 500; // No error code = internal error
  }

  // 3. Provider error (nuanced logic)
  if (errorCode === 'PROVIDER_ERROR') {
    return providerErrorStatus(errorResponse);
  }

  // 4. Standard mapping
  const mappedStatus = ERROR_STATUS_MAP[errorCode as keyof typeof ERROR_STATUS_MAP];
  return mappedStatus ?? 500; // Default to 500 for unmapped codes
}
