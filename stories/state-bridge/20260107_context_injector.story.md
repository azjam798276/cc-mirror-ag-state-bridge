---
id: "20260107_context_injector"
difficulty: "medium"
tags: ["state-bridge", "llm", "context", "typescript", "markdown"]
tech_stack: "Node.js 18+, TypeScript 5.x"
---

# User Story
As a developer, I want AG session context injected into my Claude Code conversation, so the AI understands my prior work.

# Context & Constraints
**Interface Requirements (ContextInjector):**
```typescript
interface ContextInjector {
  buildContextMessage(session: ParsedSession): string;
  injectContext(messages: Message[], session: ParsedSession): Message[];
}
```

**Context Message Template:**
```markdown
# 🔄 CONTINUING FROM ANTIGRAVITY SESSION

## Original Goal
{session.goal}

## Progress: {completed}/{total} steps ({percentage}%)

## Completed Steps
1. ✅ {step.action}

## Pending Steps
1. ⧗ {step.action}

## Files Modified by Antigravity
- {file}

## Your Task
Continue from where Antigravity left off.
```

**Token Budget:**
| Constraint | Threshold |
|------------|-----------|
| Max context chars | 50,000 (~12.5K tokens) |
| Completed steps shown | 10 (summarize if more) |
| Pending steps shown | 5 (truncate if more) |

# Acceptance Criteria
- [ ] **Markdown Format:** Generate readable markdown context
- [ ] **Token Budget:** Truncate if > 50,000 chars
- [ ] **Priority:** Goal and files always included; steps truncated first
- [ ] **Injection Position:** Insert as first system message
- [ ] **Metadata:** Add source='antigravity-session' to message metadata
- [ ] **Empty Session:** Handle sessions with no steps gracefully
- [ ] **Stale Warning:** Add warning if session > 24 hours old
