// tests/unit/cache-key-factory.test.js
import { describe, it, expect } from 'vitest';
import { CacheKeyFactory } from '../../src/services/cache-key-factory.js';

describe('CacheKeyFactory', () => {
  describe('authorSearch', () => {
    it('should generate a consistent key for the same parameters', () => {
      const params = { query: 'Tolkien', filters: { lang: 'eng' }, sortBy: 'relevance' };
      const key1 = CacheKeyFactory.authorSearch(params);
      const key2 = CacheKeyFactory.authorSearch(params);
      expect(key1).toBe(key2);
      expect(key1).toBe('author:search:tolkien:{"lang":"eng"}:relevance');
    });

    it('should handle queries with different cases and spacing', () => {
      const params1 = { query: '  Tolkien  ' };
      const params2 = { query: 'tolkien' };
      const key1 = CacheKeyFactory.authorSearch(params1);
      const key2 = CacheKeyFactory.authorSearch(params2);
      expect(key1).toBe(key2);
    });

    it('should handle default parameters', () => {
      const params = { query: 'Asimov' };
      const key = CacheKeyFactory.authorSearch(params);
      expect(key).toBe('author:search:asimov:{}:relevance');
    });
  });

  describe('bookISBN', () => {
    it('should generate a consistent key for an ISBN', () => {
      const isbn = '978-0-345-39180-3';
      const key1 = CacheKeyFactory.bookISBN(isbn);
      const key2 = CacheKeyFactory.bookISBN(isbn);
      expect(key1).toBe(key2);
      expect(key1).toBe('book:isbn:9780345391803');
    });

    it('should remove hyphens from the ISBN', () => {
      const isbn = '0-345-39180-2';
      const key = CacheKeyFactory.bookISBN(isbn);
      expect(key).toBe('book:isbn:0345391802');
    });
  });

  describe('bookTitle', () => {
    it('should generate a consistent key for a title', () => {
      const title = 'The Hobbit';
      const key1 = CacheKeyFactory.bookTitle(title);
      const key2 = CacheKeyFactory.bookTitle(title);
      expect(key1).toBe(key2);
      expect(key1).toBe('book:title:the hobbit');
    });

    it('should handle titles with different cases and spacing', () => {
      const title1 = '  The Lord of the Rings  ';
      const title2 = 'the lord of the rings';
      const key1 = CacheKeyFactory.bookTitle(title1);
      const key2 = CacheKeyFactory.bookTitle(title2);
      expect(key1).toBe(key2);
    });
  });

  describe('coverImage', () => {
    it('should generate a consistent key for a cover image', () => {
      const isbn = '978-0-345-39180-3';
      const key1 = CacheKeyFactory.coverImage(isbn);
      const key2 = CacheKeyFactory.coverImage(isbn);
      expect(key1).toBe(key2);
      expect(key1).toBe('cover:9780345391803');
    });

    it('should remove hyphens from the ISBN', () => {
      const isbn = '0-345-39180-2';
      const key = CacheKeyFactory.coverImage(isbn);
      expect(key).toBe('cover:0345391802');
    });
  });
});
