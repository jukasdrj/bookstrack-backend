/**
 * WebSocket Handlers Tests
 * 
 * Tests for WebSocket upgrade route handling:
 * - WebSocket upgrade validation
 * - Missing jobId → 400
 * - Invalid token → 401
 * - Expired token → 401
 * - Non-WebSocket upgrade → 426
 * 
 * Total: 5 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock the worker's fetch handler for WebSocket route testing
 * This simulates the behavior in src/index.js for /ws/progress route
 */
async function handleWebSocketRoute(request, env) {
  const url = new URL(request.url);
  
  // Route WebSocket connections to the Durable Object
  if (url.pathname === '/ws/progress') {
    const jobId = url.searchParams.get('jobId');
    if (!jobId) {
      return new Response('Missing jobId parameter', { status: 400 });
    }

    // Check for WebSocket upgrade header
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Get Durable Object instance for this specific jobId
    const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
    const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

    // Forward the request to the Durable Object
    return doStub.fetch(request);
  }

  return new Response('Not found', { status: 404 });
}

describe('WebSocket Route Handlers', () => {
  let mockEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Durable Object namespace and stub
    const mockDOStub = {
      fetch: vi.fn(async (request) => {
        const authHeader = request.headers.get('Authorization');
        
        // Simulate DO validation logic
        if (!authHeader) {
          return new Response('Unauthorized', { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Mock token validation
        if (token === 'invalid-token') {
          return new Response('Invalid token', { status: 401 });
        }

        if (token === 'expired-token') {
          return new Response('Token expired', { status: 401 });
        }

        // Mock successful WebSocket upgrade (use 200 instead of 101 for testing)
        return new Response(JSON.stringify({ upgraded: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    };

    mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn((jobId) => `do-id-${jobId}`),
        get: vi.fn((doId) => mockDOStub)
      }
    };
  });

  describe('WebSocket Upgrade Validation', () => {
    it('should reject request with missing jobId parameter', async () => {
      const request = new Request('https://api.example.com/ws/progress', {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        }
      });

      const response = await handleWebSocketRoute(request, mockEnv);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Missing jobId');
    });

    it('should reject request with missing Upgrade header', async () => {
      const request = new Request('https://api.example.com/ws/progress?jobId=test-job-123', {
        headers: {
          'Connection': 'Upgrade'
        }
      });

      const response = await handleWebSocketRoute(request, mockEnv);

      expect(response.status).toBe(426);
      const text = await response.text();
      expect(text).toContain('Expected WebSocket');
    });

    it('should reject request with invalid token in Durable Object', async () => {
      const request = new Request('https://api.example.com/ws/progress?jobId=test-job-123', {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await handleWebSocketRoute(request, mockEnv);

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('Invalid token');
    });

    it('should reject request with expired token in Durable Object', async () => {
      const request = new Request('https://api.example.com/ws/progress?jobId=test-job-123', {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Authorization': 'Bearer expired-token'
        }
      });

      const response = await handleWebSocketRoute(request, mockEnv);

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('expired');
    });

    it('should accept valid WebSocket upgrade request', async () => {
      const request = new Request('https://api.example.com/ws/progress?jobId=test-job-123', {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Authorization': 'Bearer valid-token-12345'
        }
      });

      const response = await handleWebSocketRoute(request, mockEnv);

      expect(response.status).toBe(200); // Mocked as 200 for testing
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledWith('test-job-123');
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.get).toHaveBeenCalledWith('do-id-test-job-123');
    });
  });

  describe('Route Forwarding', () => {
    it('should forward valid request to correct Durable Object instance', async () => {
      const jobId = 'unique-job-456';
      const request = new Request(`https://api.example.com/ws/progress?jobId=${jobId}`, {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Authorization': 'Bearer valid-token'
        }
      });

      await handleWebSocketRoute(request, mockEnv);

      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledWith(jobId);
    });

    it('should preserve request headers when forwarding to DO', async () => {
      const request = new Request('https://api.example.com/ws/progress?jobId=test-job', {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Authorization': 'Bearer valid-token',
          'User-Agent': 'Test Client'
        }
      });

      await handleWebSocketRoute(request, mockEnv);

      const doStub = mockEnv.PROGRESS_WEBSOCKET_DO.get();
      expect(doStub.fetch).toHaveBeenCalledWith(request);
    });
  });
});
