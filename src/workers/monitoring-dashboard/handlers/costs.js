/**
 * Cost Analysis Handler
 * 
 * Estimates operational costs based on usage metrics:
 * - KV operations
 * - R2 operations
 * - AI API requests (Gemini)
 * - Durable Object usage
 * - Worker invocations
 * 
 * Pricing based on Cloudflare's current rates (as of Nov 2025).
 * 
 * @param {Request} request
 * @param {Object} env
 * @returns {Response}
 */
export async function handleCosts(request, env) {
  try {
    const apiWorkerUrl = env.API_WORKER_URL || 'https://api.oooefam.net';
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '24h';

    // Cloudflare pricing (approximate)
    const pricing = {
      kvRead: 0.50 / 1_000_000,        // $0.50 per million reads
      kvWrite: 1.00 / 1_000_000,       // $1.00 per million writes
      r2Read: 0.36 / 1_000_000,        // $0.36 per million reads (Class A)
      r2Write: 4.50 / 1_000_000,       // $4.50 per million writes (Class A)
      r2Storage: 0.015 / 1_073_741_824, // $0.015 per GB/month
      doRequest: 1.00 / 1_000_000,     // $1.00 per million requests
      workerRequest: 0.30 / 1_000_000, // $0.30 per million requests (after free tier)
      aiRequest: 0.001,                // Gemini pricing varies, estimated
    };

    let costs = {
      breakdown: {
        kv: '$0.00',
        r2: '$0.00',
        ai: '$0.00',
        do: '$0.00',
        workers: '$0.00',
      },
      daily: '$0.00',
      monthly: '$0.00',
      periodMultiplier: 1,
    };

    try {
      const metricsResponse = await fetch(`${apiWorkerUrl}/metrics?period=${period}`, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        
        // Calculate period multiplier for daily/monthly estimates
        let periodMultiplier = 1;
        if (period === '15m') periodMultiplier = 96;  // 24h / 15m
        else if (period === '1h') periodMultiplier = 24;
        else if (period === '24h') periodMultiplier = 1;
        else if (period === '7d') periodMultiplier = 1/7;

        // KV costs
        const kvReads = (data.volume?.kv_hits || 0) * periodMultiplier;
        const kvWrites = kvReads * 0.1; // Estimate 10% writes to reads ratio
        const kvCost = (kvReads * pricing.kvRead) + (kvWrites * pricing.kvWrite);

        // R2 costs
        const r2Reads = (data.volume?.r2_rehydrations || 0) * periodMultiplier;
        const r2Writes = r2Reads * 0.05; // Estimate 5% writes
        const r2Cost = (r2Reads * pricing.r2Read) + (r2Writes * pricing.r2Write);

        // AI costs (estimated from volume)
        const apiMisses = (data.volume?.api_misses || 0) * periodMultiplier;
        const aiRequests = apiMisses * 0.1; // Estimate 10% of misses use AI
        const aiCost = aiRequests * pricing.aiRequest;

        // Durable Object costs
        const totalRequests = Object.values(data.volume || {}).reduce((sum, val) => sum + (val || 0), 0);
        const doRequests = totalRequests * 0.15 * periodMultiplier; // Estimate 15% use DOs
        const doCost = doRequests * pricing.doRequest;

        // Worker costs (after 100k free tier per day)
        const workerRequests = Math.max(0, totalRequests * periodMultiplier - 100_000);
        const workerCost = workerRequests * pricing.workerRequest;

        // Total daily cost
        const dailyCost = kvCost + r2Cost + aiCost + doCost + workerCost;

        costs = {
          breakdown: {
            kv: `$${kvCost.toFixed(4)}`,
            r2: `$${r2Cost.toFixed(4)}`,
            ai: `$${aiCost.toFixed(4)}`,
            do: `$${doCost.toFixed(4)}`,
            workers: `$${workerCost.toFixed(4)}`,
          },
          daily: `$${dailyCost.toFixed(2)}`,
          monthly: `$${(dailyCost * 30).toFixed(2)}`,
          periodMultiplier,
          details: {
            kvReads: Math.round(kvReads),
            kvWrites: Math.round(kvWrites),
            r2Reads: Math.round(r2Reads),
            r2Writes: Math.round(r2Writes),
            aiRequests: Math.round(aiRequests),
            doRequests: Math.round(doRequests),
            workerRequests: Math.round(workerRequests),
          },
        };
      }
    } catch (error) {
      console.error('Failed to fetch metrics for cost calculation:', error);
    }

    return new Response(
      JSON.stringify({
        period,
        timestamp: new Date().toISOString(),
        ...costs,
        note: 'Costs are estimates based on usage patterns and Cloudflare pricing.',
        disclaimer: 'Actual costs may vary. Check Cloudflare dashboard for accurate billing.',
      }, null, 2),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Cost handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to calculate costs',
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
