#!/bin/bash
# Deploy atome-studio: pull from GitHub, rebuild, restart containers.
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/3] Pulling latest from GitHub..."
git pull origin main

echo "[2/3] Rebuilding containers..."
docker compose -f "$ROOT_DIR/docker-compose.yml" build api web

echo "[3/3] Restarting..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d api web

echo "Done! Checking status..."
docker ps --filter name=atome --format "table {{.Names}}\t{{.Status}}"
