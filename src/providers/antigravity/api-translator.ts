/**
 * API Translator - Anthropic to Google Gen AI Format
 * Per PRD v2.0 and story 20260107_message_transformer
 */

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic API Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
    | { type: 'tool_result'; tool_use_id: string; content: string };

export interface AnthropicStreamEvent {
    type: 'content_block_delta' | 'message_stop' | 'error';
    index?: number;
    delta?: { type: string; text?: string };
    error?: { type: string; message: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Gen AI Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GoogleContent {
    role: 'user' | 'model';
    parts: GooglePart[];
}

export type GooglePart =
    | { text: string }
    | { functionCall: { name: string; args: unknown } }
    | { functionResponse: { name: string; response: unknown } };

export interface GoogleSystemInstruction {
    parts: Array<{ text: string }>;
}

export interface GoogleStreamEvent {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
            role?: string;
        };
        finishReason?: string;
    }>;
    error?: { code: number; message: string; status: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Translator Class
// ─────────────────────────────────────────────────────────────────────────────

export class ApiTranslator {
    /**
     * Convert Anthropic messages to Google Gen AI format.
     * Role mapping: assistant -> model
     * Time: O(n * m) where n = messages, m = content blocks
     * Space: O(n * m) for output array
     */
    toGoogleFormat(messages: AnthropicMessage[]): GoogleContent[] {
        return messages.map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: this.toParts(msg.content),
        }));
    }

    /**
     * Convert a single Google content response to Anthropic message.
     */
    fromGoogleFormat(content: GoogleContent): AnthropicMessage {
        return {
            role: content.role === 'model' ? 'assistant' : 'user',
            content: this.toAnthropicContent(content.parts),
        };
    }

    /**
     * Convert system message to Google systemInstruction format.
     */
    transformSystemMessage(system: string): GoogleSystemInstruction {
        return {
            parts: [{ text: system }],
        };
    }

    /**
     * Parse Google SSE stream and yield Anthropic-compatible stream events.
     * Handles:
     * - `data: {...}` JSON lines
     * - `data: [DONE]` end signal
     * - Partial lines across chunks
     * - UTF-8 multi-byte characters
     */
    async *parseGoogleSSE(
        stream: ReadableStream<Uint8Array>
    ): AsyncGenerator<AnthropicStreamEvent> {
        const reader = stream.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let index = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Keep last potentially incomplete line
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    if (trimmed.startsWith('data:')) {
                        const payload = trimmed.slice(5).trim();

                        if (payload === '[DONE]') {
                            yield { type: 'message_stop' };
                            return;
                        }

                        try {
                            const event: GoogleStreamEvent = JSON.parse(payload);
                            const chunk = this.toAnthropicChunk(event, index);
                            if (chunk) {
                                yield chunk;
                                index++;
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }

            // Flush remaining buffer
            if (buffer.trim()) {
                const payload = buffer.trim().replace(/^data:\s*/, '');
                if (payload && payload !== '[DONE]') {
                    try {
                        const event: GoogleStreamEvent = JSON.parse(payload);
                        const chunk = this.toAnthropicChunk(event, index);
                        if (chunk) yield chunk;
                    } catch {
                        // Ignore
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Convert a single Google stream event to Anthropic stream event.
     */
    toAnthropicChunk(
        event: GoogleStreamEvent,
        index: number
    ): AnthropicStreamEvent | null {
        if (event.error) {
            return {
                type: 'error',
                error: {
                    type: 'api_error',
                    message: event.error.message,
                },
            };
        }

        const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text !== undefined) {
            return {
                type: 'content_block_delta',
                index,
                delta: { type: 'text_delta', text },
            };
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private toParts(
        content: string | AnthropicContentBlock[]
    ): GooglePart[] {
        if (typeof content === 'string') {
            return [{ text: content }];
        }

        return content.map((block) => {
            if (block.type === 'text') {
                return { text: block.text };
            }
            if (block.type === 'tool_use') {
                return {
                    functionCall: { name: block.name, args: block.input },
                };
            }
            if (block.type === 'tool_result') {
                return {
                    functionResponse: {
                        name: block.tool_use_id,
                        response: { content: block.content },
                    },
                };
            }
            // Fallback for unknown block types
            return { text: JSON.stringify(block) };
        });
    }

    private toAnthropicContent(
        parts: GooglePart[]
    ): string | AnthropicContentBlock[] {
        // If single text part, return as string
        if (
            parts.length === 1 &&
            'text' in parts[0] &&
            !('functionCall' in parts[0])
        ) {
            return parts[0].text;
        }

        return parts.map((part) => {
            if ('text' in part) {
                return { type: 'text' as const, text: part.text };
            }
            if ('functionCall' in part) {
                return {
                    type: 'tool_use' as const,
                    id: `call_${Date.now()}`,
                    name: part.functionCall.name,
                    input: part.functionCall.args,
                };
            }
            if ('functionResponse' in part) {
                return {
                    type: 'tool_result' as const,
                    tool_use_id: part.functionResponse.name,
                    content:
                        typeof part.functionResponse.response === 'string'
                            ? part.functionResponse.response
                            : JSON.stringify(part.functionResponse.response),
                };
            }
            return { type: 'text' as const, text: '' };
        });
    }
}
