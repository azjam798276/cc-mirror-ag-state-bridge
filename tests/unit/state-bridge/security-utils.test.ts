import { SecurityUtils } from '../../../src/providers/antigravity/state-bridge/security-utils';
import * as path from 'path';

describe('SecurityUtils', () => {
    describe('scrub', () => {
        it('should redact bearer tokens', () => {
            const input = 'Authorization: Bearer ya29.a0AfH6SM...longtoken...substring';
            const output = SecurityUtils.scrub(input);
            expect(output).toContain('Authorization: Bearer [REDACTED]');
            expect(output).not.toContain('ya29');
        });

        it('should redact email addresses', () => {
            const input = 'Contact me at alice.smith@example.com for info';
            const output = SecurityUtils.scrub(input);
            expect(output).toContain('Contact me at [EMAIL_REDACTED] for info');
        });

        it('should redact sensitive local paths', () => {
            const input = 'The file is at /home/kasm-user/workspace/secret.txt';
            const output = SecurityUtils.scrub(input);
            expect(output).toContain('The file is at [PATH_REDACTED]');
        });

        it('should handle multi-line text with multiple secrets', () => {
            const input = `
                User: bob@company.org
                Path: /Users/bob/project
                Secret: abcdef1234567890abcdef1234567890abc
            `;
            const output = SecurityUtils.scrub(input);
            expect(output).toContain('[EMAIL_REDACTED]');
            expect(output).toContain('[PATH_REDACTED]');
            expect(output).toContain('Secret: [REDACTED]');
        });
    });

    describe('isPathSafe', () => {
        const baseDir = '/home/user/.antigravity/sessions';

        it('should approve paths inside authorized base', () => {
            const target = path.join(baseDir, 'session-123.json');
            expect(SecurityUtils.isPathSafe(target, [baseDir])).toBe(true);
        });

        it('should reject paths outside authorized base (traversal)', () => {
            const target = path.join(baseDir, '../../../etc/passwd');
            expect(SecurityUtils.isPathSafe(target, [baseDir])).toBe(false);
        });

        it('should reject unrelated paths', () => {
            const target = '/tmp/malicious.json';
            expect(SecurityUtils.isPathSafe(target, [baseDir])).toBe(false);
        });

        it('should handle multiple authorized bases', () => {
            const base2 = '/config/ag';
            const target = '/config/ag/test.json';
            expect(SecurityUtils.isPathSafe(target, [baseDir, base2])).toBe(true);
        });
    });
});
