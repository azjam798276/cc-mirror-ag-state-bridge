---
id: "20260107_list_ag_sessions_command"
difficulty: "easy"
tags: ["cli", "command", "display", "typescript"]
tech_stack: "Node.js 18+, TypeScript 5.x, commander, chalk"
---

# User Story
As a developer, I want to list my AG sessions, so I can choose which one to continue.

# Context & Constraints
**Command Syntax:**
```bash
cc-mirror list-ag-sessions
cc-mirror list-ag-sessions --limit 5
```

**Output Format:**
```
Recent Antigravity Sessions:

1. session-abc123 (2 hours ago)
   Goal: Build REST API with authentication
   Progress: 3/5 steps completed
   Modified: 8 files

2. session-def456 (5 hours ago)
   Goal: Fix database migration bug
   Progress: Completed
   Modified: 2 files

Use: cc-mirror send --ag-session <id> "message"
```

**Display Rules:**
- Default limit: 10 sessions
- Truncate goal to 60 characters
- Show relative time (e.g., "2 hours ago")
- Color-code progress (green=complete, yellow=in-progress)

# Acceptance Criteria
- [ ] **List Sessions:** Display sessions sorted by recency
- [ ] **Summary Info:** Show goal, progress, file count per session
- [ ] **Limit Flag:** --limit N restricts output count
- [ ] **Relative Time:** Show human-readable timestamps
- [ ] **Color Output:** Use chalk for status colors
- [ ] **No Sessions:** Display helpful message if none found
- [ ] **Usage Hint:** Show example command at bottom
