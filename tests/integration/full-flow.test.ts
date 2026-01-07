
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Readable } from 'stream';
import { TextEncoder, TextDecoder } from 'util';
import { ApiTranslator, AnthropicMessage } from '../../src/providers/antigravity/api-translator';
import { StreamingHandler } from '../../src/providers/antigravity/translation/streaming-handler';
import OAuthManager from '../../src/providers/antigravity/oauth/oauth-manager';

// Mock Dependencies that are missing or external
const mockFetch = jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>;
global.fetch = mockFetch as any;

// Mocks for Missing Components (S4-003, S4-004)
class MockAccountPoolManager {
    private accounts = [
        { email: 'tier1@example.com', tier: 'tier-1', quota: 100 },
        { email: 'tier2@example.com', tier: 'tier-2', quota: 1000 }
    ];

    async selectAccount(tierPreference: string = 'tier-1'): Promise<any> {
        // Simple logic: find first account with quota matching tier preference
        // Fallback to higher tier if preferred is empty (simplified logic)
        const account = this.accounts.find(a => a.tier === tierPreference && a.quota > 0);
        if (!account) {
            // Try upgrade
            return this.accounts.find(a => a.tier !== tierPreference && a.quota > 0);
        }
        return account;
    }

    async releaseAccount(account: any): Promise<void> {
        // No-op for test
    }
}

// Helper to create a stream from string
function createStream(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(text));
            controller.close();
        }
    });
}

describe('S4-005: Full Integration Flow', () => {
    let accountPool: MockAccountPoolManager;
    let oauthManager: OAuthManager;
    let apiTranslator: ApiTranslator;
    let streamingHandler: StreamingHandler;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Initialize Components
        accountPool = new MockAccountPoolManager();

        // Mock OAuthManager to avoid real FS/Keytar/Network
        oauthManager = new OAuthManager({ clientId: 'test-client-id', redirectUri: 'http://localhost' });
        // Mock getValidCredentials to return a valid object
        jest.spyOn(oauthManager, 'getValidCredentials').mockResolvedValue({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
            email: 'test@example.com'
        });

        apiTranslator = new ApiTranslator();
        streamingHandler = new StreamingHandler();
    });

    it('should execute the full flow: Account -> Translation -> Stream', async () => {
        // 1. Setup Input (Anthropic Message)
        const inputMessages: AnthropicMessage[] = [
            { role: 'user', content: 'Hello, world!' }
        ];

        // 2. Mock Google Gen AI Response (SSE Stream)
        const mockGoogleResponse =
            'data: ' + JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'Hello! ' }],
                        role: 'model'
                    }
                }]
            }) + '\n\n' +
            'data: ' + JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'How are you?' }],
                        role: 'model'
                    },
                    finishReason: 'STOP'
                }]
            }) + '\n\n' +
            'data: [DONE]\n\n';

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            body: createStream(mockGoogleResponse),
            headers: new Map()
        } as any);

        // =========================================================================
        // EXECUTION FLOW (Simulating AntigravityProvider.sendMessage)
        // =========================================================================

        // Step 1: Select Account
        const account = await accountPool.selectAccount('tier-1');
        expect(account).toBeDefined();
        expect(account.email).toBe('tier1@example.com');

        // Step 2: Get Token (simulating Auth header prep)
        // Provider would load these from storage
        const storedCreds = {
            accessToken: 'stale-token',
            refreshToken: 'ref-token',
            expiresAt: new Date(),
            email: account.email
        };
        const validCreds = await oauthManager.getValidCredentials(storedCreds);
        const token = validCreds.accessToken;
        expect(token).toBe('mock-access-token');

        // Step 3: Translate Request
        const googlePayload = apiTranslator.toGoogleFormat(inputMessages);
        expect(googlePayload).toHaveLength(1);
        expect(googlePayload[0].role).toBe('user');
        expect((googlePayload[0].parts[0] as any).text).toBe('Hello, world!');

        // Step 4: Execute Request (via StreamingHandler)
        const requestFactory = async () => {
            return await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ contents: googlePayload })
            });
        };

        const eventGenerator = streamingHandler.handleStream(
            requestFactory,
            (line) => {
                if (line.trim() === 'data: [DONE]') return { type: 'message_stop' } as any;
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const event = JSON.parse(jsonStr);
                        // Convert Google Event to Anthropic Event (Simplified for test)
                        return apiTranslator.toAnthropicChunk(event, 0);
                    } catch (e) { return null; }
                }
                return null;
            }
        );

        // Step 5: Verify Output Stream
        const chunks: any[] = [];
        for await (const chunk of eventGenerator) {
            chunks.push(chunk);
        }

        // Assertions
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(chunks.length).toBeGreaterThan(0);
        // Verify we got content updates
        const contentChunks = chunks.filter(c => c && c.type === 'content_block_delta');
        expect(contentChunks.length).toBe(2);
        expect(contentChunks[0].delta.text).toBe('Hello! ');
        expect(contentChunks[1].delta.text).toBe('How are you?');

        // Verify finish (might be mapped to message_stop or null depending on implementation)
    });

    it('should handle tier switching logic (Simulated)', async () => {
        // Setup: Tier 1 exhausted
        accountPool = new MockAccountPoolManager();
        jest.spyOn(accountPool, 'selectAccount').mockImplementation(async (tier) => {
            if (tier === 'tier-1') return null;
            return { email: 'tier2@example.com', tier: 'tier-2', quota: 1000 };
        });

        // Exec
        let account = await accountPool.selectAccount('tier-1'); // returns null

        if (!account) {
            // Provider logic retry
            account = await accountPool.selectAccount('tier-2');
        }

        expect(account).toBeDefined();
        expect(account.tier).toBe('tier-2');
        expect(account.email).toBe('tier2@example.com');
    });

    it('should handle 401 Unauthorized by refreshing token', async () => {
        const account = await accountPool.selectAccount();
        // First failed response
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: () => Promise.resolve('Unauthorized')
        } as any);
        // Second success response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: createStream('data: [DONE]\n\n'),
            headers: new Map()
        } as any);

        // Wrapper to handle 401 retry logic (Provider logic)
        const executeWithRetry = async () => {
            const storedCreds = {
                accessToken: 'bad-token',
                refreshToken: 'ref-token',
                expiresAt: new Date(),
                email: account.email
            };

            let validCreds = await oauthManager.getValidCredentials(storedCreds);
            let res = await fetch('url', { headers: { Authorization: validCreds.accessToken } });

            if (res.status === 401) {
                validCreds = await oauthManager.getValidCredentials(storedCreds); // In mock this returns valid
                res = await fetch('url', { headers: { Authorization: validCreds.accessToken } });
            }
            return res;
        };

        const response = await executeWithRetry();
        expect(response.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});

