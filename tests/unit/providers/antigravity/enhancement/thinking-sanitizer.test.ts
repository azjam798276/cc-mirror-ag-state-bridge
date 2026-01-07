
import { ThinkingSanitizer } from '../../../../../src/providers/antigravity/enhancement/thinking-sanitizer';

describe('ThinkingSanitizer', () => {
    describe('default configuration', () => {
        let sanitizer: ThinkingSanitizer;

        beforeEach(() => {
            sanitizer = new ThinkingSanitizer();
        });

        it('should strip thinking tags from response', () => {
            const input = '<thinking>Reasoning here</thinking>Final answer';
            const result = sanitizer.sanitize(input);
            expect(result.content).toBe('Final answer');
            expect(result.thinking).toBe('Reasoning here');
        });

        it('should handle multiline thinking blocks', () => {
            const input = `<thinking>
Line 1
Line 2
</thinking>
Response`;
            const result = sanitizer.sanitize(input);
            expect(result.content).toBe('Response');
            expect(result.thinking).toContain('Line 1');
            expect(result.thinking).toContain('Line 2');
        });

        it('should handle text without thinking tags', () => {
            const input = 'Just a response';
            const result = sanitizer.sanitize(input);
            expect(result.content).toBe('Just a response');
            expect(result.thinking).toBeUndefined();
        });

        it('should handle empty input', () => {
            const result = sanitizer.sanitize('');
            expect(result.content).toBe('');
        });

        it('should handle multiple thinking blocks', () => {
            const input = '<thinking>First</thinking>Part 1 <thinking>Second</thinking>Part 2';
            const result = sanitizer.sanitize(input);
            expect(result.content).toBe('Part 1 Part 2');
            expect(result.thinking).toContain('First');
            expect(result.thinking).toContain('Second');
        });

        it('should be case insensitive for tags', () => {
            const input = '<THINKING>LOUD</THINKING>Quiet';
            const result = sanitizer.sanitize(input);
            expect(result.content).toBe('Quiet');
            expect(result.thinking).toBe('LOUD');
        });
    });

    describe('configuration options', () => {
        it('should not strip thinking if configured false', () => {
            const sanitizer = new ThinkingSanitizer({ stripThinking: false });
            const input = '<thinking>Keep me</thinking>Response';
            const result = sanitizer.sanitize(input);
            expect(result.content).toBe(input);
            expect(result.thinking).toBe('Keep me');
        });
    });
});
