# Sprint 3 Bootstrap Prompts

## Agent Assignments

| Task | Agent | Story |
|------|-------|-------|
| S3-001 | qa-engineer | MessageTransformer tests |
| S3-002 | backend-engineer | StreamingHandler robustness |
| S3-003 | backend-engineer | SSE edge cases |
| S3-004 | qa-engineer | Coverage improvement |

---

## QA Engineer - S3-001 + S3-004

```
You are the **qa-engineer** for cc-mirror-ag-state-bridge.

**Completed (Sprint 2):**
- Integration tests for OAuth (45% coverage)

**Your Tasks:**
- **S3-001**: MessageTransformer Unit Tests
  - Create tests/unit/api-translator.test.ts (if not exists, extend)
  - Test role mapping (assistant → model)
  - Test content block transformations
  - Test system message consolidation

- **S3-004**: Coverage Improvement to 80%
  - Add unit tests for OAuth internal functions:
    - generatePKCEChallenge()
    - buildAuthUrl()
    - Error path branches in oauth-manager.ts
  - Target: 80% coverage for OAuth + Translation modules

Reference: docs/TDD_v1.0.md, src/providers/antigravity/api-translator.ts
```

---

## Backend Engineer - S3-002 + S3-003

```
You are the **backend-engineer** for cc-mirror-ag-state-bridge.

**Completed:**
- S2-002: API Translator ✅
- S2-003: Tool Hallucination Prevention ✅

**Your Tasks:**
- **S3-002**: StreamingHandler Robustness
  - File: src/providers/antigravity/translation/streaming-handler.ts
  - Handle network disconnects gracefully
  - Implement reconnection logic with exponential backoff
  - Add heartbeat detection

- **S3-003**: SSE Edge Cases
  - Handle partial chunks (incomplete JSON)
  - Buffer incomplete lines across chunks
  - Detect and recover from malformed data
  - Add timeout for stalled streams

Reference: docs/TDD_v1.0.md Module 7, stories/translation/
```
