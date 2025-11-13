import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAPIMetrics } from '../../src/utils/analytics.js';

describe('logAPIMetrics', () => {
  let mockEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a complete mock environment with all analytics bindings
    mockEnv = {
      GOOGLE_BOOKS_ANALYTICS: {
        writeDataPoint: vi.fn()
      },
      OPENLIBRARY_ANALYTICS: {
        writeDataPoint: vi.fn()
      },
      ISBNDB_ANALYTICS: {
        writeDataPoint: vi.fn()
      }
    };
  });

  describe('Google Books analytics', () => {
    it('should log successful search metrics', () => {
      logAPIMetrics(mockEnv, 'google-books', 'search', 'Harry Potter', 234, 15, true);

      expect(mockEnv.GOOGLE_BOOKS_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['Harry Potter', 'search'],
        doubles: [234, 15],
        indexes: ['google-books-search']
      });
    });

    it('should log failed search metrics with error', () => {
      logAPIMetrics(mockEnv, 'google-books', 'search', 'invalid query', 123, 0, false, 'API error: 404');

      expect(mockEnv.GOOGLE_BOOKS_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['invalid query', 'search_error'],
        doubles: [123, 0],
        indexes: ['google-books-error']
      });
    });

    it('should log ISBN search metrics', () => {
      logAPIMetrics(mockEnv, 'google-books', 'isbn_search', '9780439708180', 156, 1, true);

      expect(mockEnv.GOOGLE_BOOKS_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['9780439708180', 'isbn_search'],
        doubles: [156, 1],
        indexes: ['google-books-isbn_search']
      });
    });

    it('should log ID search metrics', () => {
      logAPIMetrics(mockEnv, 'google-books', 'id_search', 'volumeId123', 89, 1, true);

      expect(mockEnv.GOOGLE_BOOKS_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['volumeId123', 'id_search'],
        doubles: [89, 1],
        indexes: ['google-books-id_search']
      });
    });
  });

  describe('OpenLibrary analytics', () => {
    it('should log successful search metrics', () => {
      logAPIMetrics(mockEnv, 'openlibrary', 'search', 'Pride and Prejudice', 345, 20, true);

      expect(mockEnv.OPENLIBRARY_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['Pride and Prejudice', 'search'],
        doubles: [345, 20],
        indexes: ['openlibrary-search']
      });
    });

    it('should log failed search metrics', () => {
      logAPIMetrics(mockEnv, 'openlibrary', 'search', 'query', 200, 0, false, 'Network error');

      expect(mockEnv.OPENLIBRARY_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['query', 'search_error'],
        doubles: [200, 0],
        indexes: ['openlibrary-error']
      });
    });

    it('should log author works search metrics', () => {
      logAPIMetrics(mockEnv, 'openlibrary', 'author_works', 'Jane Austen', 567, 10, true);

      expect(mockEnv.OPENLIBRARY_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['Jane Austen', 'author_works'],
        doubles: [567, 10],
        indexes: ['openlibrary-author_works']
      });
    });

    it('should log Goodreads ID search metrics', () => {
      logAPIMetrics(mockEnv, 'openlibrary', 'goodreads_search', 'goodreads123', 234, 1, true);

      expect(mockEnv.OPENLIBRARY_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['goodreads123', 'goodreads_search'],
        doubles: [234, 1],
        indexes: ['openlibrary-goodreads_search']
      });
    });

    it('should log work ID search metrics', () => {
      logAPIMetrics(mockEnv, 'openlibrary', 'id_search', 'OL123W', 178, 1, true);

      expect(mockEnv.OPENLIBRARY_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['OL123W', 'id_search'],
        doubles: [178, 1],
        indexes: ['openlibrary-id_search']
      });
    });
  });

  describe('ISBNdb analytics', () => {
    it('should log successful search metrics', () => {
      logAPIMetrics(mockEnv, 'isbndb', 'search', '1984', 456, 5, true);

      expect(mockEnv.ISBNDB_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['1984', 'search'],
        doubles: [456, 5],
        indexes: ['isbndb-search']
      });
    });

    it('should log failed search metrics', () => {
      logAPIMetrics(mockEnv, 'isbndb', 'search', 'title', 123, 0, false, 'Rate limit exceeded');

      expect(mockEnv.ISBNDB_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['title', 'search_error'],
        doubles: [123, 0],
        indexes: ['isbndb-error']
      });
    });

    it('should log editions search metrics', () => {
      logAPIMetrics(mockEnv, 'isbndb', 'editions', 'The Hobbit', 300, 8, true);

      expect(mockEnv.ISBNDB_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['The Hobbit', 'editions'],
        doubles: [300, 8],
        indexes: ['isbndb-editions']
      });
    });

    it('should log ISBN search metrics', () => {
      logAPIMetrics(mockEnv, 'isbndb', 'isbn_search', '9780451524935', 234, 1, true);

      expect(mockEnv.ISBNDB_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
        blobs: ['9780451524935', 'isbn_search'],
        doubles: [234, 1],
        indexes: ['isbndb-isbn_search']
      });
    });
  });

  describe('graceful degradation', () => {
    it('should not throw when analytics binding is missing', () => {
      const envWithoutAnalytics = {};

      // Should not throw
      expect(() => {
        logAPIMetrics(envWithoutAnalytics, 'google-books', 'search', 'query', 100, 5, true);
      }).not.toThrow();
    });

    it('should not throw when specific provider binding is missing', () => {
      const envWithSomeAnalytics = {
        GOOGLE_BOOKS_ANALYTICS: {
          writeDataPoint: vi.fn()
        }
        // Missing OPENLIBRARY_ANALYTICS
      };

      // Should not throw for missing binding
      expect(() => {
        logAPIMetrics(envWithSomeAnalytics, 'openlibrary', 'search', 'query', 100, 5, true);
      }).not.toThrow();
    });

    it('should not throw when writeDataPoint fails', () => {
      const envWithFailingAnalytics = {
        GOOGLE_BOOKS_ANALYTICS: {
          writeDataPoint: vi.fn().mockImplementation(() => {
            throw new Error('Analytics service unavailable');
          })
        }
      };

      // Should not throw even if writeDataPoint throws
      expect(() => {
        logAPIMetrics(envWithFailingAnalytics, 'google-books', 'search', 'query', 100, 5, true);
      }).not.toThrow();
    });

    it('should warn for unknown provider', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logAPIMetrics(mockEnv, 'unknown-provider', 'search', 'query', 100, 5, true);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown provider for analytics: unknown-provider');
      
      consoleWarnSpy.mockRestore();
    });
  });
});
