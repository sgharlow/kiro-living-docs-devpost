# DEPLOY.md

## Deployment Overview
The Living Documentation Generator deploys as an MCP server that integrates with Kiro IDE. The deployment model is simple: users install the MCP server package and configure it in their Kiro MCP settings. The server runs locally alongside Kiro, watching project files and serving documentation via a local web server. No external infrastructure or cloud services required.

## Prerequisites
Before deploying, ensure:
- [ ] All tests pass locally (80%+ coverage)
- [ ] TODOS.md critical items resolved
- [ ] MCP server responds to all required tool calls
- [ ] File watching works across platforms (Windows, macOS, Linux)
- [ ] Web server starts and serves documentation
- [ ] Performance targets met (<5s updates, <100MB memory)
- [ ] Sample projects generate documentation successfully

## Environment Configuration

### Development Environment
```bash
# .env.development
LOG_LEVEL=debug
WEB_SERVER_PORT=3000
WATCH_DEBOUNCE_MS=300
CACHE_SIZE_MB=50
ANALYSIS_TIMEOUT_MS=30000
```

### Demo Environment
```bash
# .env.demo
LOG_LEVEL=info
WEB_SERVER_PORT=3000
WATCH_DEBOUNCE_MS=100
CACHE_SIZE_MB=100
ANALYSIS_TIMEOUT_MS=10000
DEMO_MODE=true
```

### Production Environment (User Installation)
```bash
# .env.production
LOG_LEVEL=error
WEB_SERVER_PORT=3000
WATCH_DEBOUNCE_MS=500
CACHE_SIZE_MB=100
ANALYSIS_TIMEOUT_MS=15000
```

## Deployment Steps

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Start MCP server in development mode
npm run dev

# 4. Configure Kiro MCP settings
# Add to ~/.kiro/settings/mcp.json:
{
  "mcpServers": {
    "living-docs": {
      "command": "node",
      "args": ["./dist/server.js"],
      "cwd": "/absolute/path/to/kiro-living-docs-devpost"
    }
  }
}

# 5. Test with sample project
npm run test:integration

# 6. Verify web UI at http://localhost:3000
```

### Staging Deployment
```bash
# 1. Pre-deployment checks
npm run test
npm run build
npm run lint

# 2. Deploy to staging
git push staging main
# OR
npm run deploy:staging

# 3. Post-deployment
npm run migrate:staging
npm run health:staging

# 4. Smoke tests
npm run test:staging
```

### Production Deployment
```bash
# 1. Pre-flight checklist
- [ ] Staging tests pass
- [ ] Backup production database
- [ ] Notify team of deployment
- [ ] Check error monitoring dashboard

# 2. Deploy to production
git push production main
# OR
npm run deploy:production

# 3. Database migrations (if needed)
npm run migrate:production

# 4. Health checks
npm run health:production

# 5. Smoke tests
npm run test:production

# 6. Monitor for 15 minutes
- [ ] Check error rates
- [ ] Verify key metrics
- [ ] Test critical paths
```

## Rollback Procedures

### Automatic Rollback Triggers
- Error rate > 5%
- Response time > 5 seconds
- Health check failures

### Manual Rollback Steps
```bash
# 1. Revert to previous version
git revert HEAD
git push production main

# OR for immediate rollback
npm run rollback:production

# 2. Verify rollback
npm run health:production

# 3. Investigate issue
npm run logs:production --since="30 minutes ago"
```

## Infrastructure Components

### Services
| Component | Provider | Dashboard URL | Notes |
|-----------|----------|---------------|-------|
| Web Server | <!-- e.g., Vercel --> | <!-- URL --> | <!-- Notes --> |
| API Server | <!-- e.g., Railway --> | <!-- URL --> | <!-- Notes --> |
| Database | <!-- e.g., PostgreSQL --> | <!-- URL --> | <!-- Notes --> |
| Cache | <!-- e.g., Redis --> | <!-- URL --> | <!-- Notes --> |

### Monitoring
- **APM**: <!-- e.g., DataDog, New Relic -->
- **Logs**: <!-- e.g., LogTail, CloudWatch -->
- **Errors**: <!-- e.g., Sentry, Rollbar -->
- **Uptime**: <!-- e.g., Pingdom, UptimeRobot -->

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    # Run tests
  
  deploy:
    # Deploy to environment
```

## Secret Management

### Required Secrets
| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| API_KEY | Third-party API key | <!-- Provider --> |
| DATABASE_URL | Database connection string | <!-- Provider --> |
| JWT_SECRET | Authentication secret | Generate with `openssl rand -base64 32` |

### Updating Secrets
```bash
# Development
cp .env.example .env.local
# Edit .env.local with your values

# Production (example for Vercel)
vercel env add API_KEY production
```

## Health Checks

### Endpoints to Monitor
- `GET /health` - Basic health check
- `GET /ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

### Automated Monitoring
```bash
# Health check script
curl -f https://api.example.com/health || exit 1
```

## Post-Deployment Checklist

### Immediate (0-5 minutes)
- [ ] Deployment successful (no errors)
- [ ] Health checks passing
- [ ] Key pages loading
- [ ] API responding

### Short-term (5-30 minutes)
- [ ] Error rate normal
- [ ] Performance metrics stable
- [ ] No user complaints
- [ ] Database connections stable

### Long-term (24 hours)
- [ ] No memory leaks
- [ ] Log volume normal
- [ ] Cost within expected range
- [ ] Security scans pass

## Troubleshooting

### Common Issues

#### Issue: Deployment fails
```bash
# Check logs
npm run logs:production --tail=100

# Check build output
npm run build --verbose

# Verify environment variables
npm run env:check
```

#### Issue: Database connection errors
```bash
# Test connection
npm run db:test

# Check migration status
npm run migrate:status

# Rollback migration if needed
npm run migrate:rollback
```

## Contact Information

- **DevOps Lead**: <!-- Name and contact -->
- **On-call**: <!-- Rotation or contact -->
- **Escalation**: <!-- Management contact -->

## Notes
<!-- Any additional deployment-specific information -->