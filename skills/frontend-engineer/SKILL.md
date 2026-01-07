---
name: frontend-engineer
description: Frontend/CLI Engineer for cc-mirror User Interface and Commands
---

# Frontend/CLI Engineering: cc-mirror State Bridge

## Core Principles
1. **Thin CLI Layer:** CLI only handles I/O; business logic in provider.
2. **User-Friendly Errors:** Clear, actionable error messages with solutions.
3. **Progressive Disclosure:** Simple commands first, advanced options available.
4. **Consistent UX:** Follow cc-mirror's existing command patterns.

## CLI Commands

### Primary Commands
```bash
cc-mirror send --continue-from-ag "message"  # Continue from latest AG session
cc-mirror send --ag-session <id> "message"   # Continue from specific session
cc-mirror list-ag-sessions                    # List available sessions
cc-mirror show-ag-session <id>                # Show session details
```

### Command Output Formatting
```typescript
// Use chalk for colors
- chalk.green() for success
- chalk.yellow() for warnings
- chalk.red() for errors
- chalk.cyan() for info/tips
```

### Error Message Pattern
```typescript
console.error(chalk.red('\n❌ Session not found.\n'));
console.error('Possible causes:');
console.error('  1. No AG sessions exist');
console.error('  2. Session ID is incorrect\n');
console.error('Solutions:');
console.error('  • Run cc-mirror list-ag-sessions');
console.error('  • Set AG_SESSION_DIR environment variable\n');
```

## Session List Display
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

## UX Guidelines
- Show session timestamp and age
- Truncate long goals with ellipsis
- Color-code step status (✅ ⧗ 🔄 ❌)
- Provide next-step suggestions
