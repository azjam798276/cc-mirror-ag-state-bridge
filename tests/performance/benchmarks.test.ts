
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { OAuthManager } from '../../src/providers/antigravity/oauth/oauth-manager';
import { ApiTranslator, AnthropicMessage } from '../../src/providers/antigravity/api-translator';
import { SessionDiscovery } from '../../src/providers/antigravity/state-bridge/session-discovery';
import * as fs from 'fs-extra';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as path from 'path';

// Mocks
// Mocks
jest.mock('fs-extra');

describe('Performance Benchmarks', () => {
    // Preserve performance.now
    const originalNow = global.performance?.now?.bind(global.performance) || Date.now;

    beforeAll(() => {
        if (!global.performance) {
            (global as any).performance = { now: Date.now };
        } else {
            global.performance.now = originalNow;
        }
    });

    describe('OAuth Flow Latency', () => {
        let oauthManager: OAuthManager;

        beforeEach(() => {
            oauthManager = new OAuthManager({
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                redirectUri: 'http://localhost:51121/oauth/callback'
            });
        });

        test('S5-002: OAuth URL Generation Latency (<50ms)', () => {
            // We access private method buildAuthUrl via casting to benchmark calculation overhead
            const pkce = {
                codeVerifier: 'test',
                codeChallenge: 'test',
                codeChallengeMethod: 'S256' as const
            };
            const state = 'test-state';

            const start = performance.now();

            // Generate URL multiple times to get average
            for (let i = 0; i < 100; i++) {
                (oauthManager as any).buildAuthUrl(pkce, state);
            }

            const end = performance.now();
            const avgTime = (end - start) / 100;

            console.log(`[Benchmark] OAuth URL Generation Avg: ${avgTime.toFixed(3)}ms`);
            expect(avgTime).toBeLessThan(50);
        });
    });

    describe('ApiTranslator Overhead', () => {
        let translator: ApiTranslator;
        const largeMessage: AnthropicMessage[] = [
            {
                role: 'user',
                content: 'A'.repeat(10000) // 10KB text
            },
            {
                role: 'assistant',
                content: [
                    { type: 'text', text: 'B'.repeat(5000) },
                    {
                        type: 'tool_use',
                        id: 'tool_1',
                        name: 'test_tool',
                        input: { data: 'C'.repeat(1000) }
                    }
                ]
            }
        ];

        beforeEach(() => {
            translator = new ApiTranslator();
        });

        test('S5-002: Translation Overhead (<100ms)', () => {
            const start = performance.now();

            for (let i = 0; i < 50; i++) {
                translator.toGoogleFormat(largeMessage);
            }

            const end = performance.now();
            const avgTime = (end - start) / 50;

            console.log(`[Benchmark] Translation Overhead Avg: ${avgTime.toFixed(3)}ms`);
            expect(avgTime).toBeLessThan(100);
        });
    });

    describe('Session Discovery Time', () => {
        let discovery: SessionDiscovery;

        beforeEach(() => {
            discovery = new SessionDiscovery();

            // Mock 100 session files
            const mockFiles = Array.from({ length: 100 }, (_, i) => ({
                name: `session-${i}.json`,
                isDirectory: () => false,
                isFile: () => true
            }));

            (fs.existsSync as any as jest.Mock).mockReturnValue(true);
            (fs.readdirSync as any as jest.Mock).mockReturnValue(mockFiles);
            (fs.statSync as any as jest.Mock).mockImplementation(() => ({
                mtime: new Date(Date.now() - Math.random() * 10000000),
                size: 1024 + Math.random() * 1000
            }));
        });

        test('S5-002: Session Discovery (<1s for 100 sessions)', async () => {
            const start = performance.now();

            const sessions = await discovery.findSessions();

            const end = performance.now();
            const duration = end - start;

            console.log(`[Benchmark] Discovery (100 files): ${duration.toFixed(3)}ms`);
            console.log(`[Benchmark] Sessions found: ${sessions.length}`);

            expect(sessions.length).toBe(100);
            expect(duration).toBeLessThan(1000);
        });
    });
});
