/**
 * Unit tests for ApiTranslator
 * Per story 20260107_message_transformer and 20260107_streaming_handler
 */
import {
    ApiTranslator,
    type AnthropicMessage,
    type GoogleContent,
    type GoogleStreamEvent,
} from '../../src/providers/antigravity/api-translator';

describe('ApiTranslator', () => {
    const translator = new ApiTranslator();

    describe('toGoogleFormat', () => {
        it('should map user role correctly', () => {
            const messages: AnthropicMessage[] = [
                { role: 'user', content: 'Hello' },
            ];
            const result = translator.toGoogleFormat(messages);

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe('user');
            expect(result[0].parts).toEqual([{ text: 'Hello' }]);
        });

        it('should map assistant to model', () => {
            const messages: AnthropicMessage[] = [
                { role: 'assistant', content: 'Hi there' },
            ];
            const result = translator.toGoogleFormat(messages);

            expect(result[0].role).toBe('model');
        });

        it('should handle text content blocks', () => {
            const messages: AnthropicMessage[] = [
                {
                    role: 'user',
                    content: [{ type: 'text', text: 'Block text' }],
                },
            ];
            const result = translator.toGoogleFormat(messages);

            expect(result[0].parts).toEqual([{ text: 'Block text' }]);
        });

        it('should convert tool_use to functionCall', () => {
            const messages: AnthropicMessage[] = [
                {
                    role: 'assistant',
                    content: [
                        {
                            type: 'tool_use',
                            id: 'call_123',
                            name: 'get_weather',
                            input: { city: 'SF' },
                        },
                    ],
                },
            ];
            const result = translator.toGoogleFormat(messages);

            expect(result[0].parts[0]).toEqual({
                functionCall: { name: 'get_weather', args: { city: 'SF' } },
            });
        });

        it('should convert tool_result to functionResponse', () => {
            const messages: AnthropicMessage[] = [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: 'call_123',
                            content: '72°F',
                        },
                    ],
                },
            ];
            const result = translator.toGoogleFormat(messages);

            expect(result[0].parts[0]).toEqual({
                functionResponse: {
                    name: 'call_123',
                    response: { content: '72°F' },
                },
            });
        });
    });

    describe('fromGoogleFormat', () => {
        it('should map model to assistant', () => {
            const content: GoogleContent = {
                role: 'model',
                parts: [{ text: 'Response' }],
            };
            const result = translator.fromGoogleFormat(content);

            expect(result.role).toBe('assistant');
            expect(result.content).toBe('Response');
        });

        it('should preserve user role', () => {
            const content: GoogleContent = {
                role: 'user',
                parts: [{ text: 'Query' }],
            };
            const result = translator.fromGoogleFormat(content);

            expect(result.role).toBe('user');
        });

        it('should return content blocks for multi-part', () => {
            const content: GoogleContent = {
                role: 'model',
                parts: [
                    { text: 'Part 1' },
                    { functionCall: { name: 'fn', args: {} } },
                ],
            };
            const result = translator.fromGoogleFormat(content);

            expect(Array.isArray(result.content)).toBe(true);
            expect((result.content as any)[0].type).toBe('text');
            expect((result.content as any)[1].type).toBe('tool_use');
        });
    });

    describe('transformSystemMessage', () => {
        it('should wrap system text in parts array', () => {
            const result = translator.transformSystemMessage('You are helpful');

            expect(result).toEqual({
                parts: [{ text: 'You are helpful' }],
            });
        });
    });

    describe('toAnthropicChunk', () => {
        it('should convert text delta', () => {
            const event: GoogleStreamEvent = {
                candidates: [
                    {
                        content: { parts: [{ text: 'Hello' }] },
                    },
                ],
            };
            const result = translator.toAnthropicChunk(event, 0);

            expect(result).toEqual({
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'Hello' },
            });
        });

        it('should convert error events', () => {
            const event: GoogleStreamEvent = {
                error: { code: 400, message: 'Bad request', status: 'INVALID' },
            };
            const result = translator.toAnthropicChunk(event, 0);

            expect(result?.type).toBe('error');
            expect(result?.error?.message).toBe('Bad request');
        });

        it('should return null for empty candidates', () => {
            const event: GoogleStreamEvent = { candidates: [] };
            const result = translator.toAnthropicChunk(event, 0);

            expect(result).toBeNull();
        });
    });

    describe('parseGoogleSSE', () => {
        function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
            const encoder = new TextEncoder();
            return new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(encoder.encode(chunk));
                    }
                    controller.close();
                },
            });
        }

        it('should parse single data line', async () => {
            const stream = makeStream([
                'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}\n',
            ]);
            const events: any[] = [];

            for await (const event of translator.parseGoogleSSE(stream)) {
                events.push(event);
            }

            expect(events).toHaveLength(1);
            expect(events[0].delta?.text).toBe('Hi');
        });

        it('should emit message_stop on [DONE]', async () => {
            const stream = makeStream([
                'data: {"candidates":[{"content":{"parts":[{"text":"X"}]}}]}\n',
                'data: [DONE]\n',
            ]);
            const events: any[] = [];

            for await (const event of translator.parseGoogleSSE(stream)) {
                events.push(event);
            }

            expect(events).toHaveLength(2);
            expect(events[1].type).toBe('message_stop');
        });

        it('should handle partial lines across chunks', async () => {
            const stream = makeStream([
                'data: {"candidates":[{"content":{"parts":[{"te',
                'xt":"Split"}]}}]}\n',
            ]);
            const events: any[] = [];

            for await (const event of translator.parseGoogleSSE(stream)) {
                events.push(event);
            }

            expect(events).toHaveLength(1);
            expect(events[0].delta?.text).toBe('Split');
        });
    });

    // -------------------------------------------------------------------------
    // System Message Tests (S3-001)
    // -------------------------------------------------------------------------
    describe('transformSystemMessage - multiline', () => {
        it('should handle multi-line system messages', () => {
            const systemText = 'You are helpful.\nBe concise.';
            const result = translator.transformSystemMessage(systemText);
            
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].text).toBe(systemText);
        });

        it('should preserve empty system messages', () => {
            const result = translator.transformSystemMessage('');
            expect(result.parts[0].text).toBe('');
        });
    });

    //-------------------------------------------------------------------------
    // Content Block Edge Cases (S3-001)
    // -------------------------------------------------------------------------
    describe('toGoogleFormat - mixed blocks', () => {
        it('should handle mixed text and tool_use', () => {
            const messages: AnthropicMessage[] = [{
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Checking...' },
                    { type: 'tool_use', id: 'c1', name: 'search', input: { q: 'test' } },
                ],
            }];
            
            const result = translator.toGoogleFormat(messages);
            expect(result[0].parts).toHaveLength(2);
        });

        it('should handle empty content array', () => {
            const messages: AnthropicMessage[] = [{ role: 'user', content: [] }];
            const result = translator.toGoogleFormat(messages);
            expect(result[0].parts).toEqual([]);
        });
    });
});
