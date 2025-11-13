/**
 * Search Routes
 * Handles all search endpoints (v1 canonical and legacy)
 */

import { getCorsHeaders } from '../middleware/cors.js';
import * as bookSearch from '../handlers/book-search.js';
import * as authorSearch from '../handlers/author-search.js';
import { handleAdvancedSearch } from '../handlers/search-handlers.js';
import { handleSearchTitle } from '../handlers/v1/search-title.js';
import { handleSearchISBN } from '../handlers/v1/search-isbn.js';
import { handleSearchAdvanced } from '../handlers/v1/search-advanced.js';
import { adaptToUnifiedEnvelope } from '../utils/envelope-helpers.ts';

/**
 * Handle search-related routes (v1 and legacy)
 */
export async function handleSearchRoutes(request, url, env, ctx) {
  // Feature flag for unified response envelope (Issue #399)
  const useUnifiedEnvelope = env.ENABLE_UNIFIED_ENVELOPE === 'true';

  // ========================================================================
  // V1 Search Endpoints (Canonical Contracts)
  // ========================================================================

  // GET /v1/search/title - Search books by title (canonical response)
  if (url.pathname === '/v1/search/title' && request.method === 'GET') {
    const query = url.searchParams.get('q');
    const response = await handleSearchTitle(query, env);
    return adaptToUnifiedEnvelope(response, useUnifiedEnvelope);
  }

  // GET /v1/search/isbn - Search books by ISBN (canonical response)
  if (url.pathname === '/v1/search/isbn' && request.method === 'GET') {
    const isbn = url.searchParams.get('isbn');
    const response = await handleSearchISBN(isbn, env);
    return adaptToUnifiedEnvelope(response, useUnifiedEnvelope);
  }

  // GET /v1/search/advanced - Advanced search by title and/or author (canonical response)
  if (url.pathname === '/v1/search/advanced' && request.method === 'GET') {
    const title = url.searchParams.get('title') || '';
    const author = url.searchParams.get('author') || '';
    const response = await handleSearchAdvanced(title, author, env, ctx);
    return adaptToUnifiedEnvelope(response, useUnifiedEnvelope);
  }

  // ========================================================================
  // Legacy Search Endpoints
  // ========================================================================

  // GET /search/title - Search books by title with caching (6h TTL)
  if (url.pathname === '/search/title') {
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter "q"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const maxResults = parseInt(url.searchParams.get('maxResults') || '20');
    const result = await bookSearch.searchByTitle(query, { maxResults }, env, ctx);

    // Extract cache headers from result
    const cacheHeaders = result._cacheHeaders || {};
    delete result._cacheHeaders; // Don't expose internal field to client

    return new Response(JSON.stringify(result), {
      headers: {
        ...getCorsHeaders(request),
        'Content-Type': 'application/json',
        ...cacheHeaders
      }
    });
  }

  // GET /search/isbn - Search books by ISBN with caching (7 day TTL)
  if (url.pathname === '/search/isbn') {
    const isbn = url.searchParams.get('isbn');
    if (!isbn) {
      return new Response(JSON.stringify({ error: 'Missing ISBN parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const maxResults = parseInt(url.searchParams.get('maxResults') || '1');
    const result = await bookSearch.searchByISBN(isbn, { maxResults }, env, ctx);

    // Extract cache headers from result
    const cacheHeaders = result._cacheHeaders || {};
    delete result._cacheHeaders; // Don't expose internal field to client

    return new Response(JSON.stringify(result), {
      headers: {
        ...getCorsHeaders(request),
        'Content-Type': 'application/json',
        ...cacheHeaders
      }
    });
  }

  // GET /search/author - Search books by author with pagination (6h cache)
  if (url.pathname === '/search/author') {
    const authorName = url.searchParams.get('q');
    if (!authorName) {
      return new Response(JSON.stringify({ error: 'Missing query parameter "q"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Support both 'limit' (new) and 'maxResults' (iOS compatibility)
    const limitParam = url.searchParams.get('limit') || url.searchParams.get('maxResults') || '50';
    const limit = parseInt(limitParam);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sortBy = url.searchParams.get('sortBy') || 'publicationYear';

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 100'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (offset < 0) {
      return new Response(JSON.stringify({
        error: 'Invalid offset parameter',
        message: 'Offset must be >= 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const validSortOptions = ['publicationYear', 'publicationYearAsc', 'title', 'popularity'];
    if (!validSortOptions.includes(sortBy)) {
      return new Response(JSON.stringify({
        error: 'Invalid sortBy parameter',
        message: `sortBy must be one of: ${validSortOptions.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await authorSearch.searchByAuthor(
      authorName,
      { limit, offset, sortBy },
      env,
      ctx
    );

    // Extract cache status for headers
    const cacheStatus = result.cached ? 'HIT' : 'MISS';
    const cacheSource = result.cacheSource || 'NONE';

    return new Response(JSON.stringify(result), {
      headers: {
        ...getCorsHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600', // 6h cache
        'X-Cache': cacheStatus,
        'X-Cache-Source': cacheSource,
        'X-Provider': result.provider || 'openlibrary'
      }
    });
  }

  // GET/POST /search/advanced - Advanced multi-field search
  // GET is primary (aligns with /search/title, /search/isbn, enables HTTP caching)
  // POST supported for backward compatibility
  if (url.pathname === '/search/advanced') {
    try {
      let bookTitle, authorName, maxResults;

      if (request.method === 'GET') {
        // Query parameters (iOS enrichment, documentation examples, REST standard)
        // Support both "title" and "bookTitle" for flexibility
        bookTitle = url.searchParams.get('title') || url.searchParams.get('bookTitle');
        authorName = url.searchParams.get('author') || url.searchParams.get('authorName');
        maxResults = parseInt(url.searchParams.get('maxResults') || '20', 10);

      } else if (request.method === 'POST') {
        // JSON body (legacy support for existing clients)
        const searchParams = await request.json();
        // Support both naming conventions: "title"/"bookTitle", "author"/"authorName"
        bookTitle = searchParams.title || searchParams.bookTitle;
        authorName = searchParams.author || searchParams.authorName;
        maxResults = searchParams.maxResults || 20;

      } else {
        // Only GET and POST allowed
        return new Response(JSON.stringify({
          error: 'Method not allowed',
          message: 'Use GET with query parameters or POST with JSON body'
        }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Allow': 'GET, POST'
          }
        });
      }

      // Validate that at least one search parameter is provided
      if (!bookTitle && !authorName) {
        return new Response(JSON.stringify({
          error: 'At least one search parameter required (title or author)'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Call handler (works with both GET and POST)
      const result = await handleAdvancedSearch(
        { bookTitle, authorName },
        { maxResults },
        env
      );

      return new Response(JSON.stringify(result), {
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json',
          // Add cache header for GET requests (like /search/title)
          ...(request.method === 'GET' && { 'Cache-Control': 'public, max-age=21600' }) // 6h cache
        }
      });

    } catch (error) {
      console.error('Advanced search failed:', error);
      return new Response(JSON.stringify({
        error: 'Advanced search failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not found', { status: 404 });
}
