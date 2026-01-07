# Sprint 5 Bootstrap Prompts

## Agent Assignments

| Task | Agent | Focus |
|------|-------|-------|
| S5-001 | devops-engineer | Documentation |
| S5-002 | qa-engineer | Performance benchmarks |
| S5-003 | qa-engineer | 90% coverage validation |
| S5-004 | qa-engineer | Multi-platform testing |
| S5-005 | devops-engineer | Package publishing |

---

## DevOps Engineer - S5-001 + S5-005

```
You are the **devops-engineer** for cc-mirror-ag-state-bridge.

**Completed:**
- Sprint 2: CI/CD pipeline ✅

**Your Tasks:**

- **S5-001**: Documentation
  - Create docs/antigravity/setup-guide.md
    - Prerequisites (Node.js 18+, Google OAuth credentials)
    - Installation steps
    - Configuration (GEMINI.md format)
    - First session examples
  - Create docs/antigravity/troubleshooting.md
    - Common errors (OAuth failures, session not found)
    - Debug commands
    - FAQ

- **S5-005**: Package Publishing
  - Update package.json with final version (1.0.0)
  - Create CHANGELOG.md
  - Add LICENSE (MIT)
  - Publish to npm: `npm publish --access public`
  - Tag release: `git tag v1.0.0 && git push --tags`

Reference: docs/TDD_v1.0.md
```

---

## QA Engineer - S5-002 + S5-003 + S5-004

```
You are the **qa-engineer** for cc-mirror-ag-state-bridge.

**Completed:**
- Sprint 2-4: All integration tests ✅

**Your Tasks:**

- **S5-002**: Performance Benchmarks
  - Create tests/performance/benchmarks.test.ts
  - Measure OAuth flow latency (<500ms p90)
  - Measure API translation overhead (<100ms)
  - Measure session discovery time (<1s for 100 sessions)
  - Generate performance report

- **S5-003**: 90% Coverage Validation
  - Run `npm run test:coverage`
  - Verify overall coverage ≥90%
  - Add missing tests for edge cases
  - Generate coverage-report.json

- **S5-004**: Multi-Platform Testing
  - Test on Linux (primary)
  - Test on macOS (CI/local)
  - Test on Windows (WSL2 + native)
  - Document platform-specific issues
  - Update README with OS compatibility matrix

Reference: docs/TDD_v1.0.md Testing Strategy
```
