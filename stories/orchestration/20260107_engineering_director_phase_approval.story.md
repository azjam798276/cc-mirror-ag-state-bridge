---
id: "20260107_engineering_director_phase_approval"
role: "engineering-director"
difficulty: "medium"
tags: ["review", "approval", "phase-transition"]
tech_stack: "Node.js 18+, TypeScript 5.x, Multi-Agent"
---

# User Story: Phase Approval

**As an** Engineering Director,
**I want** to review completed phases and approve transitions,
**So that** only quality-verified work advances to the next phase.

## Context & Constraints
- Receive phase completion notification from Orchestrator
- Review all task outputs and test results
- Verify coverage ≥ 90%
- Check for security issues or critical TODOs

## Acceptance Criteria
1. Director receives phase completion request
2. All tasks in phase are verified as `✅`
3. Test coverage meets threshold
4. Security review completed (if applicable)
5. Decision output as structured JSON (APPROVED/REJECTED)
6. If rejected, specific actionable feedback provided

## Implementation Hints
```json
{
  "phase": "phase-1-foundation",
  "decision": "APPROVED",
  "reasoning": "All tasks complete, coverage 92%, no security issues",
  "next_steps": ["Proceed to Phase 2", "Update roadmap"]
}
```
