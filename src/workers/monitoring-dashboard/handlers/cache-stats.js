/**
 * Cache Stats Handler
 * 
 * Provides detailed cache performance metrics:
 * - Combined hit rate
 * - Hit counts by tier (Edge, KV, R2)
 * - Miss counts
 * - Cache efficiency
 * 
 * @param {Request} request
 * @param {Object} env
 * @returns {Response}
 */
export async function handleCacheStats(request, env) {
  try {
    const apiWorkerUrl = env.API_WORKER_URL || 'https://api.oooefam.net';
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '1h';

    // Fetch cache metrics from API worker
    let cacheData = {
      combinedHitRate: 0,
      edgeHits: 0,
      kvHits: 0,
      r2Reads: 0,
      apiMisses: 0,
      edgeHitRate: 0,
      kvHitRate: 0,
    };

    try {
      const metricsResponse = await fetch(`${apiWorkerUrl}/metrics?period=${period}`, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        
        if (data.volume) {
          cacheData.edgeHits = data.volume.edge_hits || 0;
          cacheData.kvHits = data.volume.kv_hits || 0;
          cacheData.r2Reads = data.volume.r2_rehydrations || 0;
          cacheData.apiMisses = data.volume.api_misses || 0;
        }

        if (data.hitRates) {
          cacheData.combinedHitRate = data.hitRates.combined || 0;
          cacheData.edgeHitRate = data.hitRates.edge || 0;
          cacheData.kvHitRate = data.hitRates.kv || 0;
        }

        // Calculate combined hit rate if not provided
        if (!cacheData.combinedHitRate) {
          const totalHits = cacheData.edgeHits + cacheData.kvHits + cacheData.r2Reads;
          const totalRequests = totalHits + cacheData.apiMisses;
          
          if (totalRequests > 0) {
            cacheData.combinedHitRate = (totalHits / totalRequests) * 100;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch cache metrics:', error);
    }

    return new Response(
      JSON.stringify({
        period,
        timestamp: new Date().toISOString(),
        combinedHitRate: cacheData.combinedHitRate,
        edgeHits: cacheData.edgeHits,
        kvHits: cacheData.kvHits,
        r2Reads: cacheData.r2Reads,
        apiMisses: cacheData.apiMisses,
        breakdown: {
          edgeHitRate: cacheData.edgeHitRate,
          kvHitRate: cacheData.kvHitRate,
        },
        efficiency: {
          totalCached: cacheData.edgeHits + cacheData.kvHits + cacheData.r2Reads,
          totalRequests: cacheData.edgeHits + cacheData.kvHits + cacheData.r2Reads + cacheData.apiMisses,
        },
      }, null, 2),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('Cache stats handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch cache stats',
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
