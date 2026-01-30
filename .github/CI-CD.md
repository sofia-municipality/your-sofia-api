# CI/CD Documentation

This document describes the Continuous Integration and Continuous Deployment setup for Your Sofia API.

## GitHub Actions Workflows

### 1. Build and Push Docker Image (`docker-build.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- New tags matching `v*.*.*` (e.g., `v1.0.0`)
- Pull requests to `main`
- Manual trigger via workflow_dispatch

**What it does:**

1. Starts a PostgreSQL service container for build-time database access
2. Builds the Docker image using `docker/Dockerfile`
3. Pushes images to GitHub Container Registry (ghcr.io)
4. Creates attestations for supply chain security
5. Caches layers for faster subsequent builds

**Image Tags:**

- `main` → `latest` + `main-{sha}`
- `develop` → `develop` + `develop-{sha}`
- `v1.2.3` → `v1.2.3`, `v1.2`, `v1`, `latest`
- PR → `pr-{number}`

**Registry:** `ghcr.io/sofia-municipality/your-sofia-api`

### 2. Deploy to Production (`deploy-production.yml`)

**Triggers:**

- New GitHub Release published
- Manual trigger with custom tag selection

**What it does:**

1. Connects to production server via SSH
2. Pulls latest code and Docker images
3. Runs docker-compose to update services
4. Verifies deployment via health check endpoint
5. Sends notification to Slack (optional)

**Requirements:**

- GitHub secrets configured (see below)
- SSH access to production server
- Docker and docker-compose installed on server

## Required GitHub Secrets

### For Docker Build

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### For Production Deployment

- `DEPLOY_SSH_KEY` - Private SSH key for server access
- `DEPLOY_USER` - SSH username (e.g., `deploy`)
- `DEPLOY_HOST` - Server hostname or IP (e.g., `your.sofia.bg`)
- `DEPLOY_PATH` - Path to application on server (e.g., `/var/www/your-sofia-api`)
- `DEPLOY_URL` - Public URL for health checks (e.g., `https://your.sofia.bg`)
- `SLACK_WEBHOOK_URL` - (Optional) Slack webhook for notifications

### Setting up secrets

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with its value

## Server Setup

### Prerequisites

1. **Docker and Docker Compose installed**

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt-get install docker-compose-plugin
   ```

2. **Deploy user with Docker permissions**

   ```bash
   sudo useradd -m -s /bin/bash deploy
   sudo usermod -aG docker deploy
   ```

3. **SSH key setup**

   ```bash
   # On your local machine, generate SSH key
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/your-sofia-deploy

   # Copy public key to server
   ssh-copy-id -i ~/.ssh/your-sofia-deploy.pub deploy@your-server

   # Add private key to GitHub secrets as DEPLOY_SSH_KEY
   cat ~/.ssh/your-sofia-deploy
   ```

4. **Application directory**

   ```bash
   sudo mkdir -p /var/www/your-sofia-api
   sudo chown deploy:deploy /var/www/your-sofia-api

   # Clone repository as deploy user
   sudo -u deploy git clone https://github.com/sofia-municipality/your-sofia-api.git /var/www/your-sofia-api
   ```

5. **Environment configuration**

   ```bash
   cd /var/www/your-sofia-api
   cp .env.production.example .env.production
   nano .env.production  # Configure secrets
   ```

6. **SSL certificates**

   ```bash
   # Install certbot
   sudo apt-get install certbot

   # Get certificate
   sudo certbot certonly --standalone -d your.sofia.bg

   # Copy to application
   sudo cp /etc/letsencrypt/live/your.sofia.bg/fullchain.pem docker/nginx/ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your.sofia.bg/privkey.pem docker/nginx/ssl/key.pem
   sudo chown deploy:deploy docker/nginx/ssl/*.pem
   ```

## Deployment Workflow

### Automatic Deployment (Recommended)

1. **Development:**

   ```bash
   git checkout develop
   git add .
   git commit -m "feat: new feature"
   git push origin develop
   ```

   → Builds `develop` tag automatically

2. **Release:**

   ```bash
   git checkout main
   git merge develop
   git tag v1.0.0
   git push origin main --tags
   ```

   → Builds `v1.0.0`, `v1.0`, `v1`, `latest` tags

3. **Create GitHub Release:**
   - Go to Releases → Draft a new release
   - Select tag `v1.0.0`
   - Add release notes
   - Publish
     → Triggers automatic deployment to production

### Manual Deployment

1. **Trigger workflow manually:**
   - Go to Actions → Deploy to Production
   - Click "Run workflow"
   - Select branch and tag
   - Click "Run workflow"

2. **Or deploy from server:**
   ```bash
   ssh deploy@your.sofia.bg
   cd /var/www/your-sofia-api
   git pull origin main
   docker-compose -f docker/docker-compose.prod.yml --env-file .env.production pull
   docker-compose -f docker/docker-compose.prod.yml --env-file .env.production up -d
   ```

## Monitoring Deployments

### GitHub Actions UI

- Go to Actions tab in repository
- View workflow runs, logs, and status
- Download artifacts and check build times

### Server Logs

```bash
# View all services
docker-compose -f docker/docker-compose.prod.yml logs -f

# View specific service
docker-compose -f docker/docker-compose.prod.yml logs -f payload

# Check container status
docker-compose -f docker/docker-compose.prod.yml ps
```

### Health Checks

```bash
# From local machine
curl https://your.sofia.bg/api/health

# From server
docker exec your-sofia-api-prod curl http://localhost:3000/api/health
```

## Rollback Procedure

### Quick Rollback to Previous Tag

```bash
ssh deploy@your.sofia.bg
cd /var/www/your-sofia-api

# Find previous tag
git tag --sort=-version:refname | head -5

# Checkout previous tag
git checkout v1.0.0

# Pull and restart
docker-compose -f docker/docker-compose.prod.yml pull
docker-compose -f docker/docker-compose.prod.yml up -d
```

### Via GitHub Actions

1. Go to Actions → Deploy to Production
2. Click "Run workflow"
3. Enter previous tag (e.g., `v1.0.0`)
4. Run workflow

## Troubleshooting

### Build Fails with Database Connection Error

**Issue:** Docker build can't connect to PostgreSQL service

**Solution:** The workflow includes a PostgreSQL service and waits for it to be ready. If it still fails:

1. Check `services.postgres` configuration in workflow
2. Ensure `network: host` is set in build step
3. Verify `DATABASE_URI` uses `localhost:5432`

### Deployment Fails on Server

**Issue:** SSH connection or docker-compose fails

**Solutions:**

1. **SSH key issues:**

   ```bash
   # Test SSH connection
   ssh -i ~/.ssh/your-sofia-deploy deploy@your.sofia.bg

   # Verify key is in GitHub secrets
   # Regenerate if needed
   ```

2. **Docker permissions:**

   ```bash
   # Add deploy user to docker group
   sudo usermod -aG docker deploy

   # Test docker access
   sudo -u deploy docker ps
   ```

3. **Missing environment variables:**
   ```bash
   # Verify .env.production exists and is complete
   cat /var/www/your-sofia-api/.env.production
   ```

### Health Check Fails After Deployment

**Issue:** `/api/health` returns non-200 status

**Solutions:**

1. **Check logs:**

   ```bash
   docker-compose -f docker/docker-compose.prod.yml logs payload
   ```

2. **Verify database:**

   ```bash
   docker-compose -f docker/docker-compose.prod.yml logs postgres
   docker exec -it your-sofia-postgres-prod psql -U postgres -d your-sofia
   ```

3. **Check migrations:**
   ```bash
   # Migrations run automatically via command in docker-compose
   # View output in payload logs
   docker-compose -f docker/docker-compose.prod.yml logs payload | grep migrate
   ```

## Security Best Practices

1. ✅ **Use GitHub Environments**
   - Set up "production" environment with approval requirements
   - Restrict who can approve deployments

2. ✅ **Rotate Secrets Regularly**
   - SSH keys every 90 days
   - Database passwords quarterly
   - Payload secrets semi-annually

3. ✅ **Enable Branch Protection**
   - Require PR reviews for `main`
   - Require status checks to pass
   - No direct pushes to `main`

4. ✅ **Monitor Container Registry**
   - Regularly scan images for vulnerabilities
   - Delete old/unused tags
   - Use dependabot for dependency updates

5. ✅ **Audit Deployment Logs**
   - Review GitHub Actions logs
   - Monitor server access logs
   - Set up alerts for failed deployments

## Performance Optimization

### Build Cache

The workflow uses GitHub Actions cache to speed up builds:

- Layer caching via `cache-from: type=gha`
- Reuses unchanged layers across builds
- Significantly reduces build time for small changes

### Parallel Jobs

For larger projects, split into multiple jobs:

- `test` - Run tests in parallel
- `build` - Build Docker image
- `deploy` - Deploy only if test + build pass

### Multi-Architecture Builds

To support ARM servers:

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3

- name: Build multi-arch image
  uses: docker/build-push-action@v5
  with:
    platforms: linux/amd64,linux/arm64
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Deployment Guide](../DEPLOYMENT.md)
- [Docker Configuration](../docker/README.md)
