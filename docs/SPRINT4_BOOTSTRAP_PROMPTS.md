# Sprint 4 Bootstrap Prompts

## Agent Assignments

| Task | Agent | Focus |
|------|-------|-------|
| S4-001 | backend-engineer | ThinkingSanitizer |
| S4-002 | backend-engineer | ToolHardener Layers 2-4 |
| S4-003 | backend-engineer | Account Pool Manager |
| S4-004 | backend-engineer | Tier Manager & Quota |
| S4-005 | qa-engineer | Full integration tests |

---

## Backend Engineer - S4-001 to S4-004

```
You are the **backend-engineer** for cc-mirror-ag-state-bridge.

**Completed:**
- Sprint 2: OAuth, API Translator, Tool Validation ✅
- Sprint 3: StreamingHandler robustness, SSE edge cases ✅

**Your Tasks:**

- **S4-001**: ThinkingSanitizer
  - File: src/providers/antigravity/enhancement/thinking-sanitizer.ts
  - Clean thinking blocks when toggling modes
  - Detect and strip `<thinking>` tags from responses
  - Handle edge cases (nested tags, malformed XML)

- **S4-002**: ToolHardener Mirrowel Layers 2-4
  - File: src/providers/antigravity/enhancement/tool-hardener.ts
  - Layer 2: Signature injection in tool schemas
  - Layer 3: System prompt prepending
  - Layer 4: Namespace prefixing
  - Already have Layer 1 (additionalProperties: false)

- **S4-003**: Account Pool Manager
  - File: src/providers/antigravity/account/account-pool.ts
  - Select best account based on tier and quota
  - Filter active accounts with remaining quota
  - Sort by tier priority, then quota remaining

- **S4-004**: Tier Manager & Quota Tracker
  - File: src/providers/antigravity/account/tier-manager.ts
  - File: src/providers/antigravity/account/quota-tracker.ts
  - Track usage per account
  - Estimate quota remaining
  - Tier definitions (free, pro, enterprise)

Reference: docs/TDD_v1.0.md Modules 8-10
```

---

## QA Engineer - S4-005

```
You are the **qa-engineer** for cc-mirror-ag-state-bridge.

**Completed:**
- Sprint 2: OAuth integration tests ✅
- Sprint 3: MessageTransformer tests, 80% coverage ✅

**Your Task:**

- **S4-005**: Full Integration Test Suite
  - Create tests/integration/full-flow.test.ts
  - End-to-end flow: OAuth → API Translation → Tool Calling → Streaming
  - Test account pool selection logic
  - Test quota tracking and tier switching
  - Mock Google Gen AI API responses
  - Target: 90% coverage overall

Reference: docs/TDD_v1.0.md Testing Strategy
```
