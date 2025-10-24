/**
 * Batch Bookshelf Scan Handler
 * Handles multiple photos in one job with sequential processing
 */

import { scanImageWithGemini } from '../providers/gemini-provider.js';

const MAX_PHOTOS_PER_BATCH = 5;
const MAX_IMAGE_SIZE = 10_000_000; // 10MB per image

export async function handleBatchScan(request, env, ctx) {
  try {
    const { jobId, images } = await request.json();

    // Validation
    if (!jobId || !images || !Array.isArray(images)) {
      return new Response(JSON.stringify({
        error: 'Invalid request: jobId and images array required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (images.length === 0) {
      return new Response(JSON.stringify({
        error: 'At least one image required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (images.length > MAX_PHOTOS_PER_BATCH) {
      return new Response(JSON.stringify({
        error: `Batch size exceeds maximum ${MAX_PHOTOS_PER_BATCH} photos`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate R2 binding
    if (!env.BOOKSHELF_IMAGES) {
      console.error('R2 binding BOOKSHELF_IMAGES not configured');
      return new Response(JSON.stringify({
        error: 'Storage not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate image structure and size
    for (const img of images) {
      if (typeof img.index !== 'number' || !img.data) {
        return new Response(JSON.stringify({
          error: 'Each image must have index and data fields'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate base64 image size (4/3 of decoded size due to base64 encoding)
      const estimatedSize = (img.data.length * 3) / 4;
      if (estimatedSize > MAX_IMAGE_SIZE) {
        return new Response(JSON.stringify({
          error: `Image ${img.index} exceeds maximum size of ${MAX_IMAGE_SIZE / 1_000_000}MB`
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Initialize batch job in Durable Object
    const doId = env.PROGRESS_WEBSOCKET_DO.idFromName(jobId);
    const doStub = env.PROGRESS_WEBSOCKET_DO.get(doId);

    await doStub.fetch(`http://do/init-batch`, {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        totalPhotos: images.length,
        status: 'uploading'
      })
    });

    // Process batch asynchronously (don't await)
    ctx.waitUntil(processBatchPhotos(jobId, images, env, doStub));

    // Return accepted response immediately
    return new Response(JSON.stringify({
      jobId,
      totalPhotos: images.length,
      status: 'processing'
    }), {
      status: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Batch scan error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function processBatchPhotos(jobId, images, env, doStub) {
  const allBooks = [];
  const photoResults = [];

  try {
    // Phase 1: Upload all images to R2 in parallel
    const uploadPromises = images.map(async (img, idx) => {
      try {
        const imageBuffer = Buffer.from(img.data, 'base64');
        const r2Key = `bookshelf-scans/${jobId}/photo-${idx}.jpg`;

        await env.BOOKSHELF_IMAGES.put(r2Key, imageBuffer, {
          httpMetadata: { contentType: 'image/jpeg' }
        });

        return { index: idx, r2Key, success: true };
      } catch (error) {
        console.error(`Upload failed for photo ${idx}:`, error);
        return { index: idx, success: false, error: error.message };
      }
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Update progress after uploads
    await doStub.fetch(`http://do/update-batch`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'processing',
        uploads: uploadResults
      })
    });

    // Phase 2: Process images sequentially with Gemini
    for (let i = 0; i < uploadResults.length; i++) {
      const upload = uploadResults[i];

      if (!upload.success) {
        photoResults.push({
          index: i,
          status: 'error',
          error: upload.error
        });
        continue;
      }

      // Check if job canceled
      const isCanceled = await doStub.isBatchCanceled();
      if (isCanceled.canceled) {
        console.log(`Job ${jobId} canceled at photo ${i}, returning partial results`);

        // Return partial results from completed photos
        const partialBooks = deduplicateBooks(allBooks);

        await doStub.completeBatch({
          status: 'canceled',
          totalBooks: partialBooks.length,
          photoResults: photoResults.concat(
            // Mark remaining photos as skipped
            uploadResults.slice(i).map((upload, idx) => ({
              index: i + idx,
              status: 'skipped',
              booksFound: 0
            }))
          ),
          books: partialBooks
        });

        return; // Exit early with partial results
      }

      // Update progress: processing this photo
      await doStub.fetch(`http://do/update-photo`, {
        method: 'POST',
        body: JSON.stringify({
          photoIndex: i,
          status: 'processing'
        })
      });

      try {
        // Call Gemini provider directly (already imported at top)
        const r2Object = await env.BOOKSHELF_IMAGES.get(upload.r2Key);
        const imageBuffer = await r2Object.arrayBuffer();

        const result = await scanImageWithGemini(imageBuffer, env);

        photoResults.push({
          index: i,
          status: 'complete',
          booksFound: result.books.length
        });

        allBooks.push(...result.books);

        // Update progress: photo complete
        await doStub.fetch(`http://do/update-photo`, {
          method: 'POST',
          body: JSON.stringify({
            photoIndex: i,
            status: 'complete',
            booksFound: result.books.length
          })
        });

      } catch (error) {
        console.error(`Processing failed for photo ${i}:`, error);
        photoResults.push({
          index: i,
          status: 'error',
          error: error.message
        });

        // Update progress: photo error
        await doStub.fetch(`http://do/update-photo`, {
          method: 'POST',
          body: JSON.stringify({
            photoIndex: i,
            status: 'error',
            error: error.message
          })
        });
      }
    }

    // Phase 3: Deduplicate books by ISBN
    const uniqueBooks = deduplicateBooks(allBooks);

    // Send final completion
    await doStub.fetch(`http://do/complete-batch`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'complete',
        totalBooks: uniqueBooks.length,
        photoResults,
        books: uniqueBooks
      })
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    await doStub.fetch(`http://do/update-batch`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'error',
        error: error.message
      })
    });
  }
}

function deduplicateBooks(books) {
  const seen = new Map();

  for (const book of books) {
    // Use ISBN as primary key, fallback to title+author
    const key = book.isbn || `${book.title}::${book.author}`;

    if (!seen.has(key)) {
      seen.set(key, book);
    } else {
      // Keep book with higher confidence
      const existing = seen.get(key);
      if ((book.confidence || 0) > (existing.confidence || 0)) {
        seen.set(key, book);
      }
    }
  }

  return Array.from(seen.values());
}
