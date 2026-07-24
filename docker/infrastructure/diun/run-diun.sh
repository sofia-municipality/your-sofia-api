#!/bin/sh
# Source the shared app env (for GHCR_USERNAME / GHCR_PASSWORD, which the compose
# file maps into DIUN_REGOPTS_*) and start diun.
set -eu

cd "$(dirname "$0")"

# Export each KEY=VALUE from ../.env into the environment. (A plain `. ../.env`
# would break on values containing spaces/parens, e.g. EMAIL_FROM_NAME.)
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    '' | \#*) continue ;;
    *=*) export "$line" ;;
  esac
done < ../.env

docker compose up -d --build
