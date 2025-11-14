// src/services/cache-key-factory.js
export class CacheKeyFactory {
  /**
   * Generate cache key for author search
   * @param {Object} params - Search parameters
   * @returns {string} Cache key
   */
  static authorSearch(params) {
    const { query, filters = {}, sortBy = 'relevance' } = params
    const normalizedQuery = query.toLowerCase().trim()
    const filterString = JSON.stringify(filters)
    return `author:search:${normalizedQuery}:${filterString}:${sortBy}`
  }

  /**
   * Generate cache key for ISBN book search
   * @param {string} isbn - ISBN-10 or ISBN-13
   * @returns {string} Cache key
   */
  static bookISBN(isbn) {
    const normalizedISBN = isbn.replace(/-/g, '')
    return `book:isbn:${normalizedISBN}`
  }

  /**
   * Generate cache key for title search
   * @param {string} title - Book title
   * @returns {string} Cache key
   */
  static bookTitle(title) {
    const normalizedTitle = title.toLowerCase().trim()
    return `book:title:${normalizedTitle}`
  }

  /**
   * Generate cache key for cover images
   * @param {string} isbn - ISBN identifier
   * @returns {string} Cache key
   */
  static coverImage(isbn) {
    return `cover:${isbn.replace(/-/g, '')}`
  }
}
