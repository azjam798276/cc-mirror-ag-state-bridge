/**
 * StreamingHandler - Robust SSE Stream Processing
 * Per PRD v2.0, TDD v1.0 Module 7, and stories S3-002, S3-003
 *
 * Features:
 * - Network disconnect handling with exponential backoff
 * - Heartbeat detection for stalled streams
 * - Partial chunk and incomplete line buffering
 * - Malformed data recovery
 */

import {
    StreamingConfig,
    StreamingError,
    StreamTimeoutError,
    BufferOverflowError,
} from './types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<StreamingConfig> = {
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    heartbeatTimeoutMs: 30000,
    maxBufferSize: 1048576, // 1MB
};

/**
 * StreamingHandler provides robust SSE stream processing with:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat timeout detection
 * - Partial line buffering across chunks
 * - Malformed data recovery
 *
 * Time complexity: O(n) where n = number of lines in stream
 * Space complexity: O(m) where m = size of incomplete line buffer
 */
export class StreamingHandler {
    private config: Required<StreamingConfig>;

    constructor(config: StreamingConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Handle a streaming response with automatic retry and reconnection logic.
     *
     * @param requestFactory - Function that creates a new request (for retries)
     * @param parser - Function to parse each SSE line into typed events
     * @returns AsyncGenerator yielding parsed events
     *
     * @throws {StreamingError} After all retry attempts exhausted
     * @throws {BufferOverflowError} If line buffer exceeds maxBufferSize
     */
    async *handleStream<T>(
        requestFactory: () => Promise<Response>,
        parser: (line: string) => T | null
    ): AsyncGenerator<T> {
        let attempt = 0;

        while (attempt < this.config.maxRetries) {
            try {
                // Execute request
                const response = await requestFactory();

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`
                    );
                }

                if (!response.body) {
                    throw new Error('Response body is null');
                }

                // Process stream with heartbeat detection
                yield* this.processStream(response.body, parser);

                // Stream completed successfully
                return;
            } catch (error) {
                attempt++;

                // Check if error is retryable
                if (!this.isRetryableError(error)) {
                    throw new StreamingError(
                        `Non-retryable error: ${error instanceof Error ? error.message : String(error)}`,
                        error,
                        attempt
                    );
                }

                // If max retries reached, throw
                if (attempt >= this.config.maxRetries) {
                    throw new StreamingError(
                        `Max retries (${this.config.maxRetries}) exceeded`,
                        error,
                        attempt
                    );
                }

                // Calculate backoff delay
                const backoff = this.calculateBackoff(attempt);
                await this.sleep(backoff);
            }
        }
    }

    /**
     * Process a single stream with heartbeat detection and line buffering.
     *
     * @param stream - ReadableStream from response.body
     * @param parser - Function to parse each SSE line
     * @returns AsyncGenerator yielding parsed events
     *
     * @throws {StreamTimeoutError} If no data received within heartbeatTimeoutMs
     * @throws {BufferOverflowError} If buffer exceeds maxBufferSize
     */
    private async *processStream<T>(
        stream: ReadableStream<Uint8Array>,
        parser: (line: string) => T | null
    ): AsyncGenerator<T> {
        const reader = stream.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
            while (true) {
                // Race between read and heartbeat timeout
                const result = await this.readWithTimeout(
                    reader,
                    this.config.heartbeatTimeoutMs
                );

                if (result.done) {
                    break;
                }

                // Decode chunk (stream: true handles partial UTF-8 sequences)
                buffer += decoder.decode(result.value, { stream: true });

                // Check buffer size to prevent memory exhaustion
                if (buffer.length > this.config.maxBufferSize) {
                    throw new BufferOverflowError(
                        `Buffer exceeded ${this.config.maxBufferSize} bytes`
                    );
                }

                // Split by newlines, keeping last incomplete line
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                // Process each complete line
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    const event = parser(trimmed);
                    if (event) {
                        yield event;
                    }
                }
            }

            // Flush remaining buffer
            if (buffer.trim()) {
                const event = parser(buffer.trim());
                if (event) {
                    yield event;
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Read from stream with timeout for heartbeat detection.
     *
     * @param reader - ReadableStream reader
     * @param timeoutMs - Timeout in milliseconds
     * @returns ReadableStreamReadResult
     *
     * @throws {StreamTimeoutError} If timeout is reached
     */
    private async readWithTimeout(
        reader: ReadableStreamDefaultReader<Uint8Array>,
        timeoutMs: number
    ): Promise<ReadableStreamReadResult<Uint8Array>> {
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(
                () =>
                    reject(
                        new StreamTimeoutError(
                            `No data received within ${timeoutMs}ms`
                        )
                    ),
                timeoutMs
            );
        });

        return Promise.race([reader.read(), timeout]);
    }

    /**
     * Calculate exponential backoff delay with jitter.
     *
     * @param attempt - Current retry attempt (1-indexed)
     * @returns Delay in milliseconds
     */
    private calculateBackoff(attempt: number): number {
        // Exponential backoff: initial * 2^(attempt-1)
        const exponential =
            this.config.initialBackoffMs * Math.pow(2, attempt - 1);

        // Cap at maxBackoffMs
        const capped = Math.min(exponential, this.config.maxBackoffMs);

        // Add jitter (±20%)
        const jitter = capped * 0.2 * (Math.random() - 0.5);

        return Math.floor(capped + jitter);
    }

    /**
     * Determine if error is retryable (network errors, 5xx, timeouts).
     *
     * @param error - Error to check
     * @returns true if error is retryable
     */
    private isRetryableError(error: unknown): boolean {
        if (error instanceof StreamTimeoutError) {
            return true;
        }

        if (error instanceof BufferOverflowError) {
            return false; // Don't retry buffer overflows
        }

        if (error instanceof Error) {
            const message = error.message.toLowerCase();

            // Network errors
            if (
                message.includes('network') ||
                message.includes('fetch') ||
                message.includes('econnreset') ||
                message.includes('enotfound')
            ) {
                return true;
            }

            // HTTP 5xx errors
            if (message.includes('http 5')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Sleep for specified duration.
     *
     * @param ms - Duration in milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
