import { ContextInjector } from '../../../src/providers/antigravity/state-bridge/context-injector';
import { ParsedSession } from '../../../src/providers/antigravity/state-bridge/types';

describe('ContextInjector Security', () => {
    let injector: ContextInjector;

    beforeEach(() => {
        injector = new ContextInjector();
    });

    const createMockSession = (variables: Record<string, any>): ParsedSession => ({
        sessionId: 'test-session',
        goal: 'Goal with secret Bearer ya29.a0AfH6SM-token-that-is-at-least-thirty-two-characters-long',
        planSteps: [],
        currentStep: 0,
        completedSteps: [],
        pendingSteps: [],
        filesModified: [],
        variables,
        timestamp: new Date()
    });

    it('should scrub secrets from the session goal', () => {
        const session = createMockSession({});
        const message = injector.buildContextMessage(session);
        expect(message).toContain('Goal with secret Bearer [REDACTED]');
        expect(message).not.toContain('ya29');
    });

    it('should scrub secrets from session variables', () => {
        const session = createMockSession({
            API_KEY: 'secret: key-12345678901234567890123456789012',
            USER_EMAIL: 'bob@example.com',
            CLIENT_ID: 'client-123'
        });
        const message = injector.buildContextMessage(session);

        expect(message).toContain('"API_KEY": "secret: [REDACTED]"');
        expect(message).toContain('"USER_EMAIL": "[EMAIL_REDACTED]"');
        expect(message).toContain('"CLIENT_ID": "client-123"'); // Should not redact short non-secret strings
        expect(message).not.toContain('1234567890');
        expect(message).not.toContain('bob@example.com');
    });

    it('should scrub secrets in truncated messages', () => {
        const manySteps = createMockSession({});
        manySteps.completedSteps = Array(200).fill(null).map((_, i) => ({
            id: `c-${i}`,
            action: `Step ${i} ` + 'X'.repeat(400),
            status: 'completed' as const
        }));

        const message = injector.buildContextMessage(manySteps);
        expect(message).toContain('Goal with secret Bearer [REDACTED]');
        expect(message).toContain('earlier steps omitted for brevity');
    });
});
