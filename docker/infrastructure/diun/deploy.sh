#!/bin/sh
set -eu

echo "$DIUN_REGOPTS_GHCR_PASSWORD" | docker login ghcr.io -u "$DIUN_REGOPTS_GHCR_USERNAME" --password-stdin

healthcheck() {
  waited=0
  while [ "$waited" -lt 180 ]; do
    if wget -q -O /dev/null http://localhost:3003/api/health; then
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
  done
  echo "healthcheck failed for $1" >&2
  return 1
}

cd /infra
API_IMAGE="$DIUN_ENTRY_IMAGE" docker stack deploy \
  --with-registry-auth \
  --prune \
  --resolve-image always \
  -c docker-stack.yml \
  "your-sofia"
sleep 3
healthcheck "your-sofia_api"
