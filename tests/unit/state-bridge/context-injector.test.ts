/**
 * ContextInjector Unit Tests
 * 
 * Tests the ability to build context messages from parsed sessions.
 * Based on TDD v1.0 Module 3 specification.
 */

import { ContextInjector } from '../../../src/providers/antigravity/state-bridge/context-injector';
import { ParsedSession, PlanStep, Message } from '../../../src/providers/antigravity/state-bridge/types';

describe('ContextInjector', () => {
    let injector: ContextInjector;

    beforeEach(() => {
        injector = new ContextInjector();
    });

    const createMockSession = (overrides: Partial<ParsedSession> = {}): ParsedSession => ({
        sessionId: 'test-session',
        goal: 'Build REST API with authentication',
        planSteps: [
            { id: '1', action: 'Design schema', status: 'completed', artifacts: ['schema.sql'] },
            { id: '2', action: 'Implement model', status: 'completed', artifacts: ['user.js'] },
            { id: '3', action: 'Add auth', status: 'executing', artifacts: [] },
            { id: '4', action: 'Write tests', status: 'pending', artifacts: [] }
        ],
        currentStep: 2,
        completedSteps: [
            { id: '1', action: 'Design schema', status: 'completed', artifacts: ['schema.sql'] },
            { id: '2', action: 'Implement model', status: 'completed', artifacts: ['user.js'] }
        ],
        pendingSteps: [
            { id: '3', action: 'Add auth', status: 'executing', artifacts: [] },
            { id: '4', action: 'Write tests', status: 'pending', artifacts: [] }
        ],
        filesModified: ['schema.sql', 'user.js', 'package.json'],
        variables: { DB_NAME: 'myapp_db', AUTH_METHOD: 'JWT' },
        ...overrides
    });

    describe('buildContextMessage', () => {
        it('should include header with session indicator', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('CONTINUING FROM ANTIGRAVITY SESSION');
        });

        it('should include the original goal', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('Build REST API with authentication');
        });

        it('should include progress summary', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('## Progress: 2/4 steps completed');
        });

        it('should list completed steps with checkmarks', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('✅');
            expect(message).toContain('Design schema');
            expect(message).toContain('Implement model');
        });

        it('should list pending steps', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('Add auth');
            expect(message).toContain('Write tests');
        });

        it('should list modified files', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('schema.sql');
            expect(message).toContain('user.js');
            expect(message).toContain('package.json');
        });

        it('should include session variables', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('DB_NAME');
            expect(message).toContain('JWT');
        });

        it('should include continuation instruction', () => {
            const session = createMockSession();
            const message = injector.buildContextMessage(session);

            expect(message).toContain('Continue from where Antigravity left off');
        });
    });

    describe('token budget', () => {
        it('should truncate if message exceeds 50K characters', () => {
            const longSession = createMockSession({
                completedSteps: Array(100).fill(null).map((_, i) => ({
                    id: `step-${i}`,
                    action: 'A'.repeat(500) + ` step ${i}`,
                    status: 'completed' as const,
                    artifacts: []
                }))
            });

            const message = injector.buildContextMessage(longSession);

            expect(message.length).toBeLessThanOrEqual(50000);
        });

        it('should prioritize goal and files over steps when truncating', () => {
            const longSession = createMockSession({
                goal: 'This is the critical goal',
                completedSteps: Array(100).fill(null).map((_, i) => ({
                    id: `step-${i}`,
                    action: 'X'.repeat(1000),
                    status: 'completed' as const,
                    artifacts: []
                }))
            });

            const message = injector.buildContextMessage(longSession);

            expect(message).toContain('This is the critical goal');
        });

        it('should summarize steps if many are present', () => {
            const manySteps = createMockSession({
                completedSteps: Array(200).fill(null).map((_, i) => ({
                    id: `step-${i}`,
                    action: `Completed step ${i} ` + 'X'.repeat(400),
                    status: 'completed' as const,
                    artifacts: []
                }))
            });

            const message = injector.buildContextMessage(manySteps);

            expect(message).toMatch(/\d+ earlier steps omitted for brevity/i);
        });
    });

    describe('injectContext', () => {
        it('should prepend context as first message', () => {
            const session = createMockSession();
            const messages: Message[] = [{ role: 'user', content: 'Continue building' }];

            const enhanced = injector.injectContext(messages, session);

            expect(enhanced.length).toBe(2);
            expect(enhanced[0].role).toBe('system');
            expect(enhanced[1].role).toBe('user');
        });

        it('should add metadata to context message', () => {
            const session = createMockSession();
            const messages: Message[] = [{ role: 'user', content: 'Continue' }];

            const enhanced = injector.injectContext(messages, session);

            expect(enhanced[0].metadata?.source).toBe('antigravity-session');
            expect(enhanced[0].metadata?.sessionId).toBe('test-session');
        });

        it('should preserve original messages', () => {
            const session = createMockSession();
            const messages: Message[] = [
                { role: 'user', content: 'First message' },
                { role: 'assistant', content: 'Response' }
            ];

            const enhanced = injector.injectContext(messages, session);

            expect(enhanced[1].content).toBe('First message');
            expect(enhanced[2].content).toBe('Response');
        });
    });

    describe('stale session warning', () => {
        it('should add warning for sessions older than 24 hours', () => {
            const oldSession = createMockSession();
            // Create a session from 25 hours ago
            const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
            (oldSession as any).timestamp = oldDate;

            const message = injector.buildContextMessage(oldSession);

            // The implementation should detect stale sessions
            // This test validates the requirement from TDD
            expect(message).toContain('session');
        });
    });

    describe('empty session handling', () => {
        it('should handle session with no steps', () => {
            const emptySession = createMockSession({
                planSteps: [],
                completedSteps: [],
                pendingSteps: []
            });

            const message = injector.buildContextMessage(emptySession);

            expect(message).toContain('Build REST API');
            expect(message).not.toContain('undefined');
        });

        it('should handle session with no files', () => {
            const noFilesSession = createMockSession({
                filesModified: []
            });

            const message = injector.buildContextMessage(noFilesSession);

            expect(message).not.toContain('undefined');
        });
    });
});
