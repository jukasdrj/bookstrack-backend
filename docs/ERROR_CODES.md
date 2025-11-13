# API Error Codes Documentation

This document describes all standardized error codes used across the BooksTrack API.

## Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "optional": "additional context"
    }
  },
  "meta": {
    "timestamp": "2025-11-13T23:46:10.432Z"
  }
}
```

## HTTP Status Code Mapping

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication credentials |
| `INVALID_TOKEN` | 401 | Authentication token is invalid or malformed |
| `TOKEN_EXPIRED` | 401 | Authentication token has expired |
| `INVALID_REQUEST` | 400 | Request is malformed or invalid |
| `INVALID_ISBN` | 400 | ISBN format is invalid |
| `INVALID_QUERY` | 400 | Search query is invalid or empty |
| `INVALID_PARAMETER` | 400 | One or more parameters have invalid values |
| `MISSING_PARAMETER` | 400 | Required parameter is missing |
| `FILE_TOO_LARGE` | 413 | Uploaded file exceeds maximum size |
| `INVALID_FILE_TYPE` | 400 | File type is not supported |
| `INVALID_CONTENT` | 400 | Request content is invalid |
| `BATCH_TOO_LARGE` | 400 | Batch operation exceeds maximum size |
| `EMPTY_BATCH` | 400 | Batch array is empty when items required |
| `NOT_FOUND` | 404 | Requested resource was not found |
| `JOB_NOT_FOUND` | 404 | Job ID not found or state not initialized |
| `RATE_LIMIT_EXCEEDED` | 503 | Too many requests, retry later |
| `PROVIDER_ERROR` | 502/503 | External data provider error (varies by condition) |
| `PROVIDER_TIMEOUT` | 503 | External provider request timed out |
| `PROVIDER_UNAVAILABLE` | 503 | External provider is temporarily unavailable |
| `PROCESSING_FAILED` | 500 | Server-side processing operation failed |
| `ENRICHMENT_FAILED` | 500 | Book enrichment operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected internal server error |

## Error Code Categories

### Authentication & Authorization (401)

Errors related to user authentication and authorization.

#### `UNAUTHORIZED`
- **Status**: 401 Unauthorized
- **When**: Missing authentication credentials or invalid authentication
- **Example**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization token"
  },
  "meta": { "timestamp": "2025-11-13T23:46:10.432Z" }
}
```

#### `INVALID_TOKEN`
- **Status**: 401 Unauthorized
- **When**: Authentication token is present but invalid or malformed
- **Details**: May include token validation failure reason

#### `TOKEN_EXPIRED`
- **Status**: 401 Unauthorized
- **When**: Authentication token has passed its expiration time
- **Details**: May include expiration timestamp

### Request Validation (400)

Errors related to invalid or malformed client requests.

#### `INVALID_REQUEST`
- **Status**: 400 Bad Request
- **When**: Request structure or format is invalid
- **Example**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request: jobId and workIds (array) required",
    "details": { "received": { "jobId": null } }
  },
  "meta": { "timestamp": "2025-11-13T23:46:10.432Z" }
}
```

#### `INVALID_ISBN`
- **Status**: 400 Bad Request
- **When**: ISBN format doesn't match ISBN-10 or ISBN-13 pattern
- **Details**: Includes the invalid ISBN value

#### `INVALID_QUERY`
- **Status**: 400 Bad Request
- **When**: Search query is empty, too short, or contains invalid characters
- **Details**: Includes the invalid query

#### `INVALID_PARAMETER`
- **Status**: 400 Bad Request
- **When**: A parameter value doesn't meet validation requirements
- **Details**: Includes parameter name, invalid value, and validation rule

#### `MISSING_PARAMETER`
- **Status**: 400 Bad Request
- **When**: A required parameter is missing from the request
- **Details**: Includes the name of the missing parameter

### File & Content Validation (400/413)

Errors related to file uploads and content validation.

#### `FILE_TOO_LARGE`
- **Status**: 413 Payload Too Large
- **When**: Uploaded file exceeds maximum allowed size
- **Details**: Includes max size and actual size
- **Example**:
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File too large (max 10MB)",
    "details": { "maxSize": 10485760, "actualSize": 15000000 }
  },
  "meta": { "timestamp": "2025-11-13T23:46:10.432Z" }
}
```

#### `INVALID_FILE_TYPE`
- **Status**: 400 Bad Request
- **When**: File type is not in the list of accepted types
- **Details**: Includes file type and list of accepted types

#### `INVALID_CONTENT`
- **Status**: 400 Bad Request
- **When**: Request body content is malformed or doesn't match expected format
- **Details**: Includes content validation error

### Batch Operations (400)

Errors specific to batch processing operations.

#### `BATCH_TOO_LARGE`
- **Status**: 400 Bad Request
- **When**: Batch array exceeds maximum allowed size
- **Details**: Includes max size and actual size

#### `EMPTY_BATCH`
- **Status**: 400 Bad Request
- **When**: Batch array is empty when at least one item is required
- **Details**: Includes field name

### Resource Errors (404)

Errors related to resource availability.

#### `NOT_FOUND`
- **Status**: 404 Not Found
- **When**: Requested resource doesn't exist
- **Details**: May include resource type and identifier

#### `JOB_NOT_FOUND`
- **Status**: 404 Not Found
- **When**: Job ID doesn't exist or job state hasn't been initialized
- **Details**: Includes job ID

### Rate Limiting (503)

Errors related to rate limiting and throttling.

#### `RATE_LIMIT_EXCEEDED`
- **Status**: 503 Service Unavailable
- **When**: Client has exceeded their rate limit
- **Headers**: `Retry-After` (seconds until retry allowed)
- **Details**: May include retry time
- **Example**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": { "retryAfter": 60 }
  },
  "meta": { "timestamp": "2025-11-13T23:46:10.432Z" }
}
```

### External Provider Errors (502/503)

Errors from external data providers (Google Books, OpenLibrary, ISBNdb, etc.)

#### `PROVIDER_ERROR`
- **Status**: 502 Bad Gateway or 503 Service Unavailable
- **When**: External provider returned an error
- **Details**: Includes provider name and error details
- **Note**: Status code is determined automatically based on error type:
  - 503 for timeouts, rate limits, or unavailability
  - 502 for other upstream errors

#### `PROVIDER_TIMEOUT`
- **Status**: 503 Service Unavailable
- **When**: Request to external provider timed out
- **Details**: Includes provider name and timeout duration

#### `PROVIDER_UNAVAILABLE`
- **Status**: 503 Service Unavailable
- **When**: External provider is temporarily down or unreachable
- **Details**: Includes provider name

### Processing Errors (500)

Errors during server-side processing operations.

#### `PROCESSING_FAILED`
- **Status**: 500 Internal Server Error
- **When**: A processing operation failed unexpectedly
- **Details**: Includes operation name and error message

#### `ENRICHMENT_FAILED`
- **Status**: 500 Internal Server Error
- **When**: Book enrichment process failed
- **Details**: Includes book identifier and error details

#### `INTERNAL_ERROR`
- **Status**: 500 Internal Server Error
- **When**: Unexpected server error occurred
- **Details**: May include error message (sanitized for security)

## Usage Examples

### Using the Error Response Builder

```typescript
import { createStandardErrorResponse, ErrorResponses } from '../utils/error-responses.js';

// Method 1: Direct function call
return createStandardErrorResponse(
  'Invalid ISBN format',
  'INVALID_ISBN',
  { provided: isbn }
);

// Method 2: Using helper shortcuts
return ErrorResponses.invalidRequest('Invalid request structure');
return ErrorResponses.missingParameter('jobId');
return ErrorResponses.unauthorized();
return ErrorResponses.notFound('Book');
return ErrorResponses.fileTooLarge(10, 15);
```

### Error Response Object Structure

All errors include:
- `success`: Always `false` for errors
- `error.code`: Standardized error code from this document
- `error.message`: Human-readable error description
- `error.details`: Optional additional context (object)
- `meta.timestamp`: ISO 8601 timestamp of when error occurred

### Client-Side Error Handling

```typescript
// TypeScript client example
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
  };
}

async function handleApiError(response: Response) {
  const error: ApiError = await response.json();
  
  switch (error.error.code) {
    case 'UNAUTHORIZED':
      // Redirect to login
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Show retry message
      const retryAfter = error.error.details?.retryAfter || 60;
      console.log(`Please retry after ${retryAfter} seconds`);
      break;
    case 'INVALID_ISBN':
      // Show validation error
      console.error(`Invalid ISBN: ${error.error.details?.provided}`);
      break;
    default:
      // Generic error handling
      console.error(error.error.message);
  }
}
```

## Migration Guide

For developers updating existing endpoints:

1. **Import the utilities**:
```typescript
import { createStandardErrorResponse, ErrorResponses } from '../utils/error-responses.js';
```

2. **Replace old error responses**:

Before:
```typescript
return new Response(JSON.stringify({ error: 'Invalid request' }), { 
  status: 400 
});
```

After:
```typescript
return ErrorResponses.invalidRequest('Invalid request');
```

3. **Use appropriate error codes**:
- Authentication issues → `UNAUTHORIZED`, `INVALID_TOKEN`
- Missing parameters → `MISSING_PARAMETER`
- Invalid input → `INVALID_REQUEST`, `INVALID_PARAMETER`
- Not found → `NOT_FOUND`, `JOB_NOT_FOUND`
- File issues → `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`
- Internal errors → `INTERNAL_ERROR`, `PROCESSING_FAILED`

## Related Documentation

- [Error Status Mapping](../src/utils/error-status.ts) - HTTP status code logic
- [Error Response Types](../src/types/responses.ts) - TypeScript type definitions
- [Error Response Builders](../src/utils/error-responses.ts) - Utility functions
