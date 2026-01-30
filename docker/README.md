# Docker Configuration

This directory contains all Docker-related files for deploying Your Sofia API.

## Structure

```
docker/
├── Dockerfile                    # Multi-stage production Docker image
├── .dockerignore                 # Files to exclude from Docker build context
├── docker-compose.local.yml    # PostgreSQL for local development
├── docker-compose.prod.yml      # Production deployment configuration
├── nginx/                        # Nginx reverse proxy configuration
│   ├── nginx.conf               # Nginx configuration with SSL, rate limiting
│   └── ssl/                     # SSL certificates directory
└── scripts/                      # Database management scripts
    ├── backup-db.sh             # Automated database backup
    └── restore-db.sh            # Database restore from backup
```

## Quick Start

### Development (PostgreSQL only)

```bash
docker-compose -f docker/docker-compose.local.yml up -d
```

### Production Deployment

```bash
# 1. Start PostgreSQL
docker-compose -f docker/docker-compose.prod.yml --env-file .env.production up -d postgres

# 2. Build and start the API (migrations run automatically)
docker-compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Optional: Start Nginx for SSL termination
docker-compose -f docker/docker-compose.prod.yml --env-file .env.production --profile with-nginx up -d
```

## Files

### `Dockerfile`

Multi-stage production Docker image:

- **base**: Node 22.12.0-alpine with pnpm 9.15.4
- **deps**: Installs dependencies
- **builder**: Builds Next.js application
- **runner**: Minimal production image with standalone output

**Key features:**

- Uses `output: 'standalone'` from next.config.js for minimal image size
- Runs as non-root user (nextjs:nodejs)
- Includes source files and node_modules for `pnpm payload migrate` at runtime

### `docker-compose.prod.yml`

Production deployment with:

- **PostgreSQL**: PostGIS 16-3.5 with health checks, volume persistence, backups
- **Payload API**: Built from Dockerfile, runs migrations on startup via `command` override
- **Nginx** (optional): Reverse proxy with SSL, rate limiting, security headers

**Environment variables:**

- Database: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Payload: `PAYLOAD_SECRET`, `CRON_SECRET`, `PREVIEW_SECRET`
- Public: `NEXT_PUBLIC_SERVER_URL`

**Key configuration:**

- `build.network: host` - Allows database access during build phase
- `command: sh -c "pnpm payload migrate && node server.js"` - Runs migrations before startup
- `depends_on.postgres.condition: service_healthy` - Waits for database

### `docker-compose.postgres.yml`

Simplified PostgreSQL setup for local development. Starts only the database without the API.

### `nginx/nginx.conf`

Production-ready Nginx configuration:

- HTTP → HTTPS redirect
- Rate limiting (10 req/s, different limits for admin vs API)
- Security headers (X-Frame-Options, CSP, etc.)
- Gzip compression
- Static file caching (1 year with immutable)
- SSL/TLS configuration (TLSv1.2, TLSv1.3)

### `scripts/backup-db.sh`

Automated PostgreSQL backup script:

- Creates timestamped pg_dump with gzip compression
- Deletes old backups based on `BACKUP_RETENTION_DAYS` (default 30)
- Loads configuration from `.env.production`
- Stores backups in `../backups/` directory

### `scripts/restore-db.sh`

Database restoration script:

- Validates backup file exists
- Requires confirmation before restore
- Gunzips and restores via psql
- Error handling for failed restores

## Deployment Workflow

1. **Configure environment**: Copy `.env.production.example` to `.env.production` and update secrets
2. **Set up SSL**: Place certificates in `docker/nginx/ssl/` or use Let's Encrypt
3. **Start PostgreSQL**: Wait for health check (~30 seconds)
4. **Build & Deploy**: Migrations run automatically via docker-compose `command`
5. **Enable Nginx**: Optional, for SSL termination and load balancing

## Network Configuration

- **Build phase**: Uses `network: host` to access local PostgreSQL during Docker build
- **Runtime**: Uses `your-sofia-network` bridge for container communication
- **Database connection**: `postgres:5432` (internal) and `localhost:5432` (external)

## Volume Mounts

- **postgres_data**: PostgreSQL data persistence
- **media_data**: Uploaded media files (`/app/public/media`)
- **../public**: Public assets directory (mapped from host)
- **../backups**: Database backup storage

## Health Checks

- **PostgreSQL**: `pg_isready` every 30s, 5 retries, 30s start period
- **Payload API**: HTTP request to `/api/health` every 30s, 3 retries, 60s start period

## Troubleshooting

**Build fails with database connection error:**

- Ensure PostgreSQL is running: `docker-compose -f docker/docker-compose.prod.yml up -d postgres`
- Wait for health check: `docker ps` (should show "healthy")
- Build with `network: host` allows access to `127.0.0.1:5432`

**Container won't start:**

```bash
docker-compose -f docker/docker-compose.prod.yml logs payload
docker-compose -f docker/docker-compose.prod.yml config
```

**Migrations fail:**

- Check `DATABASE_URI` is correct
- Verify PostgreSQL is healthy
- Review migration logs in container output

## Additional Documentation

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Comprehensive production deployment guide
- [Payload CMS Docs](https://payloadcms.com/docs) - Official documentation
- [Next.js Docker](https://nextjs.org/docs/deployment#docker-image) - Next.js containerization
