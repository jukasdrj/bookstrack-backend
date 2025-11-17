# Monitoring Dashboard Worker

## Overview

The Monitoring Dashboard Worker is a separate Cloudflare Worker that provides a comprehensive, real-time monitoring interface for the BooksTrack backend infrastructure.

## Features

### 📊 Real-Time Metrics
- **Worker Performance**: Request volume, latency percentiles (P50/P95/P99), error rates
- **Cache Analytics**: Hit rates by tier (Edge, KV, R2), cache efficiency
- **External API Health**: Status and latency for Google Books, OpenLibrary, ISBNdb, Gemini
- **WebSocket Stats**: Active connections, message throughput, connection duration
- **Cost Estimation**: Daily and monthly cost projections based on usage

### 🎨 Modern UI
- Clean, responsive dashboard interface
- Auto-refresh every 30 seconds (configurable)
- Color-coded health status indicators
- Real-time alert display
- Mobile-friendly design

### 🔍 Health Monitoring
- Overall system health aggregation
- Subsystem status tracking
- Alert severity levels (healthy, degraded, critical)
- Historical alert logging

## Architecture

### Separation of Concerns
The monitoring worker is intentionally separated from the main API worker to:
- **Avoid coupling**: Monitoring doesn't affect API performance
- **Independent scaling**: Dashboard can be updated without API deployment
- **Security**: Read-only access to metrics data
- **Clarity**: Clear separation between production APIs and operational tooling

### Data Flow
```
┌─────────────────┐
│  Monitoring     │
│  Dashboard UI   │
└────────┬────────┘
         │
         │ HTTP/REST
         ▼
┌─────────────────┐      ┌──────────────┐
│  Dashboard      │─────▶│  API Worker  │
│  Worker         │      │  /metrics    │
│  (Read-only)    │      │  /health     │
└────────┬────────┘      └──────────────┘
         │
         │ (Optional)
         ▼
┌─────────────────┐
│  KV Cache       │
│  (Shared)       │
└─────────────────┘
```

## Deployment

### Local Development

```bash
# Start the monitoring dashboard locally
npm run dev:monitor

# Access at http://localhost:8787
```

### Production Deployment

```bash
# Deploy to production
npm run deploy:monitor

# Access at https://monitor.oooefam.net
```

### View Logs

```bash
# Stream real-time logs
npm run tail:monitor
```

## API Endpoints

### Dashboard UI
- `GET /` - Main dashboard interface

### Metrics APIs
- `GET /api/health` - Overall system health status
- `GET /api/metrics?period=15m` - Aggregated performance metrics
- `GET /api/cache-stats?period=1h` - Cache performance data
- `GET /api/provider-health` - External API provider status
- `GET /api/websocket-stats` - WebSocket connection metrics
- `GET /api/costs?period=24h` - Cost estimation and breakdown

### Query Parameters

**period** (available on most endpoints):
- `15m` - Last 15 minutes
- `1h` - Last hour (default)
- `24h` - Last 24 hours
- `7d` - Last 7 days

## Configuration

### Environment Variables

Set in `wrangler-monitoring.toml`:

```toml
[vars]
API_WORKER_URL = "https://api.oooefam.net"  # Main API worker URL
LOG_LEVEL = "INFO"
STRUCTURED_LOGGING = "true"
```

### Custom Domain

The monitoring dashboard is accessible at:
- **Production**: https://monitor.oooefam.net
- **Local Dev**: http://localhost:8787

Configure custom domains in `wrangler-monitoring.toml`:

```toml
routes = [
  { pattern = "monitor.oooefam.net/*", zone_name = "oooefam.net" }
]
```

## Development

### Project Structure

```
src/workers/monitoring-dashboard/
├── index.js                    # Main worker entry point
├── handlers/
│   ├── dashboard.js            # Dashboard UI handler
│   ├── health.js               # Health check endpoint
│   ├── metrics.js              # Performance metrics
│   ├── cache-stats.js          # Cache analytics
│   ├── provider-health.js      # External API health
│   ├── websocket-stats.js      # WebSocket metrics
│   └── costs.js                # Cost estimation
└── templates/
    └── dashboard.html          # Dashboard HTML/CSS/JS
```

### Adding New Metrics

1. **Create Handler**: Add new handler in `handlers/`
2. **Update Router**: Add route in `index.js`
3. **Update UI**: Modify `templates/dashboard.html` to display new metrics
4. **Test**: Verify locally with `npm run dev:monitor`

### Example: Adding Database Metrics

```javascript
// handlers/database-stats.js
export async function handleDatabaseStats(request, env) {
  // Fetch D1 database metrics
  const stats = {
    queryCount: 1234,
    avgLatency: 15,
  };
  
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// index.js
import { handleDatabaseStats } from './handlers/database-stats.js';

// Add to router
case '/api/database-stats':
  response = await handleDatabaseStats(request, env);
  break;
```

## Monitoring Best Practices

### Alert Thresholds

The dashboard uses the following thresholds:

| Metric | Warning | Critical |
|--------|---------|----------|
| Combined Hit Rate | < 90% | < 75% |
| P95 Latency | > 100ms | > 500ms |
| Error Rate | > 2% | > 5% |
| API Provider Down | 1 provider | 2+ providers |

### Auto-Refresh Configuration

Default: 30 seconds

To modify, edit `templates/dashboard.html`:

```javascript
autoRefreshInterval = setInterval(refreshDashboard, 30000); // 30s
```

### Caching Strategy

API endpoints use aggressive caching to minimize load:
- Health: No cache (real-time)
- Metrics: 30s cache
- Provider Health: 60s cache
- Costs: 5min cache

## Troubleshooting

### Dashboard Shows "Loading..."

**Cause**: Unable to fetch data from API worker

**Solutions**:
1. Check API worker is running: `curl https://api.oooefam.net/health`
2. Verify `API_WORKER_URL` in `wrangler-monitoring.toml`
3. Check CORS headers allow dashboard domain
4. Review browser console for errors

### Metrics Show Zero Values

**Cause**: No recent traffic or Analytics Engine not configured

**Solutions**:
1. Generate test traffic to API worker
2. Verify Analytics Engine bindings in main `wrangler.toml`
3. Check that metrics are being written (check main worker logs)

### Cost Estimates Seem Wrong

**Cause**: Cost calculation is based on usage patterns and estimates

**Solutions**:
1. Verify period multiplier in cost calculation
2. Check actual usage in Cloudflare dashboard
3. Adjust pricing constants in `handlers/costs.js`

### Provider Health Shows All "Unknown"

**Cause**: Health checks require network access or authentication

**Solutions**:
1. For authenticated APIs (ISBNdb, Gemini), this is expected
2. Check network connectivity from worker
3. Verify timeout settings (default 5s)

## Security Considerations

### Read-Only Access

The monitoring dashboard has **read-only** access to metrics. It cannot:
- Modify worker configuration
- Write to databases or caches
- Trigger deployments
- Access sensitive secrets

### Access Control

Currently, the dashboard is **publicly accessible**. To restrict access:

1. **Option 1: Cloudflare Access** (Recommended)
   - Configure Cloudflare Access for `monitor.oooefam.net`
   - Require authentication via Google, GitHub, etc.

2. **Option 2: Custom Authentication**
   - Add auth middleware in `index.js`
   - Require API key or JWT token

3. **Option 3: IP Allowlist**
   - Configure in Cloudflare WAF
   - Only allow specific IP ranges

### Sensitive Data

The dashboard displays operational metrics only. It does not expose:
- API keys or secrets
- User data or PII
- Request payloads
- Database contents

## Future Enhancements

### Planned Features
- [ ] Historical trend graphs (7 day, 30 day)
- [ ] Alerting integration (email, Slack, PagerDuty)
- [ ] Custom metric queries via GraphQL
- [ ] Detailed trace viewing
- [ ] Durable Object state inspection
- [ ] R2 storage analytics
- [ ] Query performance profiling
- [ ] Anomaly detection (ML-based)

### Integration Ideas
- Grafana/Prometheus exporter
- DataDog/New Relic integration
- Custom webhooks for alerts
- Scheduled email reports
- Mobile app notifications

## Contributing

When adding new features to the monitoring dashboard:

1. Keep it **read-only** - no writes to production systems
2. Use **aggressive caching** - minimize load on API worker
3. Make it **responsive** - mobile-friendly UI
4. Add **error handling** - graceful degradation
5. Document **new metrics** - update this README

## Related Documentation

- [Main API Worker](../../README.md)
- [API Contract](../../docs/API_CONTRACT.md)
- [Architecture Overview](../../ARCHITECTURE_OVERVIEW.md)
- [Deployment Guide](../../docs/deployment/DEPLOYMENT.md)

---

**Last Updated**: November 17, 2025  
**Maintained By**: Backend Team  
**Status**: Production Ready ✅
