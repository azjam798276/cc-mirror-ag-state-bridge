/**
 * Translation Module Types
 * Streaming handler configuration and errors
 */

/**
 * Configuration for streaming handler retry logic.
 */
export interface StreamingConfig {
    /**
     * Maximum number of retry attempts for failed requests.
     * @default 3
     */
    maxRetries?: number;

    /**
     * Initial delay in milliseconds for exponential backoff.
     * @default 1000
     */
    initialBackoffMs?: number;

    /**
     * Maximum delay in milliseconds for exponential backoff.
     * @default 30000
     */
    maxBackoffMs?: number;

    /**
     * Timeout in milliseconds for stream heartbeat detection.
     * If no data is received within this time, the stream is considered stalled.
     * @default 30000
     */
    heartbeatTimeoutMs?: number;

    /**
     * Maximum size in bytes for the line buffer.
     * Prevents memory exhaustion from malformed streams.
     * @default 1048576 (1MB)
     */
    maxBufferSize?: number;
}

/**
 * Error thrown when streaming fails after all retries.
 */
export class StreamingError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
        public readonly attemptsMade?: number
    ) {
        super(message);
        this.name = 'StreamingError';
    }
}

/**
 * Error thrown when stream is stalled (no data received within heartbeat timeout).
 */
export class StreamTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StreamTimeoutError';
    }
}

/**
 * Error thrown when buffer size exceeds limit.
 */
export class BufferOverflowError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BufferOverflowError';
    }
}
