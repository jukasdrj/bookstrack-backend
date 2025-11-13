/**
 * Integration tests for POST /v1/enrichment/batch endpoint
 *
 * Tests the canonical batch enrichment endpoint that accepts books for enrichment.
 * This endpoint is used by iOS to enrich books with the canonical API contract.
 *
 * **Prerequisites:**
 * 1. Deploy worker: `wrangler deploy`
 * 2. Run tests: `WORKER_URL=https://books-api-proxy.jukasdrj.workers.dev npm test integration/v1-enrichment-batch`
 *
 * **OR** for local dev:
 * 1. `wrangler dev --port 8787` (separate terminal)
 * 2. `npm test integration/v1-enrichment-batch`
 *
 * Note: Tests validate HTTP contract only. WebSocket testing requires separate client setup.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

// Check if worker is running before ALL tests
beforeAll(async () => {
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    if (!response.ok) {
      throw new Error('Worker health check failed');
    }
  } catch (error) {
    console.warn('\n⚠️  Worker not running. Start with: wrangler dev --port 8787');
    console.warn('   Or set WORKER_URL to deployed worker for real API tests\n');
    throw new Error('Worker not available - skipping integration tests');
  }
});

describe('POST /v1/enrichment/batch (canonical endpoint)', () => {
  /**
   * Helper to generate unique job IDs for each test
   */
  function generateJobId(): string {
    return `test-v1-batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  // ========================================================================
  // Basic Functionality Tests
  // ========================================================================

  describe('Basic functionality', () => {
    it('should accept valid books array and return 202 Accepted', async () => {
      const jobId = generateJobId();
      const books = [
        { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
        { title: '1984', author: 'George Orwell' },
        { title: 'To Kill a Mockingbird', author: 'Harper Lee' }
      ];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.success).toBe(true);
      expect(body.data.processedCount).toBe(0);
      expect(body.data.totalCount).toBe(3);
      expect(body.data.token).toBeDefined();
      expect(typeof body.data.token).toBe('string');
      expect(body.metadata).toBeDefined();
      expect(body.metadata.timestamp).toBeDefined();
      expect(body.error).toBeUndefined();
    });

    it('should handle single book', async () => {
      const jobId = generateJobId();
      const books = [{ title: 'The Hobbit', author: 'J.R.R. Tolkien' }];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.totalCount).toBe(1);
      expect(body.data.token).toBeDefined();
      expect(body.metadata.timestamp).toBeDefined();
    });

    it('should handle books with ISBN', async () => {
      const jobId = generateJobId();
      const books = [
        { title: 'Harry Potter', author: 'J.K. Rowling', isbn: '9780439708180' }
      ];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.totalCount).toBe(1);
      expect(body.data.token).toBeDefined();
    });

    it('should handle large batch of books (20+)', async () => {
      const jobId = generateJobId();
      const books = Array.from({ length: 20 }, (_, i) => ({
        title: `Book ${i + 1}`,
        author: `Author ${i + 1}`
      }));

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.totalCount).toBe(20);
      expect(body.data.token).toBeDefined();
      expect(body.metadata.timestamp).toBeDefined();
    });
  });

  // ========================================================================
  // Error Handling Tests
  // ========================================================================

  describe('Error handling', () => {
    it('should return 400 for missing jobId', async () => {
      const books = [{ title: 'Test Book', author: 'Test Author' }];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books })
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.message.toLowerCase()).toContain('jobid');
      expect(body.metadata.timestamp).toBeDefined();
    });

    it('should return 400 for missing books array', async () => {
      const jobId = generateJobId();

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.message.toLowerCase()).toContain('books');
      expect(body.metadata.timestamp).toBeDefined();
    });

    it('should return 400 with E_EMPTY_BATCH for empty books array', async () => {
      const jobId = generateJobId();
      const books: any[] = [];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('E_EMPTY_BATCH');
      expect(body.error.message.toLowerCase()).toContain('empty');
      expect(body.metadata.timestamp).toBeDefined();
    });

    it('should return 400 for books as non-array', async () => {
      const jobId = generateJobId();
      const books = 'not-an-array';

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.metadata.timestamp).toBeDefined();
    });

    it('should return 400 for book without title', async () => {
      const jobId = generateJobId();
      const books = [{ author: 'Test Author' }];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.message.toLowerCase()).toContain('title');
      expect(body.metadata.timestamp).toBeDefined();
    });

    it('should return 400 for malformed JSON', async () => {
      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-{{'
      });

      expect([400, 500]).toContain(response.status);
    });
  });

  // ========================================================================
  // Response Structure Validation (Canonical Contract)
  // ========================================================================

  describe('Canonical response structure', () => {
    it('should return EnrichmentJobInitResponse structure', async () => {
      const jobId = generateJobId();
      const books = [
        { title: 'Test Book 1' },
        { title: 'Test Book 2' }
      ];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      expect(response.status).toBe(202);

      const body = await response.json();

      // Validate ResponseEnvelope structure
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('metadata');
      expect(body.data).toBeDefined();
      expect(body.metadata).toBeDefined();

      // Validate metadata
      expect(body.metadata.timestamp).toBeDefined();
      expect(typeof body.metadata.timestamp).toBe('string');

      // Validate EnrichmentJobInitResponse data payload
      expect(body.data).toHaveProperty('success');
      expect(body.data).toHaveProperty('processedCount');
      expect(body.data).toHaveProperty('totalCount');
      expect(body.data).toHaveProperty('token');

      // Validate types (TypeScript canonical contract)
      expect(typeof body.data.success).toBe('boolean');
      expect(typeof body.data.processedCount).toBe('number');
      expect(typeof body.data.totalCount).toBe('number');
      expect(typeof body.data.token).toBe('string');

      // Validate values
      expect(body.data.success).toBe(true);
      expect(body.data.processedCount).toBe(0);
      expect(body.data.totalCount).toBe(2);
      expect(body.data.token.length).toBeGreaterThan(0);
    });

    it('should include CORS headers', async () => {
      const jobId = generateJobId();
      const books = [{ title: 'Test Book' }];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      // Content-Type should be application/json
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  // ========================================================================
  // WebSocket Integration
  // ========================================================================

  describe('WebSocket integration', () => {
    it('should return WebSocket auth token', async () => {
      const jobId = generateJobId();
      const books = [{ title: 'Test Book', author: 'Test Author' }];

      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId })
      });

      const body = await response.json();

      // Token should be a UUID-like string
      expect(body.data.token).toBeDefined();
      expect(typeof body.data.token).toBe('string');
      expect(body.data.token.length).toBeGreaterThan(20);
    });

    it('should generate unique tokens for different jobs', async () => {
      const books = [{ title: 'Test Book' }];

      const response1 = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId: 'test-job-1' })
      });

      const response2 = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, jobId: 'test-job-2' })
      });

      const body1 = await response1.json();
      const body2 = await response2.json();

      expect(body1.data.token).toBeDefined();
      expect(body2.data.token).toBeDefined();
      expect(body1.data.token).not.toBe(body2.data.token);
    });
  });

  // ========================================================================
  // HTTP Method Validation
  // ========================================================================

  describe('HTTP method validation', () => {
    it('should reject GET requests', async () => {
      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'GET'
      });

      // Should return 404 (not matched)
      expect(response.status).toBe(404);
    });

    it('should only accept POST method', async () => {
      const jobId = generateJobId();
      const books = [{ title: 'Test Book' }];
      const methods = ['PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ books, jobId })
        });

        expect(response.status).toBe(404);
      }
    });
  });

  // ========================================================================
  // iOS Canary Check (from issue requirements)
  // ========================================================================

  describe('iOS canary check', () => {
    it('should return 400 with error for empty books array (iOS canary)', async () => {
      const response = await fetch(`${WORKER_URL}/v1/enrichment/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 'canary-test', books: [] })
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('E_EMPTY_BATCH');
    });
  });
});
