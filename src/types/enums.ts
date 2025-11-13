/**
 * Canonical Enum Types
 *
 * These match Swift enums in BooksTrackerFeature exactly.
 * DO NOT modify without updating iOS Swift enums.
 */

export type EditionFormat =
  | 'Hardcover'
  | 'Paperback'
  | 'E-book'
  | 'Audiobook'
  | 'Mass Market';

export type AuthorGender =
  | 'Female'
  | 'Male'
  | 'Non-binary'
  | 'Other'
  | 'Unknown';

export type CulturalRegion =
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  | 'Middle East'
  | 'Caribbean'
  | 'Central Asia'
  | 'Indigenous'
  | 'International';

export type ReviewStatus =
  | 'verified'
  | 'needsReview'
  | 'userEdited';

/**
 * Provider identifiers for attribution
 */
export type DataProvider =
  | 'google-books'
  | 'openlibrary'
  | 'isbndb'
  | 'gemini';

/**
 * Error codes for structured error handling
 * 
 * Standard error codes used across all API endpoints for consistent error reporting.
 * Each code maps to a specific HTTP status code (see error-status.ts).
 * 
 * Categories:
 * - Authentication: UNAUTHORIZED, INVALID_TOKEN
 * - Validation: INVALID_*, MISSING_*
 * - Resources: NOT_FOUND
 * - Rate Limiting: RATE_LIMIT_EXCEEDED
 * - External Services: PROVIDER_ERROR, PROVIDER_TIMEOUT
 * - Internal: INTERNAL_ERROR
 */
export type ApiErrorCode =
  // Authentication & Authorization
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  
  // Request Validation
  | 'INVALID_REQUEST'
  | 'INVALID_ISBN'
  | 'INVALID_QUERY'
  | 'INVALID_PARAMETER'
  | 'MISSING_PARAMETER'
  
  // File/Content Validation
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'INVALID_CONTENT'
  
  // Batch/Array Validation
  | 'BATCH_TOO_LARGE'
  | 'EMPTY_BATCH'
  
  // Resource Errors
  | 'NOT_FOUND'
  | 'JOB_NOT_FOUND'
  
  // Rate Limiting
  | 'RATE_LIMIT_EXCEEDED'
  
  // External Provider Errors
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  
  // Processing Errors
  | 'PROCESSING_FAILED'
  | 'ENRICHMENT_FAILED'
  
  // Generic/Fallback
  | 'INTERNAL_ERROR';
