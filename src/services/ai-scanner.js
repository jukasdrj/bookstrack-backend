/**
 * Bookshelf AI Scanner Service
 * Migrated from bookshelf-ai-worker
 *
 * CRITICAL: Uses direct function calls instead of RPC to eliminate circular dependencies!
 */

import { handleAdvancedSearch } from '../handlers/search-handlers.js';

/**
 * Process bookshelf image scan with AI vision
 *
 * @param {string} jobId - Unique job identifier
 * @param {ArrayBuffer} imageData - Raw image data
 * @param {Object} env - Worker environment bindings
 * @param {Object} doStub - ProgressWebSocketDO stub for status updates
 */
export async function processBookshelfScan(jobId, imageData, env, doStub) {
  const startTime = Date.now();

  try {
    // Stage 1: Image quality analysis (10% progress)
    await doStub.pushProgress({
      progress: 0.1,
      processedItems: 0,
      totalItems: 3,
      currentStatus: 'Analyzing image quality...',
      jobId
    });

    // Stage 2: AI processing (30% → 70% progress)
    await doStub.pushProgress({
      progress: 0.3,
      processedItems: 1,
      totalItems: 3,
      currentStatus: 'Processing with AI...',
      jobId
    });

    // Call Gemini AI vision analysis
    const geminiResponse = await callGeminiVision(imageData, env);
    const detectedBooks = parseGeminiResponse(geminiResponse);

    await doStub.pushProgress({
      progress: 0.5,
      processedItems: 1,
      totalItems: 3,
      currentStatus: `Detected ${detectedBooks.length} books, enriching data...`,
      jobId,
      detectedBooks
    });

    // Stage 3: Enrichment (70% → 100% progress)
    // CRITICAL: Direct function call instead of RPC!
    const enrichedBooks = [];
    for (let i = 0; i < detectedBooks.length; i++) {
      const book = detectedBooks[i];

      try {
        // Direct function call - NO RPC, no circular dependency!
        const searchResults = await handleAdvancedSearch({
          bookTitle: book.title,
          authorName: book.author
        }, { maxResults: 1 }, env);

        enrichedBooks.push({
          ...book,
          enrichment: {
            status: searchResults.items?.length > 0 ? 'success' : 'not_found',
            apiData: searchResults.items?.[0] || null,
            provider: searchResults.provider || 'unknown',
            cachedResult: searchResults.cached || false
          }
        });

        const progress = 0.7 + (0.25 * (i + 1) / detectedBooks.length);
        await doStub.pushProgress({
          progress,
          processedItems: 2,
          totalItems: 3,
          currentStatus: `Enriched ${i + 1}/${detectedBooks.length} books`,
          jobId
        });

      } catch (error) {
        console.error(`[AI Scanner] Enrichment failed for "${book.title}":`, error);
        enrichedBooks.push({
          ...book,
          enrichment: {
            status: 'error',
            error: error.message
          }
        });
      }
    }

    // Separate high/low confidence results
    const threshold = parseFloat(env.CONFIDENCE_THRESHOLD || '0.6');
    const approved = enrichedBooks.filter(b => b.confidence >= threshold);
    const review = enrichedBooks.filter(b => b.confidence < threshold);

    const processingTime = Date.now() - startTime;

    // Stage 4: Complete (100%)
    await doStub.pushProgress({
      progress: 1.0,
      processedItems: 3,
      totalItems: 3,
      currentStatus: 'Scan complete',
      jobId,
      result: {
        totalDetected: detectedBooks.length,
        approved: approved.length,
        needsReview: review.length,
        books: enrichedBooks,
        metadata: {
          processingTime,
          enrichedCount: enrichedBooks.filter(b => b.enrichment?.status === 'success').length,
          timestamp: new Date().toISOString()
        }
      }
    });

    console.log(`[AI Scanner] Scan complete for job ${jobId}: ${detectedBooks.length} books, ${processingTime}ms`);

  } catch (error) {
    console.error(`[AI Scanner] Scan failed for job ${jobId}:`, error);

    // Push error to WebSocket
    await doStub.pushProgress({
      progress: 0,
      processedItems: 0,
      totalItems: 3,
      currentStatus: 'Scan failed',
      jobId,
      error: error.message
    });
  } finally {
    // Close WebSocket connection
    await doStub.closeConnection(1000, 'Scan complete');
  }
}

/**
 * Call Gemini AI vision API to analyze bookshelf image
 * @param {ArrayBuffer} imageData - Raw image data
 * @param {Object} env - Worker environment with GEMINI_API_KEY
 * @returns {Promise<Object>} Gemini API response
 */
async function callGeminiVision(imageData, env) {
  // Handle both secrets store (has .get() method) and direct env var
  const apiKey = env.GEMINI_API_KEY?.get
    ? await env.GEMINI_API_KEY.get()
    : env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Convert ArrayBuffer to base64
  const base64Image = arrayBufferToBase64(imageData);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze this bookshelf image and extract all visible book titles and authors. Return a JSON array with this exact format:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "confidence": 0.95,
    "boundingBox": {
      "x1": 0.1,
      "y1": 0.2,
      "x2": 0.3,
      "y2": 0.4
    }
  }
]

Guidelines:
- confidence: 0.0-1.0 (how certain you are about the text)
- boundingBox: normalized coordinates (0.0-1.0) for the book spine
- Only include books where you can read at least the title
- Skip decorative items, bookends, or non-book objects`
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,  // Low temperature for factual extraction
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Parse Gemini API response to extract book list
 * @param {Object} geminiData - Gemini API response
 * @returns {Array} Array of detected books with title, author, confidence, boundingBox
 */
function parseGeminiResponse(geminiData) {
  try {
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[AI Scanner] Gemini returned empty response');
      return [];
    }

    // Extract JSON from markdown code block if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const books = JSON.parse(jsonText);

    if (!Array.isArray(books)) {
      console.error('[AI Scanner] Gemini response is not an array');
      return [];
    }

    // Validate and normalize book data
    return books.map(book => ({
      title: book.title || '',
      author: book.author || '',
      confidence: Math.max(0, Math.min(1, parseFloat(book.confidence) || 0.5)),
      boundingBox: {
        x1: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.x1) || 0)),
        y1: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.y1) || 0)),
        x2: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.x2) || 1)),
        y2: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.y2) || 1))
      }
    })).filter(book => book.title.length > 0);

  } catch (error) {
    console.error('[AI Scanner] Failed to parse Gemini response:', error);
    console.error('[AI Scanner] Raw response:', geminiData);
    return [];
  }
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Raw binary data
 * @returns {string} Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
