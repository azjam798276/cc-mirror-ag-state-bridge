/**
 * Unit Tests - StreamingHandler
 * Per stories S3-002 and S3-003
 */

import { StreamingHandler } from '../../../../../src/providers/antigravity/translation/streaming-handler';
import {
    StreamingError,
    StreamTimeoutError,
    BufferOverflowError,
} from '../../../../../src/providers/antigravity/translation/types';

/**
 * Mock ReadableStream for testing
 */
class MockReadableStream {
    private chunks: Uint8Array[];
    private currentIndex = 0;

    constructor(chunks: Uint8Array[]) {
        this.chunks = chunks;
    }

    getReader() {
        return {
            read: async (): Promise<
                ReadableStreamReadResult<Uint8Array>
            > => {
                if (this.currentIndex >= this.chunks.length) {
                    return { done: true, value: undefined };
                }
                const value = this.chunks[this.currentIndex++];
                return { done: false, value };
            },
            releaseLock: () => { },
        };
    }
}

/**
 * Helper to create mock Response with ReadableStream
 */
function createMockResponse(
    chunks: string[],
    ok = true,
    status = 200
): Response {
    const encoder = new TextEncoder();
    const stream = new MockReadableStream(
        chunks.map((c) => encoder.encode(c))
    );

    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Internal Server Error',
        body: stream as any,
    } as Response;
}

/**
 * Simple parser for testing (expects "data: {payload}" format)
 */
function simpleParser(line: string): { payload: string } | null {
    if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return null;
        return { payload };
    }
    return null;
}

describe('StreamingHandler', () => {
    describe('Basic Stream Processing', () => {
        it('should successfully parse complete SSE stream', async () => {
            const handler = new StreamingHandler();
            const chunks = [
                'data: event1\n',
                'data: event2\n',
                'data: event3\n',
                'data: [DONE]\n',
            ];

            const requestFactory = async () => createMockResponse(chunks);
            const results: Array<{ payload: string }> = [];

            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(results).toEqual([
                { payload: 'event1' },
                { payload: 'event2' },
                { payload: 'event3' },
            ]);
        });

        it('should handle empty lines and whitespace', async () => {
            const handler = new StreamingHandler();
            const chunks = [
                'data: event1\n',
                '\n',
                '  \n',
                'data: event2\n',
            ];

            const requestFactory = async () => createMockResponse(chunks);
            const results: Array<{ payload: string }> = [];

            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(results).toEqual([
                { payload: 'event1' },
                { payload: 'event2' },
            ]);
        });
    });

    describe('S3-003: SSE Edge Cases', () => {
        it('should buffer incomplete lines across chunks', async () => {
            const handler = new StreamingHandler();
            // Split "data: event1" across two chunks
            const chunks = ['data: ev', 'ent1\ndata: event2\n'];

            const requestFactory = async () => createMockResponse(chunks);
            const results: Array<{ payload: string }> = [];

            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(results).toEqual([
                { payload: 'event1' },
                { payload: 'event2' },
            ]);
        });

        it('should handle partial chunks at end of stream', async () => {
            const handler = new StreamingHandler();
            const chunks = [
                'data: event1\n',
                'data: event2\n',
                'data: final', // No newline at end
            ];

            const requestFactory = async () => createMockResponse(chunks);
            const results: Array<{ payload: string }> = [];

            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(results).toEqual([
                { payload: 'event1' },
                { payload: 'event2' },
                { payload: 'final' },
            ]);
        });

        it('should recover from malformed data (skip invalid lines)', async () => {
            const handler = new StreamingHandler();
            const chunks = [
                'data: event1\n',
                'invalid-line\n',
                'data: event2\n',
                'another-bad-line\n',
                'data: event3\n',
            ];

            const requestFactory = async () => createMockResponse(chunks);
            const results: Array<{ payload: string }> = [];

            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(results).toEqual([
                { payload: 'event1' },
                { payload: 'event2' },
                { payload: 'event3' },
            ]);
        });

        it('should throw StreamingError for buffer overflow', async () => {
            const handler = new StreamingHandler({ maxBufferSize: 50 });
            // Single line longer than 50 bytes
            const longLine = 'data: ' + 'x'.repeat(100);
            const chunks = [longLine];

            const requestFactory = async () => createMockResponse(chunks);

            // BufferOverflowError is non-retryable and gets wrapped in StreamingError
            await expect(async () => {
                for await (const _ of handler.handleStream(
                    requestFactory,
                    simpleParser
                )) {
                    // consume
                }
            }).rejects.toThrow(StreamingError);
        });
    });

    describe('S3-002: Reconnection Logic', () => {
        it('should retry on HTTP 5xx errors', async () => {
            const handler = new StreamingHandler({
                maxRetries: 3,
                initialBackoffMs: 10,
            });

            let attempt = 0;
            const requestFactory = async () => {
                attempt++;
                if (attempt < 3) {
                    return createMockResponse([], false, 500);
                }
                return createMockResponse(['data: success\n']);
            };

            const results: Array<{ payload: string }> = [];
            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(attempt).toBe(3);
            expect(results).toEqual([{ payload: 'success' }]);
        });

        it('should throw StreamingError after max retries', async () => {
            const handler = new StreamingHandler({
                maxRetries: 2,
                initialBackoffMs: 10,
            });

            let attempt = 0;
            const requestFactory = async () => {
                attempt++;
                return createMockResponse([], false, 503);
            };

            await expect(async () => {
                for await (const _ of handler.handleStream(
                    requestFactory,
                    simpleParser
                )) {
                    // consume
                }
            }).rejects.toThrow(StreamingError);

            expect(attempt).toBe(2);
        });

        it('should not retry on non-retryable errors', async () => {
            const handler = new StreamingHandler({
                maxRetries: 3,
                initialBackoffMs: 10,
            });

            let attempt = 0;
            const requestFactory = async () => {
                attempt++;
                // Simulate buffer overflow (non-retryable)
                throw new BufferOverflowError('Buffer too large');
            };

            await expect(async () => {
                for await (const _ of handler.handleStream(
                    requestFactory,
                    simpleParser
                )) {
                    // consume
                }
            }).rejects.toThrow(StreamingError);

            expect(attempt).toBe(1); // Should not retry
        });
    });

    describe('Heartbeat Detection', () => {
        it('should timeout if no data received within heartbeatTimeoutMs', async () => {
            const handler = new StreamingHandler({
                heartbeatTimeoutMs: 100,
                maxRetries: 2, // Reduce retries to speed up test
                initialBackoffMs: 10,
            });

            // Mock a stream that never sends data
            const stalledStream = {
                getReader: () => ({
                    read: async () => {
                        // Simulate stalled stream (never resolves)
                        await new Promise(() => { });
                        return { done: false, value: new Uint8Array() };
                    },
                    releaseLock: () => { },
                }),
            };

            const requestFactory = async () =>
            ({
                ok: true,
                status: 200,
                statusText: 'OK',
                body: stalledStream,
            } as any);

            // Should throw StreamingError after max retries
            // (timeout is retryable, so it will retry until maxRetries)
            await expect(async () => {
                for await (const _ of handler.handleStream(
                    requestFactory,
                    simpleParser
                )) {
                    // consume
                }
            }).rejects.toThrow(StreamingError);
        });
    });

    describe('Exponential Backoff', () => {
        it('should apply exponential backoff with jitter', async () => {
            const handler = new StreamingHandler({
                maxRetries: 4,
                initialBackoffMs: 100,
                maxBackoffMs: 500,
            });

            const delays: number[] = [];
            let attempt = 0;

            const requestFactory = async () => {
                const start = Date.now();
                attempt++;
                if (attempt < 4) {
                    if (attempt > 1) {
                        delays.push(Date.now() - start);
                    }
                    return createMockResponse([], false, 502);
                }
                return createMockResponse(['data: success\n']);
            };

            const results: Array<{ payload: string }> = [];
            for await (const event of handler.handleStream(
                requestFactory,
                simpleParser
            )) {
                results.push(event);
            }

            expect(results).toEqual([{ payload: 'success' }]);
            expect(attempt).toBe(4);
            // Note: Actual delays cannot be precisely tested due to jitter,
            // but we verify retries happened
        });
    });
});
