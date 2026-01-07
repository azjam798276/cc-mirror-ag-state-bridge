#!/bin/bash
# Real-time CLI Dashboard
# Shows live agent status with progress bars

set -e

cd "$(dirname "$0")/.."

echo "🖥️  Starting Real-time CLI Dashboard..."
echo ""

npx ts-node --transpile-only src/orchestrator/dashboard.ts "$@"
