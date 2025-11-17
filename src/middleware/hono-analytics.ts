/**
 * Hono Analytics Middleware
 *
 * Adds router tracking headers for A/B testing and performance comparison
 * between manual routing and Hono routing.
 */

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'

/**
 * Middleware that tracks router usage and response times
 * Adds headers: X-Router and X-Response-Time
 */
export const analyticsMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const startTime = Date.now()

    await next()

    // Add router identifier for A/B testing
    c.res.headers.set('X-Router', 'hono')

    // Add response time
    const responseTime = Date.now() - startTime
    c.res.headers.set('X-Response-Time', `${responseTime}ms`)

    // Log performance metrics
    if (c.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
      console.log(JSON.stringify({
        router: 'hono',
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        responseTime,
        timestamp: new Date().toISOString()
      }))
    }
  }
}

/**
 * Helper function to add router analytics to any response
 * Can be used in handlers that bypass middleware
 */
export function addRouterAnalytics(
  response: Response,
  router: 'hono' | 'manual',
  startTime: number
): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Router', router)
  headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
