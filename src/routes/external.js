/**
 * External API Routes
 * Handles backward compatibility routes for external API providers
 * (Google Books, OpenLibrary, ISBNdb)
 */

import * as externalApis from '../services/external-apis.js';

/**
 * Handle external API routes (backward compatibility - temporary during migration)
 */
export async function handleExternalRoutes(request, url, env, ctx) {
  // Google Books search
  if (url.pathname === '/external/google-books') {
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const maxResults = parseInt(url.searchParams.get('maxResults') || '20');
    const result = await externalApis.searchGoogleBooks(query, { maxResults }, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Google Books ISBN search
  if (url.pathname === '/external/google-books-isbn') {
    const isbn = url.searchParams.get('isbn');
    if (!isbn) {
      return new Response(JSON.stringify({ error: 'Missing isbn parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await externalApis.searchGoogleBooksByISBN(isbn, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // OpenLibrary search
  if (url.pathname === '/external/openlibrary') {
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const maxResults = parseInt(url.searchParams.get('maxResults') || '20');
    const result = await externalApis.searchOpenLibrary(query, { maxResults }, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // OpenLibrary author works
  if (url.pathname === '/external/openlibrary-author') {
    const author = url.searchParams.get('author');
    if (!author) {
      return new Response(JSON.stringify({ error: 'Missing author parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await externalApis.getOpenLibraryAuthorWorks(author, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ISBNdb search
  if (url.pathname === '/external/isbndb') {
    const title = url.searchParams.get('title');
    if (!title) {
      return new Response(JSON.stringify({ error: 'Missing title parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const author = url.searchParams.get('author') || '';
    const result = await externalApis.searchISBNdb(title, author, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ISBNdb editions for work
  if (url.pathname === '/external/isbndb-editions') {
    const title = url.searchParams.get('title');
    const author = url.searchParams.get('author');

    if (!title || !author) {
      return new Response(JSON.stringify({ error: 'Missing title or author parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await externalApis.getISBNdbEditionsForWork(title, author, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ISBNdb book by ISBN
  if (url.pathname === '/external/isbndb-isbn') {
    const isbn = url.searchParams.get('isbn');
    if (!isbn) {
      return new Response(JSON.stringify({ error: 'Missing isbn parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await externalApis.getISBNdbBookByISBN(isbn, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Not found', { status: 404 });
}
