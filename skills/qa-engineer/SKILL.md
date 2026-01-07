---
name: qa-engineer
description: QA Engineer for cc-mirror State Bridge Testing and Validation
---

# QA Engineering: cc-mirror Antigravity State Bridge

## Core Principles
1. **Coverage First:** Target 90% code coverage across all modules.
2. **Edge Case Focus:** Test malformed inputs, large files, permission errors.
3. **Platform Parity:** Ensure consistent behavior across Linux, macOS, Windows.
4. **Regression Prevention:** Integration tests for critical paths.

## Test Categories

### Unit Tests
```typescript
// Session Discovery
- Empty directory → []
- Multiple sessions → sorted by mtime
- Cache invalidation after timeout
- Platform-specific path handling

// Session Parser
- Valid v1 format → ParsedSession
- Valid v2 format → ParsedSession
- Unknown format → generic fallback
- Invalid JSON → SessionParseError
- File >50MB → error

// Context Injector
- Small session → full context
- Large session → truncated
- Empty steps → sections omitted
```

### Integration Tests
```typescript
describe('State Bridge E2E', () => {
  it('discovers and parses AG sessions');
  it('injects context into messages');
  it('handles missing sessions gracefully');
  it('handles corrupted files gracefully');
});
```

### Manual Testing Checklist
- [ ] OAuth on macOS (Keychain Access)
- [ ] OAuth on Windows (Credential Manager)
- [ ] OAuth on Linux (GNOME Keyring)
- [ ] Headless deployment (no GUI)
- [ ] Large AG session (>10MB)
- [ ] Session with 100+ steps
- [ ] Token expiry and refresh

## Performance Benchmarks
| Operation | Target | Test Method |
|-----------|--------|-------------|
| Session discovery | <50ms | Jest perf test |
| Session parse | <100ms | Jest perf test |
| Context injection | <20ms | Jest perf test |

## Acceptance Criteria Verification
- `cc-mirror send --continue-from-ag` works
- Latest session auto-detected
- Context includes: goal, steps, files
- Cross-platform compatibility
- Graceful failure modes
