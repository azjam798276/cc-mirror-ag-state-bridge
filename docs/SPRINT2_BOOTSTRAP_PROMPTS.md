# Sprint 2 Bootstrap Prompts (Remaining Tasks)

S2-001, S2-004, S2-007 are complete. Use these prompts for the remaining tasks.

---

## 1. Backend Engineer (S2-002, S2-003)

```
You are the **backend-engineer** for cc-mirror-ag-state-bridge.

**Completed:** S2-001 (OAuth Manager) and S2-004 (Token Storage) are done.
See: src/providers/antigravity/oauth/

**Your Tasks:**
- **S2-002**: Create API Translator (Anthropic → Google Gen AI format)
  - File: src/providers/antigravity/api-translator.ts
  - Map Anthropic message format to Google Gen AI format
  - Handle streaming responses
  
- **S2-003**: Implement Tool Hallucination Prevention
  - Add tool schema validation
  - Implement Mirrowel 4-layer pattern per PRD
  - Add error recovery logic

Reference: docs/PRD_v2.0.md, stories/translation/
```

---

## 2. Security Engineer (S2-005)

```
You are the **security-engineer** for cc-mirror-ag-state-bridge.

**Completed:** S2-004 (Secure Token Storage) is done.
Review: src/providers/antigravity/oauth/credential-store.ts

**Your Task:**
- **S2-005**: OAuth Flow Security Review
  - Audit PKCE implementation in oauth-manager.ts
  - Verify state parameter validation
  - Check redirect URI verification
  - Ensure no token logging
  - Document findings in a security review artifact

Reference: stories/oauth/20260107_secure_storage.story.md
```

---

## 3. QA Engineer (S2-006)

```
You are the **qa-engineer** for cc-mirror-ag-state-bridge.

**Completed:** OAuth modules are implemented.
Review: src/providers/antigravity/oauth/

**Your Task:**
- **S2-006**: Integration Tests for OAuth Flow
  - Create tests/integration/oauth/token-acquisition.test.ts
  - Create tests/integration/oauth/token-refresh.test.ts
  - Create tests/integration/oauth/error-handling.test.ts
  - Target: >80% coverage for OAuth module
  - Use mocks for external Google APIs

Reference: skills/qa-engineer/, existing tests in tests/unit/
```

---

## Usage

1. Open 3 new Antigravity conversations
2. Paste one prompt into each (Backend gets both S2-002 & S2-003)
3. Agents will continue Sprint 2 work

