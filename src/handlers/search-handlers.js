/**
 * Search handlers for book lookups
 * Extracted to eliminate RPC circular dependencies
 */

import * as externalApis from '../services/external-apis.js';

/**
 * Advanced search handler for multi-provider book search
 * Previously called via RPC from bookshelf-ai-worker
 *
 * @param {Object} searchParams - Search parameters
 * @param {string} searchParams.bookTitle - Book title to search
 * @param {string} searchParams.authorName - Author name to search
 * @param {Object} options - Search options
 * @param {number} options.maxResults - Maximum results to return (default: 1)
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Object>} Search results with items array (Google Books format)
 */
export async function handleAdvancedSearch(searchParams, options = {}, env) {
  const { bookTitle, authorName } = searchParams;
  const maxResults = options.maxResults || 1;

  console.log(`[AdvancedSearch] Searching for "${bookTitle}" by "${authorName}"`);

  try {
    // Try Google Books first (most reliable for enrichment)
    const query = [bookTitle, authorName].filter(Boolean).join(' ');

    const googleResult = await externalApis.searchGoogleBooks(query, { maxResults }, env);

    if (googleResult.success && googleResult.works && googleResult.works.length > 0) {
      // Convert normalized works back to Google Books volumeInfo format
      // This maintains compatibility with the existing enrichment code
      const items = googleResult.works.flatMap(work =>
        work.editions.map(edition => ({
          id: edition.googleBooksVolumeId || `synthetic-${edition.isbn13 || edition.isbn10}`,
          volumeInfo: {
            title: work.title,
            subtitle: work.subtitle,
            authors: work.authors.map(a => a.name),
            publishedDate: edition.publicationDate || edition.publishDate,
            publisher: edition.publisher,
            pageCount: edition.pageCount || edition.pages,
            categories: edition.genres || [],
            description: edition.description,
            imageLinks: edition.coverImageURL ? {
              thumbnail: edition.coverImageURL,
              smallThumbnail: edition.coverImageURL
            } : undefined,
            industryIdentifiers: [
              edition.isbn13 ? { type: 'ISBN_13', identifier: edition.isbn13 } : null,
              edition.isbn10 ? { type: 'ISBN_10', identifier: edition.isbn10 } : null
            ].filter(Boolean),
            previewLink: edition.previewLink,
            infoLink: edition.infoLink
          }
        }))
      );

      return {
        success: true,
        provider: 'google',
        items: items.slice(0, maxResults),
        cached: false
      };
    }

    // Fallback to OpenLibrary if Google Books fails
    console.log(`[AdvancedSearch] Google Books returned no results, trying OpenLibrary...`);

    const olResult = await externalApis.searchOpenLibrary(query, { maxResults }, env);

    if (olResult.success && olResult.works && olResult.works.length > 0) {
      // Convert OpenLibrary format to Google Books-compatible format
      const items = olResult.works.flatMap(work =>
        work.editions.map(edition => ({
          id: work.externalIds?.openLibraryWorkId || `ol-${work.title.replace(/\s+/g, '-').toLowerCase()}`,
          volumeInfo: {
            title: work.title,
            subtitle: work.subtitle,
            authors: work.authors.map(a => a.name),
            publishedDate: edition.publicationDate,
            publisher: edition.publisher,
            pageCount: edition.pageCount,
            categories: work.subjects?.slice(0, 5) || [],
            imageLinks: edition.coverImageURL ? {
              thumbnail: edition.coverImageURL,
              smallThumbnail: edition.coverImageURL
            } : undefined,
            industryIdentifiers: [
              edition.isbn13 ? { type: 'ISBN_13', identifier: edition.isbn13 } : null,
              edition.isbn10 ? { type: 'ISBN_10', identifier: edition.isbn10 } : null
            ].filter(Boolean)
          }
        }))
      );

      return {
        success: true,
        provider: 'openlibrary',
        items: items.slice(0, maxResults),
        cached: false
      };
    }

    // No results from any provider
    return {
      success: true,
      provider: 'none',
      items: [],
      cached: false
    };

  } catch (error) {
    console.error(`[AdvancedSearch] Error searching for "${bookTitle}":`, error);
    return {
      success: false,
      error: error.message,
      items: []
    };
  }
}
