/**
 * Unit Tests for External APIs Service
 *
 * Mocks the underlying fetch() calls to test the logic of each
 * function in `external-apis.ts`, including analytics recording.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as externalApis from '../../src/services/external-apis.ts';
import { recordProviderMetric } from '../../src/utils/analytics.ts';

// Mock the analytics module
vi.mock('../../src/utils/analytics.ts', () => ({
  recordProviderMetric: vi.fn(),
}));

describe('External APIs Service', () => {
  let mockFetch;
  let mockEnv;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockEnv = {
      GOOGLE_BOOKS_API_KEY: 'test-key',
      GOOGLE_BOOKS_ANALYTICS: {
        writeDataPoint: vi.fn(),
      },
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ============================================================================
  // Google Books
  // ============================================================================

  describe('searchGoogleBooks', () => {
    it('should record analytics on success', async () => {
      const mockResponse = { items: [{ volumeInfo: { title: 'Test Book' } }] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await externalApis.searchGoogleBooks('test', {}, mockEnv);

      expect(recordProviderMetric).toHaveBeenCalledWith(
        mockEnv.GOOGLE_BOOKS_ANALYTICS,
        'google-books',
        'search',
        expect.any(Number),
        1,
      );
    });

    it('should record analytics on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

      await externalApis.searchGoogleBooks('test', {}, mockEnv);

      expect(recordProviderMetric).toHaveBeenCalledWith(
        mockEnv.GOOGLE_BOOKS_ANALYTICS,
        'google-books',
        'search',
        expect.any(Number),
        0,
        'Google Books API error: 500 Server Error'
      );
    });
  });

  describe('searchGoogleBooksById', () => {
    it('should record analytics on success', async () => {
      const mockResponse = { volumeInfo: { title: 'Test Book' } };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await externalApis.searchGoogleBooksById('123', mockEnv);

      expect(recordProviderMetric).toHaveBeenCalledWith(
        mockEnv.GOOGLE_BOOKS_ANALYTICS,
        'google-books',
        'id_search',
        expect.any(Number),
        1,
      );
    });

    it('should record analytics on failure', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

        await externalApis.searchGoogleBooksById('123', mockEnv);

        expect(recordProviderMetric).toHaveBeenCalledWith(
          mockEnv.GOOGLE_BOOKS_ANALYTICS,
          'google-books',
          'id_search',
          expect.any(Number),
          0,
          'Google Books API error: 500 Server Error'
        );
      });
    });

  describe('searchGoogleBooksByISBN', () => {
    it('should record analytics on success', async () => {
      const mockResponse = { items: [{ volumeInfo: { title: 'Test Book' } }] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await externalApis.searchGoogleBooksByISBN('9781234567890', mockEnv);

      expect(recordProviderMetric).toHaveBeenCalledWith(
        mockEnv.GOOGLE_BOOKS_ANALYTICS,
        'google-books',
        'isbn_search',
        expect.any(Number),
        1
      );
    });

    it('should record analytics on failure', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

        await externalApis.searchGoogleBooksByISBN('9781234567890', mockEnv);

        expect(recordProviderMetric).toHaveBeenCalledWith(
          mockEnv.GOOGLE_BOOKS_ANALYTICS,
          'google-books',
          'isbn_search',
          expect.any(Number),
          0,
          'Google Books API error: 500 Server Error'
        );
      });
  });
});
