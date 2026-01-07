---
id: "20260107_context_integration_tests"
difficulty: "hard"
tags: ["integration", "testing", "e2e", "cross-platform", "coverage"]
tech_stack: "TypeScript, Jest, Node.js"
---

# User Story
As a QA engineer, I want comprehensive integration tests for the full context injection flow covering session discovery, parsing, injection, and API integration across all supported platforms (Linux, macOS, Windows).

# Context & Constraints

## Test Scope
Full end-to-end flow:
```
SessionDiscovery → SessionParser → ContextInjector → API Client
```

## Test Environment
- **Platforms:** Linux, macOS, Windows (GitHub Actions matrix)
- **Mock Data:** Sample AG session files in `tests/fixtures/ag-sessions/`
- **Coverage Target:** ≥90% for all state-bridge modules

## Integration Test Structure

### 1. Session Discovery Tests
```typescript
describe('SessionDiscovery Integration', () => {
  it('discovers sessions from ~/.antigravity/sessions', async () => {
    // Setup mock session files
    const sessions = await discovery.findSessions();
    expect(sessions).toHaveLength(3);
    expect(sessions[0].sessionId).toBe('latest');
  });

  it('handles missing session directory gracefully', async () => {
    // Remove session dir
    const sessions = await discovery.findSessions();
    expect(sessions).toEqual([]);
  });

  it('respects $AG_SESSION_DIR env variable', async () => {
    process.env.AG_SESSION_DIR = '/custom/path';
    // ... verify custom path is checked first
  });
});
```

### 2. Parser Integration Tests
```typescript
describe('SessionParser Integration', () => {
  it('parses real AG session format v1', async () => {
    const parsed = await parser.parse('fixtures/ag-v1-session.json');
    expect(parsed.goal).toBe('Build REST API');
    expect(parsed.completedSteps).toHaveLength(2);
  });

  it('handles corrupted JSON gracefully', async () => {
    const parsed = await parser.parse('fixtures/corrupted.json');
    expect(parsed.goal).toContain('Unknown goal');
  });

  it('extracts generic info from unknown formats', async () => {
    // Test resilient parsing
  });
});
```

### 3. Context Injection Tests
```typescript
describe('ContextInjector Integration', () => {
  it('builds valid markdown context from session', () => {
    const context = injector.buildContextMessage(mockSession);
    expect(context).toContain('## Original Goal');
    expect(context).toContain('## Completed Steps');
    expect(context).toContain('## Pending Steps');
  });

  it('injects context as system message', () => {
    const messages = [{ role: 'user', content: 'Add tests' }];
    const enhanced = injector.injectContext(messages, mockSession);
    
    expect(enhanced[0].role).toBe('system');
    expect(enhanced[0].content).toContain('CONTINUING FROM ANTIGRAVITY');
    expect(enhanced[1].role).toBe('user');
  });

  it('enforces 12.5K token budget', () => {
    const hugeSession = createHugeSession(); // 100+ steps
    const context = injector.buildContextMessage(hugeSession);
    
    const tokenCount = estimateTokens(context);
    expect(tokenCount).toBeLessThan(12500);
  });
});
```

### 4. End-to-End CLI Tests
```typescript
describe('CLI --continue-from-ag E2E', () => {
  it('loads latest session and sends to API', async () => {
    // Mock API client
    const apiMock = jest.fn();
    
    await cli.send(['--continue-from-ag', 'Add rate limiting']);
    
    expect(apiMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: 'Add rate limiting' })
      ])
    );
  });

  it('falls back gracefully when no sessions found', async () => {
    // Remove all session files
    const consoleSpy = jest.spyOn(console, 'warn');
    
    await cli.send(['--continue-from-ag', 'Test message']);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No Antigravity sessions found')
    );
  });

  it('uses specific session with --ag-session flag', async () => {
    await cli.send(['--ag-session', 'abc123', 'Continue task']);
    
    // Verify session abc123 was loaded
  });
});
```

## Cross-Platform Tests

### Platform-Specific Paths
```typescript
describe('Cross-Platform Compatibility', () => {
  const platforms = [
    { os: 'linux', path: '~/.antigravity/sessions' },
    { os: 'darwin', path: '~/Library/Application Support/Antigravity/sessions' },
    { os: 'win32', path: '%APPDATA%/Antigravity/sessions' }
  ];

  platforms.forEach(({ os, path }) => {
    it(`discovers sessions on ${os}`, () => {
      // Mock process.platform
      // Verify correct path is used
    });
  });
});
```

## Acceptance Criteria
- [ ] Integration test suite in `tests/integration/context-injection.test.ts`
- [ ] Tests cover: discovery, parsing, injection, CLI flow
- [ ] Edge cases: no sessions, corrupted JSON, permission denied, multiple sessions
- [ ] Cross-platform validation (Linux/macOS/Windows GitHub Actions)
- [ ] Coverage ≥90% for all state-bridge modules
- [ ] All tests pass with green CI status
- [ ] Test fixtures in `tests/fixtures/ag-sessions/` with sample session formats

## Performance Benchmarks
```typescript
describe('Performance', () => {
  it('discovers 100 sessions in <50ms', async () => {
    const start = Date.now();
    await discovery.findSessions();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('parses session in <100ms', async () => {
    const start = Date.now();
    await parser.parse('fixture.json');
    expect(Date.now() - start).toBeLessThan(100);
  });
});
```

# Dependencies
- All Phase 2 implementations (P2-001, P2-002, P2-003)
- Mock AG session fixtures
- GitHub Actions matrix for multi-platform CI

# Exit Criteria
- All integration tests pass locally and in CI
- Coverage report shows ≥90% for state-bridge/
- Test documentation in tests/README.md with setup instructions
- No flaky tests (3 consecutive green runs)
