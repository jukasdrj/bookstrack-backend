/**
 * Record an event to Analytics Engine dataset
 * Silently fails if dataset not available (graceful degradation)
 */
export async function recordAnalytics(
  dataset: AnalyticsEngineDataset | undefined,
  event: {
    blobs?: (string | number)[]
    doubles?: number[]
    indexes?: string[]
  }
): Promise<void> {
  if (!dataset) return

  try {
    dataset.writeDataPoint(event)
  } catch (error) {
    console.warn('[Analytics] Failed to record event:', error.message)
  }
}

/**
 * Record provider performance metrics
 */
export function recordProviderMetric(
  dataset: AnalyticsEngineDataset | undefined,
  provider: string,
  operation: string,
  processingTimeMs: number,
  resultCount: number,
  error?: string
) {
  recordAnalytics(dataset, {
    blobs: [provider, operation, error ? 'error' : 'success'],
    doubles: [processingTimeMs, resultCount],
    indexes: [error ? 'provider-error' : 'provider-success']
  })
}
