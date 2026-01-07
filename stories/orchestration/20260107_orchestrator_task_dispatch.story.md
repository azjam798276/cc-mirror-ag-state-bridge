---
id: "20260107_orchestrator_task_dispatch"
role: "orchestrator"
difficulty: "medium"
tags: ["orchestration", "task-dispatch", "meow-workflow"]
tech_stack: "Node.js 18+, TypeScript 5.x, Multi-Agent"
---

# User Story: MAYOR Task Dispatch

**As a** MAYOR orchestrator,
**I want** to scan phase documents and dispatch tasks to workers,
**So that** the project progresses systematically through all phases.

## Context & Constraints
- Read phase docs from `/docs/phases/*.md`
- Parse task tables for status `⬜` (pending)
- Match tasks to appropriate worker roles
- Output structured JSON dispatch objects

## Acceptance Criteria
1. Orchestrator identifies all pending tasks in Phase 1
2. Tasks are dispatched in ID order (P1-001 before P1-002)
3. Each dispatch includes task_id, worker, instruction, acceptance_criteria
4. After worker completion, status updated to `✅` or `❌`
5. Phase transition requested when all tasks complete

## Implementation Hints
```json
{
  "task_id": "P1-001",
  "worker": "backend-engineer",
  "instruction": "Implement SessionDiscovery class",
  "acceptance_criteria": ["Discovers AG sessions from ~/.gemini/"],
  "context_files": ["src/state-bridge/session-discovery.ts"]
}
```
