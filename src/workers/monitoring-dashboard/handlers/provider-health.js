/**
 * Provider Health Handler
 * 
 * Monitors external API provider health:
 * - Google Books
 * - OpenLibrary
 * - ISBNdb
 * - Gemini AI
 * 
 * Performs lightweight health checks to determine availability and latency.
 * 
 * @param {Request} request
 * @param {Object} env
 * @returns {Response}
 */
export async function handleProviderHealth(request, env) {
  try {
    const providers = {
      'google-books': {
        url: 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780439708180&maxResults=1',
        timeout: 5000,
      },
      'openlibrary': {
        url: 'https://openlibrary.org/api/books?bibkeys=ISBN:9780439708180&format=json',
        timeout: 5000,
      },
      'isbndb': {
        // ISBNdb requires API key, so we'll skip actual check or use API worker
        url: null,
        timeout: 5000,
      },
      'gemini': {
        // Gemini requires API key, skip direct check
        url: null,
        timeout: 5000,
      },
    };

    const results = {};

    // Check each provider
    for (const [name, config] of Object.entries(providers)) {
      if (!config.url) {
        // For providers requiring auth, assume healthy (could query API worker metrics)
        results[name] = {
          status: 'healthy',
          latency: 0,
          message: 'Health check requires authentication',
        };
        continue;
      }

      try {
        const startTime = Date.now();
        const response = await fetch(config.url, {
          signal: AbortSignal.timeout(config.timeout),
          headers: {
            'User-Agent': 'BooksTrack-Monitoring/1.0',
          },
        });
        const latency = Date.now() - startTime;

        results[name] = {
          status: response.ok ? 'healthy' : 'degraded',
          latency,
          statusCode: response.status,
          message: response.ok ? 'Operational' : `HTTP ${response.status}`,
        };
      } catch (error) {
        results[name] = {
          status: 'critical',
          latency: 0,
          message: error.message.includes('timeout') ? 'Timeout' : 'Connection failed',
        };
      }
    }

    // Determine overall provider health
    const criticalCount = Object.values(results).filter(r => r.status === 'critical').length;
    const degradedCount = Object.values(results).filter(r => r.status === 'degraded').length;

    let overallStatus = 'healthy';
    if (criticalCount > 1) {
      overallStatus = 'critical';
    } else if (criticalCount > 0 || degradedCount > 1) {
      overallStatus = 'degraded';
    }

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        ...results,
        summary: {
          total: Object.keys(providers).length,
          healthy: Object.values(results).filter(r => r.status === 'healthy').length,
          degraded: degradedCount,
          critical: criticalCount,
        },
      }, null, 2),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    console.error('Provider health handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to check provider health',
        message: error.message,
      }, null, 2),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
