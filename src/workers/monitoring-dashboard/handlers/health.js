/**
 * Health Check Handler
 * 
 * Aggregates health status from all subsystems:
 * - Worker status (via api-worker health endpoint)
 * - Cache performance
 * - External API availability
 * - Active alerts
 * 
 * @param {Request} request
 * @param {Object} env
 * @returns {Response}
 */
export async function handleHealthCheck(request, env) {
  try {
    const apiWorkerUrl = env.API_WORKER_URL || 'https://api.oooefam.net';
    
    // Check API worker health
    let workerHealth = { status: 'unknown', message: 'Unable to reach API worker' };
    try {
      const healthResponse = await fetch(`${apiWorkerUrl}/health`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      if (healthResponse.ok) {
        workerHealth = await healthResponse.json();
      }
    } catch (error) {
      console.error('Failed to fetch API worker health:', error);
    }

    // Check cache health
    let cacheHealth = { status: 'unknown', hitRate: 0 };
    try {
      const cacheResponse = await fetch('/api/cache-stats');
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        const hitRate = cacheData.combinedHitRate || 0;
        cacheHealth = {
          status: hitRate >= 90 ? 'healthy' : hitRate >= 75 ? 'degraded' : 'critical',
          hitRate,
        };
      }
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    }

    // Aggregate alerts
    const alerts = [];
    
    if (workerHealth.status !== 'healthy') {
      alerts.push({
        severity: 'critical',
        message: `API Worker status: ${workerHealth.status}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (cacheHealth.status === 'critical') {
      alerts.push({
        severity: 'critical',
        message: `Cache hit rate critically low: ${cacheHealth.hitRate.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    } else if (cacheHealth.status === 'degraded') {
      alerts.push({
        severity: 'warning',
        message: `Cache hit rate below target: ${cacheHealth.hitRate.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    }

    // Determine overall health
    let overallStatus = 'healthy';
    let message = 'All systems operational';

    if (alerts.some(a => a.severity === 'critical')) {
      overallStatus = 'critical';
      message = 'Critical issues detected';
    } else if (alerts.some(a => a.severity === 'warning')) {
      overallStatus = 'degraded';
      message = 'Performance degraded';
    }

    return new Response(
      JSON.stringify({
        status: overallStatus,
        message,
        timestamp: new Date().toISOString(),
        checks: {
          worker: workerHealth,
          cache: cacheHealth,
        },
        alerts,
      }, null, 2),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        status: 'critical',
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString(),
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
