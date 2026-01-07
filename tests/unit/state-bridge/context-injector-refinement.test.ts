/**
 * ContextInjector Refinement Tests
 * 
 * Specifically tests the Recency-First truncation strategy.
 */

import { ContextInjector } from '../../../src/providers/antigravity/state-bridge/context-injector';
import { ParsedSession } from '../../../src/providers/antigravity/state-bridge/types';

describe('ContextInjector Refinement (Truncation)', () => {
    let injector: ContextInjector;

    beforeEach(() => {
        injector = new ContextInjector();
    });

    const createMockSession = (overrides: Partial<ParsedSession> = {}): ParsedSession => ({
        sessionId: 'test-session',
        goal: 'Test Goal',
        planSteps: [],
        currentStep: 0,
        completedSteps: [],
        pendingSteps: [],
        filesModified: ['file1.js'],
        variables: {},
        ...overrides
    });

    it('should keep the latest steps when truncated', () => {
        const manySteps = createMockSession({
            planSteps: Array(210).fill({ action: 'Action' }),
            completedSteps: Array(200).fill(null).map((_, i) => ({
                id: `c-${i}`,
                action: `Completed Step ${i} ` + 'X'.repeat(400),
                status: 'completed' as const
            })),
            pendingSteps: Array(10).fill(null).map((_, i) => ({
                id: `p-${i}`,
                action: `Pending Step ${i} ` + 'Y'.repeat(400),
                status: 'pending' as const
            }))
        });

        const message = injector.buildContextMessage(manySteps);

        expect(message.length).toBeLessThanOrEqual(50000);
        expect(message).toContain('Pending Step 9');
        expect(message).toContain('Pending Step 0');
        expect(message).toContain('Completed Step 99');
        // It should have truncated earlier steps
        expect(message).toContain('earlier steps omitted for brevity');
        expect(message).not.toContain('Completed Step 0');
    });

    it('should show "Recent Steps" header when steps are present', () => {
        const session = createMockSession({
            completedSteps: [{ id: '1', action: 'Action', status: 'completed' }]
        });
        const message = injector.buildContextMessage(session);
        expect(message).toContain('## Recent Steps');
    });

    it('should show stale session warning for sessions older than 24h', () => {
        const staleSession = createMockSession({
            timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000)
        });
        const message = injector.buildContextMessage(staleSession);
        expect(message).toContain('25 hours old');
        expect(message).toContain('Context may be outdated');
    });

    it('should show "more files" indicator when files exceed MAX_FILES_SHOWN', () => {
        const manyFiles = createMockSession({
            filesModified: Array(60).fill('file.ts')
        });
        const message = injector.buildContextMessage(manyFiles);
        expect(message).toContain('... and 10 more files');
    });

    it('should handle a minimal session with no data gracefully', () => {
        const minimalSession: ParsedSession = {
            sessionId: 'min',
            goal: '',
            planSteps: [],
            currentStep: 0,
            completedSteps: [],
            pendingSteps: [],
            filesModified: [],
            variables: {},
            timestamp: undefined
        };
        const message = injector.buildContextMessage(minimalSession);
        expect(message).toContain('# 🔄 CONTINUING FROM ANTIGRAVITY SESSION');
        expect(message).not.toContain('## Recent Steps');
        expect(message).not.toContain('## Session Variables');
    });

    it('should truncate extremely long goals', () => {
        const longGoal = createMockSession({
            goal: 'G'.repeat(6000)
        });
        const message = injector.buildContextMessage(longGoal);
        expect(message).toContain('... (truncated)');
        expect(message.length).toBeLessThan(7000);
    });

    it('should apply final safety truncation if message exceeds MAX_CONTEXT_CHARS', () => {
        const massiveVariables = createMockSession({
            variables: { data: 'X'.repeat(60000) }
        });
        const message = injector.buildContextMessage(massiveVariables);
        expect(message.length).toBeLessThanOrEqual(50000);
        expect(message).toContain('truncated to fit model budget');
    });
});
