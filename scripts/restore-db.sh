#!/bin/bash
# Database restore script for Your Sofia API
# Usage: ./scripts/restore-db.sh <backup-file>

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-file>"
    echo "Example: $0 ./backups/your-sofia_20250107_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

echo "WARNING: This will restore the database from ${BACKUP_FILE}"
echo "Current database data will be replaced!"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo "Restoring database from ${BACKUP_FILE}..."

# Restore backup
gunzip -c ${BACKUP_FILE} | docker exec -i your-sofia-postgres-prod psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-your-sofia}

if [ $? -eq 0 ]; then
    echo "Database restored successfully from ${BACKUP_FILE}"
else
    echo "Restore failed!"
    exit 1
fi
