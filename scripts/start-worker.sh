#!/usr/bin/env bash
set -euo pipefail

echo "Starting Worker process…"
npx ts-node src/worker-main.ts
