/**
 * Standardized Error Response Builders
 * 
 * Central utility for creating consistent error responses across all API endpoints.
 * All errors follow the standard format:
 * {
 *   success: false,
 *   error: {
 *     code: 'ERROR_CODE',
 *     message: 'Human readable message',
 *     details: { optional context }
 *   },
 *   meta: {
 *     timestamp: 'ISO 8601 string'
 *   }
 * }
 * 
 * Related: GitHub Issue - Standardize Error Response Format
 */

import type { ApiErrorCode } from '../types/enums.js';
import type { ErrorResponse } from '../types/responses.js';
import { createErrorResponseObject } from '../types/responses.js';
import { statusFromError } from './error-status.js';

/**
 * Create a standardized error Response with proper HTTP status
 * 
 * This is the primary function to use when returning errors from handlers.
 * Automatically determines the correct HTTP status code based on error code.
 * 
 * @param message - Human-readable error message
 * @param code - Standard error code from ApiErrorCode enum
 * @param details - Optional additional context (object, string, or any serializable value)
 * @param headers - Optional additional headers (CORS headers will be merged in handlers)
 * @returns Response object with standardized error format and appropriate HTTP status
 * 
 * @example
 * // Basic error
 * return createStandardErrorResponse(
 *   'Invalid ISBN format',
 *   'INVALID_ISBN',
 *   { provided: isbn }
 * );
 * 
 * @example
 * // Authentication error
 * return createStandardErrorResponse(
 *   'Missing authorization token',
 *   'UNAUTHORIZED'
 * );
 * 
 * @example
 * // With custom headers
 * return createStandardErrorResponse(
 *   'File too large',
 *   'FILE_TOO_LARGE',
 *   { size: fileSize, maxSize: MAX_SIZE },
 *   { 'X-Max-File-Size': String(MAX_SIZE) }
 * );
 */
export function createStandardErrorResponse(
  message: string,
  code: ApiErrorCode,
  details?: any,
  headers: Record<string, string> = {}
): Response {
  const errorObj = createErrorResponseObject(message, code, details);
  const status = statusFromError(errorObj);
  
  return new Response(JSON.stringify(errorObj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Create a standardized error Response with explicit HTTP status
 * 
 * Use this when you need to override the default status mapping,
 * or when the error doesn't fit standard patterns.
 * 
 * @param message - Human-readable error message
 * @param status - Explicit HTTP status code
 * @param code - Optional error code from ApiErrorCode enum
 * @param details - Optional additional context
 * @param headers - Optional additional headers
 * @returns Response object with standardized error format
 * 
 * @example
 * return createErrorResponseWithStatus(
 *   'Custom error scenario',
 *   418, // I'm a teapot
 *   'INTERNAL_ERROR',
 *   { reason: 'Coffee not available' }
 * );
 */
export function createErrorResponseWithStatus(
  message: string,
  status: number,
  code?: ApiErrorCode,
  details?: any,
  headers: Record<string, string> = {}
): Response {
  const errorObj = createErrorResponseObject(message, code, details);
  
  return new Response(JSON.stringify(errorObj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Common error response builders for frequent scenarios
 * These provide shortcuts for the most common error cases
 */

export const ErrorResponses = {
  /**
   * 400 Bad Request - Invalid or missing request parameters
   */
  invalidRequest(message: string, details?: any): Response {
    return createStandardErrorResponse(message, 'INVALID_REQUEST', details);
  },
  
  /**
   * 400 Bad Request - Missing required parameter
   */
  missingParameter(paramName: string, details?: any): Response {
    return createStandardErrorResponse(
      `Missing required parameter: ${paramName}`,
      'MISSING_PARAMETER',
      { parameter: paramName, ...details }
    );
  },
  
  /**
   * 400 Bad Request - Invalid parameter value
   */
  invalidParameter(paramName: string, reason: string, details?: any): Response {
    return createStandardErrorResponse(
      `Invalid parameter '${paramName}': ${reason}`,
      'INVALID_PARAMETER',
      { parameter: paramName, reason, ...details }
    );
  },
  
  /**
   * 401 Unauthorized - Missing or invalid authentication
   */
  unauthorized(message: string = 'Unauthorized', details?: any): Response {
    return createStandardErrorResponse(message, 'UNAUTHORIZED', details);
  },
  
  /**
   * 401 Unauthorized - Invalid or expired token
   */
  invalidToken(message: string = 'Invalid or expired token', details?: any): Response {
    return createStandardErrorResponse(message, 'INVALID_TOKEN', details);
  },
  
  /**
   * 404 Not Found - Resource not found
   */
  notFound(resource: string = 'Resource', details?: any): Response {
    return createStandardErrorResponse(
      `${resource} not found`,
      'NOT_FOUND',
      details
    );
  },
  
  /**
   * 404 Not Found - Job not found
   */
  jobNotFound(jobId?: string): Response {
    return createStandardErrorResponse(
      'Job not found or state not initialized',
      'JOB_NOT_FOUND',
      jobId ? { jobId } : undefined
    );
  },
  
  /**
   * 413 Payload Too Large - File size exceeds limit
   */
  fileTooLarge(maxSize: number, actualSize?: number): Response {
    return createStandardErrorResponse(
      `File too large (max ${maxSize}MB)`,
      'FILE_TOO_LARGE',
      { maxSize, actualSize }
    );
  },
  
  /**
   * 400 Bad Request - Batch size exceeds limit
   */
  batchTooLarge(maxSize: number, actualSize?: number): Response {
    return createStandardErrorResponse(
      `Batch size exceeds maximum of ${maxSize}`,
      'BATCH_TOO_LARGE',
      { maxSize, actualSize }
    );
  },
  
  /**
   * 400 Bad Request - Empty batch/array
   */
  emptyBatch(fieldName: string = 'array'): Response {
    return createStandardErrorResponse(
      `${fieldName} cannot be empty`,
      'EMPTY_BATCH',
      { field: fieldName }
    );
  },
  
  /**
   * 503 Service Unavailable - Rate limit exceeded
   */
  rateLimitExceeded(retryAfter?: number): Response {
    const headers = retryAfter ? { 'Retry-After': String(retryAfter) } : {};
    return createStandardErrorResponse(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      retryAfter ? { retryAfter } : undefined,
      headers
    );
  },
  
  /**
   * 500 Internal Server Error - Processing failed
   */
  processingFailed(operation: string, error?: Error): Response {
    return createStandardErrorResponse(
      `Failed to ${operation}`,
      'PROCESSING_FAILED',
      error ? { message: error.message } : undefined
    );
  },
  
  /**
   * 500 Internal Server Error - Generic internal error
   */
  internalError(message: string = 'Internal server error', error?: Error): Response {
    return createStandardErrorResponse(
      message,
      'INTERNAL_ERROR',
      error ? { message: error.message } : undefined
    );
  }
};
