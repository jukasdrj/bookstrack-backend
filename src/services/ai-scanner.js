/**
 * Bookshelf AI Scanner Service
 * Migrated from bookshelf-ai-worker
 *
 * CRITICAL: Uses direct function calls instead of RPC to eliminate circular dependencies!
 */

import { handleAdvancedSearch } from '../handlers/search-handlers.js';
import { scanImageWithGemini } from '../providers/gemini-provider.js';
import { scanImageWithCloudflare } from '../providers/cloudflare-provider.js';

/**
 * Process bookshelf image scan with AI vision
 *
 * @param {string} jobId - Unique job identifier
 * @param {ArrayBuffer} imageData - Raw image data
 * @param {Request} request - Request object with X-AI-Provider header
 * @param {Object} env - Worker environment bindings
 * @param {Object} doStub - ProgressWebSocketDO stub for status updates
 */
export async function processBookshelfScan(jobId, imageData, request, env, doStub) {
  const startTime = Date.now();

  try {
    console.log(`[AI Scanner] Starting scan for job ${jobId}, image size: ${imageData.byteLength} bytes`);

    // Stage 1: Image quality analysis (10% progress)
    await doStub.pushProgress({
      progress: 0.1,
      processedItems: 0,
      totalItems: 3,
      currentStatus: 'Analyzing image quality...',
      jobId
    });
    console.log(`[AI Scanner] Progress pushed: 10% (image quality analysis)`);

    // Stage 2: Provider selection and AI processing
    await doStub.pushProgress({
      progress: 0.3,
      processedItems: 1,
      totalItems: 3,
      currentStatus: 'Processing with AI...',
      jobId
    });

    // Parse provider from query parameter (format: "cf-llava-1.5-7b")
    const url = new URL(request.url);
    const providerParam = url.searchParams.get('provider') || 'gemini-flash';

    console.log(`[AI Scanner] Job ${jobId} - Provider parameter: ${providerParam}`);

    // Map provider parameter to model identifier
    let scanResult;
    let modelIdentifier;

    try {
      switch (providerParam) {
        case 'cf-llava-1.5-7b':
          console.log('[AI Scanner] Using Cloudflare LLaVA 1.5');
          modelIdentifier = '@cf/llava-hf/llava-1.5-7b-hf';
          scanResult = await scanImageWithCloudflare(imageData, env, modelIdentifier);
          break;

        case 'cf-uform-gen2-qwen-500m':
          console.log('[AI Scanner] Using Cloudflare UForm Gen2 Qwen');
          modelIdentifier = '@cf/unum/uform-gen2-qwen-500m';
          scanResult = await scanImageWithCloudflare(imageData, env, modelIdentifier);
          break;

        case 'cf-llama-3.2-11b-vision':
          console.log('[AI Scanner] Using Cloudflare Llama 3.2 Vision');
          modelIdentifier = '@cf/meta/llama-3.2-11b-vision-instruct';
          scanResult = await scanImageWithCloudflare(imageData, env, modelIdentifier);
          break;

        case 'gemini-flash':
        default:
          console.log('[AI Scanner] Using Gemini 2.0 Flash (default)');
          // Default to Gemini for backward compatibility
          scanResult = await scanImageWithGemini(imageData, env);
          break;
      }
      console.log('[AI Scanner] AI processing complete');
    } catch (aiError) {
      console.error('[AI Scanner] AI processing failed:', aiError.message);
      throw aiError;
    }

    const detectedBooks = scanResult.books;
    const suggestions = scanResult.suggestions || [];

    console.log(`[AI Scanner] ${detectedBooks.length} books detected via ${providerParam} (${scanResult.metadata.processingTimeMs}ms)`);

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
          timestamp: new Date().toISOString(),
          modelUsed: providerParam  // Include model in metadata
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
