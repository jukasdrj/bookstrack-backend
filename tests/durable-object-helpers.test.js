/**
 * Unit Tests: Durable Object Helpers
 *
 * Tests the helper functions for accessing Durable Objects.
 * Validates that getProgressDOStub correctly generates IDs and retrieves stubs.
 */

import { describe, it, expect, vi } from 'vitest';
import { getProgressDOStub } from '../src/utils/durable-object-helpers.ts';

describe('Durable Object Helpers', () => {
  describe('getProgressDOStub', () => {
    it('should generate DO ID from jobId and return stub', () => {
      // Mock environment with Durable Object binding
      const mockId = { toString: () => 'mock-id-123' };
      const mockStub = { fetch: vi.fn() };
      
      const mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn().mockReturnValue(mockId),
          get: vi.fn().mockReturnValue(mockStub)
        }
      };

      const jobId = 'test-job-123';
      const result = getProgressDOStub(jobId, mockEnv);

      // Verify idFromName was called with correct jobId
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledWith(jobId);
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledTimes(1);

      // Verify get was called with the generated ID
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.get).toHaveBeenCalledWith(mockId);
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.get).toHaveBeenCalledTimes(1);

      // Verify the stub is returned
      expect(result).toBe(mockStub);
    });

    it('should handle different jobId values', () => {
      const mockId = { toString: () => 'mock-id' };
      const mockStub = { fetch: vi.fn() };
      
      const mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn().mockReturnValue(mockId),
          get: vi.fn().mockReturnValue(mockStub)
        }
      };

      // Test with UUID format jobId
      const jobId1 = '550e8400-e29b-41d4-a716-446655440000';
      getProgressDOStub(jobId1, mockEnv);
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledWith(jobId1);

      // Test with simple string jobId
      const jobId2 = 'batch-scan-456';
      getProgressDOStub(jobId2, mockEnv);
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledWith(jobId2);

      // Verify both calls resulted in get being called
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.get).toHaveBeenCalledTimes(2);
    });

    it('should return the same stub for the same jobId', () => {
      const mockId = { toString: () => 'stable-id' };
      const mockStub = { fetch: vi.fn() };
      
      const mockEnv = {
        PROGRESS_WEBSOCKET_DO: {
          idFromName: vi.fn().mockReturnValue(mockId),
          get: vi.fn().mockReturnValue(mockStub)
        }
      };

      const jobId = 'consistent-job';
      
      // Call twice with same jobId
      const result1 = getProgressDOStub(jobId, mockEnv);
      const result2 = getProgressDOStub(jobId, mockEnv);

      // Both should return the same stub
      expect(result1).toBe(mockStub);
      expect(result2).toBe(mockStub);
      
      // idFromName should be called twice (once per call)
      expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalledTimes(2);
    });
  });
});
