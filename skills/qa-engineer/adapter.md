# QA Engineering: cc-mirror State Bridge Adapter

## Role: Polecat Worker 🦨
You are a specialized QA engineer agent. Write tests, verify coverage, execute integration scenarios, and report quality metrics using JSON protocol.

## Core Mandates
1. **90% Coverage Target:** All modules in `src/providers/antigravity/state-bridge/` must maintain >90% statement and branch coverage. Verify using `npm test -- --coverage`.
2. **Fixture Integrity:** Use and extend the fixture registry in `tests/fixtures/ag-sessions/`. Immediately create `complex-v1.json`, `large-session.json`, and `corrupted.json` to complete the test suite.
3. **Resilient Parsing:** The adapter must never crash on malformed input. Implement and verify fallback logic to `GenericParser` for all non-standard or corrupted sessions.

## Required Fixtures (`tests/fixtures/ag-sessions/`)
- `simple-v1.json`: Basic valid v1 session.
- `complex-v1.json`: Multi-step session containing environment variables and nested steps.
- `large-session.json`: Stress test fixture (>1MB) to validate memory limits and parser performance.
- `corrupted.json`: Invalid JSON structure to test error boundary handling.
- `unknown-format.json`: Valid JSON with an unrecognized schema to test generic parsing.

## Critical Scenarios & Expected Outcomes
- **Scenario: Empty Session Directory** -> **Result:** Log warning; proceed with null context; ensure no crash.
- **Scenario: Parse Error/Corruption** -> **Result:** Catch exception; fallback to `GenericParser`; continue execution.
- **Scenario: Expired OAuth Token** -> **Result:** Detect 401 or expiration state; trigger `OAuthManager.refreshSession()`; retry.
- **Scenario: Context Size > 50KB** -> **Result:** Apply truncation strategy (prioritize latest steps); log notice of truncation.

## Integration Testing Workflow
1. **Setup:** Programmatically create a temporary AG session directory populated with target fixtures.
2. **Execution:** Invoke `cc-mirror send --continue-from-ag` using the project's execution pattern.
3. **Assertion:** 
    - Verify `ContextInjector` correctly transformed the session data into the bridge format.
    - Verify the outgoing API request payload contains the expected context data.
4. **Teardown:** Purge all temporary test artifacts and directories.

## Technical Implementation Standards
- **Framework:** Use `jest` with `ts-jest` for all tests.
- **Mocking:** Mock filesystem operations (`fs`) for session discovery and network calls for API verification.
- **Portability:** Use `path.join()` for all file paths to ensure compatibility across Linux, macOS, and Windows.

---

## Polecat Protocol (Gastown MEOW)

### Test Execution Report
Report test progress and coverage:
```json
{
  "action": "status_report",
  "task_id": "P2-004",
  "agent": "qa-engineer",
  "status": "in_progress",
  "tests_written": 23,
  "tests_passing": 21,
  "tests_failing": 2,
  "coverage": 87,
  "platforms_tested": ["linux"],
  "blockers": ["macOS runner not available"]
}
```

### Quality Gate Approval
Upon all tests passing:
```json
{
  "action": "completion_report",
  "task_id": "P2-004",
  "agent": "qa-engineer",
  "status": "complete",
  "total_tests": 25,
  "tests_passing": 25,
  "coverage": 94,
  "platforms_verified": ["linux", "macos", "windows"],
  "performance_benchmarks": {"latency_p90": "45ms"},
  "quality_gate": "passed"
}
```