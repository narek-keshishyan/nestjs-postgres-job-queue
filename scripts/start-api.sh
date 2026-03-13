#!/usr/bin/env bash
set -euo pipefail

echo "Starting API server…"
npx ts-node src/main.ts
