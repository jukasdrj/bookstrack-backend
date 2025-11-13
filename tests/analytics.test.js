/**
 * Unit Tests: Analytics Utilities
 *
 * Tests the analytics helper functions for recording events and provider metrics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recordAnalytics, recordProviderMetric } from '../src/utils/analytics.js';

describe('Analytics Utilities', () => {
  let mockDataset;
  let consoleWarnSpy;

  beforeEach(() => {
    // Create a fresh mock dataset for each test
    mockDataset = {
      writeDataPoint: vi.fn()
    };
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
  });

  describe('recordAnalytics', () => {
    it('should write data point when dataset is provided', async () => {
      const event = {
        blobs: ['test-query', 'search'],
        doubles: [123, 5],
        indexes: ['test-index']
      };

      await recordAnalytics(mockDataset, event);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);
      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith(event);
    });

    it('should do nothing when dataset is undefined', async () => {
      const event = {
        blobs: ['test-query', 'search'],
        doubles: [123, 5],
        indexes: ['test-index']
      };

      await recordAnalytics(undefined, event);

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should do nothing when dataset is null', async () => {
      const event = {
        blobs: ['test-query', 'search'],
        doubles: [123, 5],
        indexes: ['test-index']
      };

      await recordAnalytics(null, event);

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should catch and log errors from writeDataPoint', async () => {
      const errorMessage = 'Analytics service unavailable';
      mockDataset.writeDataPoint.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const event = {
        blobs: ['test-query', 'search'],
        doubles: [123, 5],
        indexes: ['test-index']
      };

      // Should not throw
      await recordAnalytics(mockDataset, event);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Analytics] Failed to record event:',
        errorMessage
      );
    });

    it('should handle events with only blobs', async () => {
      const event = {
        blobs: ['test-query', 'search']
      };

      await recordAnalytics(mockDataset, event);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith(event);
    });

    it('should handle events with only doubles', async () => {
      const event = {
        doubles: [123, 5]
      };

      await recordAnalytics(mockDataset, event);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith(event);
    });

    it('should handle events with only indexes', async () => {
      const event = {
        indexes: ['test-index']
      };

      await recordAnalytics(mockDataset, event);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith(event);
    });

    it('should handle empty event object', async () => {
      const event = {};

      await recordAnalytics(mockDataset, event);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith(event);
    });
  });

  describe('recordProviderMetric', () => {
    it('should record successful provider operation', async () => {
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        123,
        5
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);
      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['google-books', 'search', 'success'],
        doubles: [123, 5],
        indexes: ['provider-success']
      });
    });

    it('should record failed provider operation', async () => {
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        50,
        0,
        'API timeout'
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);
      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['google-books', 'search', 'error'],
        doubles: [50, 0],
        indexes: ['provider-error']
      });
    });

    it('should work with different providers', async () => {
      await recordProviderMetric(
        mockDataset,
        'openlibrary',
        'author_works',
        234,
        15
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['openlibrary', 'author_works', 'success'],
        doubles: [234, 15],
        indexes: ['provider-success']
      });
    });

    it('should work with ISBNdb provider', async () => {
      await recordProviderMetric(
        mockDataset,
        'isbndb',
        'isbn_lookup',
        89,
        1
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['isbndb', 'isbn_lookup', 'success'],
        doubles: [89, 1],
        indexes: ['provider-success']
      });
    });

    it('should handle zero processing time', async () => {
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        0,
        10
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['google-books', 'search', 'success'],
        doubles: [0, 10],
        indexes: ['provider-success']
      });
    });

    it('should handle zero result count', async () => {
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        123,
        0
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['google-books', 'search', 'success'],
        doubles: [123, 0],
        indexes: ['provider-success']
      });
    });

    it('should do nothing when dataset is undefined', async () => {
      await recordProviderMetric(
        undefined,
        'google-books',
        'search',
        123,
        5
      );

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockDataset.writeDataPoint.mockImplementation(() => {
        throw new Error('Network error');
      });

      // Should not throw
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        123,
        5
      );

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should treat empty string error as error case', async () => {
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        50,
        0,
        ''
      );

      // Empty string is falsy, so should be treated as success
      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['google-books', 'search', 'success'],
        doubles: [50, 0],
        indexes: ['provider-success']
      });
    });

    it('should treat non-empty error string as error case', async () => {
      await recordProviderMetric(
        mockDataset,
        'google-books',
        'search',
        50,
        0,
        'Rate limit exceeded'
      );

      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['google-books', 'search', 'error'],
        doubles: [50, 0],
        indexes: ['provider-error']
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple consecutive calls', async () => {
      await recordProviderMetric(mockDataset, 'google-books', 'search', 100, 5);
      await recordProviderMetric(mockDataset, 'openlibrary', 'search', 200, 3);
      await recordProviderMetric(mockDataset, 'isbndb', 'isbn_lookup', 50, 1);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and error calls', async () => {
      await recordProviderMetric(mockDataset, 'google-books', 'search', 100, 5);
      await recordProviderMetric(mockDataset, 'google-books', 'search', 50, 0, 'Timeout');
      await recordProviderMetric(mockDataset, 'google-books', 'search', 120, 8);

      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(3);

      const calls = mockDataset.writeDataPoint.mock.calls;
      expect(calls[0][0].indexes).toEqual(['provider-success']);
      expect(calls[1][0].indexes).toEqual(['provider-error']);
      expect(calls[2][0].indexes).toEqual(['provider-success']);
    });
  });
});
