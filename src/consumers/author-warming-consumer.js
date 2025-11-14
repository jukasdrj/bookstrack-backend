import { searchByTitle } from '../handlers/book-search.js';
import { searchByAuthor } from '../handlers/author-search.js';
import { generateCacheKey, setCached } from '../utils/cache.js';
import { enrichBooksParallel } from '../services/parallel-enrichment.js';

/**
 * Author Warming Consumer - Processes queued authors
 *
 * CRITICAL: This consumer MUST generate cache keys identical to search handlers
 * to ensure warmed cache entries are actually used by search endpoints.
 *
 * Cache key alignment (per 2025-10-29-cache-warming-fix.md):
 * - Title search: search:title:maxresults=20&title={normalizedTitle}
 * - Author search: auto-search:{queryB64}:{paramsB64}
 *
 * @param {Object} batch - Batch of queue messages
 * @param {Object} env - Worker environment bindings
 * @param {ExecutionContext} ctx - Execution context
 */
export async function processAuthorBatch(batch, env, ctx) {
  for (const message of batch.messages) {
    try {
      const { author, depth, source, jobId } = message.body;

      // 1. Check if already processed
      const processed = await env.CACHE.get(`warming:processed:author:${author.toLowerCase()}`);
      if (processed) {
        const data = JSON.parse(processed);
        if (depth <= data.depth) {
          console.log(`Skipping ${author}: already processed at depth ${data.depth}`);
          message.ack();
          continue;
        }
      }

      // 2. STEP 1: Warm author bibliography using searchByAuthor handler
      // This ensures we use the same cache key generation logic as the search endpoint
      const authorResult = await searchByAuthor(author, {
        limit: 100,
        offset: 0,
        sortBy: 'publicationYear'
      }, env, ctx);

      if (!authorResult.success || !authorResult.works || authorResult.works.length === 0) {
        console.warn(`No works found for ${author}, skipping`);
        message.ack();
        continue;
      }

      console.log(`Cached author "${author}": ${authorResult.works.length} works`);

      // 3. STEP 2: Extract titles and warm each one using searchByTitle handler
      // This ensures canonical DTO format and correct cache keys (with maxResults param)
      // Use parallel processing with concurrency limit (default: 5) to prevent API rate limiting
      let titlesWarmed = 0;
      await enrichBooksParallel(
        authorResult.works,
        async (work) => {
          // Use searchByTitle to get full orchestrated data (Google + OpenLibrary)
          // This will automatically cache with correct key: search:title:maxresults=20&title={normalized}
          await searchByTitle(work.title, { maxResults: 20 }, env, ctx);
          return work;
        },
        async (completed, total, title, hasError) => {
          if (!hasError) {
            titlesWarmed++;
          }
          // Progress logging for visibility
          console.log(`Warming cache: ${completed}/${total} titles (${title})`);
        },
        5 // Concurrency limit: 5 concurrent requests to prevent API throttling
      );

      console.log(`Warmed ${titlesWarmed} titles for author "${author}"`);

      // 4. Mark author as processed
      await env.CACHE.put(
        `warming:processed:author:${author.toLowerCase()}`,
        JSON.stringify({
          worksCount: authorResult.works.length,
          titlesWarmed: titlesWarmed,
          lastWarmed: Date.now(),
          depth: depth,
          jobId: jobId
        }),
        { expirationTtl: 90 * 24 * 60 * 60 } // 90 days
      );

      // 5. Analytics
      if (env.CACHE_ANALYTICS) {
        ctx.waitUntil(env.CACHE_ANALYTICS.writeDataPoint({
          blobs: ['warming', author, source],
          doubles: [authorResult.works.length, titlesWarmed],
          indexes: ['cache-warming']
        }));
      }

      message.ack();

    } catch (error) {
      console.error(`Failed to process author ${message.body.author}:`, error);

      // Retry on rate limits, fail otherwise
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        message.retry();
      } else {
        message.retry(); // Retry up to 3 times
      }
    }
  }
}
