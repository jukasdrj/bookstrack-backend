/**
 * Tests for Monitoring Dashboard Worker
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Monitoring Dashboard Worker', () => {
  let env;

  beforeEach(() => {
    // Mock environment
    env = {
      API_WORKER_URL: 'https://api.oooefam.net',
      CACHE: {
        get: vi.fn(),
        put: vi.fn(),
      },
    };

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('Health Endpoint', () => {
    it('should return healthy status when all systems operational', async () => {
      // Mock API worker health response
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ combinedHitRate: 95 }),
        });

      const { handleHealthCheck } = await import('../src/workers/monitoring-dashboard/handlers/health.js');
      const request = new Request('http://localhost/api/health');
      const response = await handleHealthCheck(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.message).toBe('All systems operational');
      expect(data.alerts).toHaveLength(0);
    });

    it('should return critical status when worker is down', async () => {
      // Mock API worker failure
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ combinedHitRate: 95 }),
        });

      const { handleHealthCheck } = await import('../src/workers/monitoring-dashboard/handlers/health.js');
      const request = new Request('http://localhost/api/health');
      const response = await handleHealthCheck(request, env);
      const data = await response.json();

      expect(data.status).toBe('critical');
      expect(data.alerts.length).toBeGreaterThan(0);
      expect(data.alerts[0].severity).toBe('critical');
    });

    it('should return degraded status when cache performance is low', async () => {
      // Mock degraded cache performance
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ combinedHitRate: 80 }),
        });

      const { handleHealthCheck } = await import('../src/workers/monitoring-dashboard/handlers/health.js');
      const request = new Request('http://localhost/api/health');
      const response = await handleHealthCheck(request, env);
      const data = await response.json();

      expect(data.status).toBe('degraded');
      expect(data.alerts).toHaveLength(1);
      expect(data.alerts[0].severity).toBe('warning');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return aggregated metrics', async () => {
      // Mock metrics response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          volume: {
            edge_hits: 1000,
            kv_hits: 500,
            api_misses: 100,
          },
          latency: {
            edge_hit: { p50: 10, p95: 25, p99: 50 },
            kv_hit: { p50: 30, p95: 60, p99: 100 },
          },
        }),
      });

      const { handleMetrics } = await import('../src/workers/monitoring-dashboard/handlers/metrics.js');
      const request = new Request('http://localhost/api/metrics?period=1h');
      const response = await handleMetrics(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period).toBe('1h');
      expect(data.requestVolume).toBeGreaterThan(0);
      expect(data.latency).toHaveProperty('p50');
      expect(data.latency).toHaveProperty('p95');
      expect(data.latency).toHaveProperty('p99');
      expect(data.successRate).toBeGreaterThan(0);
    });

    it('should handle API worker unavailability gracefully', async () => {
      // Mock fetch failure
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const { handleMetrics } = await import('../src/workers/monitoring-dashboard/handlers/metrics.js');
      const request = new Request('http://localhost/api/metrics');
      const response = await handleMetrics(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requestVolume).toBe(0);
      expect(data.latency.p50).toBe(0);
    });
  });

  describe('Cache Stats Endpoint', () => {
    it('should return cache performance metrics', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          volume: {
            edge_hits: 800,
            kv_hits: 400,
            r2_rehydrations: 50,
            api_misses: 150,
          },
          hitRates: {
            combined: 89.3,
            edge: 57.1,
            kv: 28.6,
          },
        }),
      });

      const { handleCacheStats } = await import('../src/workers/monitoring-dashboard/handlers/cache-stats.js');
      const request = new Request('http://localhost/api/cache-stats?period=24h');
      const response = await handleCacheStats(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.combinedHitRate).toBeGreaterThan(0);
      expect(data.edgeHits).toBeGreaterThan(0);
      expect(data.kvHits).toBeGreaterThan(0);
      expect(data.efficiency).toHaveProperty('totalCached');
      expect(data.efficiency).toHaveProperty('totalRequests');
    });

    it('should calculate combined hit rate if not provided', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          volume: {
            edge_hits: 700,
            kv_hits: 200,
            r2_rehydrations: 0,
            api_misses: 100,
          },
        }),
      });

      const { handleCacheStats } = await import('../src/workers/monitoring-dashboard/handlers/cache-stats.js');
      const request = new Request('http://localhost/api/cache-stats');
      const response = await handleCacheStats(request, env);
      const data = await response.json();

      expect(data.combinedHitRate).toBeCloseTo(90, 0); // (900/1000) * 100
    });
  });

  describe('Provider Health Endpoint', () => {
    it('should check Google Books availability', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { handleProviderHealth } = await import('../src/workers/monitoring-dashboard/handlers/provider-health.js');
      const request = new Request('http://localhost/api/provider-health');
      const response = await handleProviderHealth(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data['google-books'].status).toBe('healthy');
      expect(data['google-books'].latency).toBeGreaterThanOrEqual(0);
    });

    it('should detect provider failures', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const { handleProviderHealth } = await import('../src/workers/monitoring-dashboard/handlers/provider-health.js');
      const request = new Request('http://localhost/api/provider-health');
      const response = await handleProviderHealth(request, env);
      const data = await response.json();

      expect(data['google-books'].status).toBe('critical');
      expect(data['google-books'].message).toContain('Timeout');
    });

    it('should return overall degraded status if multiple providers down', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'));

      const { handleProviderHealth } = await import('../src/workers/monitoring-dashboard/handlers/provider-health.js');
      const request = new Request('http://localhost/api/provider-health');
      const response = await handleProviderHealth(request, env);
      const data = await response.json();

      expect(data.status).not.toBe('healthy');
      expect(data.summary.critical).toBeGreaterThan(0);
    });
  });

  describe('Cost Analysis Endpoint', () => {
    it('should estimate costs based on usage', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          volume: {
            kv_hits: 1_000_000,
            r2_rehydrations: 100_000,
            api_misses: 50_000,
          },
        }),
      });

      const { handleCosts } = await import('../src/workers/monitoring-dashboard/handlers/costs.js');
      const request = new Request('http://localhost/api/costs?period=24h');
      const response = await handleCosts(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.daily).toMatch(/^\$/);
      expect(data.monthly).toMatch(/^\$/);
      expect(data.breakdown).toHaveProperty('kv');
      expect(data.breakdown).toHaveProperty('r2');
      expect(data.breakdown).toHaveProperty('ai');
      expect(data.details).toHaveProperty('kvReads');
    });

    it('should provide cost breakdown by service', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          volume: {
            kv_hits: 500_000,
            r2_rehydrations: 50_000,
            api_misses: 10_000,
          },
        }),
      });

      const { handleCosts } = await import('../src/workers/monitoring-dashboard/handlers/costs.js');
      const request = new Request('http://localhost/api/costs');
      const response = await handleCosts(request, env);
      const data = await response.json();

      expect(parseFloat(data.breakdown.kv.substring(1))).toBeGreaterThanOrEqual(0);
      expect(parseFloat(data.breakdown.r2.substring(1))).toBeGreaterThanOrEqual(0);
    });
  });

  describe('WebSocket Stats Endpoint', () => {
    it('should return WebSocket metrics', async () => {
      const { handleWebSocketStats } = await import('../src/workers/monitoring-dashboard/handlers/websocket-stats.js');
      const request = new Request('http://localhost/api/websocket-stats');
      const response = await handleWebSocketStats(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('activeConnections');
      expect(data).toHaveProperty('messagesPerMinute');
      expect(data).toHaveProperty('avgDuration');
    });

    it('should fetch from cache if available', async () => {
      // KV.get with 'json' option returns parsed JSON automatically
      env.CACHE.get = vi.fn().mockResolvedValueOnce({
        activeConnections: 42,
        messagesPerMinute: 150,
      });

      const { handleWebSocketStats } = await import('../src/workers/monitoring-dashboard/handlers/websocket-stats.js');
      const request = new Request('http://localhost/api/websocket-stats');
      const response = await handleWebSocketStats(request, env);
      const data = await response.json();

      expect(data.activeConnections).toBe(42);
      expect(data.messagesPerMinute).toBe(150);
    });
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const worker = await import('../src/workers/monitoring-dashboard/index.js');
      const request = new Request('http://localhost/api/health', { method: 'OPTIONS' });
      const response = await worker.default.fetch(request, env, {});

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should add CORS headers to all responses', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      const worker = await import('../src/workers/monitoring-dashboard/index.js');
      const request = new Request('http://localhost/api/health');
      const response = await worker.default.fetch(request, env, {});

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const worker = await import('../src/workers/monitoring-dashboard/index.js');
      const request = new Request('http://localhost/unknown');
      const response = await worker.default.fetch(request, env, {});

      expect(response.status).toBe(404);
    });

    it('should handle handler errors gracefully', async () => {
      // Force an error by not mocking fetch
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const worker = await import('../src/workers/monitoring-dashboard/index.js');
      const request = new Request('http://localhost/api/metrics');
      const response = await worker.default.fetch(request, env, {});

      expect(response.status).toBeLessThan(300); // Should still return 200 with zero values
    });
  });
});
