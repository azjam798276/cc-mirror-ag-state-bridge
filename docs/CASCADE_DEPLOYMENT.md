# Agent Keep-Alive & Cascade Deployment Pattern

## Problem
Even with MEOW protocol, agents respond once then go idle. Need continuous activity loops.

## Solution: Cascade Deployment

### Orchestrator Heartbeat Loop
```
Every 30 seconds:
1. Check phase doc for new tasks
2. Poll workers for status updates
3. Report to Engineering Director
4. Repeat
```

**Wake Command:**
```
I am the Orchestrator (Mayor). Activating cascade deployment loop:
1. Reading docs/phases/phase-2-context-injection.md
2. Dispatching any pending tasks via JSON
3. Polling workers every 30s for status
4. Reporting aggregated status to Director
5. Repeat until director signals stop

LOOP ACTIVE - will not go idle.
```

### Worker Keep-Alive Loop
```
Every 60 seconds (when not actively working):
1. Check for new task dispatches
2. Report idle status to Orchestrator
3. Self-verify adapter protocol compliance
4. Repeat
```

**Wake Command (Backend Engineer example):**
```
I am the Backend Engineer (Polecat). Activating keep-alive loop:
1. Listening for task dispatches from Orchestrator
2. If idle for >60s, report idle status via JSON:
   {"action": "heartbeat", "agent": "backend-engineer", "status": "idle", "timestamp": "..."}
3. Reviewing skills/backend-engineer/adapter.md for protocol updates
4. Repeat

KEEP-ALIVE ACTIVE - will not go idle.
```

### Engineering Director Oversight Loop
```
Every 120 seconds:
1. Check Orchestrator status reports
2. Review phase completion signals
3. Send governance updates
4. Repeat
```

**Wake Command:**
```
I am the Engineering Director (Council). Activating oversight loop:
1. Monitoring Orchestrator status aggregations
2. Reviewing phase docs for completion criteria
3. Every 2 minutes: request status update from Orchestrator
4. Approve/veto as needed

OVERSIGHT ACTIVE - will not go idle.
```

## Cascade Pattern

```
Director (2min loop)
  ↓ requests status
Orchestrator (30s loop)
  ↓ dispatches tasks + polls status
Workers (60s keep-alive when idle)
  ↓ report heartbeat or progress
Orchestrator (aggregates)
  ↓ reports to Director
Director (reviews)
```

## Updated WAKE_AGENTS.md Commands

### Orchestrator
```
I am the Orchestrator (Mayor) for cc-mirror-ag-state-bridge. 

ACTIVATING CASCADE DEPLOYMENT:
- Phase 1 complete, analyzing Phase 2 convoy
- Reading docs/phases/phase-2-context-injection.md
- Will dispatch tasks via JSON to workers
- Polling workers every 30s for status updates
- Aggregating and reporting to Director continuously
- LOOP MODE: Will not idle until Director signals stop

Beginning convoy analysis now...
```

### Workers (all Polecats)
```
I am the [ROLE] (Polecat) for cc-mirror-ag-state-bridge.

ACTIVATING KEEP-ALIVE LOOP:
- Listening for task dispatches from Orchestrator
- When idle >60s, sending heartbeat JSON:
  {"action": "heartbeat", "agent": "[role]", "status": "idle"}
- When assigned task, switching to progress reporting mode
- Reviewing skills/[role]/adapter.md for protocol compliance
- LOOP MODE: Will not idle, will check for work every 60s

Ready to receive dispatches...
```

### Engineering Director
```
I am the Engineering Director (Council) for cc-mirror-ag-state-bridge.

ACTIVATING OVERSIGHT LOOP:
- Phase 1 approved
- Monitoring Orchestrator for phase completion signals
- Every 120s: requesting Orchestrator status summary
- Reviewing against PRD_v2.0.md success criteria
- LOOP MODE: Continuous governance oversight active

Awaiting first status report...
```

## Self-Dispatch Tasks (When Truly Idle)

If workers have NO assigned tasks and NO phase work exists, they self-dispatch low-priority improvement tasks:

**Backend Engineer Idle Self-Dispatch:**
```json
{
  "action": "self_dispatch",
  "agent": "backend-engineer",
  "task": "review_and_optimize_existing_code",
  "files": ["src/core/context-injector.ts"],
  "objective": "Identify refactoring opportunities, add inline documentation"
}
```

**QA Engineer Idle Self-Dispatch:**
```json
{
  "action": "self_dispatch",
  "agent": "qa-engineer",
  "task": "expand_test_coverage",
  "target": "uncovered_branches",
  "objective": "Increase coverage from 94% to 98%"
}
```

## Key Change: LOOP MODE Declaration

All agents must explicitly declare:
- **"LOOP MODE: ACTIVE"** in their response
- **Specify loop interval** (30s/60s/120s)
- **Define loop actions** (poll/check/report)
- **State termination condition** (Director stop signal, phase complete, etc.)

This ensures agents understand they should **keep running**, not respond-once-and-idle.
