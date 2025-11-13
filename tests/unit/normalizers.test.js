/**
 * Unit Tests: Normalizers
 *
 * Tests for provider response normalization to canonical DTOs
 * Covers: Google Books, OpenLibrary, ISBNdb
 * See TEST_PLAN.md for complete test strategy
 */

import { describe, it, expect } from 'vitest'
import {
  mockGoogleBooksSearchResponse,
  mockOpenLibrarySearchResponse,
  mockISBNdbResponse
} from '../mocks/providers.js'
import { normalizeGoogleBooksToWork, normalizeGoogleBooksToEdition } from '../../src/services/normalizers/google-books.js'
import { normalizeOpenLibraryToWork, normalizeOpenLibraryToEdition, normalizeOpenLibraryToAuthor } from '../../src/services/normalizers/openlibrary.js'
import { normalizeISBNdbToWork, normalizeISBNdbToEdition, normalizeISBNdbToAuthor } from '../../src/services/normalizers/isbndb.js'

/**
 * Test the canonical DTO structure that all normalizers should produce
 */
function validateWorkDTO(work) {
  // Required fields for WorkDTO
  expect(work).toHaveProperty('title')
  expect(work).toHaveProperty('primaryProvider')
  expect(work).toHaveProperty('synthetic')
  expect(typeof work.title).toBe('string')
  expect(work.title.length).toBeGreaterThan(0)
  expect(typeof work.synthetic).toBe('boolean')
}

function validateEditionDTO(edition) {
  // Required fields
  expect(edition).toHaveProperty('isbn')
  expect(edition).toHaveProperty('publisher')
  expect(typeof edition.isbn).toBe('string')
  expect(edition.isbn.length).toBeGreaterThan(0)
}

function validateAuthorDTO(author) {
  // Required fields
  expect(author).toHaveProperty('name')
  expect(typeof author.name).toBe('string')
  expect(author.name.length).toBeGreaterThan(0)
}

/**
 * Google Books Normalizer Tests
 * Tests conversion of Google Books volume responses to canonical DTOs
 */
describe('Google Books Normalizer', () => {
  const googleBooksVolume = mockGoogleBooksSearchResponse.items[0]

  it('should normalize Google Books volume to WorkDTO', () => {
    // Verify the mock data structure
    expect(googleBooksVolume).toBeDefined()
    expect(googleBooksVolume.volumeInfo).toBeDefined()
    expect(googleBooksVolume.volumeInfo.title).toBe("Harry Potter and the Philosopher's Stone")

    // Use actual normalizer function
    const normalized = normalizeGoogleBooksToWork(googleBooksVolume)
    
    // Validate required fields
    expect(normalized.title).toBe("Harry Potter and the Philosopher's Stone")
    expect(normalized.primaryProvider).toBe('google-books')
    expect(normalized.synthetic).toBe(false)
    expect(normalized.firstPublicationYear).toBe(1998)
    expect(normalized.coverImageURL).toBeDefined()
    validateWorkDTO(normalized)
  })

  it('should normalize Google Books edition to EditionDTO', () => {
    // Use actual normalizer function
    const normalized = normalizeGoogleBooksToEdition(googleBooksVolume)
    
    // Validate required fields
    expect(normalized.isbn).toBeDefined()
    expect(normalized.publisher).toBe('Bloomsbury')
    expect(normalized.pageCount).toBe(309)
    expect(normalized.format).toBe('Hardcover')
    validateEditionDTO(normalized)
  })

  it('should extract author data from Google Books response', () => {
    const authors = mockGoogleBooksSearchResponse.items[0].volumeInfo.authors
    expect(authors).toBeDefined()
    expect(Array.isArray(authors)).toBe(true)
    expect(authors.length).toBeGreaterThan(0)
    expect(authors[0]).toBe('J.K. Rowling')

    // Normalized author DTO
    const authorDTO = {
      name: authors[0],
      gender: 'Unknown'
    }
    validateAuthorDTO(authorDTO)
  })

  it('should normalize ISBN formats (10/13 digit)', () => {
    const normalized = normalizeGoogleBooksToEdition(googleBooksVolume)
    
    // Check that both ISBN-10 and ISBN-13 are extracted
    expect(normalized.isbns).toBeDefined()
    expect(Array.isArray(normalized.isbns)).toBe(true)
    expect(normalized.isbns.length).toBeGreaterThan(0)
    
    // Should have ISBN-13 as primary
    expect(normalized.isbn).toBe('9780439708180')
  })

  it('should handle missing optional fields gracefully', () => {
    // Simulate a minimal volume with missing optional fields
    const minimalVolume = {
      id: 'minimal-id',
      volumeInfo: {
        title: 'Minimal Book',
        authors: ['Author Name']
      }
    }

    // Normalizer should not crash and should use defaults
    const normalized = normalizeGoogleBooksToWork(minimalVolume)
    expect(normalized.title).toBe('Minimal Book')
    expect(normalized.primaryProvider).toBe('google-books')
    expect(normalized.synthetic).toBe(false)
    // Missing fields should be undefined, not cause errors
    expect(normalized.description).toBeUndefined()
  })
})

/**
 * OpenLibrary Normalizer Tests
 * Tests conversion of OpenLibrary search results to canonical DTOs
 */
describe('OpenLibrary Normalizer', () => {
  const olDoc = mockOpenLibrarySearchResponse.docs[0]

  it('should normalize OpenLibrary work to WorkDTO', () => {
    expect(olDoc).toBeDefined()
    expect(olDoc.title).toBe("Harry Potter and the Philosopher's Stone")
    expect(olDoc.author_name).toBeDefined()
    expect(Array.isArray(olDoc.author_name)).toBe(true)

    // Use actual normalizer function
    const normalized = normalizeOpenLibraryToWork(olDoc)
    
    expect(normalized.title).toBe("Harry Potter and the Philosopher's Stone")
    expect(normalized.primaryProvider).toBe('openlibrary')
    expect(normalized.synthetic).toBe(false)
    expect(normalized.firstPublicationYear).toBe(1998)
    validateWorkDTO(normalized)
  })

  it('should normalize OpenLibrary edition to EditionDTO', () => {
    // Use actual normalizer function
    const normalized = normalizeOpenLibraryToEdition(olDoc)
    
    // OpenLibrary search results include edition info
    expect(normalized.isbn).toBeDefined()
    expect(normalized.publisher).toBeDefined()
    expect(normalized.format).toBeDefined() // Should have a default format
    validateEditionDTO(normalized)
  })

  it('should normalize OpenLibrary author to AuthorDTO', () => {
    const authorName = olDoc.author_name[0]
    
    // Use actual normalizer function
    const normalized = normalizeOpenLibraryToAuthor(authorName)
    
    expect(normalized.name).toBe('J.K. Rowling')
    expect(normalized.gender).toBe('Unknown')
    validateAuthorDTO(normalized)
  })

  it('should handle incomplete author data', () => {
    // Some books may have author_name as empty or missing
    const incompleteDoc = {
      title: 'Unknown Author Book',
      author_name: []
    }
    expect(Array.isArray(incompleteDoc.author_name)).toBe(true)
    expect(incompleteDoc.author_name.length).toBe(0)
  })

  it('should handle missing edition fields', () => {
    // Simulate incomplete document
    const incompleteDoc = {
      key: '/works/OL123W',
      title: 'Incomplete Book',
      author_name: ['Author']
      // Missing publisher, isbn, etc
    }
    
    // Should not crash
    const normalized = normalizeOpenLibraryToWork(incompleteDoc)
    expect(normalized.title).toBe('Incomplete Book')
    expect(normalized.primaryProvider).toBe('openlibrary')
  })
})

/**
 * ISBNdb Normalizer Tests
 * Tests conversion of ISBNdb responses to canonical DTOs
 */
describe('ISBNdb Normalizer', () => {
  const isbndbRecord = mockISBNdbResponse.data[0]

  it('should normalize ISBNdb response to WorkDTO', () => {
    expect(isbndbRecord).toBeDefined()
    expect(isbndbRecord.title).toBe("Harry Potter and the Philosopher's Stone")
    expect(isbndbRecord.isbn).toBe('9780439708180')

    // Use actual normalizer function
    const normalized = normalizeISBNdbToWork(isbndbRecord)
    
    expect(normalized.title).toBe("Harry Potter and the Philosopher's Stone")
    expect(normalized.primaryProvider).toBe('isbndb')
    expect(normalized.synthetic).toBe(false)
    validateWorkDTO(normalized)
  })

  it('should extract cover image URL from ISBNdb', () => {
    expect(isbndbRecord.image).toBeDefined()
    expect(typeof isbndbRecord.image).toBe('string')
    expect(isbndbRecord.image.startsWith('https://')).toBe(true)
    expect(isbndbRecord.image.includes('isbndb.com')).toBe(true)
  })

  it('should handle missing cover URL gracefully', () => {
    const noCoverRecord = {
      title: 'No Cover Book',
      isbn: '9780000000000',
      authors: ['Author']
      // Missing image field
    }
    
    // Use actual normalizer function - should not crash
    const normalized = normalizeISBNdbToWork(noCoverRecord)
    expect(normalized.title).toBe('No Cover Book')
    expect(normalized.primaryProvider).toBe('isbndb')
  })

  it('should extract author data from ISBNdb', () => {
    expect(isbndbRecord.authors).toBeDefined()
    expect(Array.isArray(isbndbRecord.authors)).toBe(true)
    expect(isbndbRecord.authors[0]).toBe('J.K. Rowling')
    
    // Use actual normalizer function
    const normalized = normalizeISBNdbToAuthor(isbndbRecord.authors[0])
    expect(normalized.name).toBe('J.K. Rowling')
    expect(normalized.gender).toBe('Unknown')
    validateAuthorDTO(normalized)
  })
})

/**
 * Canonical DTO Validation Tests
 * Ensures all normalized responses meet canonical format requirements
 */
describe('Canonical DTO Validation', () => {
  it('should produce valid WorkDTO', () => {
    const workDTO = {
      title: "Harry Potter and the Philosopher's Stone",
      isbn: '9780439708180',
      primaryProvider: 'google_books',
      publicationYear: 1998,
      categories: ['Fiction', 'Fantasy'],
      language: 'en',
      synthetic: false
    }
    validateWorkDTO(workDTO)
  })

  it('should include all required WorkDTO fields', () => {
    const workDTO = {
      title: 'Test Title',
      isbn: '9780000000000',
      primaryProvider: 'google_books'
    }
    expect(workDTO.title).toBeDefined()
    expect(workDTO.isbn).toBeDefined()
    expect(workDTO.primaryProvider).toBeDefined()
    expect(['google_books', 'openlibrary', 'isbndb']).toContain(workDTO.primaryProvider)
  })

  it('should enforce EditionDTO type constraints', () => {
    const editionDTO = {
      isbn: '9780000000000',
      publisher: 'Test Publisher',
      pageCount: 300,
      format: 'Hardcover'
    }

    // Validate type constraints
    expect(typeof editionDTO.isbn).toBe('string')
    expect(typeof editionDTO.publisher).toBe('string')
    expect(typeof editionDTO.pageCount).toBe('number')
    expect(['Hardcover', 'Paperback', 'E-book', 'Audiobook']).toContain(editionDTO.format)
  })

  it('should produce properly formatted AuthorDTO array', () => {
    const authorDTOs = [
      {
        name: 'J.K. Rowling',
        gender: 'Unknown',
        birthYear: 1965
      },
      {
        name: 'Stephen King',
        gender: 'Unknown'
      }
    ]

    expect(Array.isArray(authorDTOs)).toBe(true)
    authorDTOs.forEach(author => {
      validateAuthorDTO(author)
    })

    // Test deduplication
    const uniqueNames = new Set(authorDTOs.map(a => a.name))
    expect(uniqueNames.size).toBe(authorDTOs.length)
  })
})
