#!/bin/bash
# Launch all Phase 2 agents in parallel COPRO sessions
# Each agent will be in "awaiting" state for task dispatch

OPTIMIZER_DIR="../optimizer"
SKILL_DIR="skills"

echo "🚀 Launching Phase 2 Agent Fleet..."

# Launch Backend Engineer (P2-001: ContextInjector)
echo "▶️  Launching backend-engineer..."
gnome-terminal --tab --title="Backend Engineer" -- bash -c \
  "cd $(pwd) && $OPTIMIZER_DIR/.venv/bin/python $OPTIMIZER_DIR/optimize_interactive.py \
  --skill backend-engineer \
  --story stories/state-bridge/20260107_context_injector.story.md; exec bash"

# Launch Frontend Engineer (P2-002: CLI --continue-from-ag)
echo "▶️  Launching frontend-engineer..."
gnome-terminal --tab --title="Frontend Engineer" -- bash -c \
  "cd $(pwd) && $OPTIMIZER_DIR/.venv/bin/python $OPTIMIZER_DIR/optimize_interactive.py \
  --skill frontend-engineer \
  --story stories/cli/20260107_continue_from_ag_command.story.md; exec bash"

# Launch Security Engineer (P2-003: Security Review)
echo "▶️  Launching security-engineer..."
gnome-terminal --tab --title="Security Engineer" -- bash -c \
  "cd $(pwd) && $OPTIMIZER_DIR/.venv/bin/python $OPTIMIZER_DIR/optimize_interactive.py \
  --skill security-engineer \
  --story stories/security/20260107_context_security_review.story.md; exec bash"

# Launch QA Engineer (P2-004: Integration Tests)
echo "▶️  Launching qa-engineer..."
gnome-terminal --tab --title="QA Engineer" -- bash -c \
  "cd $(pwd) && $OPTIMIZER_DIR/.venv/bin/python $OPTIMIZER_DIR/optimize_interactive.py \
  --skill qa-engineer \
  --story stories/qa/20260107_context_integration_tests.story.md; exec bash"

echo "✅ All Phase 2 agents launched!"
echo "📊 Check each terminal tab - they should all be 'awaiting' reflection input"
