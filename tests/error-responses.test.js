/**
 * Tests for Standardized Error Response Format
 * 
 * Validates that all error responses follow the standard format:
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
 */

import { describe, it, expect } from 'vitest';
import { createStandardErrorResponse, ErrorResponses } from '../src/utils/error-responses.ts';

describe('Standard Error Response Format', () => {
  describe('createStandardErrorResponse', () => {
    it('should create error response with required fields', async () => {
      const response = createStandardErrorResponse(
        'Test error message',
        'INVALID_REQUEST'
      );
      
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Test error message'
        },
        meta: {
          timestamp: expect.any(String)
        }
      });
    });

    it('should include details when provided', async () => {
      const response = createStandardErrorResponse(
        'Invalid ISBN format',
        'INVALID_ISBN',
        { provided: '12345' }
      );
      
      const body = await response.json();
      expect(body.error.details).toEqual({ provided: '12345' });
    });

    it('should set correct HTTP status based on error code', async () => {
      const testCases = [
        { code: 'UNAUTHORIZED', expectedStatus: 401 },
        { code: 'INVALID_REQUEST', expectedStatus: 400 },
        { code: 'NOT_FOUND', expectedStatus: 404 },
        { code: 'FILE_TOO_LARGE', expectedStatus: 413 },
        { code: 'INTERNAL_ERROR', expectedStatus: 500 },
        { code: 'RATE_LIMIT_EXCEEDED', expectedStatus: 503 },
      ];

      for (const { code, expectedStatus } of testCases) {
        const response = createStandardErrorResponse('Test', code);
        expect(response.status).toBe(expectedStatus);
      }
    });

    it('should include timestamp in ISO 8601 format', async () => {
      const response = createStandardErrorResponse(
        'Test error',
        'INTERNAL_ERROR'
      );
      
      const body = await response.json();
      const timestamp = body.meta.timestamp;
      
      // Validate ISO 8601 format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Validate it's a valid date
      const date = new Date(timestamp);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    it('should allow custom headers', async () => {
      const response = createStandardErrorResponse(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        undefined,
        { 'Retry-After': '60' }
      );
      
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('ErrorResponses helper shortcuts', () => {
    it('invalidRequest should create 400 error', async () => {
      const response = ErrorResponses.invalidRequest('Bad request');
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_REQUEST');
      expect(body.error.message).toBe('Bad request');
    });

    it('missingParameter should create 400 error with parameter name', async () => {
      const response = ErrorResponses.missingParameter('jobId');
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error.code).toBe('MISSING_PARAMETER');
      expect(body.error.message).toContain('jobId');
      expect(body.error.details.parameter).toBe('jobId');
    });

    it('invalidParameter should create 400 error with details', async () => {
      const response = ErrorResponses.invalidParameter(
        'limit',
        'must be between 1 and 100',
        { value: 150, min: 1, max: 100 }
      );
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_PARAMETER');
      expect(body.error.message).toContain('limit');
      expect(body.error.message).toContain('must be between 1 and 100');
      expect(body.error.details.parameter).toBe('limit');
      expect(body.error.details.value).toBe(150);
    });

    it('unauthorized should create 401 error', async () => {
      const response = ErrorResponses.unauthorized();
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Unauthorized');
    });

    it('invalidToken should create 401 error', async () => {
      const response = ErrorResponses.invalidToken();
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('notFound should create 404 error', async () => {
      const response = ErrorResponses.notFound('Book');
      expect(response.status).toBe(404);
      
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Book');
    });

    it('jobNotFound should create 404 error with jobId', async () => {
      const response = ErrorResponses.jobNotFound('test-job-123');
      expect(response.status).toBe(404);
      
      const body = await response.json();
      expect(body.error.code).toBe('JOB_NOT_FOUND');
      expect(body.error.details.jobId).toBe('test-job-123');
    });

    it('fileTooLarge should create 413 error', async () => {
      const response = ErrorResponses.fileTooLarge(10, 15);
      expect(response.status).toBe(413);
      
      const body = await response.json();
      expect(body.error.code).toBe('FILE_TOO_LARGE');
      expect(body.error.details.maxSize).toBe(10);
      expect(body.error.details.actualSize).toBe(15);
    });

    it('batchTooLarge should create 400 error', async () => {
      const response = ErrorResponses.batchTooLarge(50, 75);
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error.code).toBe('BATCH_TOO_LARGE');
      expect(body.error.details.maxSize).toBe(50);
      expect(body.error.details.actualSize).toBe(75);
    });

    it('emptyBatch should create 400 error', async () => {
      const response = ErrorResponses.emptyBatch('items');
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error.code).toBe('EMPTY_BATCH');
      expect(body.error.message).toContain('items');
    });

    it('rateLimitExceeded should create 503 error with Retry-After header', async () => {
      const response = ErrorResponses.rateLimitExceeded(60);
      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('60');
      
      const body = await response.json();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.details.retryAfter).toBe(60);
    });

    it('processingFailed should create 500 error', async () => {
      const error = new Error('Something went wrong');
      const response = ErrorResponses.processingFailed('process data', error);
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body.error.code).toBe('PROCESSING_FAILED');
      expect(body.error.message).toContain('process data');
      expect(body.error.details.message).toBe('Something went wrong');
    });

    it('internalError should create 500 error', async () => {
      const response = ErrorResponses.internalError();
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Internal server error');
    });
  });

  describe('Error format validation', () => {
    it('should always have success: false', async () => {
      const response = createStandardErrorResponse('Test', 'INTERNAL_ERROR');
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.success).not.toBeUndefined();
    });

    it('should always have error.code', async () => {
      const response = createStandardErrorResponse('Test', 'NOT_FOUND');
      const body = await response.json();
      
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
    });

    it('should always have error.message', async () => {
      const response = createStandardErrorResponse('Test message', 'INTERNAL_ERROR');
      const body = await response.json();
      
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe('string');
      expect(body.error.message).toBe('Test message');
    });

    it('should have error.details as optional', async () => {
      const withoutDetails = createStandardErrorResponse('Test', 'INTERNAL_ERROR');
      const withDetails = createStandardErrorResponse('Test', 'INTERNAL_ERROR', { foo: 'bar' });
      
      const bodyWithout = await withoutDetails.json();
      const bodyWith = await withDetails.json();
      
      expect(bodyWithout.error.details).toBeUndefined();
      expect(bodyWith.error.details).toEqual({ foo: 'bar' });
    });

    it('should always have meta.timestamp', async () => {
      const response = createStandardErrorResponse('Test', 'INTERNAL_ERROR');
      const body = await response.json();
      
      expect(body.meta.timestamp).toBeDefined();
      expect(typeof body.meta.timestamp).toBe('string');
    });
  });

  describe('HTTP Status Code Mappings', () => {
    const mappings = [
      // Authentication (401)
      ['UNAUTHORIZED', 401],
      ['INVALID_TOKEN', 401],
      ['TOKEN_EXPIRED', 401],
      
      // Validation (400)
      ['INVALID_REQUEST', 400],
      ['INVALID_ISBN', 400],
      ['INVALID_QUERY', 400],
      ['INVALID_PARAMETER', 400],
      ['MISSING_PARAMETER', 400],
      ['INVALID_FILE_TYPE', 400],
      ['INVALID_CONTENT', 400],
      ['BATCH_TOO_LARGE', 400],
      ['EMPTY_BATCH', 400],
      
      // File Size (413)
      ['FILE_TOO_LARGE', 413],
      
      // Not Found (404)
      ['NOT_FOUND', 404],
      ['JOB_NOT_FOUND', 404],
      
      // Service Unavailable (503)
      ['RATE_LIMIT_EXCEEDED', 503],
      ['PROVIDER_UNAVAILABLE', 503],
      ['PROVIDER_TIMEOUT', 503],
      
      // Internal Server Error (500)
      ['PROCESSING_FAILED', 500],
      ['ENRICHMENT_FAILED', 500],
      ['INTERNAL_ERROR', 500],
    ];

    mappings.forEach(([code, expectedStatus]) => {
      it(`should map ${code} to ${expectedStatus}`, () => {
        const response = createStandardErrorResponse('Test', code);
        expect(response.status).toBe(expectedStatus);
      });
    });
  });
});
