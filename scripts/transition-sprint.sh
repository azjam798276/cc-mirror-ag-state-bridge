#!/bin/bash
# Automated Sprint Transition Script
# Usage: ./scripts/transition-sprint.sh <sprint_number>

SPRINT_NUM=$1
BRAIN_DIR="$HOME/.gemini/antigravity/brain"
GEMINI_FILE="$HOME/.gemini/GEMINI.md"

if [ -z "$SPRINT_NUM" ]; then
    echo "Usage: $0 <sprint_number>"
    echo "Example: $0 4"
    exit 1
fi

# Sprint configuration
case $SPRINT_NUM in
    3)
        PHASE="sprint-3-protocol-translation"
        PREV_PHASE="sprint-2-oauth-provider"
        TASKS='[
          {"id":"S3-001","agent":"qa-engineer","description":"MessageTransformer unit tests"},
          {"id":"S3-002","agent":"backend-engineer","description":"StreamingHandler robustness"},
          {"id":"S3-003","agent":"backend-engineer","description":"SSE edge cases"},
          {"id":"S3-004","agent":"qa-engineer","description":"Coverage improvement to 80%"}
        ]'
        ;;
    4)
        PHASE="sprint-4-enhancements"
        PREV_PHASE="sprint-3-protocol-translation"
        TASKS='[
          {"id":"S4-001","agent":"backend-engineer","description":"ThinkingSanitizer implementation"},
          {"id":"S4-002","agent":"backend-engineer","description":"ToolHardener Mirrowel Layer 2-4"},
          {"id":"S4-003","agent":"backend-engineer","description":"Account Pool Manager"},
          {"id":"S4-004","agent":"backend-engineer","description":"Tier Manager & Quota Tracker"},
          {"id":"S4-005","agent":"qa-engineer","description":"Full integration test suite"}
        ]'
        ;;
    5)
        PHASE="sprint-5-polish-launch"
        PREV_PHASE="sprint-4-enhancements"
        TASKS='[
          {"id":"S5-001","agent":"devops-engineer","description":"Documentation"},
          {"id":"S5-002","agent":"qa-engineer","description":"Performance benchmarks"},
          {"id":"S5-003","agent":"qa-engineer","description":"90% coverage validation"},
          {"id":"S5-004","agent":"qa-engineer","description":"Multi-platform testing"},
          {"id":"S5-005","agent":"devops-engineer","description":"Package publishing"}
        ]'
        ;;
    *)
        echo "Error: Sprint $SPRINT_NUM not configured"
        exit 1
        ;;
esac

echo "🚀 Transitioning to Sprint $SPRINT_NUM..."

# 1. Update GEMINI.md orchestrator dispatch
cp "$GEMINI_FILE" "$GEMINI_FILE.bak"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

cat > /tmp/sprint_dispatch.json << EOF
{
  "currentPhase": {
    "phase": "$PHASE",
    "phaseDoc": "docs/TDD_v1.0.md",
    "status": "in_progress",
    "startedAt": "$TIMESTAMP",
    "tasks": $TASKS,
    "lastUpdated": "$TIMESTAMP"
  },
  "previousPhase": {
    "phase": "$PREV_PHASE",
    "status": "complete",
    "completedAt": "$TIMESTAMP"
  },
  "heartbeats": [],
  "lastOrchestratorPoll": "$TIMESTAMP"
}
EOF

awk '
/<MEMORY\[ORCHESTRATOR_DISPATCH\]>/ { 
    print; 
    system("cat /tmp/sprint_dispatch.json"); 
    skip=1; 
    next 
}
/<\/MEMORY\[ORCHESTRATOR_DISPATCH\]>/ { 
    skip=0 
}
!skip
' "$GEMINI_FILE.bak" > "$GEMINI_FILE"

echo "  ✅ Updated GEMINI.md for Sprint $SPRINT_NUM"

# 2. Reset agent task.md files
# Extract tasks by agent from the JSON
BACKEND_TASKS=$(echo "$TASKS" | jq -r '.[] | select(.agent=="backend-engineer") | "- [ ] \(.id): \(.description)"')
QA_TASKS=$(echo "$TASKS" | jq -r '.[] | select(.agent=="qa-engineer") | "- [ ] \(.id): \(.description)"')
DEVOPS_TASKS=$(echo "$TASKS" | jq -r '.[] | select(.agent=="devops-engineer") | "- [ ] \(.id): \(.description)"')

# Backend Engineer
if [ -n "$BACKEND_TASKS" ]; then
    cat > "$BRAIN_DIR/455e1593-67ee-4e67-8def-2c740d9126c9/task.md" << EOF
# Task: Sprint $SPRINT_NUM (Backend Engineer)

## Sprint $SPRINT_NUM Tasks
$BACKEND_TASKS
EOF
    echo "  ✅ Reset backend-engineer task.md"
fi

# QA Engineer
if [ -n "$QA_TASKS" ]; then
    cat > "$BRAIN_DIR/bae2b5ff-5121-47b7-b637-8d9e5c3796cd/task.md" << EOF
# Task: Sprint $SPRINT_NUM (QA Engineer)

## Sprint $SPRINT_NUM Tasks
$QA_TASKS
EOF
    echo "  ✅ Reset qa-engineer task.md"
fi

# DevOps Engineer
if [ -n "$DEVOPS_TASKS" ]; then
    cat > "$BRAIN_DIR/912ae322-48d1-43d4-be42-757a8b35e7e6/task.md" << EOF
# Task: Sprint $SPRINT_NUM (DevOps Engineer)

## Sprint $SPRINT_NUM Tasks
$DEVOPS_TASKS
EOF
    echo "  ✅ Reset devops-engineer task.md"
fi

# Security Engineer (usually no new tasks after Sprint 2)
cat > "$BRAIN_DIR/d8b5d68c-ad2c-4a54-aaa6-5b5226562348/task.md" << EOF
# Task: Sprint $SPRINT_NUM (Security Engineer)

## Sprint $SPRINT_NUM Tasks
No assigned tasks for Sprint $SPRINT_NUM. Monitoring security review needs.
EOF
echo "  ✅ Reset security-engineer task.md"

echo ""
echo "🎉 Sprint $SPRINT_NUM transition complete!"
echo ""
echo "Next steps:"
echo "  1. Review docs/SPRINT${SPRINT_NUM}_BOOTSTRAP_PROMPTS.md"
echo "  2. Launch new Antigravity conversations for assigned agents"
echo "  3. Run ./scripts/run-dashboard.sh to monitor progress"
