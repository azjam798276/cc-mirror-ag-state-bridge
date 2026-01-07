---
id: "jest_filesystem_mocking_patterns"
source: "cc-mirror Antigravity State Bridge TDD v1.0"
tags: ["typescript", "jest", "testing", "mocking", "qa"]
---

## Problem

Need to test SessionParser and SessionDiscovery classes without requiring real Antigravity IDE installations or creating actual filesystem structures. Tests must be fast (<100ms), isolated (no side effects), and reproducible (same results every run). Traditional filesystem operations are slow and can leave behind test debris.

## Solution

```typescript
// tests/unit/providers/antigravity/state-bridge/session-parser.test.ts

import { vol } from 'memfs';
import { SessionParser, SessionParseError, ParsedSession } from '@/providers/antigravity/state-bridge/session-parser';

// Mock fs-extra to use memfs (in-memory filesystem)
jest.mock('fs-extra', () => require('memfs').fs);

describe('SessionParser', () => {
  let parser: SessionParser;

  beforeEach(() => {
    // Reset in-memory filesystem before each test
    vol.reset();
    
    parser = new SessionParser();
  });

  afterEach(() => {
    // Cleanup (although vol.reset() in beforeEach is sufficient)
    vol.reset();
  });

  describe('parse() - Format V1', () => {
    it('should parse a valid V1 format session', async () => {
      // Arrange: Create mock session file
      const sessionPath = '/tmp/session-v1.json';
      const sessionData = {
        sessionId: 'test-123',
        initialPrompt: 'Build a REST API',
        plan: {
          steps: [
            {
              id: 'step-1',
              description: 'Design database schema',
              status: 'completed',
              files: ['schema.sql'],
              result: 'Schema created successfully'
            },
            {
              id: 'step-2',
              description: 'Implement user model',
              status: 'executing',
              files: ['models/user.ts']
            },
            {
              id: 'step-3',
              description: 'Add authentication',
              status: 'pending',
              files: []
            }
          ]
        },
        executionState: {
          currentStep: 1,
          variables: {
            DB_NAME: 'myapp_db',
            AUTH_METHOD: 'JWT'
          }
        },
        terminalHistory: ['npm install', 'npm run migrate'],
        errors: []
      };

      // Write to in-memory filesystem
      vol.fromJSON({
        [sessionPath]: JSON.stringify(sessionData)
      });

      // Act: Parse the session
      const parsed = await parser.parse(sessionPath);

      // Assert: Verify structure
      expect(parsed.sessionId).toBe('test-123');
      expect(parsed.goal).toBe('Build a REST API');
      expect(parsed.planSteps).toHaveLength(3);
      
      // Check completed steps
      expect(parsed.completedSteps).toHaveLength(1);
      expect(parsed.completedSteps.action).toBe('Design database schema');
      expect(parsed.completedSteps.status).toBe('completed');
      
      // Check pending steps
      expect(parsed.pendingSteps).toHaveLength(2);
      expect(parsed.pendingSteps.action).toBe('Implement user model');
      expect(parsed.pendingSteps.status).toBe('executing');
      
      // Check files
      expect(parsed.filesModified).toContain('schema.sql');
      expect(parsed.filesModified).toContain('models/user.ts');
      
      // Check variables
      expect(parsed.variables.DB_NAME).toBe('myapp_db');
      
      // Check terminal history
      expect(parsed.terminalHistory).toEqual(['npm install', 'npm run migrate']);
    });

    it('should handle missing optional fields gracefully', async () => {
      const sessionPath = '/tmp/minimal-session.json';
      const minimalData = {
        initialPrompt: 'Simple task',
        plan: {
          steps: [
            { id: '1', description: 'Do something', status: 'pending' }
          ]
        }
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(minimalData)
      });

      const parsed = await parser.parse(sessionPath);

      expect(parsed.sessionId).toBe('unknown'); // Default
      expect(parsed.goal).toBe('Simple task');
      expect(parsed.variables).toEqual({}); // Empty default
      expect(parsed.terminalHistory).toEqual([]);
    });

    it('should normalize various status strings', async () => {
      const sessionPath = '/tmp/status-test.json';
      const sessionData = {
        plan: {
          steps: [
            { id: '1', description: 'A', status: 'COMPLETE' },
            { id: '2', description: 'B', status: 'done' },
            { id: '3', description: 'C', status: 'in_progress' },
            { id: '4', description: 'D', status: 'running' },
            { id: '5', description: 'E', status: 'failed' },
            { id: '6', description: 'F', status: 'unknown_status' }
          ]
        }
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(sessionData)
      });

      const parsed = await parser.parse(sessionPath);

      expect(parsed.planSteps).toHaveLength(6);
      expect(parsed.planSteps[0].status).toBe('completed');
      expect(parsed.planSteps[1].status).toBe('completed');
      expect(parsed.planSteps[2].status).toBe('executing');
      expect(parsed.planSteps[3].status).toBe('executing');
      expect(parsed.planSteps[4].status).toBe('failed');
      expect(parsed.planSteps[5].status).toBe('pending'); // Unknown → pending
    });
  });

  describe('parse() - Format V2 (Future)', () => {
    it('should parse a valid V2 format session', async () => {
      const sessionPath = '/tmp/session-v2.json';
      const sessionData = {
        sessionMetadata: {
          id: 'v2-session-456',
          objective: 'Build microservice',
          currentTaskIndex: 0
        },
        agentPlan: {
          tasks: [
            {
              taskId: 'task-1',
              description: 'Setup Docker',
              state: 'completed',
              outputFiles: ['Dockerfile', 'docker-compose.yml'],
              executionResult: 'Docker setup complete'
            }
          ]
        },
        context: {
          SERVICE_NAME: 'user-service',
          PORT: 3000
        }
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(sessionData)
      });

      const parsed = await parser.parse(sessionPath);

      expect(parsed.sessionId).toBe('v2-session-456');
      expect(parsed.goal).toBe('Build microservice');
      expect(parsed.planSteps).toHaveLength(1);
      expect(parsed.variables.SERVICE_NAME).toBe('user-service');
    });
  });

  describe('parse() - Generic Fallback', () => {
    it('should extract data from unknown format using heuristics', async () => {
      const sessionPath = '/tmp/unknown-format.json';
      const unknownData = {
        metadata: {
          sessionInfo: {
            id: 'unknown-789'
          }
        },
        userRequest: 'Do something',
        workflow: {
          steps: [
            { action: 'First step' },
            { action: 'Second step' }
          ]
        },
        modifiedFiles: ['file1.ts', 'file2.ts']
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(unknownData)
      });

      const parsed = await parser.parse(sessionPath);

      // Generic parser should find these via heuristics
      expect(parsed.sessionId).toBeTruthy();
      expect(parsed.planSteps.length).toBeGreaterThan(0);
      expect(parsed.errors).toContain('Warning: Unknown session format, some data may be missing');
    });

    it('should handle deeply nested structures', async () => {
      const sessionPath = '/tmp/deep-nested.json';
      const deepData = {
        level1: {
          level2: {
            level3: {
              goal: 'Deeply nested goal',
              level4: {
                level5: {
                  goal: 'Too deep (should not be found)'
                }
              }
            }
          }
        }
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(deepData)
      });

      const parsed = await parser.parse(sessionPath);

      // Should find goal at level 3 (within max depth of 5)
      expect(parsed.goal).toBe('Deeply nested goal');
    });
  });

  describe('parse() - Error Handling', () => {
    it('should throw SessionParseError for invalid JSON', async () => {
      const sessionPath = '/tmp/invalid.json';
      
      vol.fromJSON({
        [sessionPath]: '{ invalid json syntax'
      });

      await expect(parser.parse(sessionPath)).rejects.toThrow(SessionParseError);
      await expect(parser.parse(sessionPath)).rejects.toThrow('Invalid JSON');
    });

    it('should throw SessionParseError for files exceeding size limit', async () => {
      const sessionPath = '/tmp/huge.json';
      
      // Create a mock file that appears huge (>50MB)
      // Note: memfs stat() can be mocked to return custom size
      const hugeData = { goal: 'x'.repeat(60 * 1024 * 1024) }; // 60MB of data
      
      vol.fromJSON({
        [sessionPath]: JSON.stringify(hugeData)
      });

      await expect(parser.parse(sessionPath)).rejects.toThrow(SessionParseError);
      await expect(parser.parse(sessionPath)).rejects.toThrow('too large');
    });

    it('should throw SessionParseError for non-existent files', async () => {
      const sessionPath = '/tmp/does-not-exist.json';

      await expect(parser.parse(sessionPath)).rejects.toThrow();
    });

    it('should handle empty JSON object', async () => {
      const sessionPath = '/tmp/empty.json';
      
      vol.fromJSON({
        [sessionPath]: '{}'
      });

      const parsed = await parser.parse(sessionPath);

      expect(parsed.sessionId).toBe('unknown');
      expect(parsed.goal).toBe('Unknown goal (could not parse session format)');
      expect(parsed.planSteps).toEqual([]);
    });
  });

  describe('registerFormat() - Custom Formats', () => {
    it('should allow registering custom format detectors', async () => {
      const sessionPath = '/tmp/custom-format.json';
      const customData = {
        customFormatVersion: '3.0',
        objective: 'Custom format test',
        tasks: [{ name: 'Task 1', done: true }]
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(customData)
      });

      // Register custom format
      parser.registerFormat({
        version: 'custom-v3',
        detect: (raw) => raw.customFormatVersion === '3.0',
        parse: (raw) => ({
          sessionId: 'custom',
          goal: raw.objective,
          planSteps: raw.tasks.map((t: any) => ({
            id: t.name,
            action: t.name,
            status: t.done ? 'completed' : 'pending',
            artifacts: []
          })),
          currentStep: 0,
          completedSteps: [],
          pendingSteps: [],
          filesModified: [],
          variables: {},
          terminalHistory: [],
          errors: []
        })
      });

      const parsed = await parser.parse(sessionPath);

      expect(parsed.goal).toBe('Custom format test');
      expect(parsed.planSteps[0].action).toBe('Task 1');
    });
  });

  describe('Performance Tests', () => {
    it('should parse a typical session in under 100ms', async () => {
      const sessionPath = '/tmp/perf-test.json';
      
      // Create a realistic session with 20 steps
      const sessionData = {
        initialPrompt: 'Performance test',
        plan: {
          steps: Array.from({ length: 20 }, (_, i) => ({
            id: `step-${i}`,
            description: `Step ${i}`,
            status: i < 10 ? 'completed' : 'pending',
            files: [`file${i}.ts`]
          }))
        }
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(sessionData)
      });

      const start = Date.now();
      await parser.parse(sessionPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle 100+ steps without performance degradation', async () => {
      const sessionPath = '/tmp/large-session.json';
      
      const sessionData = {
        plan: {
          steps: Array.from({ length: 150 }, (_, i) => ({
            id: `step-${i}`,
            description: `Step ${i}`,
            status: 'pending'
          }))
        }
      };

      vol.fromJSON({
        [sessionPath]: JSON.stringify(sessionData)
      });

      const start = Date.now();
      const parsed = await parser.parse(sessionPath);
      const duration = Date.now() - start;

      expect(parsed.planSteps).toHaveLength(150);
      expect(duration).toBeLessThan(200); // Still reasonably fast
    });
  });
});

// ========== TEST UTILITIES ==========

/**
 * Helper to create mock session files with predefined templates.
 */
export function createMockSession(template: 'simple' | 'complex' | 'corrupted'): any {
  switch (template) {
    case 'simple':
      return {
        goal: 'Simple task',
        plan: { steps: [{ id: '1', action: 'Do it', status: 'pending' }] }
      };

    case 'complex':
      return {
        sessionId: 'complex-123',
        initialPrompt: 'Build full-stack app',
        plan: {
          steps: [
            { id: '1', description: 'Frontend', status: 'completed', files: ['app.tsx'] },
            { id: '2', description: 'Backend', status: 'executing', files: ['server.ts'] },
            { id: '3', description: 'Database', status: 'pending', files: [] }
          ]
        },
        executionState: {
          currentStep: 1,
          variables: { ENV: 'production' }
        },
        terminalHistory: ['npm start'],
        errors: []
      };

    case 'corrupted':
      return {
        // Missing required fields
        plan: null,
        goal: undefined
      };

    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

/**
 * Custom Jest matcher to validate ParsedSession structure.
 */
expect.extend({
  toBeValidParsedSession(received: any) {
    const required = ['sessionId', 'goal', 'planSteps', 'completedSteps', 'pendingSteps'];
    const missing = required.filter(field => !(field in received));

    if (missing.length > 0) {
      return {
        pass: false,
        message: () => `Expected valid ParsedSession, but missing fields: ${missing.join(', ')}`
      };
    }

    if (!Array.isArray(received.planSteps)) {
      return {
        pass: false,
        message: () => 'Expected planSteps to be an array'
      };
    }

    return {
      pass: true,
      message: () => 'ParsedSession is valid'
    };
  }
});

// TypeScript declaration for custom matcher
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidParsedSession(): R;
    }
  }
}
```

```typescript
// tests/unit/providers/antigravity/state-bridge/session-discovery.test.ts

import { vol } from 'memfs';
import * as os from 'os';
import * as path from 'path';
import { SessionDiscovery } from '@/providers/antigravity/state-bridge/session-discovery';

jest.mock('fs-extra', () => require('memfs').fs);

describe('SessionDiscovery', () => {
  let discovery: SessionDiscovery;
  const mockHomeDir = '/home/testuser';
  const mockSessionDir = path.join(mockHomeDir, '.antigravity', 'sessions');

  beforeEach(() => {
    vol.reset();
    
    // Mock os.homedir()
    jest.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

    discovery = new SessionDiscovery({
      customPath: mockSessionDir,
      cacheTimeout: 100 // Short timeout for testing
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    vol.reset();
  });

  describe('findSessions()', () => {
    it('should return empty array when no sessions exist', async () => {
      // Create directory but no files
      vol.fromJSON({
        [mockSessionDir]: null // Creates empty directory
      });

      const sessions = await discovery.findSessions();

      expect(sessions).toEqual([]);
    });

    it('should discover session files in the directory', async () => {
      // Create mock session files with different timestamps
      const now = Date.now();
      
      vol.fromJSON({
        [`${mockSessionDir}/session-abc123.json`]: JSON.stringify({ goal: 'Test 1' }),
        [`${mockSessionDir}/session-def456.json`]: JSON.stringify({ goal: 'Test 2' }),
        [`${mockSessionDir}/not-a-session.txt`]: 'text file', // Should be ignored
      });

      const sessions = await discovery.findSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.sessionId)).toContain('abc123');
      expect(sessions.map(s => s.sessionId)).toContain('def456');
    });

    it('should sort sessions by most recent first', async () => {
      const baseTime = Date.now();

      // Manually set mtimes by writing files at different times
      vol.fromJSON({
        [`${mockSessionDir}/session-old.json`]: JSON.stringify({ goal: 'Old' }),
        [`${mockSessionDir}/session-new.json`]: JSON.stringify({ goal: 'New' }),
      });

      // Manipulate mtime (in real memfs, you'd need to actually wait or mock stat)
      // For testing purposes, we can rely on file creation order

      const sessions = await discovery.findSessions();

      // Most recent should be first (in this case, 'new' was created last)
      expect(sessions[0].sessionId).toBe('new');
      expect(sessions[1].sessionId).toBe('old');
    });

    it('should cache results for specified timeout', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-1.json`]: JSON.stringify({ goal: 'Test' }),
      });

      // First call - should scan filesystem
      const sessions1 = await discovery.findSessions();
      expect(sessions1).toHaveLength(1);

      // Add another file
      vol.fromJSON({
        [`${mockSessionDir}/session-2.json`]: JSON.stringify({ goal: 'Test 2' }),
      }, mockSessionDir); // Merge with existing

      // Second call - should return cached (doesn't see new file yet)
      const sessions2 = await discovery.findSessions();
      expect(sessions2).toHaveLength(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third call - cache expired, should see new file
      const sessions3 = await discovery.findSessions();
      expect(sessions3).toHaveLength(2);
    });

    it('should compute human-readable age strings', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-recent.json`]: JSON.stringify({ goal: 'Recent' }),
      });

      const sessions = await discovery.findSessions();

      expect(sessions[0].ageString).toMatch(/just now|second|minute/);
    });

    it('should handle permission errors gracefully', async () => {
      // Simulate directory that throws permission error
      // (memfs doesn't fully support permissions, so we'd mock fs.readdir to throw)
      
      const mockReaddir = jest.requireMock('fs-extra').readdir as jest.Mock;
      mockReaddir.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const sessions = await discovery.findSessions();

      // Should return empty, not throw
      expect(sessions).toEqual([]);
    });
  });

  describe('getLatestSession()', () => {
    it('should return most recent session', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-old.json`]: JSON.stringify({ goal: 'Old' }),
        [`${mockSessionDir}/session-new.json`]: JSON.stringify({ goal: 'New' }),
      });

      const latest = await discovery.getLatestSession();

      expect(latest).not.toBeNull();
      expect(latest!.sessionId).toBe('new');
    });

    it('should return null when no sessions exist', async () => {
      vol.fromJSON({
        [mockSessionDir]: null
      });

      const latest = await discovery.getLatestSession();

      expect(latest).toBeNull();
    });
  });

  describe('getSessionById()', () => {
    it('should find session by ID', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-target.json`]: JSON.stringify({ goal: 'Target' }),
        [`${mockSessionDir}/session-other.json`]: JSON.stringify({ goal: 'Other' }),
      });

      const session = await discovery.getSessionById('target');

      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('target');
      expect(session!.filePath).toContain('session-target.json');
    });

    it('should return null for non-existent ID', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-exists.json`]: JSON.stringify({ goal: 'Exists' }),
      });

      const session = await discovery.getSessionById('nonexistent');

      expect(session).toBeNull();
    });

    it('should handle various filename patterns', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-abc123.json`]: JSON.stringify({}),
        [`${mockSessionDir}/ag-session-def456.json`]: JSON.stringify({}),
        [`${mockSessionDir}/xyz789.json`]: JSON.stringify({}),
      });

      const session1 = await discovery.getSessionById('abc123');
      const session2 = await discovery.getSessionById('def456');
      const session3 = await discovery.getSessionById('xyz789');

      expect(session1).not.toBeNull();
      expect(session2).not.toBeNull();
      expect(session3).not.toBeNull();
    });
  });

  describe('clearCache()', () => {
    it('should invalidate cached results', async () => {
      vol.fromJSON({
        [`${mockSessionDir}/session-1.json`]: JSON.stringify({}),
      });

      // Populate cache
      await discovery.findSessions();

      // Clear cache
      discovery.clearCache();

      // Add new file
      vol.fromJSON({
        [`${mockSessionDir}/session-2.json`]: JSON.stringify({}),
      }, mockSessionDir);

      // Should see new file immediately (no cache)
      const sessions = await discovery.findSessions();
      expect(sessions).toHaveLength(2);
    });
  });
});
```

## Key Techniques

- **memfs for filesystem mocking**: The `vol` object from memfs provides an in-memory filesystem. Tests run ~10x faster than using real filesystem operations.

- **vol.reset() isolation**: Each test gets a clean filesystem state. No test can interfere with another, even if they run in parallel.

- **vol.fromJSON() for fixtures**: Create entire directory structures with one call. Much cleaner than multiple `fs.writeFile()` calls.

- **os.homedir() mocking**: Spying on `os.homedir()` ensures tests work regardless of the actual system's home directory. Critical for CI environments.

- **Custom Jest matchers**: The `toBeValidParsedSession()` matcher encapsulates validation logic. Tests become more readable: `expect(result).toBeValidParsedSession()`.

- **Template factories**: `createMockSession()` function provides pre-built test data. Reduces duplication and makes tests more maintainable.

- **Performance benchmarks**: Tests include timing assertions (`expect(duration).toBeLessThan(100)`). Catches performance regressions early.

- **Error case coverage**: Tests explicitly verify error handling (invalid JSON, missing files, size limits). Ensures robustness.

- **Cache testing**: Tests verify cache behavior by manipulating time and checking if new files are detected. Critical for correctness.

## References

- [memfs Documentation](https://github.com/streamich/memfs) - In-memory filesystem for testing
- [Jest Mocking Guide](https://jestjs.io/docs/mock-functions) - Official Jest mocking docs
- [Testing Best Practices](https://testingjavascript.com/) - Kent C. Dodds' testing principles
- [VS Code Testing Patterns](https://github.com/microsoft/vscode/tree/main/src/vs/base/test) - Real-world examples
