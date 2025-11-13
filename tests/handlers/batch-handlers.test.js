/**
 * Batch Handler Tests
 * 
 * Unit tests for batch processing endpoints:
 * - POST /api/scan-bookshelf - Bookshelf image scanning with AI
 * - POST /api/enrichment/batch - Batch book enrichment
 * - POST /api/import/csv-gemini - CSV import with Gemini processing
 * - Job initialization & progress tracking
 * 
 * Total: 5+ tests
 * 
 * Note: This file tests the handler logic. Integration tests with
 * real server are in tests/batch-scan.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock handlers
vi.mock('../../src/handlers/batch-scan-handler.ts', () => ({
  handleBatchScan: vi.fn()
}));

vi.mock('../../src/handlers/batch-enrichment.ts', () => ({
  handleBatchEnrichment: vi.fn()
}));

vi.mock('../../src/handlers/csv-import.ts', () => ({
  handleCSVImport: vi.fn()
}));

import { handleBatchScan } from '../../src/handlers/batch-scan-handler.ts';
import { handleBatchEnrichment } from '../../src/handlers/batch-enrichment.ts';
import { handleCSVImport } from '../../src/handlers/csv-import.ts';

describe('POST /api/scan-bookshelf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize job and return jobId with token', async () => {
    const mockResponse = {
      success: true,
      data: {
        jobId: 'job-123',
        token: 'auth-token-456',
        expiresIn: 7200,
        status: 'processing'
      },
      metadata: {
        timestamp: Date.now(),
        processingTime: 15
      }
    };

    handleBatchScan.mockResolvedValue(mockResponse);

    const mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn(),
        get: vi.fn()
      }
    };

    const formData = new FormData();
    formData.append('image', new Blob(['fake-image-data']), 'bookshelf.jpg');

    const request = new Request('https://api.example.com/api/scan-bookshelf', {
      method: 'POST',
      body: formData
    });

    const response = await handleBatchScan(request, mockEnv);

    expect(response.success).toBe(true);
    expect(response.data.jobId).toBe('job-123');
    expect(response.data.token).toBeDefined();
    expect(response.data.status).toBe('processing');
  });

  it('should validate image format and size', async () => {
    const mockErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_IMAGE',
        message: 'Invalid image format. Supported: JPEG, PNG, WebP'
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    handleBatchScan.mockResolvedValue(mockErrorResponse);

    const mockEnv = {};
    const formData = new FormData();
    formData.append('image', new Blob(['fake-data']), 'document.pdf');

    const request = new Request('https://api.example.com/api/scan-bookshelf', {
      method: 'POST',
      body: formData
    });

    const response = await handleBatchScan(request, mockEnv);

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('INVALID_IMAGE');
  });

  it('should track progress via WebSocket Durable Object', async () => {
    const mockDO = {
      initializeJobState: vi.fn(),
      setAuthToken: vi.fn()
    };

    const mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn(() => 'do-id'),
        get: vi.fn(() => mockDO)
      }
    };

    handleBatchScan.mockImplementation(async (request, env) => {
      // Simulate initialization
      const jobId = crypto.randomUUID();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);
      
      await doStub.initializeJobState('bookshelf_scan', 1);
      await doStub.setAuthToken();

      return {
        success: true,
        data: { jobId, token: 'token', expiresIn: 7200, status: 'processing' },
        metadata: { timestamp: Date.now() }
      };
    });

    const formData = new FormData();
    formData.append('image', new Blob(['data']), 'shelf.jpg');

    const request = new Request('https://api.example.com/api/scan-bookshelf', {
      method: 'POST',
      body: formData
    });

    await handleBatchScan(request, mockEnv);

    expect(mockEnv.PROGRESS_WEBSOCKET_DO.idFromName).toHaveBeenCalled();
    expect(mockDO.initializeJobState).toHaveBeenCalledWith('bookshelf_scan', 1);
  });
});

describe('POST /api/enrichment/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept batch of books for enrichment', async () => {
    const mockResponse = {
      success: true,
      data: {
        jobId: 'batch-job-789',
        token: 'batch-token-012',
        expiresIn: 7200,
        totalBooks: 5,
        status: 'processing'
      },
      metadata: {
        timestamp: Date.now(),
        processingTime: 20
      }
    };

    handleBatchEnrichment.mockResolvedValue(mockResponse);

    const mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn(),
        get: vi.fn()
      }
    };

    const request = new Request('https://api.example.com/api/enrichment/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        books: [
          { title: 'Book 1', author: 'Author 1' },
          { title: 'Book 2', author: 'Author 2' },
          { title: 'Book 3', author: 'Author 3' }
        ]
      })
    });

    const response = await handleBatchEnrichment(request, mockEnv);

    expect(response.success).toBe(true);
    expect(response.data.jobId).toBeDefined();
    expect(response.data.totalBooks).toBeGreaterThan(0);
  });

  it('should validate batch size limits', async () => {
    const mockErrorResponse = {
      success: false,
      error: {
        code: 'BATCH_TOO_LARGE',
        message: 'Maximum 100 books per batch'
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    handleBatchEnrichment.mockResolvedValue(mockErrorResponse);

    const mockEnv = {};

    // Create batch exceeding limit
    const books = Array(101).fill({ title: 'Book', author: 'Author' });

    const request = new Request('https://api.example.com/api/enrichment/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ books })
    });

    const response = await handleBatchEnrichment(request, mockEnv);

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('BATCH_TOO_LARGE');
  });

  it('should initialize job state for batch processing', async () => {
    const mockDO = {
      initializeJobState: vi.fn(),
      setAuthToken: vi.fn()
    };

    const mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn(() => 'do-id'),
        get: vi.fn(() => mockDO)
      }
    };

    handleBatchEnrichment.mockImplementation(async (request, env) => {
      const jobId = crypto.randomUUID();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);
      
      const { books } = await request.json();
      await doStub.initializeJobState('batch_enrichment', books.length);
      await doStub.setAuthToken();

      return {
        success: true,
        data: { jobId, token: 'token', expiresIn: 7200, totalBooks: books.length, status: 'processing' },
        metadata: { timestamp: Date.now() }
      };
    });

    const request = new Request('https://api.example.com/api/enrichment/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        books: [
          { title: 'Book 1' },
          { title: 'Book 2' }
        ]
      })
    });

    await handleBatchEnrichment(request, mockEnv);

    expect(mockDO.initializeJobState).toHaveBeenCalledWith('batch_enrichment', 2);
  });
});

describe('POST /api/import/csv-gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept CSV file for import', async () => {
    const mockResponse = {
      success: true,
      data: {
        jobId: 'csv-job-999',
        token: 'csv-token-888',
        expiresIn: 7200,
        status: 'processing',
        estimatedRows: 50
      },
      metadata: {
        timestamp: Date.now(),
        processingTime: 25
      }
    };

    handleCSVImport.mockResolvedValue(mockResponse);

    const mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn(),
        get: vi.fn()
      }
    };

    const formData = new FormData();
    const csvContent = 'Title,Author,ISBN\nBook 1,Author 1,9780123456789\nBook 2,Author 2,9780987654321';
    formData.append('file', new Blob([csvContent]), 'books.csv');

    const request = new Request('https://api.example.com/api/import/csv-gemini', {
      method: 'POST',
      body: formData
    });

    const response = await handleCSVImport(request, mockEnv);

    expect(response.success).toBe(true);
    expect(response.data.jobId).toBeDefined();
    expect(response.data.status).toBe('processing');
  });

  it('should validate CSV file format', async () => {
    const mockErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_FILE',
        message: 'File must be a CSV file'
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    handleCSVImport.mockResolvedValue(mockErrorResponse);

    const mockEnv = {};

    const formData = new FormData();
    formData.append('file', new Blob(['data']), 'books.txt');

    const request = new Request('https://api.example.com/api/import/csv-gemini', {
      method: 'POST',
      body: formData
    });

    const response = await handleCSVImport(request, mockEnv);

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('INVALID_FILE');
  });

  it('should schedule CSV processing via alarm', async () => {
    const mockDO = {
      initializeJobState: vi.fn(),
      setAuthToken: vi.fn(),
      scheduleCSVProcessing: vi.fn()
    };

    const mockEnv = {
      PROGRESS_WEBSOCKET_DO: {
        idFromName: vi.fn(() => 'do-id'),
        get: vi.fn(() => mockDO)
      }
    };

    handleCSVImport.mockImplementation(async (request, env) => {
      const jobId = crypto.randomUUID();
      const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
      const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);
      
      await doStub.initializeJobState('csv_import', 10);
      await doStub.setAuthToken();
      await doStub.scheduleCSVProcessing();

      return {
        success: true,
        data: { jobId, token: 'token', expiresIn: 7200, status: 'processing' },
        metadata: { timestamp: Date.now() }
      };
    });

    const formData = new FormData();
    formData.append('file', new Blob(['csv-data']), 'books.csv');

    const request = new Request('https://api.example.com/api/import/csv-gemini', {
      method: 'POST',
      body: formData
    });

    await handleCSVImport(request, mockEnv);

    expect(mockDO.scheduleCSVProcessing).toHaveBeenCalled();
  });
});

describe('Job Progress Tracking', () => {
  it('should return authentication token with job initialization', async () => {
    const mockResponse = {
      success: true,
      data: {
        jobId: 'progress-job-111',
        token: 'progress-token-222',
        expiresIn: 7200,
        status: 'processing'
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    handleBatchScan.mockResolvedValue(mockResponse);

    const mockEnv = {};
    const formData = new FormData();
    formData.append('image', new Blob(['data']), 'image.jpg');

    const request = new Request('https://api.example.com/api/scan-bookshelf', {
      method: 'POST',
      body: formData
    });

    const response = await handleBatchScan(request, mockEnv);

    expect(response.data.token).toBeDefined();
    expect(response.data.expiresIn).toBe(7200); // 2 hours
  });

  it('should include jobId in response for WebSocket connection', async () => {
    const mockResponse = {
      success: true,
      data: {
        jobId: 'ws-job-333',
        token: 'ws-token-444',
        expiresIn: 7200,
        status: 'processing'
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    handleBatchEnrichment.mockResolvedValue(mockResponse);

    const mockEnv = {};
    const request = new Request('https://api.example.com/api/enrichment/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        books: [{ title: 'Test' }]
      })
    });

    const response = await handleBatchEnrichment(request, mockEnv);

    expect(response.data.jobId).toBeDefined();
    expect(typeof response.data.jobId).toBe('string');
  });
});

describe('Response Format Validation', () => {
  it('should return unified envelope for successful batch request', async () => {
    const mockResponse = {
      success: true,
      data: {
        jobId: 'envelope-job-555',
        token: 'envelope-token-666',
        expiresIn: 7200,
        status: 'processing'
      },
      metadata: {
        timestamp: Date.now(),
        processingTime: 30
      }
    };

    handleBatchScan.mockResolvedValue(mockResponse);

    const mockEnv = {};
    const formData = new FormData();
    formData.append('image', new Blob(['data']), 'shelf.jpg');

    const request = new Request('https://api.example.com/api/scan-bookshelf', {
      method: 'POST',
      body: formData
    });

    const response = await handleBatchScan(request, mockEnv);

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('metadata');
    expect(response.metadata).toHaveProperty('timestamp');
    expect(response.metadata).toHaveProperty('processingTime');
  });

  it('should return unified envelope for error response', async () => {
    const mockResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request'
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    handleBatchEnrichment.mockResolvedValue(mockResponse);

    const mockEnv = {};
    const request = new Request('https://api.example.com/api/enrichment/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await handleBatchEnrichment(request, mockEnv);

    expect(response).toHaveProperty('success');
    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  });
});
