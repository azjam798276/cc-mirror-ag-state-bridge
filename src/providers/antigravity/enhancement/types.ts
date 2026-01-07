export interface ThinkingSanitizerConfig {
    /**
     * Whether to strip thinking tags from the output.
     * @default true
     */
    stripThinking?: boolean;

    /**
     * Whether to log extracted thinking content for debugging.
     * @default false
     */
    logThinking?: boolean;
}

export interface SanitizedResponse {
    /**
     * The response text with thinking tags removed.
     */
    content: string;

    /**
     * The content that was inside the thinking tags, if any.
     */
    thinking?: string;
}

export interface ToolHardenerConfig {
    namespace?: string;
    strictMode?: boolean;
    maxRetries?: number;
}

export interface ToolSchema {
    name: string;
    description?: string;
    parameters?: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
    };
}

export interface HardenedTool {
    name: string;
    schema: ToolSchema;
    signature: string;
    namespace: string;
}

export interface ToolCallValidation {
    isValid: boolean;
    errors: string[];
    recoveryAction?: 'reject' | 'retry' | 'fallback';
}
