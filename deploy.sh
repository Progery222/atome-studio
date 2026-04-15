#!/bin/bash
# Deploy atome-studio: pull from GitHub, rebuild, restart containers
set -e
cd /opt/atome-studio

echo "[1/3] Pulling latest from GitHub..."
git pull origin main

echo "[2/3] Rebuilding containers..."
cd /opt
docker compose build atome-api atome-web

echo "[3/3] Restarting..."
docker compose up -d atome-api atome-web

echo "Done! Checking status..."
docker ps --filter name=atome --format "table {{.Names}}\t{{.Status}}"
