# Deployment Guide - Your Sofia API

This guide explains how to deploy Your Sofia API to a production server.

## Prerequisites

- Docker and Docker Compose installed on the server
- Domain name configured (e.g., `api.your-sofia.bg`)
- SSL certificates (Let's Encrypt recommended)
- Minimum 2GB RAM, 20GB storage

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/sofia-municipality/your-sofia-api.git
cd your-sofia-api
```

### 2. Configure Environment Variables

```bash
cp .env.production.example .env.production
nano .env.production
```

**Important:** Update these values:
- `POSTGRES_PASSWORD` - Strong password for PostgreSQL
- `PAYLOAD_SECRET` - Random 32+ character string
- `CRON_SECRET` - Random 32+ character string
- `PREVIEW_SECRET` - Random 32+ character string
- `NEXT_PUBLIC_SERVER_URL` - Your domain (e.g., `https://api.your-sofia.bg`)

Generate secrets:
```bash
openssl rand -base64 32
```

### 3. Set Up SSL Certificates

Place your SSL certificates in:
```
nginx/ssl/cert.pem
nginx/ssl/key.pem
```

Or use Let's Encrypt:
```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d api.your-sofia.bg

# Copy certificates
sudo cp /etc/letsencrypt/live/api.your-sofia.bg/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/api.your-sofia.bg/privkey.pem nginx/ssl/key.pem
```

### 4. Update Nginx Configuration

Edit `nginx/nginx.conf` and replace `api.your-sofia.bg` with your domain.

### 5. Deploy with Docker Compose

**Important:** The build process requires database connectivity. Start postgres first:

```bash
# Start postgres only
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d postgres

# Wait for postgres to be healthy (check with: docker ps)
# Then build and start the payload service
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

**With Nginx:**
```bash
# After postgres and payload are running
docker-compose -f docker-compose.prod.yml --env-file .env.production --profile with-nginx up -d
```

### 6. Verify Deployment

```bash
# Check running containers
docker ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f payload

# Test API
curl https://api.your-sofia.bg/api/health
```

### 7. Create Admin User

Navigate to `https://api.your-sofia.bg/admin` and create your first admin user.

## Database Management

### Backup Database

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Backups are stored in `./backups/` directory.

### Restore Database

```bash
chmod +x scripts/restore-db.sh
./scripts/restore-db.sh ./backups/your-sofia_20250107_120000.sql.gz
```

### Set Up Automated Backups

Add to crontab:
```bash
crontab -e

# Daily backup at 2 AM
0 2 * * * cd /path/to/your-sofia-api && ./scripts/backup-db.sh >> /var/log/your-sofia-backup.log 2>&1
```

## Monitoring

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f payload
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### Check Container Status

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Resource Usage

```bash
docker stats
```

## Updates

### Pull Latest Changes

```bash
git pull origin main
```

### Rebuild and Restart

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production build
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Zero-Downtime Update (with multiple instances)

```bash
# Scale up
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --scale payload=2

# Wait for health check
sleep 30

# Remove old container
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --scale payload=1
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated random secrets for PAYLOAD_SECRET, CRON_SECRET, PREVIEW_SECRET
- [ ] SSL/TLS certificates configured and valid
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Database not exposed to public internet
- [ ] Regular backups scheduled
- [ ] Server updates automated
- [ ] Nginx rate limiting enabled
- [ ] CORS properly configured
- [ ] Environment variables secured (.env.production not in git)

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs payload

# Check environment variables
docker-compose -f docker-compose.prod.yml config
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test database connection
docker exec -it your-sofia-postgres-prod psql -U postgres -d your-sofia
```

### Nginx Configuration Issues

```bash
# Test nginx configuration
docker exec your-sofia-nginx nginx -t

# Reload nginx
docker exec your-sofia-nginx nginx -s reload
```

### Out of Disk Space

```bash
# Clean up old Docker images
docker system prune -a

# Check disk usage
df -h
du -sh ./public/media
```

## Performance Tuning

### PostgreSQL

Edit `docker-compose.prod.yml` and add to postgres service:
```yaml
command:
  - "postgres"
  - "-c"
  - "max_connections=200"
  - "-c"
  - "shared_buffers=256MB"
  - "-c"
  - "effective_cache_size=1GB"
```

### Node.js

Adjust memory limits in `docker-compose.prod.yml`:
```yaml
payload:
  environment:
    NODE_OPTIONS: --max-old-space-size=2048
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/sofia-municipality/your-sofia-api/issues
- Documentation: https://github.com/sofia-municipality/your-sofia-api

## License

EUPL-1.2 - See LICENSE file
