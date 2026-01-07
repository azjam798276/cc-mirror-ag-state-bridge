#!/bin/bash
# Full Orchestrator - Runs both brain poller and phase detector
# This keeps agents active and triggers Director review on completion

set -e

cd "$(dirname "$0")/.."

echo "🚀 Starting Full Orchestrator Suite"
echo ""
echo "Components:"
echo "  - Brain Poller: Monitors agent status, pokes idle agents"
echo "  - Phase Detector: Triggers Director review on completion"
echo "  - GEMINI.md Bus: Shared state coordination"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run the phase detector (which includes brain poller)
npx ts-node --transpile-only src/orchestrator/phase-detector.ts "$@"
