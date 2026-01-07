/**
 * Integration Tests: OAuth Token Acquisition Flow
 *
 * Tests the complete OAuth 2.0 + PKCE flow from startAuthFlow() to credential return.
 * Uses mocked fetch for Google API responses and real HTTP for callback simulation.
 */

import * as http from 'http';
import { OAuthManager, OAuthCredentials } from '../../../src/providers/antigravity/oauth/oauth-manager';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OAuth Token Acquisition', () => {
    let manager: OAuthManager;
    const TEST_PORT = 19876;
    const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    const TEST_CLIENT_SECRET = 'test-client-secret';

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new OAuthManager({
            clientId: TEST_CLIENT_ID,
            clientSecret: TEST_CLIENT_SECRET,
            redirectUri: `http://localhost:${TEST_PORT}/callback`,
            scopes: ['openid', 'email', 'profile'],
            tokenRefreshBufferMs: 5 * 60 * 1000,
        });
    });

    afterEach(async () => {
        // Cleanup: force close any lingering server
        (manager as any).cleanup?.();
    });

    describe('startAuthFlow()', () => {
        it('should emit auth:url with correct PKCE parameters', async () => {
            const urlPromise = new Promise<string>((resolve) => {
                manager.on('auth:url', resolve);
            });

            // Start auth flow but don't await (we just want the URL)
            const authPromise = manager.startAuthFlow();

            const authUrl = await urlPromise;
            const url = new URL(authUrl);

            expect(url.origin).toBe('https://accounts.google.com');
            expect(url.pathname).toBe('/o/oauth2/v2/auth');
            expect(url.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
            expect(url.searchParams.get('redirect_uri')).toBe(`http://localhost:${TEST_PORT}/callback`);
            expect(url.searchParams.get('response_type')).toBe('code');
            expect(url.searchParams.get('code_challenge_method')).toBe('S256');
            expect(url.searchParams.get('code_challenge')).toBeTruthy();
            expect(url.searchParams.get('state')).toBeTruthy();
            expect(url.searchParams.get('access_type')).toBe('offline');

            // Cleanup the promise to avoid timeout
            (manager as any).cleanup();
        });

        it('should exchange code for tokens on successful callback', async () => {
            // Setup mock responses
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        access_token: 'mock-access-token',
                        refresh_token: 'mock-refresh-token',
                        expires_in: 3600,
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        email: 'user@example.com',
                    }),
                });

            let capturedState = '';
            manager.on('auth:url', (url: string) => {
                const parsed = new URL(url);
                capturedState = parsed.searchParams.get('state') || '';
            });

            const authPromise = manager.startAuthFlow();

            // Wait for server to be ready
            await new Promise((r) => setTimeout(r, 100));

            // Simulate callback from Google
            await simulateCallback(TEST_PORT, 'fake-auth-code', capturedState);

            const credentials = await authPromise;

            expect(credentials.accessToken).toBe('mock-access-token');
            expect(credentials.refreshToken).toBe('mock-refresh-token');
            expect(credentials.email).toBe('user@example.com');
            expect(credentials.expiresAt).toBeInstanceOf(Date);
            expect(credentials.expiresAt.getTime()).toBeGreaterThan(Date.now());

            // Verify PKCE was used in token exchange
            expect(mockFetch).toHaveBeenCalledWith(
                'https://oauth2.googleapis.com/token',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('code_verifier='),
                }),
            );
        });

        it('should include client_secret in token exchange when provided', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        access_token: 'token',
                        refresh_token: 'refresh',
                        expires_in: 3600,
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ email: 'test@test.com' }),
                });

            let state = '';
            manager.on('auth:url', (url: string) => {
                state = new URL(url).searchParams.get('state') || '';
            });

            const authPromise = manager.startAuthFlow();
            await new Promise((r) => setTimeout(r, 100));
            await simulateCallback(TEST_PORT, 'code', state);
            await authPromise;

            const tokenCall = mockFetch.mock.calls.find(
                (call) => call[0] === 'https://oauth2.googleapis.com/token',
            );
            expect(tokenCall?.[1]?.body).toContain(`client_secret=${TEST_CLIENT_SECRET}`);
        });
    });
});

/**
 * Helper to simulate the OAuth callback by making an HTTP request to the local server.
 */
async function simulateCallback(port: number, code: string, state: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: 'localhost',
                port,
                path: `/callback?code=${code}&state=${state}`,
                method: 'GET',
            },
            (res) => {
                res.on('data', () => { });
                res.on('end', () => resolve());
            },
        );
        req.on('error', reject);
        req.end();
    });
}
