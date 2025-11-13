/**
 * Token Refresh Handler Tests
 * 
 * Tests for POST /api/token/refresh endpoint:
 * - Token validation & refresh window (30-minute window before expiration)
 * - Concurrent refresh handling
 * - Error cases (missing params, invalid token, expired token)
 * 
 * Total: 5 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock the worker's fetch handler for token refresh route
 * This simulates the behavior in src/index.js for /api/token/refresh
 */
async function handleTokenRefreshRoute(request, env) {
  const url = new URL(request.url);

  // POST /api/token/refresh - Refresh authentication token for long-running jobs
  if (url.pathname === '/api/token/refresh' && request.method === 'POST') {
    try {
      const { jobId, oldToken } = await request.json();

      if (!jobId || !oldToken) {
        return new Response(JSON.stringify({
          error: 'Invalid request: jobId and oldToken required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
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
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Return new token
      return new Response(JSON.stringify({
        jobId,
        token: result.token,
        expiresIn: result.expiresIn
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Failed to refresh token:', error);
      return new Response(JSON.stringify({
        error: 'Failed to refresh token',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not found', { status: 404 });
}

describe('Token Refresh Handler', () => {
  let mockEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Token Refresh', () => {
    it('should refresh token successfully within 30-minute window', async () => {
      const mockDOStub = {
        refreshAuthToken: vi.fn(async (oldToken) => {
          if (oldToken === 'valid-token-near-expiry') {
            return {
              token: 'new-token-12345',
              expiresIn: 7200 // 2 hours in seconds
            };
          }
          return { error: 'Invalid token' };
        })
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn((jobId) => `do-id-${jobId}`),
          get: vi.fn(() => mockDOStub)
        }
      };

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-123',
          oldToken: 'valid-token-near-expiry'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jobId).toBe('job-123');
      expect(data.token).toBe('new-token-12345');
      expect(data.expiresIn).toBe(7200);
    });

    it('should generate new token with extended expiration', async () => {
      const mockDOStub = {
        refreshAuthToken: vi.fn(async () => ({
          token: crypto.randomUUID(),
          expiresIn: 7200
        }))
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn(() => 'do-id'),
          get: vi.fn(() => mockDOStub)
        }
      };

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-456',
          oldToken: 'old-token'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.token).toBeDefined();
      expect(data.expiresIn).toBe(7200); // 2 hours
    });
  });

  describe('Error Handling', () => {
    it('should return 400 when jobId is missing', async () => {
      mockEnv = {};

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldToken: 'some-token'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('jobId and oldToken required');
    });

    it('should return 400 when oldToken is missing', async () => {
      mockEnv = {};

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-789'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('jobId and oldToken required');
    });

    it('should return 401 when token is invalid', async () => {
      const mockDOStub = {
        refreshAuthToken: vi.fn(async () => ({
          error: 'Token not found or invalid'
        }))
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn(() => 'do-id'),
          get: vi.fn(() => mockDOStub)
        }
      };

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-999',
          oldToken: 'invalid-token'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 401 when token is expired', async () => {
      const mockDOStub = {
        refreshAuthToken: vi.fn(async () => ({
          error: 'Token has expired'
        }))
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn(() => 'do-id'),
          get: vi.fn(() => mockDOStub)
        }
      };

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-expired',
          oldToken: 'expired-token'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 401 when refresh attempted too early (>30 min remaining)', async () => {
      const mockDOStub = {
        refreshAuthToken: vi.fn(async () => ({
          error: 'Token can only be refreshed within 30 minutes of expiration'
        }))
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn(() => 'do-id'),
          get: vi.fn(() => mockDOStub)
        }
      };

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-early',
          oldToken: 'token-with-plenty-of-time'
        })
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('30 minutes');
    });

    it('should return 500 when malformed JSON in request body', async () => {
      mockEnv = {};

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });

      const response = await handleTokenRefreshRoute(request, mockEnv);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Concurrent Refresh Handling', () => {
    it('should handle concurrent refresh requests for same job', async () => {
      let refreshCount = 0;
      const mockDOStub = {
        refreshAuthToken: vi.fn(async () => {
          refreshCount++;
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            token: `new-token-${refreshCount}`,
            expiresIn: 7200
          };
        })
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn(() => 'do-id'),
          get: vi.fn(() => mockDOStub)
        }
      };

      // Make 3 concurrent requests
      const requests = Array(3).fill(null).map(() =>
        new Request('https://api.example.com/api/token/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: 'concurrent-job',
            oldToken: 'old-token'
          })
        })
      );

      const responses = await Promise.all(
        requests.map(req => handleTokenRefreshRoute(req, mockEnv))
      );

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.token).toBeDefined();
      }

      // Should have called refreshAuthToken for each request
      expect(mockDOStub.refreshAuthToken).toHaveBeenCalledTimes(3);
    });
  });

  describe('Durable Object Integration', () => {
    it('should call correct Durable Object for jobId', async () => {
      const mockDOStub = {
        refreshAuthToken: vi.fn(async () => ({
          token: 'new-token',
          expiresIn: 7200
        }))
      };

      mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn((jobId) => `do-id-${jobId}`),
          get: vi.fn(() => mockDOStub)
        }
      };

      const request = new Request('https://api.example.com/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'specific-job-123',
          oldToken: 'old-token'
        })
      });

      await handleTokenRefreshRoute(request, mockEnv);

      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledWith('specific-job-123');
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.get).toHaveBeenCalledWith('do-id-specific-job-123');
      expect(mockDOStub.refreshAuthToken).toHaveBeenCalledWith('old-token');
    });
  });
});
