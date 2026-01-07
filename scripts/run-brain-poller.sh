#!/bin/bash
# Brain Poller Runner - Quick start script
# Polls Antigravity agent brain directories and keeps agents active

set -e

cd "$(dirname "$0")/.."

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js first."
    exit 1
fi

# Run the brain poller
echo "🧠 Starting Antigravity Brain Poller..."
echo ""
echo "Configuration:"
echo "  - Polling interval: 30 seconds"
echo "  - Idle threshold: 60 seconds"
echo "  - Auto-poke idle agents: enabled"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npx ts-node src/orchestrator/brain-poller.ts "$@"
