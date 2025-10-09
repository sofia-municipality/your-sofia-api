#!/bin/bash
# Database backup script for Your Sofia API
# Usage: ./scripts/backup-db.sh

set -e

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/your-sofia_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Create backup
echo "Creating backup: ${BACKUP_FILE}"
docker exec your-sofia-postgres-prod pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-your-sofia} | gzip > ${BACKUP_FILE}

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup created successfully: ${BACKUP_FILE}"
    
    # Remove old backups
    echo "Removing backups older than ${RETENTION_DAYS} days..."
    find ${BACKUP_DIR} -name "your-sofia_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    
    echo "Backup process completed"
else
    echo "Backup failed!"
    exit 1
fi
