---
id: "20260107_continue_from_ag_command"
difficulty: "medium"
tags: ["cli", "command", "integration", "typescript"]
tech_stack: "Node.js 18+, TypeScript 5.x, commander"
---

# User Story
As a developer, I want to run `cc-mirror send --continue-from-ag`, so I can seamlessly continue my AG session in Claude Code.

# Context & Constraints
**Command Syntax:**
```bash
cc-mirror send --continue-from-ag "Add rate limiting to the API"
cc-mirror send --ag-session session-abc123 "Add tests"
```

**Flow:**
1. Parse `--continue-from-ag` or `--ag-session <id>` flag
2. Call `SessionDiscovery.getLatestSession()` or `.getSessionById(id)`
3. Call `SessionParser.parse(session.filePath)`
4. Call `ContextInjector.injectContext(messages, parsedSession)`
5. Send enhanced messages to provider
6. Stream response to stdout

**Output Messages:**
```
✅ Loaded context from AG session: abc123
   Goal: Build REST API with authentication
   Progress: 3/5 steps completed
```

# Acceptance Criteria
- [ ] **Flag Parsing:** Accept --continue-from-ag and --ag-session flags
- [ ] **Auto-Discovery:** --continue-from-ag uses latest session
- [ ] **Specific Session:** --ag-session <id> loads exact session
- [ ] **Context Display:** Show brief context summary before sending
- [ ] **Graceful Fallback:** Proceed without context if no session found
- [ ] **Error Messages:** Clear, actionable error with solutions
- [ ] **Streaming:** Stream AI response to stdout in real-time
