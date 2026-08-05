#!/bin/sh
set -eu

HOST="${DIUN_HOSTNAME:-$(hostname)}"
STAGE="startup"

notify() {
  [ -n "$DISCORD_WEBHOOK_URL" ] || { echo "no webhook configured" >&2; return 0; }
  wget -q -O /dev/null -T 10 \
    --header='Content-Type: application/json' \
    --post-data="$(printf '{"content":"%s"}' "$1")" \
    "$DISCORD_WEBHOOK_URL" \
    || echo "discord notify failed" >&2
}

on_success() {
  notify "✅ [$HOST] Deployed $DIUN_ENTRY_IMAGE successfully"
}

on_fail() {
  code=$?
  notify "❌ [$HOST] Deploy of $DIUN_ENTRY_IMAGE failed during $STAGE (exit $code)"
}
trap on_fail EXIT

STAGE="registry login"
echo "$DIUN_REGOPTS_GHCR_PASSWORD" | docker login ghcr.io -u "$DIUN_REGOPTS_GHCR_USERNAME" --password-stdin

STAGE="stack deploy"
cd /infra
API_IMAGE="$DIUN_ENTRY_IMAGE" docker stack deploy \
  --with-registry-auth \
  --prune \
  --resolve-image always \
  --detach=false \
  -c docker-stack.yml \
  "your-sofia"

trap - EXIT
on_success